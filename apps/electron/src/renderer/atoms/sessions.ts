/**
 * Jotai atoms for session state management
 *
 * Uses atomFamily for per-session isolation to prevent
 * cross-session re-renders during streaming.
 */

import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';
import type { Session, SessionMeta, Message } from '@deskhand/core';

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
