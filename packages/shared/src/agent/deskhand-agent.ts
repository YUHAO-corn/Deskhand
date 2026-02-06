/**
 * DeskhandAgent - Core agent implementation
 *
 * Wraps the Claude Agent SDK with Deskhand-specific features:
 * - Permission mode management
 * - Tool permissions via PreToolUse hook
 * - Large result summarization via PostToolUse hook
 * - Event stream handling
 */

import type { AgentEvent, PermissionMode, ThinkingLevel } from '@deskhand/core';

// ============ Types ============

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

// ============ Agent Class ============

/**
 * DeskhandAgent wraps the Claude Agent SDK
 *
 * Implementation notes:
 * - Initialize with API key and options
 * - Create SDK Agent instance
 * - Set up PreToolUse hook for permission checks
 * - Set up PostToolUse hook for large result summarization
 * - Expose chat() method with event streaming
 */
export class DeskhandAgent {
  private options: DeskhandAgentOptions;
  // private sdkAgent: Agent | null = null;
  // private abortController: AbortController | null = null;
  // private pendingPermissions: Map<string, { resolve: (allowed: boolean) => void }> = new Map();

  constructor(options: DeskhandAgentOptions) {
    this.options = options;
    // 实现步骤：
    // 1. 验证 apiKey 存在，否则抛出错误
    // 2. 创建 Anthropic client: new Anthropic({ apiKey, baseUrl })
    // 3. 暂不创建 SDK Agent，等 chat() 时按需创建（lazy init）
  }

  /**
   * Send a message and get streaming response
   */
  async chat(message: string, _options?: ChatOptions): Promise<void> {
    // 实现步骤：
    // 1. 创建 AbortController 用于取消
    // 2. 如果 sdkAgent 不存在，创建 SDK Agent:
    //    const agent = createAgent({
    //      client: this.anthropicClient,
    //      model: this.options.model || 'claude-sonnet-4-20250514',
    //      systemPrompt: buildSystemPrompt(this.options),
    //    });
    // 3. 调用 agent.chat({ message, signal: abortController.signal })
    // 4. 遍历返回的 async iterator，处理每个事件：
    //    for await (const event of response) {
    //      const agentEvent = mapSdkEventToAgentEvent(event);
    //      _options?.onEvent?.(agentEvent);
    //    }
    // 5. 发送 turn_complete 事件
    console.log('[DeskhandAgent] chat:', message);
  }

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
