import Anthropic from '@anthropic-ai/sdk';
import type { Scenario, ScoreDimension, EvalResult } from './types';
import type { RunResult } from './runner';

/**
 * Judge - 使用 LLM-as-Judge 对 agent 执行结果打分
 */
export class Judge {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * 对一次执行结果打分
   */
  async score(
    scenario: Scenario,
    runResult: RunResult
  ): Promise<Pick<EvalResult, 'scores' | 'overall_score' | 'passed' | 'judge_comment'>> {
    const prompt = this.buildPrompt(scenario, runResult);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      stream: false, // 明确禁用流式
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // 处理不同代理返回的响应格式
    let content: any;
    if (typeof response === 'string') {
      content = this.parseSSEResponse(response);
    } else if (response && typeof response === 'object' && Array.isArray((response as any).content)) {
      // 找 type === 'text' 的块（代理可能先返回 thinking 块）
      content = (response as any).content.find((c: any) => c.type === 'text');
    } else {
      throw new Error('Unexpected response type from judge');
    }

    if (!content || content.type !== 'text') {
      throw new Error('Unexpected response type from judge');
    }

    return this.parseJudgeResponse(content.text);
  }

  /**
   * 解析 SSE 流响应（用于代理 API）
   */
  private parseSSEResponse(sseText: string): { type: 'text'; text: string } {
    // 从 SSE 流中提取所有 text_delta
    const textDeltas: string[] = [];
    const lines = sseText.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
            textDeltas.push(data.delta.text);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    return {
      type: 'text',
      text: textDeltas.join(''),
    };
  }

  /**
   * 构建给 Judge 的 prompt
   */
  private buildPrompt(scenario: Scenario, runResult: RunResult): string {
    const { transcript } = runResult;

    return `你是一个 AI Agent 评估专家。请评估以下 agent 执行结果。

# 测试场景

**场景名称**: ${scenario.name}
**场景描述**: ${scenario.description}

**用户输入**: ${scenario.input}

**期望行为**: ${scenario.expected_behavior}

**成功标准**:
${scenario.success_criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

# Agent 执行记录

## 对话记录
${transcript.messages.map(m => `**${m.role}**: ${m.content}`).join('\n\n')}

## 工具调用记录
${transcript.tool_calls.length > 0
  ? transcript.tool_calls.map((tc, i) =>
      `${i + 1}. **${tc.tool}**\n   输入: ${JSON.stringify(tc.input, null, 2)}\n   输出: ${tc.output ? JSON.stringify(tc.output, null, 2) : '(无)'}`
    ).join('\n\n')
  : '(无工具调用)'
}

# 评分要求

请从以下维度评分（0-10 分）：

1. **任务完成度** - agent 是否完成了用户的任务？是否满足成功标准？
2. **工具使用合理性** - 工具调用是否合理？是否有冗余或错误的调用？
3. **错误处理** - 遇到问题时是否有合理的处理？
4. **用户体验** - 回复是否清晰？是否提供了有用的信息？

请以 JSON 格式返回评分结果：

\`\`\`json
{
  "scores": [
    {
      "name": "任务完成度",
      "score": 8,
      "reasoning": "..."
    },
    {
      "name": "工具使用合理性",
      "score": 7,
      "reasoning": "..."
    },
    {
      "name": "错误处理",
      "score": 9,
      "reasoning": "..."
    },
    {
      "name": "用户体验",
      "score": 8,
      "reasoning": "..."
    }
  ],
  "overall_score": 8.0,
  "passed": true,
  "judge_comment": "总体评价..."
}
\`\`\`

**评分标准**:
- 8-10 分：优秀，达到或超出预期
- 6-7 分：良好，基本达到预期但有改进空间
- 4-5 分：及格，完成了任务但存在明显问题
- 0-3 分：不及格，未能完成任务或存在严重问题

**通过标准**: overall_score >= 6.0`;
  }

  /**
   * 解析 Judge 的 JSON 响应
   */
  private parseJudgeResponse(text: string): Pick<EvalResult, 'scores' | 'overall_score' | 'passed' | 'judge_comment'> {
    // 尝试提取 JSON 代码块
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    let jsonText = jsonMatch ? jsonMatch[1] : text;

    // 如果没有代码块，尝试直接找 { } 范围
    if (!jsonMatch) {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        jsonText = text.slice(start, end + 1);
      } else {
        throw new Error('Judge response does not contain valid JSON');
      }
    }

    const parsed = JSON.parse(jsonText);

    return {
      scores: parsed.scores,
      overall_score: parsed.overall_score,
      passed: parsed.passed,
      judge_comment: parsed.judge_comment,
    };
  }
}
