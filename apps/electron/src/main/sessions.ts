import { app, ipcMain, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type { IpcResponse, SessionEvent } from '../shared/types'
import type { Session, SessionWithMessages, SessionListItem, Message } from '@deskhand/shared/sessions'
import {
  createSession,
  listSessions,
  loadSession,
  deleteSession,
  updateSessionMetadata,
  appendMessage,
  generateId,
} from '@deskhand/shared/sessions'
import { chat, setPathToClaudeCodeExecutable } from '@deskhand/shared/agent'
import { loadConfig } from '@deskhand/shared/config'
import { loadCredentials } from '@deskhand/shared/credentials'

/**
 * Managed session state in memory
 */
interface ManagedSession {
  id: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  isProcessing: boolean
  abortController: AbortController | null
  streamingText: string
}

// In-memory session state
const managedSessions = new Map<string, ManagedSession>()

/**
 * Send session event to all renderer windows
 */
function sendSessionEvent(event: SessionEvent): void {
  const windows = BrowserWindow.getAllWindows()
  for (const window of windows) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.SESSION_EVENT, event)
    }
  }
}

/**
 * Get or create managed session
 */
function getOrCreateManagedSession(sessionId: string): ManagedSession {
  let managed = managedSessions.get(sessionId)
  if (!managed) {
    // Load existing messages from storage
    const loaded = loadSession(sessionId)
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    if (loaded) {
      for (const msg of loaded.messages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content })
        }
      }
    }

    managed = {
      id: sessionId,
      messages,
      isProcessing: false,
      abortController: null,
      streamingText: '',
    }
    managedSessions.set(sessionId, managed)
  }
  return managed
}

/**
 * Handle sending a message and streaming the response
 */
async function handleSendMessage(
  sessionId: string,
  userMessage: string
): Promise<void> {
  const managed = getOrCreateManagedSession(sessionId)

  if (managed.isProcessing) {
    sendSessionEvent({
      type: 'error',
      sessionId,
      error: 'Already processing a message',
    })
    return
  }

  managed.isProcessing = true
  managed.streamingText = ''
  managed.abortController = new AbortController()

  // Create user message
  const userMsg: Message = {
    id: generateId(),
    role: 'user',
    content: userMessage,
    timestamp: Date.now(),
  }

  // Persist and add to managed state
  appendMessage(sessionId, userMsg)
  managed.messages.push({ role: 'user', content: userMessage })

  // Notify renderer of user message
  sendSessionEvent({
    type: 'user_message',
    sessionId,
    message: userMsg,
    status: 'processing',
  })

  try {
    // Run agent chat
    const chatIterator = chat(managed.messages, {
      onDebug: (msg: string) => console.log(`[Agent ${sessionId}]`, msg),
    })

    for await (const event of chatIterator) {
      // Check for abort
      if (managed.abortController?.signal.aborted) {
        sendSessionEvent({ type: 'interrupted', sessionId })
        break
      }

      // Convert AgentEvent to SessionEvent
      switch (event.type) {
        case 'turn_start':
          sendSessionEvent({
            type: 'turn_start',
            sessionId,
            turnId: event.turnId,
          })
          break

        case 'turn_end':
          sendSessionEvent({
            type: 'turn_end',
            sessionId,
            turnId: event.turnId,
          })
          break

        case 'text_delta':
          managed.streamingText += event.delta
          sendSessionEvent({
            type: 'text_delta',
            sessionId,
            delta: event.delta,
            turnId: event.turnId,
            parentToolUseId: event.parentToolUseId,
          })
          break

        case 'text_complete': {
          // Only persist non-intermediate text as assistant message
          if (!event.isIntermediate) {
            const assistantMsg: Message = {
              id: generateId(),
              role: 'assistant',
              content: event.text,
              timestamp: Date.now(),
            }
            appendMessage(sessionId, assistantMsg)
            managed.messages.push({ role: 'assistant', content: event.text })
          }

          sendSessionEvent({
            type: 'text_complete',
            sessionId,
            text: event.text,
            isIntermediate: event.isIntermediate,
            turnId: event.turnId,
            parentToolUseId: event.parentToolUseId,
          })
          break
        }

        case 'tool_start':
          sendSessionEvent({
            type: 'tool_start',
            sessionId,
            toolName: event.toolName,
            toolUseId: event.toolUseId,
            toolInput: event.toolInput,
            toolIntent: event.toolIntent,
            turnId: event.turnId,
            parentToolUseId: event.parentToolUseId,
          })
          break

        case 'tool_result':
          sendSessionEvent({
            type: 'tool_result',
            sessionId,
            toolUseId: event.toolUseId,
            toolName: event.toolName,
            result: event.result,
            turnId: event.turnId,
            parentToolUseId: event.parentToolUseId,
            isError: event.isError,
          })
          break

        case 'error':
          sendSessionEvent({
            type: 'error',
            sessionId,
            error: event.message,
          })
          break

        case 'complete':
          sendSessionEvent({
            type: 'complete',
            sessionId,
            tokenUsage: event.tokenUsage,
          })
          break

        case 'info':
          sendSessionEvent({
            type: 'info',
            sessionId,
            message: event.message,
          })
          break
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    sendSessionEvent({
      type: 'error',
      sessionId,
      error: errorMessage,
    })
    sendSessionEvent({ type: 'complete', sessionId })
  } finally {
    managed.isProcessing = false
    managed.abortController = null
    managed.streamingText = ''
  }
}

/**
 * Register session IPC handlers
 */
export function registerSessionHandlers(): void {
  // List all sessions
  ipcMain.handle(
    IPC_CHANNELS.SESSION_LIST,
    async (): Promise<IpcResponse<SessionListItem[]>> => {
      try {
        const sessions = listSessions()
        return { success: true, data: sessions }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list sessions',
        }
      }
    }
  )

  // Create new session
  ipcMain.handle(
    IPC_CHANNELS.SESSION_CREATE,
    async (_, name?: string): Promise<IpcResponse<Session>> => {
      try {
        const session = createSession(name)
        return { success: true, data: session }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create session',
        }
      }
    }
  )

  // Load session with messages
  ipcMain.handle(
    IPC_CHANNELS.SESSION_LOAD,
    async (_, sessionId: string): Promise<IpcResponse<SessionWithMessages>> => {
      try {
        const session = loadSession(sessionId)
        if (!session) {
          return { success: false, error: 'Session not found' }
        }
        return { success: true, data: session }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load session',
        }
      }
    }
  )

  // Delete session
  ipcMain.handle(
    IPC_CHANNELS.SESSION_DELETE,
    async (_, sessionId: string): Promise<IpcResponse<void>> => {
      try {
        const deleted = deleteSession(sessionId)
        if (!deleted) {
          return { success: false, error: 'Session not found' }
        }
        // Clean up managed session
        managedSessions.delete(sessionId)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete session',
        }
      }
    }
  )

  // Rename session
  ipcMain.handle(
    IPC_CHANNELS.SESSION_RENAME,
    async (_, sessionId: string, name: string): Promise<IpcResponse<Session>> => {
      try {
        const session = updateSessionMetadata(sessionId, { name, updatedAt: Date.now() })
        if (!session) {
          return { success: false, error: 'Session not found' }
        }
        return { success: true, data: session }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to rename session',
        }
      }
    }
  )

  // Send message - non-blocking, returns immediately
  ipcMain.handle(
    IPC_CHANNELS.SEND_MESSAGE,
    async (_, sessionId: string, message: string): Promise<IpcResponse<{ started: boolean }>> => {
      try {
        // Start processing in background (non-blocking)
        handleSendMessage(sessionId, message).catch((error) => {
          console.error(`[Session ${sessionId}] Send message error:`, error)
          sendSessionEvent({
            type: 'error',
            sessionId,
            error: error instanceof Error ? error.message : 'Failed to send message',
          })
        })
        return { success: true, data: { started: true } }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start message processing',
        }
      }
    }
  )

  // Cancel processing
  ipcMain.handle(
    IPC_CHANNELS.CANCEL_PROCESSING,
    async (_, sessionId: string): Promise<IpcResponse<void>> => {
      try {
        const managed = managedSessions.get(sessionId)
        if (managed?.abortController) {
          managed.abortController.abort()
        }
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to cancel processing',
        }
      }
    }
  )
}

/**
 * Initialize the Claude Agent SDK.
 * Must be called before any agent operations.
 * Sets up the SDK executable path and authentication environment variables.
 */
export async function initializeAgent(): Promise<void> {
  // Set path to Claude Code executable (cli.js from SDK)
  const basePath = app.isPackaged ? app.getAppPath() : process.cwd()
  const sdkRelativePath = join('node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js')
  let cliPath = join(basePath, sdkRelativePath)

  // In monorepos, dependencies may be hoisted to the root
  if (!existsSync(cliPath) && !app.isPackaged) {
    const monorepoRoot = join(basePath, '..', '..')
    cliPath = join(monorepoRoot, sdkRelativePath)
  }

  if (existsSync(cliPath)) {
    console.log('[Agent] Setting pathToClaudeCodeExecutable:', cliPath)
    setPathToClaudeCodeExecutable(cliPath)
  } else {
    console.warn('[Agent] Claude Code SDK cli.js not found at:', cliPath)
  }

  // Set authentication environment variables
  await reinitializeAuth()
}

/**
 * Reinitialize authentication environment variables.
 * Call this after onboarding or settings changes to pick up new credentials.
 */
export async function reinitializeAuth(): Promise<void> {
  try {
    const config = loadConfig()
    const credentials = await loadCredentials()
    const customBaseUrl = config.anthropicBaseUrl

    console.log('[Agent] Reinitializing auth', customBaseUrl ? `(custom base URL: ${customBaseUrl})` : '')

    // Priority 1: Custom base URL (Ollama, OpenRouter, etc.)
    if (customBaseUrl) {
      process.env.ANTHROPIC_BASE_URL = customBaseUrl
      delete process.env.CLAUDE_CODE_OAUTH_TOKEN

      if (credentials?.anthropic?.value) {
        process.env.ANTHROPIC_API_KEY = credentials.anthropic.value
        console.log(`[Agent] Using custom provider at ${customBaseUrl}`)
      } else {
        // Set a placeholder key for providers like Ollama that don't validate keys
        process.env.ANTHROPIC_API_KEY = 'not-needed'
        console.warn('[Agent] Custom base URL configured but no API key set')
      }
    } else if (credentials?.anthropic?.type === 'oauth_token' && credentials?.anthropic?.value) {
      // Priority 2: Claude Max subscription via OAuth token
      process.env.CLAUDE_CODE_OAUTH_TOKEN = credentials.anthropic.value
      delete process.env.ANTHROPIC_API_KEY
      delete process.env.ANTHROPIC_BASE_URL
      console.log('[Agent] Set Claude OAuth Token')
    } else if (credentials?.anthropic?.value) {
      // Priority 3: API key with default Anthropic endpoint
      process.env.ANTHROPIC_API_KEY = credentials.anthropic.value
      delete process.env.CLAUDE_CODE_OAUTH_TOKEN
      delete process.env.ANTHROPIC_BASE_URL
      console.log('[Agent] Set Anthropic API Key')
    } else {
      console.error('[Agent] No authentication configured!')
    }
  } catch (error) {
    console.error('[Agent] Failed to reinitialize auth:', error)
    throw error
  }
}
