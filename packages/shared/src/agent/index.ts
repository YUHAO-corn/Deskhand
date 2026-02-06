/**
 * @deskhand/shared/agent
 *
 * Agent-related exports for Deskhand.
 */

export { DeskhandAgent } from './deskhand-agent.ts';
export type { DeskhandAgentOptions, ChatOptions } from './deskhand-agent.ts';

export {
  PERMISSION_MODE_CONFIG,
  cyclePermissionMode,
} from './permission-mode.ts';
export type { PermissionModeConfig } from './permission-mode.ts';

export { THINKING_LEVEL_CONFIG } from './thinking-level.ts';
export type { ThinkingLevelConfig } from './thinking-level.ts';
