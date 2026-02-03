import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'

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
