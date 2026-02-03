import type { AuthType } from '@deskhand/shared/auth'
import type { AppConfig } from '@deskhand/shared/config'

/**
 * IPC Request/Response types
 */

// Generic response wrapper
export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// Onboarding
export interface GetAuthStateResponse {
  isConfigured: boolean
  authType: AuthType | null
  hasCredential: boolean
}

export interface SaveOnboardingConfigRequest {
  authType: AuthType
  credential: string
  anthropicBaseUrl?: string
}

export interface ValidateApiKeyRequest {
  apiKey: string
}

export interface ValidateApiKeyResponse {
  valid: boolean
  error?: string
}

// Config
export type GetConfigResponse = AppConfig

export interface SetConfigRequest {
  key: keyof AppConfig
  value: unknown
}
