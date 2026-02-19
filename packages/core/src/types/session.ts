/**
 * Session types for Deskhand
 *
 * Sessions are the primary isolation boundary. Each session maps 1:1
 * with a Claude Agent SDK instance and conversation.
 *
 * Key features:
 * - Permission mode management (safe/ask/allow-all)
 * - Thinking level configuration
 * - Working directory binding
 */

import type { StoredMessage, TokenUsage } from './message.ts';

// ============ Enums ============

/** Permission mode for Agent execution */
export type PermissionMode = 'safe' | 'ask' | 'allow-all';

/** Thinking level for Claude */
export type ThinkingLevel = 'off' | 'think' | 'max';

// ============ Session ============

/**
 * Session represents a conversation scope
 * Each session has independent state and can have different configurations
 */
export interface Session {
  id: string;
  name?: string;                     // User-defined name
  createdAt: number;                 // Creation timestamp
  lastMessageAt?: number;            // Last message timestamp (for sorting)
  preview?: string;                  // First user message preview
  messageCount: number;              // Number of messages

  // Permission & Mode
  permissionMode?: PermissionMode;   // safe/ask/allow-all
  thinkingLevel?: ThinkingLevel;     // off/think/max

  // Working directory
  workingDirectory?: string;         // Agent's working directory

  // Model override
  model?: string;                    // Model ID (overrides global config)

  // Unread tracking
  hasUnread?: boolean;               // Has unread messages
  lastReadMessageId?: string;        // Last read message ID

  // Visibility
  hidden?: boolean;                  // Hidden from session list

  // Artifacts
  artifacts?: string[];              // File paths captured from agent Write/Edit operations
}

/**
 * Stored session with full conversation data (for persistence)
 */
export interface StoredSession extends Session {
  messages: StoredMessage[];
  tokenUsage: TokenUsage;
}

/**
 * Session metadata for list display (without loading full messages)
 * Used for lazy loading - only load full session when needed
 */
export interface SessionMeta {
  id: string;
  name?: string;
  preview?: string;                  // First user message preview
  lastMessageAt?: number;
  createdAt?: number;
  messageCount?: number;
  isProcessing?: boolean;            // Currently processing
  workingDirectory?: string;
  hasUnread?: boolean;
  permissionMode?: PermissionMode;
  model?: string;
  tokenUsage?: TokenUsage;
  hidden?: boolean;
}
