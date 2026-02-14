/**
 * @deskhand/shared
 *
 * Shared business logic for Deskhand desktop AI agent.
 *
 * Usage:
 * import { DeskhandAgent } from '@deskhand/shared/agent';
 * import { loadConfig, saveConfig } from '@deskhand/shared/config';
 * import { loadSession, listSessions } from '@deskhand/shared/sessions';
 * import { loadSkills } from '@deskhand/shared/skills';
 */

// Re-export submodules for convenience
export * from './agent/index.ts';
export * from './config/index.ts';
export * from './sessions/index.ts';
export * from './skills/index.ts';
export * from './insight/index.ts';
