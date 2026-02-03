/**
 * IPC Channel definitions
 * All IPC communication between main and renderer process goes through these channels
 */

export const IPC_CHANNELS = {
  // Onboarding
  ONBOARDING_GET_AUTH_STATE: 'onboarding:get-auth-state',
  ONBOARDING_SAVE_CONFIG: 'onboarding:save-config',
  ONBOARDING_VALIDATE_API_KEY: 'onboarding:validate-api-key',

  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',

  // Theme
  THEME_GET: 'theme:get',
  THEME_SET: 'theme:set',
  THEME_CHANGED: 'theme:changed',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
