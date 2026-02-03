import { ipcMain } from 'electron'
import Anthropic from '@anthropic-ai/sdk'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type {
  IpcResponse,
  GetAuthStateResponse,
  SaveOnboardingConfigRequest,
  ValidateApiKeyRequest,
  ValidateApiKeyResponse,
} from '../shared/types'
import { loadConfig, saveConfig } from './config'
import { saveCredentials, hasCredentials } from '@deskhand/shared/credentials'
import type { AuthType } from '@deskhand/shared/auth'

/**
 * Register onboarding IPC handlers
 */
export function registerOnboardingHandlers(): void {
  // Get current auth state
  ipcMain.handle(
    IPC_CHANNELS.ONBOARDING_GET_AUTH_STATE,
    async (): Promise<IpcResponse<GetAuthStateResponse>> => {
      try {
        const config = loadConfig()
        const hasCreds = hasCredentials()

        return {
          success: true,
          data: {
            isConfigured: !!config.authType && hasCreds,
            authType: (config.authType as AuthType) || null,
            hasCredential: hasCreds,
          },
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }
  )

  // Validate API key
  ipcMain.handle(
    IPC_CHANNELS.ONBOARDING_VALIDATE_API_KEY,
    async (_, request: ValidateApiKeyRequest): Promise<IpcResponse<ValidateApiKeyResponse>> => {
      try {
        const client = new Anthropic({
          apiKey: request.apiKey,
        })

        // Try a simple API call to validate the key
        await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        })

        return {
          success: true,
          data: { valid: true },
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invalid API key'
        return {
          success: true,
          data: {
            valid: false,
            error: errorMessage,
          },
        }
      }
    }
  )

  // Save onboarding configuration
  ipcMain.handle(
    IPC_CHANNELS.ONBOARDING_SAVE_CONFIG,
    async (_, request: SaveOnboardingConfigRequest): Promise<IpcResponse<void>> => {
      try {
        // Save credentials (encrypted)
        await saveCredentials({
          anthropic: {
            type: request.authType,
            value: request.credential,
            createdAt: Date.now(),
          },
        })

        // Save config
        const config = loadConfig()
        config.authType = request.authType
        if (request.anthropicBaseUrl) {
          config.anthropicBaseUrl = request.anthropicBaseUrl
        }
        saveConfig(config)

        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save configuration',
        }
      }
    }
  )
}
