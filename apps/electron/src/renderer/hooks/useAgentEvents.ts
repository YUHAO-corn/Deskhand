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
import { useSetAtom } from 'jotai';
import type { AgentEvent, Message } from '@deskhand/core';
import { generateMessageId } from '@deskhand/core';
import {
  sessionMessagesFamily,
  sessionProcessingFamily,
  permissionRequestAtom,
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

  // Track the current streaming message ID
  const streamingMessageIdRef = useRef<string | null>(null);

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
        break;
      }

      case 'tool_result': {
        setMessages((prev) =>
          prev.map((m) =>
            m.toolUseId === event.toolUseId
              ? {
                  ...m,
                  toolResult: event.result,
                  toolStatus: event.isError ? 'error' : 'completed',
                }
              : m
          )
        );
        break;
      }

      // ─── 权限请求 ───
      case 'permission_request': {
        setPermissionRequest({
          isOpen: true,
          command: event.command,
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
  }, [sessionId, setMessages, setProcessing, setPermissionRequest]);

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
