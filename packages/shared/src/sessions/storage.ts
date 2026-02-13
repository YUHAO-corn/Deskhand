/**
 * Session storage for Deskhand
 *
 * Sessions are persisted as JSONL files:
 * - Each session has its own directory: ~/.deskhand/sessions/{sessionId}/
 * - session.jsonl contains: line 1 = header (session meta), lines 2+ = messages
 * - JSONL format enables append-only writes for better performance
 *
 * File structure:
 *   {"_type":"session","id":"...","createdAt":...}       <- header (line 1)
 *   {"_type":"message","id":"...","role":"user",...}    <- messages (lines 2+)
 *   {"_type":"message","id":"...","role":"assistant",...}
 *   {"_type":"usage","usage":{...}}                      <- token usage (last line)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Session, StoredSession, StoredMessage, SessionMeta, TokenUsage } from '@deskhand/core';
import { getConfigDir } from '../config/storage.ts';

// ============ Paths ============

/** Get sessions directory */
export function getSessionsDir(): string {
  return path.join(getConfigDir(), 'sessions');
}

/** Get session directory */
export function getSessionDir(sessionId: string): string {
  return path.join(getSessionsDir(), sessionId);
}

/** Get session JSONL file path */
export function getSessionFilePath(sessionId: string): string {
  return path.join(getSessionDir(sessionId), 'session.jsonl');
}

// ============ Session CRUD ============

/**
 * Create a new session
 */
export async function createSession(session: Session): Promise<void> {
  const sessionDir = getSessionDir(session.id);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Write initial session metadata
  const filePath = getSessionFilePath(session.id);
  const header = JSON.stringify({ ...session, _type: 'session' });
  fs.writeFileSync(filePath, header + '\n');
}

/**
 * Load session with messages
 */
export async function loadSession(sessionId: string): Promise<StoredSession | null> {
  const filePath = getSessionFilePath(sessionId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    let session: Session | null = null;
    const messages: StoredMessage[] = [];
    let tokenUsage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      contextTokens: 0,
      costUsd: 0,
    };

    for (const line of lines) {
      const obj = JSON.parse(line);
      if (obj._type === 'session') {
        const { _type, ...rest } = obj;
        session = rest as Session;
      } else if (obj._type === 'message') {
        const { _type, ...rest } = obj;
        messages.push(rest as StoredMessage);
      } else if (obj._type === 'usage') {
        tokenUsage = obj.usage as TokenUsage;
      }
    }

    if (!session) return null;

    return {
      ...session,
      messages,
      tokenUsage,
    };
  } catch {
    return null;
  }
}

/**
 * Append message to session
 */
export async function appendMessage(sessionId: string, message: StoredMessage): Promise<void> {
  const filePath = getSessionFilePath(sessionId);
  const line = JSON.stringify({ ...message, _type: 'message' }) + '\n';
  fs.appendFileSync(filePath, line);
}

/**
 * List all session metadata (for sidebar)
 */
export async function listSessions(): Promise<SessionMeta[]> {
  const sessionsDir = getSessionsDir();
  if (!fs.existsSync(sessionsDir)) {
    return [];
  }

  const metas: SessionMeta[] = [];
  const dirs = fs.readdirSync(sessionsDir);

  for (const dir of dirs) {
    const filePath = path.join(sessionsDir, dir, 'session.jsonl');
    if (!fs.existsSync(filePath)) continue;

    try {
      // Read only first line for metadata
      const content = fs.readFileSync(filePath, 'utf-8');
      const firstLine = content.split('\n')[0];
      if (!firstLine) continue;

      const obj = JSON.parse(firstLine);
      if (obj._type === 'session') {
        const { _type, ...session } = obj;
        metas.push(session as SessionMeta);
      }
    } catch {
      // Skip corrupted sessions
    }
  }

  // Sort by lastMessageAt descending
  return metas.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
}

/**
 * Delete session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  // 实现步骤：
  // 1. 获取会话目录路径
  // 2. 如果目录存在，递归删除
  const sessionDir = getSessionDir(sessionId);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true });
  }
}

/**
 * Update session metadata (name, lastMessageAt, etc.)
 */
export async function updateSessionMeta(
  sessionId: string,
  updates: Partial<Pick<Session, 'name' | 'lastMessageAt' | 'preview' | 'messageCount'>>
): Promise<void> {
  // 实现步骤：
  // 1. 读取完整的 session.jsonl
  // 2. 解析第一行（header），更新字段
  // 3. 重写整个文件（header + messages）
  // 注意：JSONL 格式不支持原地修改，需要重写
  const session = await loadSession(sessionId);
  if (!session) return;

  // Merge updates
  const updatedSession: Session = {
    id: session.id,
    createdAt: session.createdAt,
    messageCount: updates.messageCount ?? session.messageCount,
    name: updates.name ?? session.name,
    lastMessageAt: updates.lastMessageAt ?? session.lastMessageAt,
    preview: updates.preview ?? session.preview,
  };

  // Rewrite the file
  const filePath = getSessionFilePath(sessionId);
  let content = JSON.stringify({ ...updatedSession, _type: 'session' }) + '\n';
  for (const msg of session.messages) {
    content += JSON.stringify({ ...msg, _type: 'message' }) + '\n';
  }
  content += JSON.stringify({ _type: 'usage', usage: session.tokenUsage }) + '\n';
  fs.writeFileSync(filePath, content);
}

/**
 * Generate unique session ID
 * Format: YYMMDD-random (e.g., 260206-a1b2c3)
 */
export function generateSessionId(): string {
  // 实现步骤：
  // 1. 获取当前日期，格式化为 YYMMDD
  // 2. 生成 6 位随机字符串
  // 3. 组合为 YYMMDD-random
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8);
  return `${yy}${mm}${dd}-${random}`;
}

/**
 * Clear all messages from a session (for /clear command)
 */
export async function clearSessionMessages(sessionId: string): Promise<void> {
  // 实现步骤：
  // 1. 读取会话元数据
  // 2. 重写文件，只保留 header，清空 messages
  const session = await loadSession(sessionId);
  if (!session) return;

  const filePath = getSessionFilePath(sessionId);
  const header = JSON.stringify({
    _type: 'session',
    id: session.id,
    createdAt: session.createdAt,
    name: session.name,
  });
  fs.writeFileSync(filePath, header + '\n');
}
