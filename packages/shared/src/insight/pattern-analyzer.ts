/**
 * Pattern Analyzer — Stage 2 of the Insight Pipeline
 *
 * Takes all session facets, runs a single Sonnet prompt to find
 * repeated patterns across sessions. Includes quality gate logic.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SessionFacet, InsightResult } from './types.ts';

const SONNET_MODEL = 'claude-sonnet-4-20250514';

const PATTERN_ANALYSIS_PROMPT = `You are analyzing structured summaries of a user's conversation history with an AI assistant.
Your goal: find REPEATED behavioral patterns that could be automated as reusable "skills" (templates/workflows).

Input: An array of session facets, each describing one conversation session.

Output JSON:
{
  "hasValueablePatterns": true/false,
  "patterns": [
    {
      "description": "What the user repeatedly does (1-2 sentences)",
      "sessionCount": 3,
      "sessionIds": ["id1", "id2", "id3"],
      "skillOpportunity": "What a skill could automate (1-2 sentences)"
    }
  ],
  "report": "A markdown report in the user's language summarizing the analysis"
}

Rules:
- Only include patterns that appear in 2+ sessions. One-off tasks are NOT patterns.
- Sort patterns by sessionCount descending (most frequent first).
- hasValueablePatterns = false if no pattern appears in 2+ sessions.
- The "report" field should be written in the SAME LANGUAGE the user used in conversations.
- The report should be conversational and friendly, like a colleague sharing observations.
- The report should describe what patterns you found and why they'd make good skills.
- Output ONLY valid JSON, no markdown fences, no explanation.`;

/**
 * Analyze all facets to find repeated patterns using Sonnet.
 * Returns InsightResult with quality gate.
 */
export async function analyzePatterns(
  client: Anthropic,
  facets: SessionFacet[],
): Promise<InsightResult> {
  // Not enough data to find patterns
  if (facets.length < 2) {
    return { hasValueablePatterns: false, patterns: [], report: '' };
  }

  // Format facets as input
  const facetSummaries = facets.map((f) => ({
    sessionId: f.sessionId,
    userGoal: f.userGoal,
    taskType: f.taskType,
    workflowSteps: f.workflowSteps,
    frictionPoints: f.frictionPoints,
    keyPhrases: f.keyPhrases,
  }));

  const response = await client.messages.create({
    model: SONNET_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `${PATTERN_ANALYSIS_PROMPT}\n\n---\n\nSession Facets (${facets.length} sessions):\n${JSON.stringify(facetSummaries, null, 2)}`,
      },
    ],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  console.log(`[InsightPipeline] Raw pattern analysis response:`, text.slice(0, 300));
  try {
    const jsonText = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
    const parsed = JSON.parse(jsonText);
    return {
      hasValueablePatterns: parsed.hasValueablePatterns ?? false,
      patterns: parsed.patterns ?? [],
      report: parsed.report ?? '',
    };
  } catch {
    console.error('[InsightPipeline] Failed to parse pattern analysis result');
    return { hasValueablePatterns: false, patterns: [], report: '' };
  }
}
