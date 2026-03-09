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
import { getPluginPaths } from '../skills/loader';
import { createA2UIServer } from './a2ui-tools';

type ForcedA2UITool = 'render_playground' | 'render_tournament' | null;

function extractForcedA2UIToolFromMessage(message: string): ForcedA2UITool {
  const lower = message.toLowerCase();
  if (lower.includes('[pick-a-style]')) return 'render_playground';
  if (lower.includes('[this-or-that]')) return 'render_tournament';
  return null;
}

function isA2UIRenderToolName(toolName: string): boolean {
  return toolName.includes('render_playground') || toolName.includes('render_tournament');
}

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
  /** Path to A2UI HTML templates directory */
  a2uiTemplateDir?: string;
  /** Callback when SDK session ID is captured (for persistence) */
  onSdkSessionIdUpdate?: (sdkSessionId: string) => void;
  /** Clipboard file paths for system prompt injection */
  clipboardPaths?: {
    indexPath: string;
    historyPath: string;
  };
}

/** Chat options */
export interface ChatOptions {
  skills?: string[];                 // Enabled skill IDs
  model?: string;                    // Override model for this chat
  thinkingLevel?: ThinkingLevel;     // Override thinking level for this chat
  permissionMode?: 'ask' | 'allow-all'; // Permission mode for this chat
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
    const forcedA2UITool = extractForcedA2UIToolFromMessage(message);

    // ─── Step 1: 准备 ───
    this.abortController = new AbortController();
    // Note: API key and base URL are read from environment variables:
    // - ANTHROPIC_API_KEY
    // - ANTHROPIC_BASE_URL

    // Model priority: runtime options > agent options > env var > default
    const effectiveModel = options?.model || this.options.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

    // TODO: thinkingLevel needs to be mapped to SDK parameters (e.g., budget_tokens)
    // For now, we log it but don't apply it until we understand the SDK's API
    if (options?.thinkingLevel && options.thinkingLevel !== 'off') {
      console.log('[DeskhandAgent] Thinking level requested:', options.thinkingLevel);
    }

    // Permission mode: 'ask' = confirm all dangerous ops, 'allow-all' = only confirm destructive bash
    const permMode = options?.permissionMode || 'ask';

    // Tools that modify the filesystem (used in 'ask' mode)
    const DANGEROUS_TOOLS = new Set(['Bash', 'Edit', 'Write']);

    // Bash commands that are explicitly destructive
    const DESTRUCTIVE_COMMANDS = new Set(['rm', 'rmdir', 'unlink', 'shred']);

    const systemPromptAppendBlocks: string[] = [];

    if (this.options.clipboardPaths) {
      console.log('[DeskhandAgent] Clipboard context injected:', this.options.clipboardPaths.indexPath);
      systemPromptAppendBlocks.push([
        '## Clipboard History',
        'The user has clipboard monitoring enabled. Their clipboard history is stored locally.',
        `- Index file (lightweight metadata): ${this.options.clipboardPaths.indexPath}`,
        `- Full history file (complete content): ${this.options.clipboardPaths.historyPath}`,
        '',
        'When the user mentions clipboard, copied content, or asks to find something they copied before:',
        '1. Read the index file first to browse entries (each line is JSON with id, type, preview, timestamp)',
        '2. If you need the full content of a specific entry, search for its id in the history file',
        '3. Always respond in the language the user is using',
      ].join('\n'));
    }

    if (forcedA2UITool) {
      console.log('[DeskhandAgent] Interact tag detected, forcing tool:', forcedA2UITool);
      const blockedTool = forcedA2UITool === 'render_playground' ? 'render_tournament' : 'render_playground';
      systemPromptAppendBlocks.push([
        '## Interact Tag Routing',
        `The user message includes an interact tag that requires tool routing.`,
        `You MUST use ${forcedA2UITool} for A2UI rendering in this turn.`,
        `You MUST NOT call ${blockedTool} in this turn.`,
      ].join('\n'));
    }

    const sdkOptions = {
      model: effectiveModel,
      cwd: this.options.workingDirectory || process.cwd(),
      abortController: this.abortController,
      pathToClaudeCodeExecutable: this.options.pathToClaudeCodeExecutable,
      // System prompt: inject optional runtime constraints
      ...(systemPromptAppendBlocks.length > 0 ? {
        systemPrompt: {
          type: 'preset' as const,
          preset: 'claude_code' as const,
          append: `\n${systemPromptAppendBlocks.join('\n\n')}`,
        },
      } : {}),
      // Bypass SDK's built-in permissions — we implement our own via PreToolUse hook
      permissionMode: 'bypassPermissions' as const,
      allowDangerouslySkipPermissions: true,
      // Resume from previous session if we have one
      ...(this.sdkSessionId ? { resume: this.sdkSessionId } : {}),
      // Skills: pass skill directories as plugins for SDK's Skill tool
      plugins: getPluginPaths(this.options.workingDirectory),
      // A2UI: custom tools for rendering interactive UI components
      ...(this.options.a2uiTemplateDir ? {
        mcpServers: {
          'deskhand-a2ui': createA2UIServer(this.options.a2uiTemplateDir),
        },
      } : {}),
      // Custom permission hook
      hooks: {
        PreToolUse: [{
          hooks: [async (input: Record<string, unknown>) => {
            if (input.hook_event_name !== 'PreToolUse') {
              return { continue: true };
            }

            const toolName = input.tool_name as string;
            const toolInput = input.tool_input as Record<string, unknown>;

            // Interact tag hard routing:
            // When present, block the mismatched A2UI render tool at hook layer.
            if (forcedA2UITool && isA2UIRenderToolName(toolName) && !toolName.includes(forcedA2UITool)) {
              return {
                continue: false,
                decision: 'block' as const,
                reason: `Interact tag requires ${forcedA2UITool}`,
              };
            }

            // Determine if this operation needs permission
            let needsPermission = false;

            if (permMode === 'ask') {
              // Ask mode: all dangerous tools need confirmation
              needsPermission = DANGEROUS_TOOLS.has(toolName);
            } else {
              // Allow-all mode: only destructive bash commands need confirmation
              if (toolName === 'Bash') {
                const cmd = String(toolInput.command || '').trim();
                const baseCommand = cmd.split(/[\s;|&]/)[0]?.split('/').pop() || '';
                needsPermission = DESTRUCTIVE_COMMANDS.has(baseCommand);
              }
            }

            if (!needsPermission) {
              return { continue: true };
            }

            // Build human-readable command and description
            const { command, description } = this.buildPermissionDisplay(toolName, toolInput);

            const requestId = `perm-${input.tool_use_id as string}`;

            // Create a Promise that blocks until user responds
            const permissionPromise = new Promise<boolean>((resolve) => {
              this.pendingPermissions.set(requestId, { resolve });
            });

            // Emit permission_request event to UI
            emit({
              type: 'permission_request',
              requestId,
              toolName,
              command,
              description,
            });

            // Wait for user response
            const allowed = await permissionPromise;
            if (!allowed) {
              return {
                continue: false,
                decision: 'block' as const,
                reason: 'User denied permission',
              };
            }

            return { continue: true };
          }],
        }],
      },
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
          // Maintain activeParentTools for Task subagent nesting
          // When Task starts, add its toolUseId so child tools can be nested under it
          // When Task completes, remove it from the active set
          if (event.type === 'tool_start' && event.toolName === 'Task' && event.toolUseId) {
            activeParentTools.add(event.toolUseId);
          }
          if (event.type === 'tool_result' && event.toolName === 'Task' && event.toolUseId) {
            activeParentTools.delete(event.toolUseId);
          }
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
   * Build human-readable command and description for permission popup
   */
  private buildPermissionDisplay(toolName: string, toolInput: Record<string, unknown>): { command: string; description: string } {
    switch (toolName) {
      case 'Bash': {
        const cmd = String(toolInput.command || '');
        // Use model-provided description if available
        const desc = toolInput.description ? String(toolInput.description) : 'Execute command';
        return { command: cmd, description: desc };
      }
      case 'Edit': {
        const filePath = String(toolInput.file_path || '');
        return { command: `edit ${filePath}`, description: 'Edit file' };
      }
      case 'Write': {
        const filePath = String(toolInput.file_path || '');
        return { command: `write ${filePath}`, description: 'Create/overwrite file' };
      }
      default:
        return { command: toolName, description: 'Tool operation' };
    }
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
