import type { Options } from '@anthropic-ai/claude-agent-sdk'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs'

// Module-level state for SDK options
let optionsEnv: Record<string, string> = {}
let customPathToClaudeCodeExecutable: string | null = null
let claudeConfigChecked = false

// UTF-8 BOM character — Windows editors/processes sometimes prepend this to files.
const UTF8_BOM = '\uFEFF'

/**
 * Ensure ~/.claude.json exists and contains valid, BOM-free JSON before
 * the SDK subprocess starts.
 *
 * Background: The SDK's cli.js reads this file on startup. If it's missing
 * or contains invalid JSON, the CLI crashes.
 */
function ensureClaudeConfig(): void {
  if (claudeConfigChecked) return
  claudeConfigChecked = true

  const configPath = join(homedir(), '.claude.json')

  // Clean up stale .backup file
  const backupPath = `${configPath}.backup`
  if (existsSync(backupPath)) {
    try {
      unlinkSync(backupPath)
    } catch {
      // best effort
    }
  }

  // Clean up .corrupted.* files
  try {
    const homeDir = homedir()
    const files = readdirSync(homeDir)
    for (const file of files) {
      if (file.startsWith('.claude.json.corrupted.')) {
        try {
          unlinkSync(join(homeDir, file))
        } catch {
          /* best effort */
        }
      }
    }
  } catch {
    // If we can't read homedir, continue
  }

  // If file doesn't exist, create it with minimal valid JSON
  if (!existsSync(configPath)) {
    writeConfigSafe(configPath, '{}')
    return
  }

  // File exists — read and validate
  try {
    const raw = readFileSync(configPath, 'utf-8')
    const content = raw.startsWith(UTF8_BOM) ? raw.slice(1) : raw
    const hasBom = raw !== content

    if (content.trim().length === 0) {
      writeConfigSafe(configPath, '{}')
      return
    }

    // Try to parse the (BOM-stripped) content
    JSON.parse(content)

    if (hasBom) {
      // Valid JSON but had BOM prefix — rewrite without BOM
      writeConfigSafe(configPath, content)
    }
  } catch {
    // File exists but contains invalid JSON — reset
    writeConfigSafe(configPath, '{}')
  }
}

/**
 * Write content to a config file with retry logic for Windows.
 */
function writeConfigSafe(configPath: string, content: string): void {
  try {
    writeFileSync(configPath, content, 'utf-8')
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (process.platform === 'win32' && (code === 'EBUSY' || code === 'EPERM')) {
      const start = Date.now()
      while (Date.now() - start < 100) {
        /* busy wait */
      }
      try {
        writeFileSync(configPath, content, 'utf-8')
      } catch {
        // retry failed
      }
    }
  }
}

/**
 * Reset the once-per-process guard so ensureClaudeConfig() runs again.
 */
export function resetClaudeConfigCheck(): void {
  claudeConfigChecked = false
}

/**
 * Set environment variables to pass to SDK subprocess.
 * Used for ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, etc.
 */
export function setAnthropicOptionsEnv(env: Record<string, string>): void {
  optionsEnv = env
}

/**
 * Override the path to the Claude Code executable (cli.js from the SDK).
 * This is needed when the SDK is bundled (e.g., in Electron).
 */
export function setPathToClaudeCodeExecutable(path: string): void {
  customPathToClaudeCodeExecutable = path
}

/**
 * Get default options for the Claude Agent SDK.
 * Handles custom executable paths and environment variable injection.
 */
export function getDefaultOptions(): Partial<Options> {
  // Repair corrupted ~/.claude.json before the SDK subprocess reads it
  ensureClaudeConfig()

  // SECURITY: Disable Bun's automatic .env file loading in the SDK subprocess
  const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null'
  const envFileFlag = `--env-file=${nullDevice}`

  // If custom path is set (e.g., for Electron), use it
  if (customPathToClaudeCodeExecutable) {
    return {
      pathToClaudeCodeExecutable: customPathToClaudeCodeExecutable,
      // Let SDK auto-detect executable (bun/node/deno)
      env: {
        ...process.env,
        ...optionsEnv,
      },
    }
  }

  return {
    executableArgs: [envFileFlag],
    env: {
      ...process.env,
      ...optionsEnv,
    },
  }
}
