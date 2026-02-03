import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { AppConfigSchema, defaultConfig, CONFIG_DIR, CONFIG_FILE } from './types'
import type { AppConfig } from './types'

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
export function saveConfig(config: Partial<AppConfig>): AppConfig {
  ensureConfigDir()

  const currentConfig = loadConfig()
  const newConfig = AppConfigSchema.parse({ ...currentConfig, ...config })

  const configPath = getConfigPath()
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), {
    mode: 0o600,
  })

  return newConfig
}
