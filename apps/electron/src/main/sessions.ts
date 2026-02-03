import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type { IpcResponse } from '../shared/types'
import type { Session, SessionWithMessages, SessionListItem } from '@deskhand/shared/sessions'
import {
  createSession,
  listSessions,
  loadSession,
  deleteSession,
  updateSessionMetadata,
} from '@deskhand/shared/sessions'

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
}
