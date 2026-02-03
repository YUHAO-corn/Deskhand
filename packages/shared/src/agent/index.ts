import {
  query,
  AbortError,
  type Query,
  type Options,
} from '@anthropic-ai/claude-agent-sdk'
import { getDefaultOptions, setAnthropicOptionsEnv, setPathToClaudeCodeExecutable, resetClaudeConfigCheck } from './options'
import { loadConfig } from '../config'

// Re-export options utilities
export { setAnthropicOptionsEnv, setPathToClaudeCodeExecutable, resetClaudeConfigCheck }

/**
 * AgentEvent - Events emitted during agent execution
 * Designed for Activity-based UI rendering (craft-agents-oss pattern)
 */
export type AgentEvent =
  // Turn lifecycle
  | { type: 'turn_start'; turnId: string }
  | { type: 'turn_end'; turnId: string }
  // Text streaming
  | { type: 'text_delta'; delta: string; turnId?: string; parentToolUseId?: string }
  | { type: 'text_complete'; text: string; isIntermediate?: boolean; turnId?: string; parentToolUseId?: string }
  // Tool events (Activity)
  | {
      type: 'tool_start'
      toolName: string
      toolUseId: string
      toolInput: Record<string, unknown>
      toolIntent?: string
      turnId?: string
      parentToolUseId?: string
    }
  | {
      type: 'tool_result'
      toolUseId: string
      toolName: string
      result: string
      turnId?: string
      parentToolUseId?: string
      isError?: boolean
    }
  // System events
  | { type: 'error'; message: string }
  | { type: 'complete'; tokenUsage?: { inputTokens: number; outputTokens: number } }
  | { type: 'info'; message: string }

export interface AgentConfig {
  model?: string
  workingDirectory?: string
  onDebug?: (message: string) => void
}

// Default model
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

/**
 * Abort reason enum
 */
export enum AbortReason {
  UserStop = 'user_stop',
  Redirect = 'redirect',
}

/**
 * DeskhandAgent - Simple agent wrapper around Claude SDK
 * Manages conversation state and emits AgentEvents
 */
export class DeskhandAgent {
  private currentQuery: Query | null = null
  private abortController: AbortController | null = null
  private isProcessing = false
  private config: AgentConfig

  constructor(config: AgentConfig = {}) {
    this.config = config
  }

  /**
   * Check if agent is currently processing a message
   */
  getIsProcessing(): boolean {
    return this.isProcessing
  }

  /**
   * Stop the current agent execution
   */
  async stop(_reason: AbortReason = AbortReason.UserStop): Promise<void> {
    if (this.abortController) {
      this.abortController.abort()
    }
    if (this.currentQuery) {
      this.currentQuery.close()
      this.currentQuery = null
    }
    this.isProcessing = false
  }

  /**
   * Send a message and yield AgentEvents as the response streams in
   */
  async *chat(
    userMessage: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): AsyncGenerator<AgentEvent> {
    const appConfig = loadConfig()
    const model = appConfig.customModel || this.config.model || DEFAULT_MODEL
    const { onDebug } = this.config

    this.isProcessing = true
    this.abortController = new AbortController()

    try {
      onDebug?.(`Starting chat with model: ${model}`)
      onDebug?.(`Previous messages: ${messages.length}`)

      // Get SDK options with environment variables
      const defaultOptions = getDefaultOptions()

      // Thinking token budget (similar to craft-agents-oss)
      // Haiku: 4,000 tokens, Others: 10,000 tokens (default 'think' level)
      const isHaiku = model.toLowerCase().includes('haiku')
      const maxThinkingTokens = isHaiku ? 4_000 : 10_000

      const options: Partial<Options> = {
        ...defaultOptions,
        model,
        systemPrompt: 'You are a helpful AI assistant called Deskhand. Be concise and helpful.',
        cwd: this.config.workingDirectory,
        abortController: this.abortController,
        includePartialMessages: true, // Enable streaming
        maxThinkingTokens, // Enable extended thinking
      }

      // Build the prompt - prepend previous messages as context
      let prompt = userMessage
      if (messages.length > 0) {
        // Format previous messages as context
        const contextParts = messages.map((m) =>
          m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`
        )
        prompt = `${contextParts.join('\n\n')}\n\nUser: ${userMessage}`
      }

      // Start the query
      this.currentQuery = query({ prompt, options })

      // State for streaming
      let _fullText = '' // Track accumulated text (for debugging)
      let pendingText: string | null = null
      let currentTurnId: string | null = null
      let inputTokens = 0
      let outputTokens = 0

      // Process streaming messages from SDK
      for await (const message of this.currentQuery) {
        // Check for abort
        if (this.abortController.signal.aborted) {
          onDebug?.('Query aborted')
          break
        }

        // Get parentToolUseId from SDK message (for subagent context)
        const parentToolUseId = 'parent_tool_use_id' in message ? (message.parent_tool_use_id as string | null) : null

        // Process message based on type
        if (message.type === 'stream_event') {
          const event = message.event

          // message_start - capture turn ID
          if (event.type === 'message_start') {
            const messageId = (event as { message?: { id?: string } }).message?.id
            if (messageId) {
              currentTurnId = messageId
              yield { type: 'turn_start', turnId: messageId }
            }
          }

          // message_delta - contains stop_reason, emit pending text
          if (event.type === 'message_delta') {
            const stopReason = (event as { delta?: { stop_reason?: string } }).delta?.stop_reason
            if (pendingText) {
              const isIntermediate = stopReason === 'tool_use'
              yield {
                type: 'text_complete',
                text: pendingText,
                isIntermediate,
                turnId: currentTurnId || undefined,
                parentToolUseId: parentToolUseId || undefined,
              }
              pendingText = null
            }
          }

          // content_block_delta - text streaming
          if (event.type === 'content_block_delta') {
            const delta = event.delta as { type: string; text?: string }
            if (delta.type === 'text_delta' && delta.text) {
              _fullText += delta.text
              yield {
                type: 'text_delta',
                delta: delta.text,
                turnId: currentTurnId || undefined,
                parentToolUseId: parentToolUseId || undefined,
              }
            }
          }

          // content_block_start - tool_use start
          if (event.type === 'content_block_start') {
            const contentBlock = (event as { content_block?: { type: string; id?: string; name?: string; input?: unknown } }).content_block
            if (contentBlock?.type === 'tool_use' && contentBlock.id && contentBlock.name) {
              yield {
                type: 'tool_start',
                toolName: contentBlock.name,
                toolUseId: contentBlock.id,
                toolInput: (contentBlock.input ?? {}) as Record<string, unknown>,
                turnId: currentTurnId || undefined,
                parentToolUseId: parentToolUseId || undefined,
              }
            }
          }
        } else if (message.type === 'assistant') {
          // Full assistant message - extract text for pendingText
          let textContent = ''
          for (const block of message.message.content) {
            if (block.type === 'text') {
              textContent = block.text
            } else if (block.type === 'tool_use') {
              // Emit tool_start if not already emitted via stream_event
              yield {
                type: 'tool_start',
                toolName: block.name,
                toolUseId: block.id,
                toolInput: block.input as Record<string, unknown>,
                turnId: currentTurnId || undefined,
                parentToolUseId: parentToolUseId || undefined,
              }
            }
          }
          if (textContent) {
            pendingText = textContent
            _fullText = textContent
          }

          // Capture usage
          if (message.message.usage) {
            inputTokens = message.message.usage.input_tokens
            outputTokens = message.message.usage.output_tokens
          }
        } else if (message.type === 'user') {
          // User message with tool_result
          if ('tool_use_result' in message && message.tool_use_result !== undefined) {
            const toolResult = message.tool_use_result as { tool_use_id?: string; content?: string; is_error?: boolean }
            if (toolResult.tool_use_id) {
              yield {
                type: 'tool_result',
                toolUseId: toolResult.tool_use_id,
                toolName: '', // Not available in this context
                result: typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content),
                turnId: currentTurnId || undefined,
                parentToolUseId: parentToolUseId || undefined,
                isError: toolResult.is_error,
              }
            }
          }
        } else if (message.type === 'result') {
          // Result message - query completed
          if (message.subtype === 'success') {
            if (message.usage) {
              inputTokens = message.usage.input_tokens
              outputTokens = message.usage.output_tokens
            }
          }
          // Emit turn_end
          if (currentTurnId) {
            yield { type: 'turn_end', turnId: currentTurnId }
          }
        }
      }

      // Emit any remaining pending text
      if (pendingText) {
        yield {
          type: 'text_complete',
          text: pendingText,
          isIntermediate: false,
          turnId: currentTurnId || undefined,
        }
      }

      // Emit complete with token usage
      yield {
        type: 'complete',
        tokenUsage: { inputTokens, outputTokens },
      }
    } catch (error) {
      if (error instanceof AbortError) {
        onDebug?.('Chat aborted by user')
        yield { type: 'info', message: 'Chat stopped by user' }
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        onDebug?.(`Chat error: ${errorMessage}`)
        yield { type: 'error', message: errorMessage }
      }
      yield { type: 'complete' }
    } finally {
      this.isProcessing = false
      this.currentQuery = null
      this.abortController = null
    }
  }
}

/**
 * Simple chat function for backward compatibility
 * Simplified version without full agent state management
 */
export async function* chat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  agentConfig: AgentConfig = {}
): AsyncGenerator<AgentEvent> {
  if (messages.length === 0) {
    yield { type: 'error', message: 'No messages provided' }
    yield { type: 'complete' }
    return
  }

  // Get the last user message
  const lastMessage = messages[messages.length - 1]
  if (lastMessage.role !== 'user') {
    yield { type: 'error', message: 'Last message must be from user' }
    yield { type: 'complete' }
    return
  }

  // Create agent and run chat
  const agent = new DeskhandAgent(agentConfig)
  const previousMessages = messages.slice(0, -1)

  for await (const event of agent.chat(lastMessage.content, previousMessages)) {
    yield event
  }
}
