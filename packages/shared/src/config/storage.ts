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

/** Get Deskhand config directory: ~/.deskhand */
export function getConfigDir(): string {
  return path.join(os.homedir(), '.deskhand');
}

/** Get config file path: ~/.deskhand/config.json */
export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

/** Get credentials file path: ~/.deskhand/credentials.enc */
export function getCredentialsPath(): string {
  return path.join(getConfigDir(), 'credentials.enc');
}

/** Get sessions directory: ~/.deskhand/sessions */
export function getSessionsDir(): string {
  return path.join(getConfigDir(), 'sessions');
}

/** Ensure config directory exists */
export function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ============ Config CRUD ============

/**
 * Load app config from disk
 */
export async function loadConfig(): Promise<AppConfig | null> {
  // 实现步骤：
  // 1. 检查 config.json 是否存在
  // 2. 读取文件内容
  // 3. JSON.parse 并返回 AppConfig
  // 4. 出错返回 null
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
  // 实现步骤：
  // 1. 确保 ~/.deskhand 目录存在
  // 2. JSON.stringify 配置（格式化）
  // 3. 写入 config.json
  ensureConfigDir();
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// ============ Credentials (API Key) ============

/**
 * Save API key to encrypted file
 */
export async function saveApiKey(apiKey: string): Promise<void> {
  // 实现步骤：
  // 1. 确保配置目录存在
  // 2. 调用 encryptCredential(apiKey)
  // 3. 写入 credentials.enc 文件
  ensureConfigDir();
  const encrypted = encryptCredential(apiKey);
  fs.writeFileSync(getCredentialsPath(), encrypted);
}

/**
 * Load API key from encrypted file
 */
export async function getApiKey(): Promise<string | null> {
  // 实现步骤：
  // 1. 检查 credentials.enc 是否存在
  // 2. 读取文件内容
  // 3. 调用 decryptCredential() 解密
  // 4. 返回解密后的 API key
  const credPath = getCredentialsPath();
  if (!fs.existsSync(credPath)) {
    return null;
  }

  try {
    const encrypted = fs.readFileSync(credPath, 'utf-8');
    return decryptCredential(encrypted);
  } catch {
    return null;
  }
}

/**
 * Check if API key exists
 */
export async function hasApiKey(): Promise<boolean> {
  return fs.existsSync(getCredentialsPath());
}

/**
 * Delete API key (logout)
 */
export async function deleteApiKey(): Promise<void> {
  const credPath = getCredentialsPath();
  if (fs.existsSync(credPath)) {
    fs.unlinkSync(credPath);
  }
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
