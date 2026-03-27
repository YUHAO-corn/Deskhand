/**
 * useAgentEvents - Agent 事件订阅 Hook
 *
 * 核心职责：
 * 1. 订阅 IPC 事件（window.electronAPI.onAgentEvent）
 * 2. 按事件类型更新对应的 atoms
 * 3. 管理消息的创建、更新、流式追加
 *
 * 数据流：
 * IPC Event → useAgentEvents → Atoms → UI Components
 */

import { useEffect, useCallback, useRef } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import type { AgentEvent, Message } from '@deskhand/core';
import { generateMessageId, messageToStored } from '@deskhand/core';
import {
  sessionMessagesFamily,
  sessionProcessingFamily,
  permissionRequestAtom,
  sessionMetaMapAtom,
  sessionIdsAtom,
  memoryOnlySessionsAtom,
  sessionArtifactsFamily,
  artifactPanelOpenAtom,
  selectedArtifactAtom,
  workingDirectoryAtom,
} from '../atoms/sessions';

/**
 * Hook 参数
 */
export interface UseAgentEventsOptions {
  sessionId: string;
  enabled?: boolean;
}

function resolveArtifactPath(filePath: string, workingDirectory: string | null): string {
  if (!workingDirectory) return filePath;
  if (!filePath.startsWith('/')) {
    return `${workingDirectory}/${filePath}`;
  }
  if (!filePath.startsWith(workingDirectory)) {
    // SDK paths like "/hello.html" are relative to cwd with leading slash
    return `${workingDirectory}${filePath}`;
  }
  return filePath;
}

/** Known artifact file extensions (binary + renderable) */
const ARTIFACT_EXTENSIONS = new Set([
  'html', 'htm', 'md', 'markdown', 'mdx',
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp',
  'xlsx', 'xls', 'docx',
]);

/**
 * Extract file paths from Bash tool result text.
 * Looks for absolute paths or relative paths ending with known artifact extensions.
 */
function extractFilePathsFromBashResult(text: string, workingDirectory: string | null): string[] {
  if (!text) return [];
  // Match paths like /path/to/file.xlsx, ./file.xlsx, "file.xlsx", 'output.docx'
  const pathRegex = /(?:["']?)(\/?(?:[\w./-]+\/)?[\w.-]+\.(\w+))(?:["']?)/g;
  const paths: string[] = [];
  let match;
  while ((match = pathRegex.exec(text)) !== null) {
    const rawPath = match[1]!;
    const ext = match[2]!.toLowerCase();
    if (!ARTIFACT_EXTENSIONS.has(ext)) continue;
    // Resolve to absolute path
    const resolved = rawPath.startsWith('/') ? rawPath : resolveArtifactPath(rawPath, workingDirectory);
    if (!paths.includes(resolved)) {
      paths.push(resolved);
    }
  }
  return paths;
}

/**
 * Agent 事件订阅 Hook
 */
export function useAgentEvents({ sessionId, enabled = true }: UseAgentEventsOptions) {
  // ─── Atom Setters ───
  const setMessages = useSetAtom(sessionMessagesFamily(sessionId));
  const setProcessing = useSetAtom(sessionProcessingFamily(sessionId));
  const setPermissionRequest = useSetAtom(permissionRequestAtom);
  const setSessionMetaMap = useSetAtom(sessionMetaMapAtom);
  const setSessionIds = useSetAtom(sessionIdsAtom);
  const memoryOnlySessions = useAtomValue(memoryOnlySessionsAtom);
  const setArtifacts = useSetAtom(sessionArtifactsFamily(sessionId));
  const setArtifactPanelOpen = useSetAtom(artifactPanelOpenAtom);
  const setSelectedArtifact = useSetAtom(selectedArtifactAtom);
  const workingDirectory = useAtomValue(workingDirectoryAtom);

  // Track the current streaming message ID
  const streamingMessageIdRef = useRef<string | null>(null);

  // ─── rAF throttle for text_delta batching ───
  const pendingDeltaRef = useRef<string>('');
  const rafIdRef = useRef<number | null>(null);

  // ─── Persistence helper ───
  const persistMessage = useCallback((msg: Message) => {
    // Don't persist for memory-only sessions (not yet on disk)
    if (memoryOnlySessions.has(sessionId)) return;
    window.electronAPI?.appendMessage(sessionId, messageToStored(msg)).catch((err) => {
      console.error('[useAgentEvents] persist error:', err);
    });
  }, [sessionId, memoryOnlySessions]);

  const updateMeta = useCallback((updates: { lastMessageAt?: number; preview?: string }) => {
    if (memoryOnlySessions.has(sessionId)) return;
    // Update atoms
    setSessionMetaMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(sessionId);
      if (existing) {
        next.set(sessionId, { ...existing, ...updates });
      }
      return next;
    });
    // Move to top of list
    setSessionIds((prev) => {
      if (prev[0] === sessionId) return prev;
      const filtered = prev.filter((id) => id !== sessionId);
      return [sessionId, ...filtered];
    });
    // Persist to disk
    window.electronAPI?.updateSessionMeta(sessionId, updates).catch((err) => {
      console.error('[useAgentEvents] updateMeta error:', err);
    });
  }, [sessionId, memoryOnlySessions, setSessionMetaMap, setSessionIds]);

  // ─── 事件处理器 ───
  const handleEvent = useCallback((eventSessionId: string, event: AgentEvent) => {
    // 只处理当前 session 的事件
    if (eventSessionId !== sessionId) return;

    // 根据事件类型分别处理
    switch (event.type) {
      // ─── 文本流式事件（rAF 节流） ───
      case 'text_delta': {
        pendingDeltaRef.current += event.text;
        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            const batch = pendingDeltaRef.current;
            if (!batch) return;
            pendingDeltaRef.current = '';

            setMessages((prev) => {
              const messageId = streamingMessageIdRef.current;
              const existingIdx = messageId
                ? prev.findIndex((m) => m.id === messageId)
                : -1;

              if (existingIdx >= 0) {
                const updated = [...prev];
                const existing = updated[existingIdx]!;
                updated[existingIdx] = {
                  ...existing,
                  content: existing.content + batch,
                };
                return updated;
              } else {
                const newId = generateMessageId();
                streamingMessageIdRef.current = newId;
                const newMessage: Message = {
                  id: newId,
                  role: 'assistant',
                  content: batch,
                  timestamp: Date.now(),
                  isStreaming: true,
                  isPending: true,
                  turnId: event.turnId,
                };
                return [...prev, newMessage];
              }
            });
          });
        }
        break;
      }

      case 'text_complete': {
        // Flush any pending rAF delta before finalizing
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        pendingDeltaRef.current = '';

        setMessages((prev) => {
          const messageId = streamingMessageIdRef.current;
          if (!messageId) {
            // No streaming message, create a complete one
            const newMessage: Message = {
              id: generateMessageId(),
              role: 'assistant',
              content: event.text,
              timestamp: Date.now(),
              isStreaming: false,
              isIntermediate: event.isIntermediate,
              turnId: event.turnId,
            };
            // Persist the complete message
            persistMessage(newMessage);
            return [...prev, newMessage];
          }

          // Update existing streaming message
          const updated = prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content: event.text, // Replace with complete text
                  isStreaming: false,
                  isPending: false,
                  isIntermediate: event.isIntermediate,
                }
              : m
          );
          // Persist the finalized message
          const finalMsg = updated.find((m) => m.id === messageId);
          if (finalMsg) persistMessage(finalMsg);
          streamingMessageIdRef.current = null;
          return updated;
        });
        break;
      }

      // ─── 工具事件 ───
      case 'tool_start': {
        const toolNameLower = event.toolName?.toLowerCase() ?? '';
        const isFileTool = toolNameLower === 'write' || toolNameLower === 'edit';
        let resolvedFilePath: string | null = null;

        let toolInput = event.input;
        if (isFileTool && event.input?.file_path) {
          resolvedFilePath = resolveArtifactPath(String(event.input.file_path), workingDirectory);
          toolInput = {
            ...event.input,
            file_path_resolved: resolvedFilePath,
          };
        }

        const toolMessage: Message = {
          id: generateMessageId(),
          role: 'tool',
          content: '',
          timestamp: Date.now(),
          toolName: event.toolName,
          toolUseId: event.toolUseId,
          toolInput,
          toolStatus: 'executing',
          turnId: event.turnId,
          toolIntent: event.intent,
          toolDisplayName: event.displayName,
          parentToolUseId: event.parentToolUseId,
        };
        setMessages((prev) => [...prev, toolMessage]);
        persistMessage(toolMessage);

        // Capture file artifacts from Write/Edit tools
        if (resolvedFilePath) {
          setArtifacts((prev) => {
            const filtered = prev.filter((p) => p !== resolvedFilePath);
            const updated = [...filtered, resolvedFilePath];
            // Persist artifacts to session metadata
            if (!memoryOnlySessions.has(sessionId)) {
              window.electronAPI?.updateSessionMeta(sessionId, { artifacts: updated }).catch(() => {});
            }
            return updated;
          });
          setSelectedArtifact(resolvedFilePath);
          setArtifactPanelOpen(true);
        }
        break;
      }

      case 'tool_result': {
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.toolUseId === event.toolUseId
              ? {
                  ...m,
                  toolResult: event.result,
                  toolStatus: (event.isError ? 'error' : 'completed') as import('@deskhand/core').ToolStatus,
                }
              : m
          );
          // Persist the updated tool message
          const updatedMsg = updated.find((m) => m.toolUseId === event.toolUseId);
          if (updatedMsg) persistMessage(updatedMsg);
          return updated;
        });

        // A2UI: detect render_playground result and open in Artifact panel
        if (!event.isError && event.result) {
          try {
            // MCP tool results come as content array: [{ type: "text", text: "..." }]
            let resultText = event.result;
            const outer = JSON.parse(resultText);
            if (Array.isArray(outer) && outer[0]?.type === 'text' && outer[0]?.text) {
              resultText = outer[0].text;
            }
            const parsed = JSON.parse(resultText);
            if (parsed.a2ui && parsed.filePath) {
              const filePath = parsed.filePath as string;
              setArtifacts((prev) => {
                const filtered = prev.filter((p) => p !== filePath);
                const updated = [...filtered, filePath];
                if (!memoryOnlySessions.has(sessionId)) {
                  window.electronAPI?.updateSessionMeta(sessionId, { artifacts: updated }).catch(() => {});
                }
                return updated;
              });
              setSelectedArtifact(filePath);
              setArtifactPanelOpen(true);
            }
          } catch {
            // Not JSON or not A2UI — ignore
          }

          // Bash tool: scan result for file paths with known artifact extensions
          const toolName = event.toolName ?? '';
          if (toolName.toLowerCase() === 'bash' || toolName.toLowerCase() === 'execute_command') {
            const filePaths = extractFilePathsFromBashResult(event.result, workingDirectory);
            for (const fp of filePaths) {
              setArtifacts((prev) => {
                const filtered = prev.filter((p) => p !== fp);
                const updated = [...filtered, fp];
                if (!memoryOnlySessions.has(sessionId)) {
                  window.electronAPI?.updateSessionMeta(sessionId, { artifacts: updated }).catch(() => {});
                }
                return updated;
              });
              setSelectedArtifact(fp);
              setArtifactPanelOpen(true);
            }
          }
        }
        break;
      }

      // ─── 权限请求 ───
      case 'permission_request': {
        setPermissionRequest({
          isOpen: true,
          requestId: event.requestId,
          toolName: event.toolName,
          command: event.command,
          description: event.description,
        });
        break;
      }

      // ─── 状态和信息 ───
      case 'status': {
        const statusMessage: Message = {
          id: generateMessageId(),
          role: 'status',
          content: event.message,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, statusMessage]);
        break;
      }

      case 'info': {
        const infoMessage: Message = {
          id: generateMessageId(),
          role: 'info',
          content: event.message,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, infoMessage]);
        break;
      }

      // ─── 错误 ───
      case 'error': {
        const errorMessage: Message = {
          id: generateMessageId(),
          role: 'error',
          content: event.message,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setProcessing(false);
        break;
      }

      case 'typed_error': {
        const typedErrorMessage: Message = {
          id: generateMessageId(),
          role: 'error',
          content: event.error.message,
          timestamp: Date.now(),
          errorCode: event.error.code,
          errorTitle: event.error.title,
          errorDetails: event.error.details,
          errorCanRetry: event.error.canRetry,
        };
        setMessages((prev) => [...prev, typedErrorMessage]);
        setProcessing(false);
        break;
      }

      // ─── 完成 ───
      case 'complete': {
        setProcessing(false);
        streamingMessageIdRef.current = null;
        // Update session metadata with latest timestamp
        updateMeta({ lastMessageAt: Date.now() });
        break;
      }

      // ─── 后台任务 ───
      case 'task_backgrounded':
      case 'task_progress':
      case 'shell_backgrounded':
      case 'shell_killed':
        // V2: 更新对应的后台任务状态
        break;

      // ─── 工作目录变更 ───
      case 'working_directory_changed':
        // 更新 session 的 workingDirectory (后续实现)
        break;

      default:
        break;
    }
  }, [sessionId, setMessages, setProcessing, setPermissionRequest, persistMessage, updateMeta, setArtifacts, setArtifactPanelOpen, setSelectedArtifact, workingDirectory]);

  // ─── 订阅 IPC 事件 ───
  useEffect(() => {
    if (!enabled) return;

    // 订阅事件
    const unsubscribe = window.electronAPI?.onAgentEvent(handleEvent);

    // 清理订阅
    return () => {
      unsubscribe?.();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [enabled, handleEvent]);
}
