import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { Session, SessionWithMessages, Message, SessionListItem } from './types'
import { SessionSchema, MessageSchema, generateId } from './types'
import { CONFIG_DIR } from '../config/types'

const SESSIONS_DIR = 'sessions'

/**
 * Get sessions directory path
 */
function getSessionsDir(): string {
  return path.join(os.homedir(), CONFIG_DIR, SESSIONS_DIR)
}

/**
 * Ensure sessions directory exists
 */
function ensureSessionsDir(): void {
  const dir = getSessionsDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
}

/**
 * Get session file path
 */
function getSessionPath(sessionId: string): string {
  return path.join(getSessionsDir(), `${sessionId}.jsonl`)
}

/**
 * Create a new session
 */
export function createSession(name?: string): Session {
  ensureSessionsDir()

  const now = Date.now()
  const session: Session = {
    id: generateId(),
    name: name || 'New Chat',
    createdAt: now,
    updatedAt: now,
    permissionMode: 'ask',
    enabledSourceSlugs: [],
  }

  // Write session metadata as first line
  const sessionPath = getSessionPath(session.id)
  fs.writeFileSync(sessionPath, JSON.stringify({ type: 'session', ...session }) + '\n', {
    mode: 0o600,
  })

  return session
}

/**
 * List all sessions with preview text
 */
export function listSessions(): SessionListItem[] {
  ensureSessionsDir()
  const dir = getSessionsDir()

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
  const sessions: SessionListItem[] = []

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf8')
      const lines = content.split('\n').filter(Boolean)

      let session: Session | null = null
      let previewText: string | undefined

      for (const line of lines) {
        const data = JSON.parse(line)

        if (data.type === 'session') {
          const { type: _type, ...sessionData } = data
          session = SessionSchema.parse(sessionData)
        } else if (data.type === 'message' && !previewText && data.role === 'user') {
          // Get first user message as preview
          previewText = data.content?.slice(0, 100)
        }
      }

      if (session) {
        sessions.push({ ...session, previewText })
      }
    } catch {
      // Skip invalid files
    }
  }

  // Sort by updatedAt descending
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * Load a session with messages
 */
export function loadSession(sessionId: string): SessionWithMessages | null {
  const sessionPath = getSessionPath(sessionId)

  if (!fs.existsSync(sessionPath)) {
    return null
  }

  try {
    const content = fs.readFileSync(sessionPath, 'utf8')
    const lines = content.trim().split('\n').filter(Boolean)

    let session: Session | null = null
    const messages: Message[] = []

    for (const line of lines) {
      const data = JSON.parse(line)

      if (data.type === 'session') {
        const { type: _t1, ...sessionData } = data
        session = SessionSchema.parse(sessionData)
      } else if (data.type === 'message') {
        const { type: _t2, ...messageData } = data
        messages.push(MessageSchema.parse(messageData))
      }
    }

    if (!session) {
      return null
    }

    return { ...session, messages }
  } catch {
    return null
  }
}

/**
 * Append a message to a session
 */
export function appendMessage(sessionId: string, message: Message): void {
  const sessionPath = getSessionPath(sessionId)

  if (!fs.existsSync(sessionPath)) {
    throw new Error(`Session ${sessionId} not found`)
  }

  // Append message
  fs.appendFileSync(sessionPath, JSON.stringify({ type: 'message', ...message }) + '\n')

  // Update session metadata (updatedAt)
  updateSessionMetadata(sessionId, { updatedAt: Date.now() })
}

/**
 * Update session metadata
 */
export function updateSessionMetadata(
  sessionId: string,
  updates: Partial<Pick<Session, 'name' | 'updatedAt' | 'workingDirectory'>>
): Session | null {
  const sessionPath = getSessionPath(sessionId)

  if (!fs.existsSync(sessionPath)) {
    return null
  }

  try {
    const content = fs.readFileSync(sessionPath, 'utf8')
    const lines = content.trim().split('\n')

    // Parse first line (session metadata)
    const firstLine = JSON.parse(lines[0])
    const { type: _type, ...sessionData } = firstLine
    const session = SessionSchema.parse(sessionData)

    // Apply updates
    const updatedSession: Session = {
      ...session,
      ...updates,
    }

    // Rewrite first line
    lines[0] = JSON.stringify({ type: 'session', ...updatedSession })
    fs.writeFileSync(sessionPath, lines.join('\n') + '\n', { mode: 0o600 })

    return updatedSession
  } catch {
    return null
  }
}

/**
 * Delete a session
 */
export function deleteSession(sessionId: string): boolean {
  const sessionPath = getSessionPath(sessionId)

  if (!fs.existsSync(sessionPath)) {
    return false
  }

  fs.unlinkSync(sessionPath)
  return true
}
