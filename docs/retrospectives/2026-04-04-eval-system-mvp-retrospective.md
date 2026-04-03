# Eval System MVP 实战复盘

> **项目时间**：2026-04-04  
> **目标**：为 Deskhand Agent 搭建 LLM-as-Judge 评估系统，验证 agent 在真实场景下的表现  
> **成果**：MVP 跑通，完成第一个 scenario 测试（6.8/10），生成专业报告

---

## 一、为什么做这个项目

### 业务背景
Deskhand 是一款面向非技术用户的 desktop agent 产品。Agent 的输出是不确定的（同一个问题可能有不同解法），传统单元测试无法验证"做得好不好"。需要一套 **scenario-based evaluation** 系统来：
- 测试 agent 在真实用户场景下的完成度
- 量化评估不同版本的质量变化
- 为简历/面试提供可展示的技术深度

### 个人目标
- 掌握 **LLM-as-Judge** 方法论（行业标准评估方式）
- 实战 **multi-turn agent eval**（评估完整执行轨迹）
- 产出可讨论的技术成果（代码 + 报告 + 方法论理解）

---

## 二、方法论对照：我们用了什么

### 核心方法论应用

| 方法论概念 | 我们的实现 | 文件位置 |
|-----------|----------|---------|
| **Golden Dataset** | `scenarios/001-create-react-component.json`<br/>包含 input, expected_behavior, success_criteria | `packages/eval/scenarios/` |
| **LLM-as-Judge** | 用 Claude Opus 4.6 作为评分 agent<br/>按 rubric 对 trajectory 打分 | `packages/eval/src/judge.ts` |
| **Rubric（评分标准）** | 4 个维度：task completion, tool usage, error handling, user experience<br/>每个维度 0-10 分 + 文字理由 | `judge.ts` 的 prompt |
| **Trajectory（轨迹）** | 记录完整执行过程：<br/>- 用户输入<br/>- Agent 对话内容<br/>- 工具调用序列（tool name + input） | `packages/eval/src/runner.ts` |
| **Multi-turn Agent Eval** | 评估 agent 完整执行过程，不只看最终输出<br/>Judge 能看到每一步的工具调用 | 整个 eval pipeline |

### 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    Eval Pipeline                        │
└─────────────────────────────────────────────────────────┘
         ↓
  1. Load Scenario
     (golden_dataset.json)
         ↓
  2. Run Agent
     (DeskhandAgent.chat + event stream)
         ↓
  3. Collect Trajectory
     (conversation + tool calls)
         ↓
  4. LLM-as-Judge
     (Claude Opus 4.6 按 rubric 打分)
         ↓
  5. Generate Report
     (JSON + Markdown)
```

---

## 三、技术实现：关键决策

### 1. Event Stream 处理（Trajectory 收集）

**挑战**：DeskhandAgent 是事件驱动架构，输出通过 `onEvent` 回调流式返回。

**解决方案**：
```typescript
// packages/eval/src/runner.ts
await this.agent.chat(scenario.input, {
  permissionMode: 'allow-all',
  onEvent: (event: AgentEvent) => {
    switch (event.type) {
      case 'text':
      case 'text_complete':
        assistantMessage += event.text;
        break;
      case 'tool_start':
        if (event.toolUseId) {
          toolCallsMap.set(event.toolUseId, {
            tool: event.toolName,
            input: event.input,
          });
        }
        break;
    }
  },
});
```

**关键点**：
- 用 `Map<toolUseId, ToolCall>` 追踪工具调用
- 处理 `text` 和 `text_complete` 两种事件类型
- `permissionMode: 'allow-all'` 避免测试时需要人工确认

### 2. SSE 流式响应解析

**挑战**：Proxy API 返回的是原始 SSE 字符串，不是解析后的对象。

**解决方案**：
```typescript
// packages/eval/src/judge.ts
private parseSSEResponse(sseText: string): { type: 'text'; text: string } {
  const textDeltas: string[] = [];
  const lines = sseText.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
        textDeltas.push(data.delta.text);
      }
    }
  }
  return { type: 'text', text: textDeltas.join('') };
}
```

**关键点**：
- 检测响应类型（string vs object）
- 手动解析 SSE 格式（`data: {...}\n`）
- 提取 `content_block_delta` 中的 `text_delta`

### 3. Rubric 设计

**原则**：遵循方法论中的"rubric 越像法律条文，LLM 判得越准"。

**我们的 4 个维度**：
```markdown
1. Task Completion (0-10)
   - 是否完成了用户要求的任务？
   - 是否满足 success_criteria 中的所有条件？

2. Tool Usage (0-10)
   - 工具调用是否合理？
   - 有没有调用不必要的工具或遗漏必要的工具？

3. Error Handling (0-10)
   - 遇到问题时是否有合理的处理？
   - 有没有给用户清晰的反馈？

4. User Experience (0-10)
   - 回复是否清晰易懂？
   - 语气是否友好专业？
```

**Pass 标准**：`overall_score >= 6.0`（4 个维度平均分）

### 4. 报告格式

**设计原则**：3-section 结构，信息分层清晰。

```markdown
## 1. Test Scenario
- Description
- User Input
- Expected Behavior
- Success Criteria

## 2. Scoring Results
- 4 个维度分数 + 总分
- Judge Comment（文字评价）

## 3. Execution Process
- Timestamp
- Conversation（用户输入 + Agent 回复）
- Tool Calls（工具调用序列）
```

**为什么这样设计**：
- Section 1：让读者理解"考的是什么"
- Section 2：直接看结果（通过/失败）
- Section 3：深入分析执行过程（debug 用）


---

## 四、遇到的坑：5 个主要错误

### 错误 1：Import 路径错误
```typescript
// ❌ 错误
import { DeskhandAgent } from '@deskhand/shared/agent/deskhand-agent';

// ✅ 正确
import { DeskhandAgent } from '@deskhand/shared/agent';
```
**原因**：`package.json` 的 `exports` 字段只暴露了 `./agent`，没有子路径。

### 错误 2：方法名错误
```typescript
// ❌ 错误
await agent.processUserMessage(input);

// ✅ 正确
await agent.chat(input, { onEvent: ... });
```
**原因**：DeskhandAgent 的 API 是 `chat()`，不是 `processUserMessage()`。

### 错误 3：遗漏事件类型
```typescript
// ❌ 错误：只处理 'text'
case 'text':
  assistantMessage += event.text;

// ✅ 正确：处理 'text' 和 'text_complete'
case 'text':
case 'text_complete':
  assistantMessage += event.text;
```
**原因**：Agent 会发送 `text_complete` 事件标记文本结束。

### 错误 4：模型名错误
```typescript
// ❌ 错误
model: 'claude-opus-4'

// ✅ 正确
model: 'claude-opus-4-6'
```
**原因**：Proxy API 要求完整的模型 ID。

### 错误 5：SSE 响应未解析
```typescript
// ❌ 错误：直接当对象用
const response = await anthropic.messages.create(...);
const text = response.content[0].text; // TypeError

// ✅ 正确：检测类型并解析
if (typeof response === 'string') {
  const parsed = this.parseSSEResponse(response);
  const text = parsed.text;
}
```
**原因**：Proxy API 返回原始 SSE 字符串，需要手动解析。

---

## 五、成果展示

### MVP 验证结果

**第一个 Scenario**：`001-create-react-component.json`
- **任务**：创建一个 React Button 组件
- **Success Criteria**：
  1. 创建了 `Button.tsx` 文件
  2. 组件接受 `label` 和 `onClick` props
  3. 使用 TypeScript 类型定义

**测试结果**：
- **Overall Score**: 6.8/10（通过）
- **Task Completion**: 6/10
- **Tool Usage**: 7/10
- **Error Handling**: 7/10
- **User Experience**: 7/10

**Judge Comment**：
> Agent 理解了用户需求并输出了正确的 React 组件代码，但没有调用 Write 工具将代码写入文件系统。用户要求"创建"组件，应该包含文件创建操作。

**关键发现**：
- ✅ Agent 正确理解了任务
- ✅ 生成的代码符合要求
- ❌ 没有执行文件写入操作（理解偏差："创建" = 输出代码 vs 写入文件）

### 生成的报告

**JSON 报告**：`packages/eval/results/001-create-react-component.json`
- 包含完整的 scenario 信息
- 包含 transcript（conversation + tool calls）
- 包含 4 个维度的详细评分

**Markdown 报告**：`packages/eval/results/001-create-react-component.md`
- 3-section 格式，信息分层清晰
- 可直接用于技术讨论或面试展示

---

## 六、对照方法论：我们做了什么 / 还缺什么

### ✅ 已完成（MVP 范围）

| 方法论要求 | 我们的实现 | 完成度 |
|-----------|----------|-------|
| Golden Dataset | 1 个 scenario（JSON 格式） | ✅ MVP |
| LLM-as-Judge | Claude Opus 4.6 + 4 维度 rubric | ✅ 完整 |
| Trajectory 收集 | Event stream + tool calls | ✅ 完整 |
| 报告生成 | JSON + Markdown 双格式 | ✅ 完整 |
| 跑通 pipeline | CLI 一键运行 | ✅ 完整 |

### ❌ 未完成（超出 MVP 范围）

| 方法论要求 | 现状 | 优先级 |
|-----------|-----|-------|
| **Calibration（校准）** | 没有人类专家打分对比 | 🔴 高 |
| **Eval the Eval（稳定性检查）** | 没有同输出多次跑验证 | 🟡 中 |
| **覆盖度** | 只有 1 个 scenario，需要 50-100 条 | 🔴 高 |
| **Regression Test** | 没有 CI/CD 集成 | 🟢 低 |
| **Online Eval** | 没有生产环境监控 | 🟢 低 |

### 下一步建议

**Phase 1：扩展 Golden Dataset（优先级：高）**
- 目标：从 1 个扩展到 20-30 个 scenarios
- 覆盖场景：
  - 常见任务（60%）：文件操作、代码生成、信息查询
  - 边缘情况（30%）：模糊指令、多步骤任务、错误处理
  - 已知失败（10%）：之前测试中发现的问题

**Phase 2：Calibration（优先级：高）**
- 人工给 10-20 个 scenarios 打分
- 对比 LLM Judge 的打分
- 计算一致率（目标 >85%）
- 如果一致率低，调整 rubric

**Phase 3：Eval the Eval（优先级：中）**
- 同一个 agent 输出，跑 3-5 次 eval
- 检查分数方差（方差大 = rubric 太模糊）
- 调整 rubric 直到稳定

---

## 七、简历/面试要点

### 项目描述（一句话）
> 为 AI Agent 产品搭建 LLM-as-Judge 评估系统，实现 scenario-based evaluation pipeline，验证 agent 在真实用户场景下的任务完成度。

### 技术亮点（3 个关键词）
1. **LLM-as-Judge**：用 Claude Opus 4.6 作为评分 agent，按 4 维度 rubric 对执行轨迹打分
2. **Event Stream Processing**：处理 agent 的事件驱动架构，收集完整 trajectory（conversation + tool calls）
3. **SSE 解析**：手动解析 Server-Sent Events 流式响应，兼容 proxy API

### 可讨论的深度问题

**Q1: 为什么用 LLM-as-Judge 而不是代码断言？**
> Agent 的输出是不确定的，同一个任务可能有多种合理解法。代码断言只能判"对不对"，LLM-as-Judge 能判"好不好"（过程合理性、用户体验）。

**Q2: 如何保证 Judge 打分的准确性？**
> 1. 写详细的 rubric（4 个维度，每个维度有明确的 0-10 分标准）
> 2. 下一步会做 Calibration：人工打分 vs LLM 打分，计算一致率
> 3. 如果一致率低（<85%），说明 rubric 太模糊，需要调整

**Q3: 遇到的最大技术挑战是什么？**
> SSE 流式响应解析。Proxy API 返回的是原始 SSE 字符串（`event: ...\ndata: {...}`），不是解析后的对象。需要手动解析 SSE 格式，提取 `content_block_delta` 中的 `text_delta`。

**Q4: 如何扩展到更多 scenarios？**
> 1. 从真实用户日志中挖掘常见场景
> 2. 覆盖 3 类：常见任务（60%）、边缘情况（30%）、已知失败（10%）
> 3. 每个 scenario 需要明确的 success_criteria（不是唯一答案，而是通过/失败的判断标准）

**Q5: 这个系统的价值是什么？**
> 1. **量化评估**：从"靠感觉"到"靠数据"，每次改动都能看到分数变化
> 2. **回归测试**：防止新功能破坏已有能力
> 3. **产品迭代**：识别 agent 的薄弱环节，指导优化方向

### 代码示例（面试时可展示）

**Trajectory 收集**（`runner.ts`）：
```typescript
const toolCallsMap = new Map<string, ToolCall>();
await this.agent.chat(scenario.input, {
  permissionMode: 'allow-all',
  onEvent: (event: AgentEvent) => {
    switch (event.type) {
      case 'tool_start':
        if (event.toolUseId) {
          toolCallsMap.set(event.toolUseId, {
            tool: event.toolName,
            input: event.input,
          });
        }
        break;
    }
  },
});
```

**SSE 解析**（`judge.ts`）：
```typescript
private parseSSEResponse(sseText: string) {
  const textDeltas: string[] = [];
  for (const line of sseText.split('\n')) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.type === 'content_block_delta') {
        textDeltas.push(data.delta.text);
      }
    }
  }
  return { type: 'text', text: textDeltas.join('') };
}
```

---

## 八、方法论学习总结

### 核心概念理解

**Evals 的本质**：给 AI 写考试卷（出题 + 批卷）

**LLM-as-Judge 的关键**：
- Rubric 越像法律条文，LLM 判得越准
- 需要 Calibration（跟人类专家对比）
- 稳定性检查（同输出多次跑，方差要小）

**Golden Dataset 的原则**：
- 少而精（50-100 条高质量 > 几千条模糊的）
- 从真实场景挖掘
- 不写死"必须走这条路"，只写"终态 + 不能出现什么"

**Multi-turn Agent Eval 的三个维度**：
1. 结果正确性（代码断言）
2. 过程合理性（LLM Judge）
3. 副作用（代码断言）

### 完整的 Evals 飞轮

```
Golden Dataset → AI 跑考试 → 批卷 → 分数 + 失败分析
     ↑                                      ↓
     └──────── 生产翻车 case 回灌 ←──── 改进系统 → 发布
```

**内圈 Meta-evaluation**：
- 稳定性检查（同输出多次跑）
- 准确性检查（跟人类专家比）
- 覆盖度检查（生产翻车暴露盲区）

### 工程实战经验

**MVP 优先**：
- 先做 1 个 scenario 跑通 pipeline
- 再扩展到 50-100 条
- 不要一开始就追求完美

**两层夹击**：
- 代码断言判"结果对不对"
- LLM Judge 判"过程好不好"

**什么时候升级到正式工具**：
- 团队协作（需要 UI）
- CI/CD 集成（自动跑 eval）
- 生产监控（实时质量监控）
- 规模化（几千条 scenarios）

---

## 九、总结

### 项目成果
- ✅ 搭建完整的 LLM-as-Judge eval pipeline
- ✅ 跑通第一个 scenario（6.8/10）
- ✅ 生成专业报告（JSON + Markdown）
- ✅ 掌握行业标准方法论

### 技术能力提升
- **方法论**：LLM-as-Judge, Golden Dataset, Rubric, Trajectory, Calibration
- **工程实现**：Event stream processing, SSE parsing, Report generation
- **问题解决**：5 个主要错误的诊断和修复

### 可展示价值
- **简历**：AI Agent Evaluation System（LLM-as-Judge + Scenario-based Testing）
- **面试**：可深入讨论方法论、技术实现、遇到的坑、下一步规划
- **代码**：完整的 TypeScript 实现，可直接展示

### 下一步
1. 扩展 Golden Dataset（20-30 个 scenarios）
2. Calibration（人工打分 vs LLM 打分）
3. Eval the Eval（稳定性检查）

---

**文档版本**：v1.0  
**最后更新**：2026-04-04  
**相关文件**：
- 代码：`packages/eval/`
- 方法论：`/Users/godcorn/Documents/obsidian/notes/Local-Agent-Learning/ai-evals-guide.md`
- 报告示例：`packages/eval/results/001-create-react-component.md`
