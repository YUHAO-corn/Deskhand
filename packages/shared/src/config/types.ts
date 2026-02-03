import { z } from 'zod'
import type { AuthType } from '../auth/types'

/**
 * App configuration schema
 */
export const AppConfigSchema = z.object({
  authType: z.enum(['api_key', 'oauth_token']).optional(),
  anthropicBaseUrl: z.string().optional(),
  customModel: z.string().optional(),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
})

export type AppConfig = z.infer<typeof AppConfigSchema>

/**
 * Default configuration
 */
export const defaultConfig: AppConfig = {
  authType: undefined,
  anthropicBaseUrl: undefined,
  customModel: undefined,
  theme: 'system',
}

/**
 * Local storage paths
 */
export const CONFIG_DIR = '.deskhand'
export const CONFIG_FILE = 'config.json'
export const CREDENTIALS_FILE = 'credentials.enc'
