/**
 * Insight Pipeline v2 — Orchestrates the full Skill Insight flow
 *
 * Stage 1: Extract facets from all sessions (Haiku, cached)
 * Stage 2: DeskhandAgent analyzes patterns + searches skills + writes report
 * Output: Create new session with full agent conversation + action buttons
 */

import Anthropic from '@anthropic-ai/sdk';
import { createSession, appendMessage, updateSessionMeta, generateSessionId } from '../sessions/storage.ts';
import { extractAllFacets } from './facet-extractor.ts';
import { runInsightAgent, type InsightAgentConfig } from './insight-agent.ts';

export type { SessionFacet } from './types.ts';

export interface InsightPipelineConfig {
  apiKey: string;
  pathToClaudeCodeExecutable: string;
  workingDirectory?: string;
  /** Only analyze sessions created after this timestamp (0 = all) */
  sinceTimestamp?: number;
}

interface InsightPipelineResult {
  /** Whether an insight session was created */
  created: boolean;
  /** The new session ID (if created) */
  sessionId?: string;
  /** SDK session ID for conversation continuity */
  sdkSessionId?: string;
}

/**
 * Run the full insight pipeline.
 *
 * 1. Extract facets from all sessions (Haiku, cached per session)
 * 2. Quality gate: need at least 2 sessions
 * 3. Run insight agent (DeskhandAgent with find-skills)
 * 4. Create session and store agent's messages
 */
export async function runInsightPipeline(config: InsightPipelineConfig): Promise<InsightPipelineResult> {
  const client = new Anthropic({ apiKey: config.apiKey });

  // Stage 1: Extract facets (only new sessions if sinceTimestamp provided)
  console.log('[InsightPipeline] Stage 1: Extracting facets...');
  const facets = await extractAllFacets(client, config.sinceTimestamp ?? 0);
  console.log(`[InsightPipeline] Extracted ${facets.length} facets`);

  if (facets.length < 2) {
    console.log('[InsightPipeline] Not enough sessions for pattern analysis');
    return { created: false };
  }

  // Stage 2: Run insight agent
  console.log('[InsightPipeline] Stage 2: Running insight agent...');
  const agentConfig: InsightAgentConfig = {
    apiKey: config.apiKey,
    pathToClaudeCodeExecutable: config.pathToClaudeCodeExecutable,
    workingDirectory: config.workingDirectory,
  };
  const agentResult = await runInsightAgent(agentConfig, facets);
  console.log(`[InsightPipeline] Agent produced ${agentResult.messages.length} messages, ${agentResult.actions.length} actions`);

  // Quality gate: if agent produced no messages, skip
  if (agentResult.messages.length === 0) {
    console.log('[InsightPipeline] Agent produced no output, staying silent');
    return { created: false };
  }

  // Create insight session
  const sessionId = generateSessionId();
  const now = Date.now();

  await createSession({
    id: sessionId,
    name: 'Skill Insight',
    createdAt: now,
    messageCount: agentResult.messages.length,
    hasUnread: true,
  });

  // Store all agent messages
  for (const msg of agentResult.messages) {
    await appendMessage(sessionId, msg);
  }

  // Update metadata
  await updateSessionMeta(sessionId, {
    lastMessageAt: now,
    preview: 'Skill Insight Report',
    messageCount: agentResult.messages.length,
    hasUnread: true,
  });

  console.log(`[InsightPipeline] Created insight session: ${sessionId}`);
  return {
    created: true,
    sessionId,
    sdkSessionId: agentResult.sdkSessionId,
  };
}
