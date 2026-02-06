/**
 * Thinking level configuration
 *
 * Controls Claude's extended thinking feature:
 * - off: No extended thinking
 * - think: Standard thinking (5000-10000 tokens)
 * - max: Maximum thinking (20000 tokens)
 */

import type { ThinkingLevel } from '@deskhand/core';

// ============ Config ============

export interface ThinkingLevelConfig {
  id: ThinkingLevel;
  displayName: string;
  description: string;
  budgetTokens: number;
}

export const THINKING_LEVEL_CONFIG: Record<ThinkingLevel, ThinkingLevelConfig> = {
  off: {
    id: 'off',
    displayName: 'Off',
    description: 'No extended thinking',
    budgetTokens: 0,
  },
  think: {
    id: 'think',
    displayName: 'Think',
    description: 'Standard thinking (5K-10K tokens)',
    budgetTokens: 10000,
  },
  max: {
    id: 'max',
    displayName: 'Max',
    description: 'Maximum thinking (20K tokens)',
    budgetTokens: 20000,
  },
};
