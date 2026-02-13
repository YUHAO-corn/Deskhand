/**
 * Jotai atoms for session state management
 *
 * Uses atomFamily for per-session isolation to prevent
 * cross-session re-renders during streaming.
 */

import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';
import type { Session, SessionMeta, Message, ThinkingLevel, Skill } from '@deskhand/core';

// ============ Session Atoms ============

/** Session data by ID (with messages) */
export const sessionAtomFamily = atomFamily(
  (_sessionId: string) => atom<Session | null>(null),
  (a, b) => a === b
);

/** Session metadata map (for sidebar list) */
export const sessionMetaMapAtom = atom<Map<string, SessionMeta>>(new Map());

/** Ordered session IDs (for list sorting) */
export const sessionIdsAtom = atom<string[]>([]);

/** Currently active session ID */
export const activeSessionIdAtom = atom<string | null>(null);

/** Set of loaded session IDs (for lazy loading) */
export const loadedSessionsAtom = atom<Set<string>>(new Set());

/** Set of memory-only session IDs (not yet persisted to disk) */
export const memoryOnlySessionsAtom = atom<Set<string>>(new Set());

// ============ Per-Session Atoms ============

/** Messages by session ID */
export const sessionMessagesFamily = atomFamily(
  (_sessionId: string) => atom<Message[]>([]),
  (a, b) => a === b
);

/** Input draft by session ID */
export const sessionInputFamily = atomFamily(
  (_sessionId: string) => atom<string>(''),
  (a, b) => a === b
);

/** Processing state by session ID */
export const sessionProcessingFamily = atomFamily(
  (_sessionId: string) => atom<boolean>(false),
  (a, b) => a === b
);

// ============ UI Atoms ============

/** Sidebar open state */
export const sidebarOpenAtom = atom<boolean>(true);

/** Settings panel open state */
export const settingsOpenAtom = atom<boolean>(false);

/** Artifact panel open state */
export const artifactPanelOpenAtom = atom<boolean>(false);

/** Artifact panel active tab */
export const artifactActiveTabAtom = atom<'files' | 'changes' | 'terminal' | 'preview'>('files');

/** Artifact panel width */
export const artifactPanelWidthAtom = atom<number>(480);

/** Selected file path in Files tab */
export const selectedFileAtom = atom<string | null>(null);

/** File preview mode (code/preview) */
export const filePreviewModeAtom = atom<'code' | 'preview'>('code');

/** Permission mode */
export const permissionModeAtom = atom<'ask' | 'allow-all'>('ask');

/** Current permission request */
export const permissionRequestAtom = atom<{
  isOpen: boolean;
  requestId: string;
  toolName: string;
  command: string;
  description: string;
} | null>(null);

/** Thinking level for AI responses */
export const thinkingLevelAtom = atom<ThinkingLevel>('off');

/** Selected model */
export const selectedModelAtom = atom<string>('claude-sonnet-4-20250514');

/** Working directory (null = not selected, uses app default) */
export const workingDirectoryAtom = atom<string | null>(null);

// ============ Skills Atoms ============

/** All loaded skills (for UI display in SkillsPopup) */
export const skillsAtom = atom<Skill[]>([]);
