/**
 * DeskhandAgent - Core agent implementation
 *
 * Wraps the Claude Agent SDK with Deskhand-specific features:
 * - Permission mode management
 * - Tool permissions via PreToolUse hook
 * - Event stream handling via tool-matching
 *
 * 核心流程：
 * 1. 调用 SDK 的 query() 发起对话
 * 2. 遍历 SDK 消息流（for await）
 * 3. 使用 tool-matching 将 SDK 消息转换为 AgentEvent
 * 4. 通过 onEvent 回调发出事件
 */

import type { AgentEvent, PermissionMode, ThinkingLevel } from '@deskhand/core';
// import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
// import { ToolIndex, extractToolStarts, extractToolResults } from './tool-matching';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Agent options */
export interface DeskhandAgentOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  permissionMode?: PermissionMode;
  thinkingLevel?: ThinkingLevel;
  workingDirectory?: string;
}

/** Chat options */
export interface ChatOptions {
  skills?: string[];                 // Enabled skill IDs
  onEvent?: (event: AgentEvent) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DeskhandAgent wraps the Claude Agent SDK
 */
export class DeskhandAgent {
  private options: DeskhandAgentOptions;
  // private currentQuery: Query | null = null;
  // private abortController: AbortController | null = null;
  // private pendingPermissions: Map<string, { resolve: (allowed: boolean) => void }> = new Map();

  constructor(options: DeskhandAgentOptions) {
    this.options = options;
    // 实现步骤：
    // 1. 验证 apiKey 存在，否则抛出错误
    // 2. 保存配置，暂不创建 SDK query（lazy init）
  }

  /**
   * Send a message and get streaming response
   *
   * 核心实现流程（参考 craft-agent）：
   */
  async chat(message: string, options?: ChatOptions): Promise<void> {
    const emit = (event: AgentEvent) => options?.onEvent?.(event);

    // ─── Step 1: 准备 ───
    // this.abortController = new AbortController();
    // const optionsWithAbort = {
    //   apiKey: this.options.apiKey,
    //   model: this.options.model || 'claude-sonnet-4-20250514',
    //   cwd: this.options.workingDirectory,
    //   abortController: this.abortController,
    // };

    // ─── Step 2: 调用 SDK query ───
    // this.currentQuery = query({ prompt: message, options: optionsWithAbort });

    // ─── Step 3: 初始化工具匹配状态 ───
    // 参考 tool-matching.ts 的设计原则：无状态、直接 ID 匹配
    // const toolIndex = new ToolIndex();           // 工具元数据索引
    // const emittedToolStarts = new Set<string>(); // 去重：stream + assistant 都会发 tool_use
    // const activeParentTools = new Set<string>(); // 活跃的 Task 工具（用于子代理父级推断）
    // let currentTurnId: string | null = null;     // 当前 turn 的关联 ID

    // ─── Step 4: 遍历 SDK 消息流 ───
    // try {
    //   for await (const sdkMessage of this.currentQuery) {
    //     // 4.1 处理不同类型的 SDK 消息
    //     const events = this.processSdkMessage(
    //       sdkMessage,
    //       toolIndex,
    //       emittedToolStarts,
    //       activeParentTools,
    //       currentTurnId,
    //       (id) => { currentTurnId = id; }
    //     );
    //
    //     // 4.2 发出每个 AgentEvent
    //     for (const event of events) {
    //       emit(event);
    //     }
    //   }
    // } catch (error) {
    //   if (error instanceof AbortError) {
    //     emit({ type: 'info', message: 'Generation stopped' });
    //   } else {
    //     emit({ type: 'error', message: String(error) });
    //   }
    // } finally {
    //   this.currentQuery = null;
    //   this.abortController = null;
    // }

    // ─── Step 5: 发送完成事件 ───
    // emit({ type: 'complete', usage: { inputTokens: 0, outputTokens: 0 } });

    console.log('[DeskhandAgent] chat:', message);
  }

  /**
   * 处理单个 SDK 消息，转换为 AgentEvent 数组
   *
   * SDK 消息类型（参考 @anthropic-ai/claude-agent-sdk）：
   * - stream_event: 流式事件（text_delta, tool_use 等）
   * - assistant: 完整的 assistant 消息（包含 content blocks）
   * - user: 工具结果（tool_result content blocks）
   * - result: 最终结果（usage 统计）
   */
  // private processSdkMessage(
  //   sdkMessage: SDKMessage,
  //   toolIndex: ToolIndex,
  //   emittedToolStarts: Set<string>,
  //   activeParentTools: Set<string>,
  //   currentTurnId: string | null,
  //   setTurnId: (id: string) => void,
  // ): AgentEvent[] {
  //   const events: AgentEvent[] = [];
  //
  //   // 根据消息类型分别处理
  //   switch (sdkMessage.type) {
  //     case 'stream_event':
  //       // 处理流式事件：text_delta, content_block_start 等
  //       // - content_block_delta type=text_delta → emit text_delta
  //       // - content_block_start type=tool_use → extractToolStarts
  //       break;
  //
  //     case 'assistant':
  //       // 完整的 assistant 消息
  //       // - 提取 tool_use blocks → extractToolStarts（会去重）
  //       // - 提取 text blocks → emit text_complete
  //       const toolStartEvents = extractToolStarts(
  //         sdkMessage.message.content,
  //         sdkMessage.parent_tool_use_id,
  //         toolIndex,
  //         emittedToolStarts,
  //         currentTurnId,
  //         activeParentTools
  //       );
  //       events.push(...toolStartEvents);
  //       break;
  //
  //     case 'user':
  //       // 工具结果
  //       const toolResultEvents = extractToolResults(
  //         sdkMessage.message.content,
  //         sdkMessage.parent_tool_use_id,
  //         sdkMessage.tool_use_result,
  //         toolIndex,
  //         currentTurnId
  //       );
  //       events.push(...toolResultEvents);
  //       break;
  //
  //     case 'result':
  //       // 最终结果，包含 usage
  //       // emit({ type: 'complete', usage: sdkMessage.usage });
  //       break;
  //   }
  //
  //   return events;
  // }

  /**
   * Respond to permission request
   */
  async respondToPermission(requestId: string, response: 'allow' | 'deny'): Promise<void> {
    // 实现步骤：
    // 1. 从 pendingPermissions Map 获取对应的 promise resolve
    // 2. 如果存在，调用 resolve(response === 'allow')
    // 3. 从 Map 中删除该条目
    console.log('[DeskhandAgent] respondToPermission:', requestId, response);
  }

  /**
   * Stop current generation
   */
  async stop(): Promise<void> {
    // 实现步骤：
    // 1. 如果 abortController 存在，调用 abortController.abort()
    // 2. 清理 pendingPermissions（全部 resolve(false)）
    // 3. 重置 abortController = null
    console.log('[DeskhandAgent] stop');
  }
}
