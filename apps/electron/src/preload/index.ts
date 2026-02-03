import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods to renderer process via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,

  // IPC communication (placeholder for future use)
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },
  removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback)
  },
})
