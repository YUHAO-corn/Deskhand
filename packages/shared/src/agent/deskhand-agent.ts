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
import { query, AbortError, type Query } from '@anthropic-ai/claude-agent-sdk';
import { ToolIndex, extractToolStarts, extractToolResults, type ContentBlock } from './tool-matching';

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
  /** Path to the Claude Agent SDK cli.js file */
  pathToClaudeCodeExecutable?: string;
  /** Callback when SDK session ID is captured (for persistence) */
  onSdkSessionIdUpdate?: (sdkSessionId: string) => void;
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
  private currentQuery: Query | null = null;
  private abortController: AbortController | null = null;
  private pendingPermissions: Map<string, { resolve: (allowed: boolean) => void }> = new Map();
  /** SDK session ID for conversation continuity */
  private sdkSessionId: string | null = null;

  constructor(options: DeskhandAgentOptions) {
    this.options = options;
    if (!options.apiKey) {
      throw new Error('API key is required');
    }
  }

  /** Get current SDK session ID */
  getSessionId(): string | null {
    return this.sdkSessionId;
  }

  /** Set SDK session ID (for resuming conversations) */
  setSessionId(sessionId: string | null): void {
    this.sdkSessionId = sessionId;
  }

  /**
   * Send a message and get streaming response
   */
  async chat(message: string, options?: ChatOptions): Promise<void> {
    const emit = (event: AgentEvent) => options?.onEvent?.(event);

    // ─── Step 1: 准备 ───
    this.abortController = new AbortController();
    // Note: API key and base URL are read from environment variables:
    // - ANTHROPIC_API_KEY
    // - ANTHROPIC_BASE_URL
    const sdkOptions = {
      model: this.options.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      cwd: this.options.workingDirectory || process.cwd(),
      abortController: this.abortController,
      // Path to the SDK's cli.js - required for subprocess spawning
      pathToClaudeCodeExecutable: this.options.pathToClaudeCodeExecutable,
      // Bypass SDK permissions - we handle permissions ourselves
      permissionMode: 'bypassPermissions' as const,
      allowDangerouslySkipPermissions: true,
      // Resume from previous session if we have one
      ...(this.sdkSessionId ? { resume: this.sdkSessionId } : {}),
    };

    // ─── Step 2: 调用 SDK query ───
    this.currentQuery = query({ prompt: message, options: sdkOptions });

    // ─── Step 3: 初始化工具匹配状态 ───
    const toolIndex = new ToolIndex();
    const emittedToolStarts = new Set<string>();
    const activeParentTools = new Set<string>();
    let currentTurnId: string | null = null;

    // ─── Step 4: 遍历 SDK 消息流 ───
    try {
      for await (const sdkMessage of this.currentQuery) {
        // Capture SDK session ID from first message (for conversation continuity)
        const msg = sdkMessage as Record<string, unknown>;
        if (msg.session_id && !this.sdkSessionId) {
          this.sdkSessionId = msg.session_id as string;
          console.log('[DeskhandAgent] Captured SDK session ID:', this.sdkSessionId);
          this.options.onSdkSessionIdUpdate?.(this.sdkSessionId);
        }

        const events = this.processSdkMessage(
          sdkMessage,
          toolIndex,
          emittedToolStarts,
          activeParentTools,
          currentTurnId,
          (id) => { currentTurnId = id; }
        );

        for (const event of events) {
          emit(event);
        }
      }
    } catch (error) {
      if (error instanceof AbortError) {
        emit({ type: 'info', message: 'Generation stopped' });
      } else {
        emit({ type: 'error', message: String(error) });
      }
    } finally {
      this.currentQuery = null;
      this.abortController = null;
    }

    // ─── Step 5: 发送完成事件 ───
    emit({ type: 'complete', usage: { inputTokens: 0, outputTokens: 0 } });
  }

  /**
   * 处理单个 SDK 消息，转换为 AgentEvent 数组
   */
  private processSdkMessage(
    sdkMessage: unknown,
    toolIndex: ToolIndex,
    emittedToolStarts: Set<string>,
    activeParentTools: Set<string>,
    currentTurnId: string | null,
    setTurnId: (id: string) => void,
  ): AgentEvent[] {
    const events: AgentEvent[] = [];
    const msg = sdkMessage as Record<string, unknown>;

    // 根据消息类型分别处理
    switch (msg.type) {
      case 'stream_event': {
        // 处理流式事件
        const streamEvent = msg.event as Record<string, unknown>;

        // message_start: 捕获 turn ID
        if (streamEvent.type === 'message_start') {
          const message = streamEvent.message as Record<string, unknown>;
          if (message.id) {
            setTurnId(message.id as string);
          }
        }

        // content_block_delta: 流式文本
        if (streamEvent.type === 'content_block_delta') {
          const delta = streamEvent.delta as Record<string, unknown>;
          if (delta.type === 'text_delta' && delta.text) {
            events.push({
              type: 'text_delta',
              text: delta.text as string,
              turnId: currentTurnId ?? undefined,
            });
          }
        }

        // content_block_start: 工具调用开始
        if (streamEvent.type === 'content_block_start') {
          const contentBlock = streamEvent.content_block as Record<string, unknown>;
          if (contentBlock.type === 'tool_use') {
            const toolUseId = contentBlock.id as string;
            const toolName = contentBlock.name as string;

            // 存入索引并发出事件（如果未重复）
            if (!emittedToolStarts.has(toolUseId)) {
              emittedToolStarts.add(toolUseId);
              toolIndex.register(toolUseId, toolName, {});
              events.push({
                type: 'tool_start',
                toolName,
                toolUseId,
                input: {},
                turnId: currentTurnId ?? undefined,
              });
            }
          }
        }
        break;
      }

      case 'assistant': {
        // 完整的 assistant 消息
        const message = msg.message as Record<string, unknown>;
        const content = message.content as ContentBlock[] | undefined;
        const parentToolUseId = msg.parent_tool_use_id as string | undefined;

        if (content) {
          // 提取工具调用
          const toolStartEvents = extractToolStarts(
            content,
            parentToolUseId ?? null,
            toolIndex,
            emittedToolStarts,
            currentTurnId ?? undefined,
            activeParentTools
          );
          events.push(...toolStartEvents);

          // 提取文本块
          for (const block of content) {
            if (block.type === 'text' && 'text' in block) {
              events.push({
                type: 'text_complete',
                text: (block as { type: 'text'; text: string }).text,
                isIntermediate: false,
                turnId: currentTurnId ?? undefined,
              });
            }
          }
        }
        break;
      }

      case 'user': {
        // 工具结果
        const message = msg.message as Record<string, unknown>;
        const content = message.content as ContentBlock[] | undefined;
        const parentToolUseId = msg.parent_tool_use_id as string | undefined;
        const toolUseResult = msg.tool_use_result;

        if (content) {
          const toolResultEvents = extractToolResults(
            content,
            parentToolUseId ?? null,
            toolUseResult,
            toolIndex,
            currentTurnId ?? undefined
          );
          events.push(...toolResultEvents);
        }
        break;
      }

      case 'result': {
        // 最终结果，包含 usage
        const result = msg.result as Record<string, unknown> | undefined;
        const usage = result?.usage as Record<string, number> | undefined;
        if (usage) {
          events.push({
            type: 'complete',
            usage: {
              inputTokens: usage.input_tokens || 0,
              outputTokens: usage.output_tokens || 0,
            },
          });
        }
        break;
      }
    }

    return events;
  }

  /**
   * Respond to permission request
   */
  async respondToPermission(requestId: string, response: 'allow' | 'deny'): Promise<void> {
    const pending = this.pendingPermissions.get(requestId);
    if (pending) {
      pending.resolve(response === 'allow');
      this.pendingPermissions.delete(requestId);
    }
  }

  /**
   * Stop current generation
   */
  async stop(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
    // Resolve all pending permissions as denied
    for (const [id, pending] of this.pendingPermissions) {
      pending.resolve(false);
    }
    this.pendingPermissions.clear();
  }
}
