# Eval System Design - LLM-as-Judge for Deskhand Agent

**Date**: 2026-04-02  
**Status**: Ready for Implementation  
**Target**: MVP with 1 scenario, expandable to 10-20 scenarios

---

## 🎯 核心理念：场景价值 vs 功能测试

**这不是传统工程测试**：
- ❌ 不是测"list_files 功能是否存在"
- ❌ 不是测"API 返回 200 状态码"
- ❌ 不是确定性的 pass/fail 判断

**这是 AI 产品的场景评估**：
- ✅ 测"agent 能否完成真实用户需求场景"
- ✅ 测"在概率性输出下，价值交付的稳定性"
- ✅ 用 LLM-as-Judge 做推理式评分，而非规则引擎

**为什么这样设计**：
AI 系统是概率性的，不是确定性的。传统软件测试追求"功能是否存在"，但 AI 产品评估要问"场景是否完成、价值是否交付"。这是 AI Native 产品思维的核心区别。

面试时可以这样解释：
> "我们不是在测试工具调用是否成功，而是在对抗 AI 的概率性输出，验证在真实需求场景下，agent 能否稳定地交付价值。这是 AI 产品 eval 和传统软件测试的本质区别。"

---

## Q1: 为什么要做这个 eval 系统？

**A**: 用于简历展示。Deskhand 目前没有真实用户，需要用 eval 数据证明产品价值：

- 简历上可以写："Built eval framework with LLM-as-Judge, achieving X% success rate across N test scenarios"
- 面试时可以展示具体的评分报告和测试用例设计
- 证明对 AI 产品的 eval 思维（这是 AI Native PM 的核心能力）

**不是为了**：
- ❌ 生产环境的质量保证（那需要更复杂的 CI/CD 集成）
- ❌ 用户体验测试（那需要真实用户或 E2E UI 测试）

---

## Q2: 这个 eval 测的是什么？

**A**: 测试 Deskhand Agent 的任务完成能力，具体包括：

**会测到**（方案 A - 程序化调用）：
- ✅ Deskhand 的技能系统（skill 发现、加载、执行）
- ✅ 权限逻辑（permission-mode.ts）
- ✅ 自定义工具（a2ui-tools.ts）
- ✅ Agent 推理和工具调用能力

**不会测到**：
- ❌ UI 交互体验
- ❌ Electron 特定逻辑
- ❌ 流式显示效果

**为什么这样够了**：因为简历目标是证明"agent 核心能力"，不是"完整产品体验"。

---

## Q3: 整体架构是什么样的？

**A**: 核心流程：

```
测试用例 → Eval Runner → DeskhandAgent → 收集输出 → LLM-as-Judge → 生成报告
```

**文件结构**：
```
Deskhand/
├── evals/                          # 新建目录
│   ├── test-cases.json            # 测试用例定义
│   ├── eval-runner.ts             # 主执行脚本
│   ├── judge.ts                   # LLM-as-Judge 实现
│   ├── types.ts                   # 类型定义
│   └── results/                   # 结果输出目录
│       ├── YYYY-MM-DD-run-NNN.json
│       └── YYYY-MM-DD-run-NNN.md
├── packages/shared/src/agent/     # 已有代码，直接 import
│   └── deskhand-agent.ts
```

**运行方式**：
```bash
cd evals
bun run eval-runner.ts
# 输出到 results/ 目录
```

**MVP 范围**：
- 1 个测试用例
- 跑通完整管道
- 生成 JSON + Markdown 报告
- 后续扩展只需往 test-cases.json 添加更多用例

---

## Q4: 测试用例格式是什么？

**A**: `evals/test-cases.json` 格式：

```json
{
  "test_cases": [
    {
      "id": "tc001",
      "name": "List markdown files",
      "description": "测试 agent 能否正确列出目录中的 markdown 文件",
      "input": "请列出当前目录下所有的 markdown 文件",
      "expected_behavior": "使用文件系统工具列出 .md 文件，返回完整列表",
      "success_criteria": [
        "调用了正确的工具（如 list_files 或类似）",
        "返回结果包含 .md 文件",
        "没有包含非 markdown 文件"
      ]
    }
  ]
}
```

**字段说明**：
- `id`: 唯一标识符，用于结果追踪
- `name`: 简短名称
- `description`: 详细说明（给人看的）
- `input`: 发给 agent 的消息（模拟用户输入）
- `expected_behavior`: 期望 agent 做什么（给 Judge 看）
- `success_criteria`: 3-5 条具体的评分标准（给 Judge 看）

**MVP 用例建议**：
选一个简单但有代表性的任务，比如：
- "列出当前目录的 markdown 文件"（文件系统操作）
- "查找包含特定关键词的文件"（搜索能力）
- "总结某个文件的内容"（读取 + 理解）

---

## Q5: Eval Runner 怎么实现？

**A**: `evals/eval-runner.ts` 核心逻辑：

```typescript
import { DeskhandAgent } from '../packages/shared/src/agent'
import { judgeExecution } from './judge'
import testCases from './test-cases.json'

async function runEvals() {
  const results = []
  
  for (const testCase of testCases.test_cases) {
    console.log(`Running: ${testCase.name}`)
    
    // 1. 初始化 agent（allow-all 模式，不弹权限确认）
    const agent = new DeskhandAgent({
      permissionMode: 'allow-all',
      thinkingLevel: 'normal'
    })
    
    // 2. 执行任务
    const startTime = Date.now()
    const execution = await agent.executeTask(testCase.input)
    const executionTime = Date.now() - startTime
    
    // 3. 提取输出
    const agentOutput = {
      finalResponse: execution.response,
      toolsCalled: execution.toolCalls,
      steps: execution.steps
    }
    
    // 4. LLM-as-Judge 评分
    const score = await judgeExecution(testCase, agentOutput)
    
    // 5. 保存结果
    results.push({
      test_case_id: testCase.id,
      ...score,
      execution_time_ms: executionTime
    })
  }
  
  // 6. 生成报告
  saveResults(results)
}
```

**关键点**：
- `permissionMode: 'allow-all'`：eval 时不需要人工确认，直接执行
- 收集 `toolsCalled`：这是评分的重要依据
- 记录 `executionTime`：可以分析性能

**可能需要的适配**：
如果 `DeskhandAgent` 没有 `executeTask` 方法，需要：
1. 检查现有 API（可能是 `sendMessage` 或类似方法）
2. 添加一个简单的封装方法，返回结构化输出

---

## Q6: LLM-as-Judge 怎么实现？

**A**: `evals/judge.ts` 实现：

```typescript
import Anthropic from '@anthropic-ai/sdk'

export async function judgeExecution(testCase, agentOutput) {
  const client = new Anthropic({ 
    apiKey: process.env.ANTHROPIC_API_KEY 
  })
  
  const judgePrompt = `
你是一个 AI Agent 评估专家。请评估以下 agent 执行结果。

## 任务描述
${testCase.description}

## 期望行为
${testCase.expected_behavior}

## 成功标准
${testCase.success_criteria.map((c, i) => `${i+1}. ${c}`).join('\n')}

## Agent 实际输出
- 最终回复: ${agentOutput.finalResponse}
- 调用的工具: ${JSON.stringify(agentOutput.toolsCalled, null, 2)}
- 执行步骤: ${agentOutput.steps}

## 评分要求
请按 0-10 分评分，并说明理由。
- 8-10 分：完全符合预期，pass = true
- 5-7 分：部分完成，pass = false
- 0-4 分：失败，pass = false

输出 JSON 格式：
{
  "score": 8,
  "reasoning": "agent 正确使用了文件列表工具，返回结果准确，但...",
  "pass": true
}
`

  const response = await client.messages.create({
    model: 'claude-opus-4',  // 用最强的模型做 Judge
    max_tokens: 1024,
    messages: [{ role: 'user', content: judgePrompt }]
  })
  
  return JSON.parse(response.content[0].text)
}
```

**为什么用 Claude Opus**：
- 更强的推理能力，评分更准确
- 业界标准做法（OpenAI 的 evals 也用最强模型做 Judge）

**评分标准**：
- 8-10 分：完全符合预期
- 5-7 分：部分完成
- 0-4 分：失败

---

## Q7: 结果输出格式是什么？

**A**: 生成两种格式的报告：

### JSON 格式（`results/YYYY-MM-DD-run-NNN.json`）

```json
{
  "run_id": "2026-04-02-run-001",
  "timestamp": "2026-04-02T10:30:00Z",
  "total_cases": 1,
  "passed": 1,
  "failed": 0,
  "pass_rate": 1.0,
  "results": [
    {
      "test_case_id": "tc001",
      "score": 9,
      "pass": true,
      "reasoning": "Agent correctly used file listing tools and returned accurate results.",
      "execution_time_ms": 3200
    }
  ]
}
```

### Markdown 格式（`results/YYYY-MM-DD-run-NNN.md`）

```markdown
# Eval Results - 2026-04-02

## Summary
- Total: 1 test case
- Passed: 1 (100%)
- Average Score: 9.0/10

## Test Case: tc001 - List markdown files
✅ **Pass** (Score: 9/10)

**Reasoning**: Agent correctly used file listing tools and returned accurate results.

**Execution Time**: 3.2s
```

**用途**：
- JSON：机器可读，后续可以做趋势分析
- Markdown：人类可读，可以直接贴到简历材料或面试展示

---

## Q8: 实现步骤是什么？

**A**: 按顺序执行：

### Step 1: 创建目录结构
```bash
mkdir -p evals/results
cd evals
```

### Step 2: 写测试用例
创建 `test-cases.json`，先写 1 个用例（参考 Q4）

### Step 3: 实现类型定义
创建 `types.ts`：
```typescript
export interface TestCase {
  id: string
  name: string
  description: string
  input: string
  expected_behavior: string
  success_criteria: string[]
}

export interface AgentOutput {
  finalResponse: string
  toolsCalled: any[]
  steps: string
}

export interface JudgeScore {
  score: number
  reasoning: string
  pass: boolean
}
```

### Step 4: 实现 LLM-as-Judge
创建 `judge.ts`（参考 Q6 的完整代码）

### Step 5: 实现 Eval Runner
创建 `eval-runner.ts`（参考 Q5 的完整代码）

### Step 6: 实现结果保存
在 `eval-runner.ts` 中添加：
```typescript
function saveResults(results) {
  const runId = `${new Date().toISOString().split('T')[0]}-run-001`
  
  // 保存 JSON
  const jsonPath = `results/${runId}.json`
  fs.writeFileSync(jsonPath, JSON.stringify({
    run_id: runId,
    timestamp: new Date().toISOString(),
    total_cases: results.length,
    passed: results.filter(r => r.pass).length,
    failed: results.filter(r => !r.pass).length,
    pass_rate: results.filter(r => r.pass).length / results.length,
    results
  }, null, 2))
  
  // 生成 Markdown
  const mdPath = `results/${runId}.md`
  fs.writeFileSync(mdPath, generateMarkdownReport(results))
}

function generateMarkdownReport(results) {
  const passed = results.filter(r => r.pass).length
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length
  
  return `# Eval Results - ${new Date().toISOString().split('T')[0]}

## Summary
- Total: ${results.length} test case(s)
- Passed: ${passed} (${(passed/results.length*100).toFixed(0)}%)
- Average Score: ${avgScore.toFixed(1)}/10

${results.map(r => `
## Test Case: ${r.test_case_id}
${r.pass ? '✅' : '❌'} **${r.pass ? 'Pass' : 'Fail'}** (Score: ${r.score}/10)

**Reasoning**: ${r.reasoning}

**Execution Time**: ${(r.execution_time_ms/1000).toFixed(1)}s
`).join('\n')}
`
}
```

### Step 7: 运行测试
```bash
bun run eval-runner.ts
```

### Step 8: 检查结果
查看 `results/` 目录下的 JSON 和 Markdown 文件

---

## Q9: 需要注意什么坑？

**A**: 

### 坑 1: DeskhandAgent API 可能不匹配
**问题**：`DeskhandAgent` 可能没有 `executeTask` 方法
**解决**：
1. 先读 `packages/shared/src/agent/deskhand-agent.ts`
2. 找到实际的 API（可能是 `sendMessage` 或 `chat`）
3. 适配 eval-runner.ts 的调用方式

### 坑 2: 工具调用信息可能难以提取
**问题**：agent 输出可能不包含结构化的 `toolsCalled`
**解决**：
1. 检查 agent 返回的数据结构
2. 如果没有，从 agent 的内部状态或日志中提取
3. 最坏情况：只用 `finalResponse` 评分（Judge 仍然能工作）

### 坑 3: Judge 返回的不是有效 JSON
**问题**：LLM 可能返回带 markdown 代码块的 JSON
**解决**：
```typescript
let jsonText = response.content[0].text
// 去掉可能的 markdown 代码块
jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
return JSON.parse(jsonText)
```

### 坑 4: API Key 配置
**问题**：eval 需要调用 Anthropic API
**解决**：
1. 确保 `.env` 文件有 `ANTHROPIC_API_KEY`
2. 或者在 eval-runner.ts 中硬编码（仅开发用）

---

## Q10: 成功标准是什么？

**A**: MVP 完成的标志：

✅ **必须达到**：
1. 能运行 `bun run eval-runner.ts` 不报错
2. 生成 `results/YYYY-MM-DD-run-NNN.json`
3. 生成 `results/YYYY-MM-DD-run-NNN.md`
4. Markdown 报告包含：总结 + 测试用例结果 + 评分 + reasoning

✅ **验收方式**：
1. 手动检查 Markdown 报告，评分是否合理
2. 修改测试用例的 input，重新跑，看评分是否变化
3. 确认可以把 Markdown 报告贴到简历材料里

📈 **后续扩展**（不在 MVP 范围）：
- 添加 10-20 个测试用例
- 计算整体 pass rate
- 添加趋势分析（多次运行的对比）
- 集成到 CI/CD

---

## Q11: 简历上怎么写？

**A**: 完成 MVP 后，可以这样写：

**项目经历 - Deskhand (Desktop AI Agent)**
- Designed and built eval framework using LLM-as-Judge methodology to measure agent task completion quality
- Achieved [X]% success rate across [N] test scenarios covering file operations, search, and content analysis
- Defined rubric-based evaluation criteria and automated scoring pipeline, reducing manual QA time by 100%

**技能关键词**：
- LLM-as-Judge
- Agent Evaluation
- Rubric Design
- Automated Testing

**面试时可以展示**：
1. 测试用例设计（展示产品思维）
2. Eval 报告（展示数据驱动）
3. Judge prompt 设计（展示 prompt engineering 能力）

---

## 附录：给 Codex 的实现清单

**Codex 需要做的事情**（按顺序）：

1. ✅ 创建 `evals/` 目录结构
2. ✅ 写 `test-cases.json`（1 个测试用例）
3. ✅ 写 `types.ts`（类型定义）
4. ✅ 写 `judge.ts`（LLM-as-Judge 实现）
5. ✅ 写 `eval-runner.ts`（主逻辑）
6. ✅ 适配 `DeskhandAgent` API（检查实际方法名）
7. ✅ 测试运行，生成报告
8. ✅ 验收：检查 Markdown 报告是否合理

**需要的环境变量**：
```bash
ANTHROPIC_API_KEY=sk-ant-xxx
```

**预期产出**：
- `evals/` 目录下的完整代码
- `results/` 目录下的第一份报告
- 一个可以写进简历的数据点（如"85% pass rate"）

---

**文档结束**
