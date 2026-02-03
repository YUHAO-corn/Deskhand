import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type { SessionEvent } from '../shared/types'

// Type-safe IPC API
const electronAPI = {
  // Platform info
  platform: process.platform,

  // Onboarding
  getAuthState: () => ipcRenderer.invoke(IPC_CHANNELS.ONBOARDING_GET_AUTH_STATE),
  validateApiKey: (apiKey: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ONBOARDING_VALIDATE_API_KEY, { apiKey }),
  saveOnboardingConfig: (config: { authType: string; credential: string; anthropicBaseUrl?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.ONBOARDING_SAVE_CONFIG, config),

  // Sessions
  listSessions: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_LIST),
  createSession: (name?: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_CREATE, name),
  loadSession: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_LOAD, sessionId),
  deleteSession: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE, sessionId),
  renameSession: (sessionId: string, name: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_RENAME, sessionId, name),

  // Message handling
  sendMessage: (sessionId: string, message: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_MESSAGE, sessionId, message),
  cancelProcessing: (sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CANCEL_PROCESSING, sessionId),

  // Permission handling
  respondToPermission: (requestId: string, allowed: boolean, alwaysAllow?: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESPOND_TO_PERMISSION, requestId, allowed, alwaysAllow),

  // Event listeners
  onSessionEvent: (callback: (event: SessionEvent) => void) => {
    const handler = (_event: unknown, sessionEvent: SessionEvent) => callback(sessionEvent)
    ipcRenderer.on(IPC_CHANNELS.SESSION_EVENT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SESSION_EVENT, handler)
  },

  // Config
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET),
  setConfig: (key: string, value: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, { key, value }),

  // Theme
  getTheme: () => ipcRenderer.invoke(IPC_CHANNELS.THEME_GET),
  setTheme: (theme: 'light' | 'dark' | 'system') =>
    ipcRenderer.invoke(IPC_CHANNELS.THEME_SET, theme),
  onThemeChanged: (callback: (theme: 'light' | 'dark') => void) => {
    const handler = (_event: unknown, theme: 'light' | 'dark') => callback(theme)
    ipcRenderer.on(IPC_CHANNELS.THEME_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.THEME_CHANGED, handler)
  },
}

// Expose to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Type declaration for renderer
export type ElectronAPI = typeof electronAPI
