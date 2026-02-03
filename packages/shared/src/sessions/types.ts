import { z } from 'zod'

/**
 * Permission mode types
 */
export const PermissionModeSchema = z.enum(['safe', 'ask', 'allow-all'])
export type PermissionMode = z.infer<typeof PermissionModeSchema>

/**
 * Tool status types
 */
export const ToolStatusSchema = z.enum(['pending', 'executing', 'completed', 'error'])
export type ToolStatus = z.infer<typeof ToolStatusSchema>

/**
 * Message role types
 */
export const MessageRoleSchema = z.enum(['user', 'assistant', 'tool', 'error', 'warning'])
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
  // Tool-related fields
  toolUseId: z.string().optional(),
  toolName: z.string().optional(),
  toolInput: z.unknown().optional(),
  toolResult: z.string().optional(),
  toolStatus: ToolStatusSchema.optional(),
  toolDuration: z.number().optional(),
  toolIntent: z.string().optional(),
})
export type Message = z.infer<typeof MessageSchema>

/**
 * Token usage tracking
 */
export const TokenUsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadTokens: z.number().optional(),
  cacheCreationTokens: z.number().optional(),
})
export type TokenUsage = z.infer<typeof TokenUsageSchema>

/**
 * Session schema
 */
export const SessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  workingDirectory: z.string().optional(),
  // SPEC required fields
  permissionMode: PermissionModeSchema.default('ask'),
  enabledSourceSlugs: z.array(z.string()).default([]),
  tokenUsage: TokenUsageSchema.optional(),
})
export type Session = z.infer<typeof SessionSchema>

/**
 * Session with messages (for loading)
 */
export interface SessionWithMessages extends Session {
  messages: Message[]
}

/**
 * Session metadata for listing (includes preview)
 */
export interface SessionListItem extends Session {
  previewText?: string
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
