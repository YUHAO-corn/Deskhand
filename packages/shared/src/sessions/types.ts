import { z } from 'zod'

/**
 * Message role types
 */
export const MessageRoleSchema = z.enum(['user', 'assistant', 'tool', 'error'])
export type MessageRole = z.infer<typeof MessageRoleSchema>

/**
 * Message schema
 */
export const MessageSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  timestamp: z.number(),
  isIntermediate: z.boolean().optional(),
  toolUseId: z.string().optional(),
})
export type Message = z.infer<typeof MessageSchema>

/**
 * Session schema
 */
export const SessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  workingDirectory: z.string().optional(),
})
export type Session = z.infer<typeof SessionSchema>

/**
 * Session with messages (for loading)
 */
export interface SessionWithMessages extends Session {
  messages: Message[]
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
