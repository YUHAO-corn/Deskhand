/**
 * Session storage for Deskhand
 *
 * Sessions are persisted as JSONL files:
 * - Each session has its own directory
 * - session.jsonl contains messages (one JSON per line)
 * - Debounced async writes for performance
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
  const sessionDir = getSessionDir(sessionId);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true });
  }
}
