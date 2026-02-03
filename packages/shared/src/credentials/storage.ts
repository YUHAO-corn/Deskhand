import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { CONFIG_DIR, CREDENTIALS_FILE } from '../config/types'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const PBKDF2_ITERATIONS = 100000

/**
 * Get machine-specific identifier for key derivation
 */
async function getMachineId(): Promise<string> {
  // Use hostname + username as a simple machine-specific identifier
  // In production, consider using system-specific APIs like IOPlatformUUID
  const hostname = os.hostname()
  const username = os.userInfo().username
  return `${hostname}-${username}-deskhand`
}

/**
 * Derive encryption key from machine identifier
 */
async function deriveKey(salt: Buffer): Promise<Buffer> {
  const machineId = await getMachineId()
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(machineId, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256', (err, key) => {
      if (err) reject(err)
      else resolve(key)
    })
  })
}

/**
 * Get credentials file path
 */
function getCredentialsPath(): string {
  return path.join(os.homedir(), CONFIG_DIR, CREDENTIALS_FILE)
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
 * Encrypted credential storage format
 */
interface EncryptedData {
  version: number
  salt: string      // hex
  iv: string        // hex
  authTag: string   // hex
  data: string      // hex (encrypted)
}

/**
 * Stored credentials structure
 */
export interface StoredCredentials {
  anthropic?: {
    type: 'api_key' | 'oauth_token'
    value: string
    createdAt: number
  }
}

/**
 * Save credentials with AES-256-GCM encryption
 */
export async function saveCredentials(credentials: StoredCredentials): Promise<void> {
  ensureConfigDir()

  const salt = crypto.randomBytes(32)
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = await deriveKey(salt)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const plaintext = JSON.stringify(credentials)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])

  const authTag = cipher.getAuthTag()

  const encryptedData: EncryptedData = {
    version: 2,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted.toString('hex'),
  }

  const credPath = getCredentialsPath()
  fs.writeFileSync(credPath, JSON.stringify(encryptedData), {
    mode: 0o600
  })
}

/**
 * Load and decrypt credentials
 */
export async function loadCredentials(): Promise<StoredCredentials | null> {
  const credPath = getCredentialsPath()

  if (!fs.existsSync(credPath)) {
    return null
  }

  try {
    const fileContent = fs.readFileSync(credPath, 'utf8')
    const encryptedData: EncryptedData = JSON.parse(fileContent)

    const salt = Buffer.from(encryptedData.salt, 'hex')
    const iv = Buffer.from(encryptedData.iv, 'hex')
    const authTag = Buffer.from(encryptedData.authTag, 'hex')
    const encrypted = Buffer.from(encryptedData.data, 'hex')

    const key = await deriveKey(salt)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])

    return JSON.parse(decrypted.toString('utf8'))
  } catch (error) {
    console.error('Failed to load credentials:', error)
    return null
  }
}

/**
 * Check if credentials exist
 */
export function hasCredentials(): boolean {
  return fs.existsSync(getCredentialsPath())
}

/**
 * Delete credentials file
 */
export function deleteCredentials(): void {
  const credPath = getCredentialsPath()
  if (fs.existsSync(credPath)) {
    fs.unlinkSync(credPath)
  }
}
