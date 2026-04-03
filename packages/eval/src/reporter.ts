import fs from 'fs/promises';
import path from 'path';
import type { EvalResult } from './types';

/**
 * Reporter - 生成评估报告
 */
export class Reporter {
  private resultsDir: string;

  constructor(resultsDir: string = 'results') {
    this.resultsDir = resultsDir;
  }

  /**
   * 生成并保存报告
   */
  async generate(result: EvalResult): Promise<void> {
    await fs.mkdir(this.resultsDir, { recursive: true });

    const timestamp = new Date(result.timestamp).toISOString().replace(/[:.]/g, '-');
    const basename = `${result.scenario_id}_${timestamp}`;

    // 生成 JSON 报告
    const jsonPath = path.join(this.resultsDir, `${basename}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(result, null, 2));

    // 生成 Markdown 报告
    const mdPath = path.join(this.resultsDir, `${basename}.md`);
    const markdown = this.generateMarkdown(result);
    await fs.writeFile(mdPath, markdown);

    console.log(`\n✅ 报告已生成:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   Markdown: ${mdPath}`);
  }

  /**
   * 生成 Markdown 格式报告
   */
  private generateMarkdown(result: EvalResult): string {
    const passIcon = result.passed ? '✅' : '❌';

    return `# Eval Report: ${result.scenario_name}

${passIcon} **${result.passed ? 'PASSED' : 'FAILED'}** | Overall Score: **${result.overall_score.toFixed(1)}/10**

---

## 1. 测试场景

**场景 ID**: ${result.scenario_id}

**场景描述**: ${result.scenario.description}

**用户输入**:
\`\`\`
${result.scenario.input}
\`\`\`

**期望行为**: ${result.scenario.expected_behavior}

**成功标准**:
${result.scenario.success_criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

---

## 2. 评分结果

${result.scores.map(s => `### ${s.name}: ${s.score}/10

${s.reasoning}
`).join('\n')}

### Judge 总评

${result.judge_comment}

---

## 3. 执行过程

**执行时间**: ${new Date(result.timestamp).toLocaleString('zh-CN')}

### 对话记录

${result.transcript.messages.map(m => `**${m.role}**:

${m.content}
`).join('\n---\n\n')}

### 工具调用

${result.transcript.tool_calls.length > 0
  ? result.transcript.tool_calls.map((tc, i) => `#### ${i + 1}. ${tc.tool}

**输入**:
\`\`\`json
${JSON.stringify(tc.input, null, 2)}
\`\`\`

${tc.output ? `**输出**:
\`\`\`json
${JSON.stringify(tc.output, null, 2)}
\`\`\`` : '*(无输出)*'}
`).join('\n')
  : '*(无工具调用)*'
}
`;
  }
}
