import { ipcMain, nativeTheme, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type { IpcResponse, GetConfigResponse, SetConfigRequest } from '../shared/types'
import { loadConfig, updateConfig } from './config'
import type { AppConfig } from '@deskhand/shared/config'

/**
 * Register config IPC handlers
 */
export function registerConfigHandlers(): void {
  // Get config
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET,
    async (): Promise<IpcResponse<GetConfigResponse>> => {
      try {
        const config = loadConfig()
        return { success: true, data: config }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load config',
        }
      }
    }
  )

  // Set config
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SET,
    async (_, request: SetConfigRequest): Promise<IpcResponse<void>> => {
      try {
        updateConfig(request.key, request.value as AppConfig[typeof request.key])
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save config',
        }
      }
    }
  )
}

/**
 * Register theme IPC handlers
 */
export function registerThemeHandlers(): void {
  // Get current theme
  ipcMain.handle(
    IPC_CHANNELS.THEME_GET,
    async (): Promise<IpcResponse<'light' | 'dark'>> => {
      try {
        const config = loadConfig()
        let effectiveTheme: 'light' | 'dark'

        if (config.theme === 'system') {
          effectiveTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
        } else {
          effectiveTheme = config.theme
        }

        return { success: true, data: effectiveTheme }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get theme',
        }
      }
    }
  )

  // Set theme
  ipcMain.handle(
    IPC_CHANNELS.THEME_SET,
    async (_, theme: 'light' | 'dark' | 'system'): Promise<IpcResponse<void>> => {
      try {
        updateConfig('theme', theme)

        // Notify all windows of theme change
        const effectiveTheme =
          theme === 'system'
            ? nativeTheme.shouldUseDarkColors
              ? 'dark'
              : 'light'
            : theme

        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send(IPC_CHANNELS.THEME_CHANGED, effectiveTheme)
        })

        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set theme',
        }
      }
    }
  )

  // Listen for system theme changes
  nativeTheme.on('updated', () => {
    const config = loadConfig()
    if (config.theme === 'system') {
      const effectiveTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(IPC_CHANNELS.THEME_CHANGED, effectiveTheme)
      })
    }
  })
}
