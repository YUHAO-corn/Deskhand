/**
 * Session utility functions
 *
 * 参考：SPEC_SessionSidebar.md 第503行
 * Craft 参考：apps/electron/src/renderer/utils/session.ts
 */

import type { Session } from '@deskhand/core';
import type { SessionMeta } from '../atoms/sessions';

/** Common session fields used by getSessionTitle */
type SessionLike = Pick<Session, 'name' | 'preview'> & { messages?: Session['messages'] };

/**
 * Sanitize content for display as session title.
 * Strips XML blocks (e.g. <edit_request>) and normalizes whitespace.
 */
function sanitizePreview(content: string): string {
  return content
    .replace(/<edit_request>[\s\S]*?<\/edit_request>/g, '') // Strip entire edit_request blocks
    .replace(/<[^>]+>/g, '')     // Strip remaining XML/HTML tags
    .replace(/\s+/g, ' ')        // Collapse whitespace
    .trim();
}

/**
 * Get display title for a session.
 * Priority: custom name > first user message > preview (from metadata) > "New chat"
 * Works with both Session (full) and SessionMeta (lightweight)
 *
 * 实现步骤：
 * 1. 检查是否有用户自定义名称
 * 2. 如果有完整消息列表，找第一条用户消息
 * 3. 否则使用 metadata 中的 preview 字段
 * 4. 兜底返回 "New chat"
 */
export function getSessionTitle(session: SessionLike | SessionMeta): string {
  // TODO: 实现步骤 1 - 优先使用自定义名称
  if (session.name) {
    return session.name;
  }

  // TODO: 实现步骤 2 - 检查完整消息列表中的首条用户消息
  if ('messages' in session && session.messages) {
    const firstUserMessage = session.messages.find(m => m.role === 'user');
    if (firstUserMessage?.content) {
      const sanitized = sanitizePreview(firstUserMessage.content);
      if (sanitized) {
        const trimmed = sanitized.slice(0, 50);
        return trimmed.length < sanitized.length ? trimmed + '…' : trimmed;
      }
    }
  }

  // TODO: 实现步骤 3 - 使用 JSONL header 中的 preview 字段
  if (session.preview) {
    const sanitized = sanitizePreview(session.preview);
    if (sanitized) {
      const trimmed = sanitized.slice(0, 50);
      return trimmed.length < sanitized.length ? trimmed + '…' : trimmed;
    }
  }

  // TODO: 实现步骤 4 - 兜底
  return 'New chat';
}
