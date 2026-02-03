import { z } from 'zod'

/**
 * Supported authentication types
 */
export const AuthTypeSchema = z.enum(['api_key', 'oauth_token'])
export type AuthType = z.infer<typeof AuthTypeSchema>

/**
 * API Key credential
 */
export const ApiKeyCredentialSchema = z.object({
  type: z.literal('api_key'),
  apiKey: z.string().min(1),
  createdAt: z.number(),
})
export type ApiKeyCredential = z.infer<typeof ApiKeyCredentialSchema>

/**
 * OAuth token credential (Claude Pro/Max)
 */
export const OAuthCredentialSchema = z.object({
  type: z.literal('oauth_token'),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
  createdAt: z.number(),
})
export type OAuthCredential = z.infer<typeof OAuthCredentialSchema>

/**
 * Union of all credential types
 */
export const CredentialSchema = z.discriminatedUnion('type', [
  ApiKeyCredentialSchema,
  OAuthCredentialSchema,
])
export type Credential = z.infer<typeof CredentialSchema>

/**
 * Authentication state
 */
export interface AuthState {
  isConfigured: boolean
  authType: AuthType | null
  hasCredential: boolean
}

/**
 * Onboarding configuration to save
 */
export interface OnboardingConfig {
  authType: AuthType
  credential: string // API key or OAuth token
  anthropicBaseUrl?: string
}
