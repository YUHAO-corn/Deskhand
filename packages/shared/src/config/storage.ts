/**
 * Configuration storage for Deskhand
 *
 * Handles:
 * - API key encrypted storage (AES-256-GCM)
 * - App preferences
 * - Window state persistence
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { AppConfig } from '@deskhand/core';

// ============ Paths ============

/** Get Deskhand config directory */
export function getConfigDir(): string {
  return path.join(os.homedir(), '.deskhand');
}

/** Get config file path */
export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

/** Get credentials file path */
export function getCredentialsPath(): string {
  return path.join(getConfigDir(), 'credentials.enc');
}

// ============ Config CRUD ============

/**
 * Load app config from disk
 *
 * TODO: Implement
 * - Read config.json
 * - Parse JSON
 * - Return typed config
 */
export async function loadConfig(): Promise<AppConfig | null> {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as AppConfig;
  } catch {
    return null;
  }
}

/**
 * Save app config to disk
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// ============ Encryption ============

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Machine-specific key derivation (simplified)
function deriveKey(): Buffer {
  const machineId = os.hostname() + os.userInfo().username;
  return crypto.scryptSync(machineId, 'deskhand-salt', KEY_LENGTH);
}

/**
 * Encrypt sensitive data (API key)
 */
export function encryptCredential(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
export function decryptCredential(ciphertext: string): string | null {
  try {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
    if (!ivHex || !authTagHex || !encrypted) return null;

    const key = deriveKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    return null;
  }
}
