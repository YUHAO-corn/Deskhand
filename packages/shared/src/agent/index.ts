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
 * Matches the SessionEvent pattern from craft-agents-oss
 */
export type AgentEvent =
  | { type: 'text_delta'; delta: string; turnId?: string }
  | { type: 'text_complete'; text: string; isIntermediate?: boolean; turnId?: string }
  | { type: 'tool_start'; toolName: string; toolUseId: string; toolInput: Record<string, unknown>; turnId?: string }
  | { type: 'tool_result'; toolUseId: string; toolName: string; result: string; turnId?: string; isError?: boolean }
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
      const options: Partial<Options> = {
        ...defaultOptions,
        model,
        systemPrompt: 'You are a helpful AI assistant called Deskhand. Be concise and helpful.',
        cwd: this.config.workingDirectory,
        abortController: this.abortController,
        includePartialMessages: true, // Enable streaming
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

      let fullText = ''
      let inputTokens = 0
      let outputTokens = 0

      // Process streaming messages from SDK
      for await (const message of this.currentQuery) {
        // Check for abort
        if (this.abortController.signal.aborted) {
          onDebug?.('Query aborted')
          break
        }

        // Process message based on type
        if (message.type === 'stream_event') {
          // Streaming event - handle text deltas
          const event = message.event
          if (event.type === 'content_block_delta') {
            const delta = event.delta as { type: string; text?: string }
            if (delta.type === 'text_delta' && delta.text) {
              fullText += delta.text
              yield { type: 'text_delta', delta: delta.text }
            }
          }
        } else if (message.type === 'assistant') {
          // Assistant message - extract text content
          for (const block of message.message.content) {
            if (block.type === 'text') {
              const newText = block.text.slice(fullText.length)
              if (newText) {
                fullText = block.text
                yield { type: 'text_delta', delta: newText }
              }
            } else if (block.type === 'tool_use') {
              yield {
                type: 'tool_start',
                toolName: block.name,
                toolUseId: block.id,
                toolInput: block.input as Record<string, unknown>,
              }
            }
          }

          // Capture usage if available
          if (message.message.usage) {
            inputTokens = message.message.usage.input_tokens
            outputTokens = message.message.usage.output_tokens
          }
        } else if (message.type === 'result') {
          // Result message - query completed
          if (message.subtype === 'success') {
            // Extract usage from result
            if (message.usage) {
              inputTokens = message.usage.input_tokens
              outputTokens = message.usage.output_tokens
            }
          }
        }
      }

      // Emit text complete if we have text
      if (fullText) {
        yield { type: 'text_complete', text: fullText }
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
