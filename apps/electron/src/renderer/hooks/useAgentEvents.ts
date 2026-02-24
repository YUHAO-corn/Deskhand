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
      // ─── 文本流式事件 ───
      case 'text_delta': {
        setMessages((prev) => {
          // Find or create streaming message
          let messageId = streamingMessageIdRef.current;
          const existingIdx = messageId
            ? prev.findIndex((m) => m.id === messageId)
            : -1;

          if (existingIdx >= 0) {
            // Append to existing message
            const updated = [...prev];
            const existing = updated[existingIdx]!;
            updated[existingIdx] = {
              ...existing,
              content: existing.content + event.text,
            };
            return updated;
          } else {
            // Create new streaming message
            const newId = generateMessageId();
            streamingMessageIdRef.current = newId;
            const newMessage: Message = {
              id: newId,
              role: 'assistant',
              content: event.text,
              timestamp: Date.now(),
              isStreaming: true,
              isPending: true,
              turnId: event.turnId,
            };
            return [...prev, newMessage];
          }
        });
        break;
      }

      case 'text_complete': {
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
        const toolMessage: Message = {
          id: generateMessageId(),
          role: 'tool',
          content: '',
          timestamp: Date.now(),
          toolName: event.toolName,
          toolUseId: event.toolUseId,
          toolInput: event.input,
          toolStatus: 'executing',
          turnId: event.turnId,
          toolIntent: event.intent,
          toolDisplayName: event.displayName,
          parentToolUseId: event.parentToolUseId,
        };
        setMessages((prev) => [...prev, toolMessage]);
        persistMessage(toolMessage);

        // Capture file artifacts from Write/Edit tools
        const toolNameLower = event.toolName?.toLowerCase() ?? '';
        if ((toolNameLower === 'write' || toolNameLower === 'edit') && event.input?.file_path) {
          let filePath = String(event.input.file_path);
          // Resolve relative paths against working directory
          if (!filePath.startsWith('/') && workingDirectory) {
            filePath = `${workingDirectory}/${filePath}`;
          } else if (filePath.startsWith('/') && workingDirectory && !filePath.startsWith(workingDirectory)) {
            // SDK paths like "/hello.html" are relative to cwd with leading slash
            filePath = `${workingDirectory}${filePath}`;
          }
          setArtifacts((prev) => {
            const filtered = prev.filter((p) => p !== filePath);
            const updated = [...filtered, filePath];
            // Persist artifacts to session metadata
            if (!memoryOnlySessions.has(sessionId)) {
              window.electronAPI?.updateSessionMeta(sessionId, { artifacts: updated }).catch(() => {});
            }
            return updated;
          });
          setSelectedArtifact(filePath);
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
            const parsed = JSON.parse(event.result);
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
        console.log('[useAgentEvents] unknown event type:', (event as { type: string }).type);
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
    };
  }, [enabled, handleEvent]);
}
