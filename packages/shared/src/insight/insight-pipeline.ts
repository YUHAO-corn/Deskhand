/**
 * Insight Pipeline — Orchestrates the full Skill Insight flow
 *
 * Stage 1: Extract facets from all sessions (Haiku, cached)
 * Stage 2: Analyze patterns across sessions (Sonnet, single prompt)
 * Quality gate: Skip if no valuable patterns
 * Output: Create new session with insight report as first assistant message
 */

import Anthropic from '@anthropic-ai/sdk';
import { createSession, appendMessage, updateSessionMeta, generateSessionId } from '../sessions/storage.ts';
import { generateMessageId } from '@deskhand/core';
import { extractAllFacets } from './facet-extractor.ts';
import { analyzePatterns } from './pattern-analyzer.ts';
import type { InsightResult } from './types.ts';

export type { SessionFacet, RepeatedPattern, InsightResult } from './types.ts';

interface InsightPipelineResult {
  /** Whether an insight session was created */
  created: boolean;
  /** The new session ID (if created) */
  sessionId?: string;
  /** The analysis result */
  result: InsightResult;
}

/**
 * Run the full insight pipeline.
 *
 * 1. Extract facets from all sessions (Haiku, cached per session)
 * 2. Analyze patterns across all facets (Sonnet, single prompt)
 * 3. Quality gate: if no valuable patterns, return without creating session
 * 4. Create new session with report as first assistant message
 */
export async function runInsightPipeline(apiKey: string): Promise<InsightPipelineResult> {
  const client = new Anthropic({ apiKey });

  // Stage 1: Extract facets
  console.log('[InsightPipeline] Stage 1: Extracting facets...');
  const facets = await extractAllFacets(client);
  console.log(`[InsightPipeline] Extracted ${facets.length} facets`);

  if (facets.length < 2) {
    console.log('[InsightPipeline] Not enough sessions for pattern analysis');
    return { created: false, result: { hasValueablePatterns: false, patterns: [], report: '' } };
  }

  // Stage 2: Analyze patterns
  console.log('[InsightPipeline] Stage 2: Analyzing patterns...');
  const result = await analyzePatterns(client, facets);
  console.log(`[InsightPipeline] Found ${result.patterns.length} patterns, valuable: ${result.hasValueablePatterns}`);

  // Quality gate
  if (!result.hasValueablePatterns || !result.report) {
    console.log('[InsightPipeline] Quality gate: no valuable patterns, staying silent');
    return { created: false, result };
  }

  // Create insight session
  const sessionId = generateSessionId();
  const now = Date.now();

  await createSession({
    id: sessionId,
    name: 'Skill Insight',
    createdAt: now,
    messageCount: 1,
    hasUnread: true,
  });

  // Store report as first assistant message
  await appendMessage(sessionId, {
    id: generateMessageId(),
    type: 'assistant',
    content: result.report,
    timestamp: now,
  });

  // Update metadata
  await updateSessionMeta(sessionId, {
    lastMessageAt: now,
    preview: 'Skill Insight Report',
    messageCount: 1,
    hasUnread: true,
  });

  console.log(`[InsightPipeline] Created insight session: ${sessionId}`);
  return { created: true, sessionId, result };
}
