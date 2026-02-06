/**
 * Permission mode management
 *
 * Three-level permission system per session:
 * - safe: Read-only, blocks write operations
 * - ask: Prompts for bash commands (default)
 * - allow-all: Auto-approves all commands
 */

import type { PermissionMode } from '@deskhand/core';

// ============ Config ============

export interface PermissionModeConfig {
  id: PermissionMode;
  displayName: string;
  description: string;
  color: string;
}

export const PERMISSION_MODE_CONFIG: Record<PermissionMode, PermissionModeConfig> = {
  safe: {
    id: 'safe',
    displayName: 'Explore',
    description: 'Read-only mode. Agent cannot modify files or run commands.',
    color: '#10B981', // green
  },
  ask: {
    id: 'ask',
    displayName: 'Ask to Edit',
    description: 'Agent will ask permission before making changes.',
    color: '#F59E0B', // amber
  },
  'allow-all': {
    id: 'allow-all',
    displayName: 'Auto',
    description: 'Agent can make changes without asking.',
    color: '#EF4444', // red
  },
};

// ============ Mode Cycling ============

const MODE_ORDER: PermissionMode[] = ['safe', 'ask', 'allow-all'];

/**
 * Cycle to next permission mode (for SHIFT+TAB shortcut)
 */
export function cyclePermissionMode(current: PermissionMode): PermissionMode {
  const currentIndex = MODE_ORDER.indexOf(current);
  const nextIndex = (currentIndex + 1) % MODE_ORDER.length;
  return MODE_ORDER[nextIndex]!;
}
