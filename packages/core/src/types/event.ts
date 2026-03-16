/**
 * Agent event types for Deskhand
 *
 * CraftAgent emits these events during execution.
 * UI needs to listen and handle these events.
 */

// ============ Permission Request ============

/** Permission request from Agent */
export interface PermissionRequest {
  requestId: string;
  toolName: string;
  command: string;
  description: string;
}

// ============ Typed Error ============

/** Structured error with metadata */
export interface TypedError {
  code: string;
  title: string;
  message: string;
  canRetry: boolean;
  details?: string[];
}

// ============ Agent Events ============

/** Agent event union type */
export type AgentEvent =
  // Status & Info
  | { type: 'status'; message: string }
  | { type: 'info'; message: string }

  // Streaming text
  | { type: 'text_delta'; text: string; turnId?: string }
  | { type: 'text_complete'; text: string; isIntermediate?: boolean; turnId?: string }

  // Tool calls
  | { type: 'tool_start'; toolName: string; toolUseId: string; input: Record<string, unknown>; intent?: string; displayName?: string; turnId?: string; parentToolUseId?: string }
  | { type: 'tool_result'; toolUseId: string; result: string; isError: boolean; toolName?: string; input?: Record<string, unknown>; turnId?: string; parentToolUseId?: string }
  | { type: 'widget_chunk'; toolUseId: string; chunk: string; turnId?: string; title?: string; mimeType?: 'text/html' | 'image/svg+xml' }
  | { type: 'widget_complete'; toolUseId: string; turnId?: string; code?: string; title?: string; mimeType?: 'text/html' | 'image/svg+xml' }
  | { type: 'widget_error'; toolUseId: string; message: string; turnId?: string }

  // Permission request
  | { type: 'permission_request'; requestId: string; toolName: string; command: string; description: string }

  // Errors
  | { type: 'error'; message: string }
  | { type: 'typed_error'; error: TypedError }

  // Completion
  | { type: 'complete'; usage?: { inputTokens: number; outputTokens: number; costUsd?: number } }

  // Background tasks
  | { type: 'task_backgrounded'; toolUseId: string; taskId: string; intent?: string; turnId?: string }
  | { type: 'task_progress'; toolUseId: string; elapsedSeconds: number; turnId?: string }
  | { type: 'shell_backgrounded'; toolUseId: string; shellId: string; command?: string; turnId?: string }
  | { type: 'shell_killed'; shellId: string; turnId?: string }

  // Working directory change
  | { type: 'working_directory_changed'; workingDirectory: string };
