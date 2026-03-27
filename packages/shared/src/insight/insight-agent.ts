/**
 * Insight Agent — Stage 2 of the v2 Insight Pipeline
 *
 * Replaces pattern-analyzer.ts + skill-searcher.ts + buildRecommendation().
 * Uses a DeskhandAgent with find-skills skill to:
 * 1. Analyze facets and find the top repeated pattern
 * 2. Search for matching skills via find-skills
 * 3. Write a natural-language report with [ACTIONS] JSON
 *
 * The agent runs in the background. Events are collected and converted
 * to StoredMessages for persistence.
 */

import { DeskhandAgent } from '../agent/deskhand-agent.ts';
import { generateMessageId } from '@deskhand/core';
import type { StoredMessage, MessageAction, AgentEvent } from '@deskhand/core';
import type { SessionFacet } from './types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface InsightAgentConfig {
  apiKey: string;
  pathToClaudeCodeExecutable: string;
  workingDirectory?: string;
}

export interface InsightAgentResult {
  /** Messages to store in the insight session */
  messages: StoredMessage[];
  /** Parsed action buttons (from [ACTIONS] block) */
  actions: MessageAction[];
  /** SDK session ID for conversation continuity */
  sdkSessionId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildInsightPrompt(facets: SessionFacet[]): string {
  const facetSummaries = facets.map((f) => ({
    sessionId: f.sessionId,
    userGoal: f.userGoal,
    taskType: f.taskType,
    workflowSteps: f.workflowSteps,
    frictionPoints: f.frictionPoints,
    keyPhrases: f.keyPhrases,
  }));

  return `你是一个 Skill Insight Agent。你的任务是分析用户的对话历史，找出最有价值的重复行为模式，并推荐或创建对应的 skill。

## 输入

以下是从用户最近 ${facets.length} 个对话中提取的结构化摘要：

${JSON.stringify(facetSummaries, null, 2)}

## 你的目标

1. **找出最高频的一个重复模式**：只关注出现在 2+ 个会话中的模式。一次性任务不算模式。
2. **搜索匹配的现成 skill**：使用 find-skills 工具搜索 skills.sh 生态，看看有没有现成的方案。
3. **写一份简短的分析报告**：用用户的语言（看对话内容判断），像同事分享观察一样自然。

## 报告要求

- 用用户使用的语言写（中文或英文，根据对话内容判断）
- 不要暴露 "skill"、"npx"、"命令" 等技术术语
- 用 "工具"、"偏好"、"帮你记住" 这种自然语言
- 聚焦一个模式，从分析到推荐一条线贯穿
- 简短友好，200-300 字以内

## 报告结构

1. 先描述你发现的模式（用户反复在做什么）
2. 如果搜索到了匹配的现成方案，说明它能怎么帮到用户
3. 如果没有现成方案，说明你可以帮用户把偏好记下来

## 重要：结尾输出 [ACTIONS] 块

报告写完后，必须在最后输出一个 [ACTIONS] JSON 块，标记推荐动作按钮。格式：

如果找到了现成方案：
[ACTIONS]
[{"label":"帮我装上","presetMessage":"请帮我安装这个工具：<安装命令>","style":"primary"},{"label":"先不用了","presetMessage":"好的，先不需要，谢谢分析！","style":"secondary"}]
[/ACTIONS]

如果没有现成方案，建议创建：
[ACTIONS]
[{"label":"帮我设置","presetMessage":"请根据上面的分析，帮我创建一个自定义工具来自动化这个模式。把偏好记下来，以后我说相关需求时自动使用。","style":"primary"},{"label":"先不用了","presetMessage":"好的，先不需要，谢谢分析！","style":"secondary"}]
[/ACTIONS]

如果没有发现有价值的模式，不要输出 [ACTIONS] 块，只输出一句话说明没有发现值得自动化的模式。

现在开始分析。`;
}

// ─────────────────────────────────────────────────────────────────────────────
// [ACTIONS] Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract [ACTIONS]...[/ACTIONS] JSON block from text.
 * Returns parsed actions and the text with the block removed.
 */
function parseActions(text: string): { cleanText: string; actions: MessageAction[] } {
  const match = text.match(/\[ACTIONS\]\s*([\s\S]*?)\s*\[\/ACTIONS\]/);
  if (!match) {
    return { cleanText: text, actions: [] };
  }

  const cleanText = text.replace(/\[ACTIONS\][\s\S]*?\[\/ACTIONS\]/, '').trim();

  try {
    const actions = JSON.parse(match[1]!) as MessageAction[];
    return { cleanText, actions };
  } catch {
    console.error('[InsightAgent] Failed to parse [ACTIONS] JSON');
    return { cleanText, actions: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Collector → StoredMessages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect agent events and convert them to StoredMessages.
 * Handles text accumulation and tool activity tracking.
 */
class EventCollector {
  private messages: StoredMessage[] = [];
  private textBuffer = '';
  private toolMessages = new Map<string, StoredMessage>();
  private now = Date.now();

  handleEvent(event: AgentEvent): void {
    switch (event.type) {
      case 'text_delta':
        this.textBuffer += event.text;
        break;

      case 'text_complete':
        // text_complete replaces accumulated text for this block
        this.textBuffer = event.text;
        break;

      case 'tool_start': {
        // Flush any accumulated text before tool
        this.flushText();
        const toolMsg: StoredMessage = {
          id: generateMessageId(),
          type: 'tool' as const,
          content: '',
          toolName: event.toolName,
          toolUseId: event.toolUseId,
          toolInput: event.input as Record<string, unknown>,
          toolStatus: 'executing',
          turnId: event.turnId,
          timestamp: this.now,
        };
        this.toolMessages.set(event.toolUseId!, toolMsg);
        this.messages.push(toolMsg);
        break;
      }

      case 'tool_result': {
        const toolMsg = this.toolMessages.get(event.toolUseId!);
        if (toolMsg) {
          toolMsg.toolResult = event.result;
          toolMsg.toolStatus = 'completed';
        }
        break;
      }
    }
  }

  private flushText(): void {
    if (this.textBuffer.trim()) {
      this.messages.push({
        id: generateMessageId(),
        type: 'assistant',
        content: this.textBuffer,
        timestamp: this.now,
      });
      this.textBuffer = '';
    }
  }

  /** Finalize and return all collected messages */
  finalize(): StoredMessage[] {
    this.flushText();
    return this.messages;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the insight agent: analyze facets, search skills, generate report.
 * Returns messages to store + parsed actions + SDK session ID.
 */
export async function runInsightAgent(
  config: InsightAgentConfig,
  facets: SessionFacet[],
): Promise<InsightAgentResult> {
  const prompt = buildInsightPrompt(facets);
  let capturedSdkSessionId: string | undefined;

  const agent = new DeskhandAgent({
    apiKey: config.apiKey,
    pathToClaudeCodeExecutable: config.pathToClaudeCodeExecutable,
    workingDirectory: config.workingDirectory,
    onSdkSessionIdUpdate: (id) => {
      capturedSdkSessionId = id;
    },
  });

  const collector = new EventCollector();

  await agent.chat(prompt, {
    permissionMode: 'allow-all',
    onEvent: (event) => collector.handleEvent(event),
  });

  const messages = collector.finalize();

  // Find the last assistant message and parse [ACTIONS]
  let actions: MessageAction[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!;
    if (msg.type === 'assistant' && msg.content) {
      const { cleanText, actions: parsed } = parseActions(msg.content);
      msg.content = cleanText;
      msg.actions = parsed.length > 0 ? parsed : undefined;
      actions = parsed;
      break;
    }
  }

  return {
    messages,
    actions,
    sdkSessionId: capturedSdkSessionId,
  };
}
