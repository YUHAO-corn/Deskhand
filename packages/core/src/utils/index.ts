/**
 * @deskhand/core - Utilities
 */

export { debug } from './debug.ts';

/**
 * Generate unique session ID
 * Format: YYMMDD-random (e.g., 260206-a1b2c3)
 */
export function generateSessionId(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8);
  return `${yy}${mm}${dd}-${random}`;
}

/**
 * Convert runtime Message to StoredMessage for persistence
 * Strips transient fields (isStreaming, isPending)
 */
export function messageToStored(msg: import('../types/message.ts').Message): import('../types/message.ts').StoredMessage {
  return {
    id: msg.id,
    type: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    toolName: msg.toolName,
    toolUseId: msg.toolUseId,
    toolInput: msg.toolInput,
    toolResult: msg.toolResult,
    toolStatus: msg.toolStatus,
    toolDuration: msg.toolDuration,
    isIntermediate: msg.isIntermediate,
    turnId: msg.turnId,
    attachments: msg.attachments,
    widget: msg.widget,
    planPath: msg.planPath,
    errorCode: msg.errorCode,
    errorTitle: msg.errorTitle,
    errorDetails: msg.errorDetails,
    errorCanRetry: msg.errorCanRetry,
  };
}
