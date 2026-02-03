import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { AppConfig } from '@deskhand/shared/config'
import { AppConfigSchema, defaultConfig, CONFIG_DIR, CONFIG_FILE } from '@deskhand/shared/config'

/**
 * Get config file path
 */
function getConfigPath(): string {
  return path.join(os.homedir(), CONFIG_DIR, CONFIG_FILE)
}

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
  const configDir = path.join(os.homedir(), CONFIG_DIR)
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 })
  }
}

/**
 * Load app configuration
 */
export function loadConfig(): AppConfig {
  const configPath = getConfigPath()

  if (!fs.existsSync(configPath)) {
    return defaultConfig
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8')
    const parsed = JSON.parse(content)
    return AppConfigSchema.parse({ ...defaultConfig, ...parsed })
  } catch (error) {
    console.error('Failed to load config:', error)
    return defaultConfig
  }
}

/**
 * Save app configuration
 */
export function saveConfig(config: AppConfig): void {
  ensureConfigDir()
  const configPath = getConfigPath()
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
    mode: 0o600
  })
}

/**
 * Update a specific config key
 */
export function updateConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): AppConfig {
  const config = loadConfig()
  config[key] = value
  saveConfig(config)
  return config
}
