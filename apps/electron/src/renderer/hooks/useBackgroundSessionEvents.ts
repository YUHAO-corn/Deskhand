/**
 * useBackgroundSessionEvents - 处理非 active session 的 agent 事件
 *
 * 职责：
 * 1. 监听所有 agent 事件
 * 2. 对非 active session：持久化消息到磁盘
 * 3. 对非 active session：agent 完成时标记未读
 *
 * 与 useAgentEvents 的分工：
 * - useAgentEvents: 处理 active session（更新 atoms + 持久化）
 * - useBackgroundSessionEvents: 处理非 active session（只持久化 + 未读标记）
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { AgentEvent, Message } from '@deskhand/core';
import { generateMessageId, messageToStored } from '@deskhand/core';
import {
  activeSessionIdAtom,
  sessionMetaMapAtom,
  sessionIdsAtom,
  memoryOnlySessionsAtom,
} from '../atoms/sessions';

export function useBackgroundSessionEvents() {
  const activeSessionId = useAtomValue(activeSessionIdAtom);
  const setSessionMetaMap = useSetAtom(sessionMetaMapAtom);
  const setSessionIds = useSetAtom(sessionIdsAtom);
  const memoryOnlySessions = useAtomValue(memoryOnlySessionsAtom);

  // Track streaming message per background session
  const streamingIdsRef = useRef<Map<string, string>>(new Map());

  const handleEvent = useCallback((eventSessionId: string, event: AgentEvent) => {
    // Only handle non-active sessions
    if (eventSessionId === activeSessionId) return;
    // Don't persist memory-only sessions
    if (memoryOnlySessions.has(eventSessionId)) return;

    switch (event.type) {
      case 'text_complete': {
        const msgId = streamingIdsRef.current.get(eventSessionId) || generateMessageId();
        streamingIdsRef.current.delete(eventSessionId);
        const msg: Message = {
          id: msgId,
          role: 'assistant',
          content: event.text,
          timestamp: Date.now(),
          isIntermediate: event.isIntermediate,
          turnId: event.turnId,
        };
        window.electronAPI?.appendMessage(eventSessionId, messageToStored(msg));
        break;
      }

      case 'text_delta': {
        // Track streaming message ID for this session
        if (!streamingIdsRef.current.has(eventSessionId)) {
          streamingIdsRef.current.set(eventSessionId, generateMessageId());
        }
        break;
      }

      case 'tool_start': {
        const toolMsg: Message = {
          id: generateMessageId(),
          role: 'tool',
          content: '',
          timestamp: Date.now(),
          toolName: event.toolName,
          toolUseId: event.toolUseId,
          toolInput: event.input,
          toolStatus: 'executing',
          turnId: event.turnId,
        };
        window.electronAPI?.appendMessage(eventSessionId, messageToStored(toolMsg));
        break;
      }

      case 'complete': {
        streamingIdsRef.current.delete(eventSessionId);
        const now = Date.now();
        // Mark as unread
        setSessionMetaMap((prev) => {
          const next = new Map(prev);
          const existing = next.get(eventSessionId);
          if (existing) {
            next.set(eventSessionId, { ...existing, hasUnread: true, lastMessageAt: now });
          }
          return next;
        });
        // Move to top
        setSessionIds((prev) => {
          if (prev[0] === eventSessionId) return prev;
          const filtered = prev.filter((id) => id !== eventSessionId);
          return [eventSessionId, ...filtered];
        });
        // Persist unread + timestamp
        window.electronAPI?.updateSessionMeta(eventSessionId, { hasUnread: true, lastMessageAt: now });
        break;
      }
    }
  }, [activeSessionId, memoryOnlySessions, setSessionMetaMap, setSessionIds]);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onAgentEvent(handleEvent);
    return () => { unsubscribe?.(); };
  }, [handleEvent]);
}
