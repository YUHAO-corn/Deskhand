import { ipcMain, BrowserWindow } from 'electron'
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
import { chat } from '@deskhand/shared/agent'

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
        case 'text_delta':
          managed.streamingText += event.delta
          sendSessionEvent({
            type: 'text_delta',
            sessionId,
            delta: event.delta,
            turnId: event.turnId,
          })
          break

        case 'text_complete': {
          // Create and persist assistant message
          const assistantMsg: Message = {
            id: generateId(),
            role: 'assistant',
            content: event.text,
            timestamp: Date.now(),
          }
          appendMessage(sessionId, assistantMsg)
          managed.messages.push({ role: 'assistant', content: event.text })

          sendSessionEvent({
            type: 'text_complete',
            sessionId,
            text: event.text,
            isIntermediate: event.isIntermediate,
            turnId: event.turnId,
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
            turnId: event.turnId,
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
