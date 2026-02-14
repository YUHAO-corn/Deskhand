/**
 * Facet Extractor — Stage 1 of the Insight Pipeline
 *
 * For each session, extracts a structured facet (user goal, task type,
 * workflow steps, friction points) using Haiku. Results are cached
 * as .facet.json in the session directory.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { loadSession, getSessionDir, listSessions } from '../sessions/storage.ts';
import type { SessionFacet } from './types.ts';

const FACET_CACHE_FILE = '.facet.json';
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

const FACET_EXTRACTION_PROMPT = `You are analyzing a conversation between a user and an AI assistant.
Extract the following structured information as JSON:

{
  "userGoal": "What the user was trying to accomplish (1 sentence)",
  "taskType": "Category: writing / coding / design / data-analysis / research / planning / communication / other",
  "workflowSteps": ["Step 1", "Step 2", ...],
  "frictionPoints": ["Any repeated corrections, misunderstandings, or friction"],
  "keyPhrases": ["Specific instructions or phrases the user repeated"]
}

Rules:
- Be concise. Each field should be brief and factual.
- workflowSteps: only include distinct steps, not every message.
- frictionPoints: empty array if the conversation was smooth.
- keyPhrases: empty array if nothing was notably repeated.
- Output ONLY valid JSON, no markdown fences, no explanation.`;

/** Get facet cache path for a session */
function getFacetCachePath(sessionId: string): string {
  return path.join(getSessionDir(sessionId), FACET_CACHE_FILE);
}

/** Load cached facet if it exists */
function loadCachedFacet(sessionId: string): SessionFacet | null {
  const cachePath = getFacetCachePath(sessionId);
  if (!fs.existsSync(cachePath)) return null;
  try {
    const content = fs.readFileSync(cachePath, 'utf-8');
    return JSON.parse(content) as SessionFacet;
  } catch {
    return null;
  }
}

/** Save facet to cache */
function saveFacetCache(sessionId: string, facet: SessionFacet): void {
  const cachePath = getFacetCachePath(sessionId);
  fs.writeFileSync(cachePath, JSON.stringify(facet, null, 2));
}

/** Format session messages into a readable conversation string */
function formatMessages(messages: Array<{ type: string; content: string }>): string {
  return messages
    .filter((m) => m.type === 'user' || m.type === 'assistant')
    .map((m) => `[${m.type}]: ${m.content}`)
    .join('\n\n');
}

/**
 * Extract facet from a single session using Haiku.
 * Returns cached result if available.
 */
export async function extractSessionFacet(
  client: Anthropic,
  sessionId: string,
): Promise<SessionFacet | null> {
  // Check cache first
  const cached = loadCachedFacet(sessionId);
  if (cached) return cached;

  // Load session messages
  const session = await loadSession(sessionId);
  if (!session || session.messages.length === 0) return null;

  const conversation = formatMessages(session.messages);
  if (!conversation.trim()) return null;

  // Call Haiku for facet extraction
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1024,
    messages: [
      { role: 'user', content: `${FACET_EXTRACTION_PROMPT}\n\n---\n\nConversation:\n${conversation}` },
    ],
  });

  // Parse response
  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  console.log(`[InsightPipeline] Raw facet response for ${sessionId}:`, text.slice(0, 200));
  try {
    // Strip markdown code fences if present
    const jsonText = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
    const parsed = JSON.parse(jsonText);
    const facet: SessionFacet = {
      sessionId,
      userGoal: parsed.userGoal || '',
      taskType: parsed.taskType || 'other',
      workflowSteps: parsed.workflowSteps || [],
      frictionPoints: parsed.frictionPoints || [],
      keyPhrases: parsed.keyPhrases || [],
      extractedAt: Date.now(),
    };
    saveFacetCache(sessionId, facet);
    return facet;
  } catch {
    console.error(`[InsightPipeline] Failed to parse facet for session ${sessionId}`);
    return null;
  }
}

/**
 * Extract facets from all sessions.
 * Skips sessions that already have cached facets.
 */
export async function extractAllFacets(client: Anthropic): Promise<SessionFacet[]> {
  const sessions = await listSessions();
  const facets: SessionFacet[] = [];

  for (const session of sessions) {
    const facet = await extractSessionFacet(client, session.id);
    if (facet) facets.push(facet);
  }

  return facets;
}
