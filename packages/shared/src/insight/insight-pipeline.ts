/**
 * Insight Pipeline — Orchestrates the full Skill Insight flow
 *
 * Stage 1: Extract facets from all sessions (Haiku, cached)
 * Stage 2: Analyze patterns across sessions (Sonnet, single prompt)
 * Stage 3: Search for matching skills for top pattern
 * Quality gate: Skip if no valuable patterns
 * Output: Create new session with insight report + action buttons
 */

import Anthropic from '@anthropic-ai/sdk';
import { createSession, appendMessage, updateSessionMeta, generateSessionId } from '../sessions/storage.ts';
import { generateMessageId } from '@deskhand/core';
import { extractAllFacets } from './facet-extractor.ts';
import { analyzePatterns } from './pattern-analyzer.ts';
import { searchSkills } from './skill-searcher.ts';
import type { InsightResult, InsightAction } from './types.ts';

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
 * Build the recommendation section and action buttons based on skill search.
 * Uses natural language, no technical terms (Q22).
 */
function buildRecommendation(
  result: InsightResult,
): { appendedReport: string; actions: InsightAction[] } {
  const topPattern = result.patterns[0];
  if (!topPattern) {
    return { appendedReport: '', actions: [] };
  }

  const search = result.skillSearch;
  let section = '\n\n---\n\n';
  const actions: InsightAction[] = [];

  if (search?.found && search.skillName) {
    // Found a matching skill
    section += `### ✅ 有现成的方案\n\n`;
    section += `我找到了一个专门做这件事的工具（${search.skillName}），`;
    section += `装上之后我就能更好地帮你处理这类任务。要不要我帮你装上？\n`;
    actions.push({
      label: '帮我装上',
      presetMessage: `请帮我安装这个工具：${search.installCommand}`,
      style: 'primary',
    });
  } else {
    // No matching skill — offer to create one
    section += `### 💡 可以帮你记住偏好\n\n`;
    section += `我没有找到现成的方案，但我可以帮你把这些偏好记下来。`;
    section += `以后你只需要简单描述需求，我就自动按你习惯的方式来做。要我帮你设置吗？\n`;
    actions.push({
      label: '帮我设置',
      presetMessage: `请根据上面的分析，帮我创建一个自定义工具来自动化「${topPattern.description}」这个模式。把偏好记下来，以后我说相关需求时自动使用。`,
      style: 'primary',
    });
  }

  actions.push({
    label: '先不用了',
    presetMessage: '好的，先不需要，谢谢分析！',
    style: 'secondary',
  });

  return { appendedReport: section, actions };
}

/**
 * Run the full insight pipeline.
 *
 * 1. Extract facets from all sessions (Haiku, cached per session)
 * 2. Analyze patterns across all facets (Sonnet, single prompt)
 * 3. Search for matching skills for the top pattern
 * 4. Quality gate: if no valuable patterns, return without creating session
 * 5. Create new session with report + action buttons as first assistant message
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

  // Stage 3: Search for matching skills for the top pattern
  const topPattern = result.patterns[0];
  if (topPattern) {
    console.log(`[InsightPipeline] Stage 3: Searching skills for "${topPattern.skillOpportunity}"...`);
    const searchResult = await searchSkills(topPattern.skillOpportunity);
    result.skillSearch = searchResult;
    console.log(`[InsightPipeline] Skill search: found=${searchResult.found}`);
  }

  // Build recommendation section + action buttons
  const { appendedReport, actions } = buildRecommendation(result);
  const fullReport = result.report + appendedReport;
  result.actions = actions;

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

  // Store report as first assistant message with action buttons
  await appendMessage(sessionId, {
    id: generateMessageId(),
    type: 'assistant',
    content: fullReport,
    timestamp: now,
    actions: actions.length > 0 ? actions : undefined,
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
