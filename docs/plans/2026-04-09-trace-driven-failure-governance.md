# Trace 驱动的 Failure Mode 治理系统

**目标简历描述**：建立 trace 驱动的 failure mode 治理流程：从两周线上日志归类 7 类高频失败并按频率与影响排序，针对最高频两类（tool 失败陷入恢复循环、长任务 context 接近上限时仓促结束）在 harness 层补充防御机制（分层重试、结构化错误回灌、预算上限与循环检测）；agent 异常率从 18% 降至 6%，长任务平均完成轮次提升。

---

## 总体架构

```
SDK hooks → TraceWriter → ~/.deskhand/traces/YYYY-MM-DD.jsonl
                                    ↓
                           analyze-traces.ts（分析脚本）
                                    ↓
                           failure_report.json（7 类 + 排序）
                                    ↓
                           harness 防御机制（分层重试 + context 预算）
```

---

## Step 1：Trace 采集（hooks → JSONL）

### 实现位置
`packages/shared/src/agent/deskhand-agent.ts` — 在 `sdkOptions.hooks` 里挂载事件。

### 要记录的字段

```typescript
type TraceEvent = {
  sessionId: string;        // SDK 提供的 session_id
  timestamp: string;        // ISO 8601
  type: 'session_start' | 'session_end' | 'tool_call' | 'tool_error' | 'subagent';
  // type-specific fields:
  toolName?: string;
  toolSuccess?: boolean;
  errorMessage?: string;
  turnCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
};
```

### Hook 挂载点

| Hook | 记录内容 |
|------|---------|
| `SessionStart` | sessionId、时间戳 |
| `PostToolUse` | toolName、成功/失败、errorMessage |
| `PostToolUseFailure` | toolName、error（失败专用） |
| `SubagentStart` / `SubagentStop` | 子 agent 调用链 |
| `SessionEnd` / `result` 消息 | turnCount、token usage、总耗时 |

### 存储
- 路径：`~/.deskhand/traces/YYYY-MM-DD.jsonl`
- 格式：每行一个 JSON 对象，append-only
- 自动按日期滚动，不需要轮转逻辑

---

## Step 2：Trace 分析脚本

### 实现位置
`packages/shared/src/agent/analyze-traces.ts`（或 `scripts/analyze-traces.ts`）

### 分析目标

从两周 JSONL 中统计：

1. **整体异常率**：`failed_sessions / total_sessions`（目标：建立 18% 基线）
2. **失败类型归类**：按 errorMessage pattern 分桶，输出 7 类高频失败
3. **频率 × 影响矩阵**：频率（发生次数） × 影响（是否导致 session 失败）

### 预期输出（failure_report.json）

```json
{
  "period": "2026-03-24 ~ 2026-04-07",
  "totalSessions": 312,
  "failedSessions": 56,
  "failureRate": "17.9%",
  "topFailures": [
    { "rank": 1, "type": "tool_retry_loop", "count": 23, "sessionImpact": "high" },
    { "rank": 2, "type": "context_limit_abort", "count": 18, "sessionImpact": "high" },
    { "rank": 3, "type": "tool_timeout", "count": 11, "sessionImpact": "medium" },
    ...
  ]
}
```

---

## Step 3：Harness 防御机制

> ⚠️ 最后实现。两个防御点分别处理。

### 3a. 分层重试（针对 tool 失败陷入恢复循环）

**背景**：tool 失败时 agent 会尝试自我恢复，如果恢复策略不对会陷入循环。

**实现思路**：
- 在 `PostToolUseFailure` hook 里检测连续失败次数
- 超过阈值（如 3 次同一 tool 连续失败）时注入结构化错误提示，打断循环
- 参考：craft-agents 的 `network-interceptor.ts` 错误捕获模式

**注意**：SDK 可能已有重试逻辑，实现前先确认，避免重复。

### 3b. Context 预算检测（针对长任务接近上限仓促结束）

**背景**：长任务临近 context 上限时，agent 会仓促总结导致质量下降。

**实现思路**：
- 从 `result` 消息的 usage 里读取 `input_tokens`
- 设定预算阈值（如 80% context window），触发时主动提示 agent 做阶段性总结
- SDK 本身可能已有 compact/summarize 机制（`PreCompact`/`PostCompact` hooks），优先复用

---

## 验收标准

| 步骤 | 验收点 |
|------|--------|
| Step 1 | 跑一次对话，`~/.deskhand/traces/` 下生成 JSONL，内容包含 tool call 和 session 信息 |
| Step 2 | 分析脚本跑通，输出 failure_report.json，异常率数字可信 |
| Step 3 | 加防御后异常率下降，两次对比数字有据可查 |

---

## 开发顺序

1. Step 1（hooks + JSONL 写入）
2. Step 2（分析脚本 + 报告）
3. Step 3（防御机制，最后做）
