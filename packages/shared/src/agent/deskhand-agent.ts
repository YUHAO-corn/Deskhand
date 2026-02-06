/**
 * DeskhandAgent - Core agent implementation
 *
 * Wraps the Claude Agent SDK with Deskhand-specific features:
 * - Permission mode management
 * - Tool permissions via PreToolUse hook
 * - Large result summarization via PostToolUse hook
 * - Event stream handling
 */

import type { AgentEvent, PermissionMode, ThinkingLevel } from '@deskhand/core';

// ============ Types ============

/** Agent options */
export interface DeskhandAgentOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  permissionMode?: PermissionMode;
  thinkingLevel?: ThinkingLevel;
  workingDirectory?: string;
}

/** Chat options */
export interface ChatOptions {
  skills?: string[];                 // Enabled skill IDs
  onEvent?: (event: AgentEvent) => void;
}

// ============ Agent Class ============

/**
 * DeskhandAgent wraps the Claude Agent SDK
 *
 * Implementation notes:
 * - Initialize with API key and options
 * - Create SDK Agent instance
 * - Set up PreToolUse hook for permission checks
 * - Set up PostToolUse hook for large result summarization
 * - Expose chat() method with event streaming
 */
export class DeskhandAgent {
  private options: DeskhandAgentOptions;
  // TODO: private sdkAgent: Agent;

  constructor(options: DeskhandAgentOptions) {
    this.options = options;
    // TODO: Initialize SDK Agent
  }

  /**
   * Send a message and get streaming response
   *
   * Implementation notes:
   * - Build messages array
   * - Inject skill content as system message
   * - Call SDK agent.chat()
   * - Process events and emit via onEvent callback
   */
  async chat(message: string, _options?: ChatOptions): Promise<void> {
    console.log('[DeskhandAgent] chat:', message);
    // TODO: Implement
  }

  /**
   * Respond to permission request
   */
  async respondToPermission(_requestId: string, _response: 'allow' | 'deny'): Promise<void> {
    // TODO: Implement
  }

  /**
   * Stop current generation
   */
  async stop(): Promise<void> {
    // TODO: Implement
  }
}
