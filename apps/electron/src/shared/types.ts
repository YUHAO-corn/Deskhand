import type { AuthType } from '@deskhand/shared/auth'
import type { AppConfig } from '@deskhand/shared/config'
import type { Message, PermissionMode, TokenUsage } from '@deskhand/shared/sessions'

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
  anthropicBaseUrl?: string
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

/**
 * SessionEvent - Events sent from main to renderer for real-time updates
 * Based on craft-agents-oss architecture
 */
export type SessionEvent =
  // Streaming text content
  | { type: 'text_delta'; sessionId: string; delta: string; turnId?: string }
  | {
      type: 'text_complete'
      sessionId: string
      text: string
      isIntermediate?: boolean
      turnId?: string
    }
  // Tool execution
  | {
      type: 'tool_start'
      sessionId: string
      toolName: string
      toolUseId: string
      toolInput: Record<string, unknown>
      toolIntent?: string
      turnId?: string
    }
  | {
      type: 'tool_result'
      sessionId: string
      toolUseId: string
      toolName: string
      result: string
      turnId?: string
      isError?: boolean
    }
  // Control flow
  | { type: 'error'; sessionId: string; error: string }
  | {
      type: 'complete'
      sessionId: string
      tokenUsage?: TokenUsage
    }
  | { type: 'interrupted'; sessionId: string; message?: Message }
  // Status/info
  | { type: 'status'; sessionId: string; message: string }
  | { type: 'info'; sessionId: string; message: string }
  // Permission requests
  | { type: 'permission_request'; sessionId: string; request: PermissionRequest }
  | {
      type: 'permission_mode_changed'
      sessionId: string
      permissionMode: PermissionMode
    }
  // User message events (for optimistic UI)
  | {
      type: 'user_message'
      sessionId: string
      message: Message
      status: 'accepted' | 'queued' | 'processing'
    }
  // Title generated
  | { type: 'title_generated'; sessionId: string; title: string }
  // Usage updates
  | { type: 'usage_update'; sessionId: string; tokenUsage: { inputTokens: number } }

/**
 * Permission request for tool execution approval
 */
export interface PermissionRequest {
  requestId: string
  sessionId: string
  toolName: string
  command: string
  description?: string
  intent?: string
}
