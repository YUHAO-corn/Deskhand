/**
 * Configuration types for Deskhand
 *
 * Application-level configuration including API auth and default settings.
 */

import type { PermissionMode, ThinkingLevel } from './session.ts';

// ============ App Config ============

/** Application configuration */
export interface AppConfig {
  // Claude API auth
  apiKey?: string;                   // Anthropic API Key (encrypted storage)
  baseUrl?: string;                  // API proxy URL (optional, defaults to official)

  // Default settings
  defaultModel?: string;             // Default model ID
  defaultThinkingLevel?: ThinkingLevel;   // Default thinking level
  defaultPermissionMode?: PermissionMode; // Default permission mode

  // Workspace
  lastWorkingDirectory?: string;     // Last selected working directory (persisted)

  // Window state
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Insight
  lastInsightAt?: number;            // Timestamp of last insight pipeline run
}

// ============ Auth State ============

/** Runtime auth state */
export interface AuthState {
  isAuthenticated: boolean;          // Whether authenticated
  isValidating: boolean;             // Whether validating
  error?: string;                    // Auth error message
}

// ============ Setup Needs ============

/** Setup requirements check result */
export interface SetupNeeds {
  isFullyConfigured: boolean;
  needsAuth: boolean;
}
