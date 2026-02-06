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

import { useEffect, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import type { AgentEvent, Message } from '@deskhand/core';
// import { messagesAtomFamily, sessionProcessingAtomFamily } from '../atoms/session';
// import { generateMessageId } from '@deskhand/core';

/**
 * Hook 参数
 */
export interface UseAgentEventsOptions {
  sessionId: string;
  enabled?: boolean;
}

/**
 * Agent 事件订阅 Hook
 *
 * 使用方式：
 * ```tsx
 * function ChatArea({ sessionId }: { sessionId: string }) {
 *   useAgentEvents({ sessionId, enabled: true });
 *   // ... 渲染消息
 * }
 * ```
 */
export function useAgentEvents({ sessionId, enabled = true }: UseAgentEventsOptions) {
  // ─── Atom Setters ───
  // const setMessages = useSetAtom(messagesAtomFamily(sessionId));
  // const setProcessing = useSetAtom(sessionProcessingAtomFamily(sessionId));

  // ─── 事件处理器 ───
  const handleEvent = useCallback((eventSessionId: string, event: AgentEvent) => {
    // 只处理当前 session 的事件
    if (eventSessionId !== sessionId) return;

    // 根据事件类型分别处理
    switch (event.type) {
      // ─── 文本流式事件 ───
      case 'text_delta':
        // 实现步骤：
        // 1. 查找当前 streaming 的 assistant 消息
        // 2. 如果不存在，创建新消息（role: 'assistant', isStreaming: true）
        // 3. 追加 event.text 到消息内容
        console.log('[useAgentEvents] text_delta:', event.text.length, 'chars');
        break;

      case 'text_complete':
        // 实现步骤：
        // 1. 查找当前 streaming 的 assistant 消息
        // 2. 设置 isStreaming = false
        // 3. 如果 event.isIntermediate，标记为中间消息
        console.log('[useAgentEvents] text_complete, intermediate:', event.isIntermediate);
        break;

      // ─── 工具事件 ───
      case 'tool_start':
        // 实现步骤：
        // 1. 创建新的 tool 消息
        // 2. 设置 toolName, toolUseId, toolInput, toolStatus='executing'
        // 3. 添加到消息列表
        console.log('[useAgentEvents] tool_start:', event.toolName);
        break;

      case 'tool_result':
        // 实现步骤：
        // 1. 查找对应 toolUseId 的 tool 消息
        // 2. 更新 toolResult, toolStatus='completed' 或 'error'
        console.log('[useAgentEvents] tool_result:', event.toolUseId, event.isError);
        break;

      // ─── 权限请求 ───
      case 'permission_request':
        // 实现步骤：
        // 1. 创建 permission 请求消息或更新 atom
        // 2. 显示权限确认 UI
        console.log('[useAgentEvents] permission_request:', event.toolName);
        break;

      // ─── 状态和信息 ───
      case 'status':
        // 创建 status 消息（role: 'status'）
        console.log('[useAgentEvents] status:', event.message);
        break;

      case 'info':
        // 创建 info 消息（role: 'info'）
        console.log('[useAgentEvents] info:', event.message);
        break;

      // ─── 错误 ───
      case 'error':
        // 创建 error 消息（role: 'error'）
        console.log('[useAgentEvents] error:', event.message);
        break;

      case 'typed_error':
        // 创建带结构化信息的 error 消息
        console.log('[useAgentEvents] typed_error:', event.error.code);
        break;

      // ─── 完成 ───
      case 'complete':
        // 实现步骤：
        // 1. 设置 processing = false
        // 2. 更新 token usage（如果有）
        // 3. 持久化消息到 storage
        console.log('[useAgentEvents] complete, usage:', event.usage);
        break;

      // ─── 后台任务 ───
      case 'task_backgrounded':
      case 'task_progress':
      case 'shell_backgrounded':
      case 'shell_killed':
        // 更新对应的后台任务状态
        console.log('[useAgentEvents] background task event:', event.type);
        break;

      // ─── 工作目录变更 ───
      case 'working_directory_changed':
        // 更新 session 的 workingDirectory
        console.log('[useAgentEvents] working_directory_changed:', event.workingDirectory);
        break;

      default:
        console.log('[useAgentEvents] unknown event type:', (event as { type: string }).type);
    }
  }, [sessionId]);

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
