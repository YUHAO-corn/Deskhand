import Anthropic from '@anthropic-ai/sdk'
import { loadCredentials } from '../credentials'
import { loadConfig } from '../config'

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
 * Get the Anthropic client with credentials
 * Priority: Environment variables > Config file
 */
async function getAnthropicClient(): Promise<Anthropic> {
  // Check environment variables first (for dev/testing)
  const envApiKey = process.env.ANTHROPIC_API_KEY
  const envBaseUrl = process.env.ANTHROPIC_BASE_URL

  if (envApiKey) {
    return new Anthropic({
      apiKey: envApiKey,
      baseURL: envBaseUrl || undefined,
    })
  }

  // Fall back to config file
  const credentials = await loadCredentials()
  const config = loadConfig()

  if (!credentials?.anthropic) {
    throw new Error('No API credentials configured. Set ANTHROPIC_API_KEY env var or configure in app.')
  }

  return new Anthropic({
    apiKey: credentials.anthropic.value,
    baseURL: config.anthropicBaseUrl || undefined,
  })
}

/**
 * Simple agent chat function that yields AgentEvents
 * Simplified from craft-agents-oss for MVP
 */
export async function* chat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  config: AgentConfig = {}
): AsyncGenerator<AgentEvent> {
  const { model = DEFAULT_MODEL, onDebug } = config

  try {
    const client = await getAnthropicClient()

    onDebug?.(`Starting chat with model: ${model}`)
    onDebug?.(`Messages: ${messages.length}`)

    // Create streaming message
    const stream = await client.messages.stream({
      model,
      max_tokens: 8192,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      system: 'You are a helpful AI assistant called Deskhand. Be concise and helpful.',
    })

    let fullText = ''
    let inputTokens = 0
    let outputTokens = 0

    // Process streaming events
    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullText += event.delta.text
          yield { type: 'text_delta', delta: event.delta.text }
        }
      } else if (event.type === 'message_start') {
        if (event.message.usage) {
          inputTokens = event.message.usage.input_tokens
        }
      } else if (event.type === 'message_delta') {
        if (event.usage) {
          outputTokens = event.usage.output_tokens
        }
      }
    }

    // Emit text complete
    if (fullText) {
      yield { type: 'text_complete', text: fullText }
    }

    // Emit complete with token usage
    yield {
      type: 'complete',
      tokenUsage: { inputTokens, outputTokens },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    onDebug?.(`Chat error: ${message}`)
    yield { type: 'error', message }
    yield { type: 'complete' }
  }
}

export { getAnthropicClient }
