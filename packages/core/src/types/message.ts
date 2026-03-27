/**
 * Message types for Deskhand
 *
 * Messages are the atomic unit of conversation, supporting various roles
 * including user input, AI responses, tool calls, and system notifications.
 */

import type { Artifact } from './artifact.ts';

// ============ Enums ============

/** Message role types */
export type MessageRole =
  | 'user'           // User input message
  | 'assistant'      // AI response
  | 'tool'           // Tool call/result
  | 'error'          // Error message (red, with details)
  | 'status'         // Status message (gray, e.g., "Connecting...")
  | 'info'           // Info message (blue, informational)
  | 'warning'        // Warning message (yellow, e.g., "Near token limit")
  | 'plan'           // Agent-submitted plan (needs user approval)
  | 'auth-request';  // Auth request (credential input popup)

/** Tool execution status */
export type ToolStatus = 'pending' | 'executing' | 'completed' | 'error' | 'backgrounded';

/** Auth request type */
export type AuthRequestType = 'credential' | 'oauth';

/** Auth status */
export type AuthStatus = 'pending' | 'completed' | 'cancelled' | 'failed';

/** Credential input mode */
export type CredentialInputMode = 'bearer' | 'basic' | 'header' | 'query';

/** Attachment type */
export type AttachmentType = 'image' | 'text' | 'pdf' | 'office' | 'unknown';

// ============ Token Usage ============

/** Token usage statistics */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextTokens: number;
  costUsd: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

// ============ Tool Display ============

/**
 * Tool display metadata for MCP tools
 * Used for custom tool icons and names in the UI
 */
export interface ToolDisplayMeta {
  /** Display name for the tool (e.g., "Commit", "Linear") */
  displayName: string;
  /** Base64-encoded icon as data URL (e.g., "data:image/png;base64,...") - 32x32px */
  iconDataUrl?: string;
  /** Description of what this tool does */
  description?: string;
  /** Category for grouping/styling */
  category?: 'skill' | 'source' | 'native' | 'mcp';
}

// ============ Attachment ============

/** Stored attachment (persisted to disk) */
export interface StoredAttachment {
  id: string;
  type: AttachmentType;
  name: string;                      // Original filename
  mimeType: string;
  size: number;
  storedPath: string;                // Full path on disk
  thumbnailPath?: string;            // Thumbnail path
  thumbnailBase64?: string;          // Base64 thumbnail (for rendering)
}

// ============ Message ============

/**
 * Runtime message with all fields
 * Used in the UI for rendering and state management
 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;

  // Tool related
  toolName?: string;
  toolUseId?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  toolStatus?: ToolStatus;
  toolDuration?: number;             // Tool execution duration (ms)

  // Streaming state
  isStreaming?: boolean;             // Currently streaming
  isPending?: boolean;               // Awaiting confirmation
  isIntermediate?: boolean;          // Intermediate text (between tool calls)
  turnId?: string;                   // Same-turn correlation ID

  // Attachments (user messages)
  attachments?: StoredAttachment[];

  // Plan related (role='plan')
  planPath?: string;                 // Plan file path

  // Auth request related (role='auth-request')
  authRequestId?: string;
  authRequestType?: AuthRequestType;
  authSourceSlug?: string;
  authSourceName?: string;
  authStatus?: AuthStatus;
  authCredentialMode?: CredentialInputMode;
  authDescription?: string;
  authError?: string;

  // Error details (role='error')
  errorCode?: string;
  errorTitle?: string;
  errorDetails?: string[];
  errorCanRetry?: boolean;

  // Artifact association (Deskhand-specific)
  artifacts?: Artifact[];

  // Insight action buttons (embedded in insight report messages)
  actions?: MessageAction[];
}

/** Action button embedded in a message (e.g., insight report recommendations) */
export interface MessageAction {
  /** Button label (natural language) */
  label: string;
  /** Preset message to auto-send when clicked */
  presetMessage: string;
  /** Button style */
  style: 'primary' | 'secondary';
}

/**
 * Stored message (for persistence)
 * Removes transient fields like isStreaming
 */
export interface StoredMessage {
  id: string;
  type: MessageRole;                 // Note: uses 'type' instead of 'role' for storage
  content: string;
  timestamp?: number;

  // Tool related
  toolName?: string;
  toolUseId?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  toolStatus?: ToolStatus;
  toolDuration?: number;

  // Grouping
  isIntermediate?: boolean;
  turnId?: string;

  // Attachments
  attachments?: StoredAttachment[];

  // Plan
  planPath?: string;

  // Auth request
  authRequestId?: string;
  authRequestType?: AuthRequestType;
  authSourceSlug?: string;
  authSourceName?: string;
  authStatus?: AuthStatus;
  authCredentialMode?: CredentialInputMode;
  authDescription?: string;
  authError?: string;

  // Error details
  errorCode?: string;
  errorTitle?: string;
  errorDetails?: string[];
  errorCanRetry?: boolean;

  // Insight action buttons
  actions?: MessageAction[];
}

/** Generate a unique message ID */
export function generateMessageId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `msg-${timestamp}-${random}`;
}
