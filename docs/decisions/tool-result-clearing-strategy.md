# Tool Result Clearing 策略

> 日期：2026-04-08
> 对应：Context Compaction Slice 6

## 决策

**采用 API 默认的 Tool Result Clearing 行为，暂不实现精细控制。**

## 理由

1. **API 默认策略已经合理**
   - Claude API 会自动清理过期的 tool result
   - 保留最近几轮的 tool result 用于上下文连贯性

2. **精细控制成本高**
   - 需要使用 `context_management` 参数
   - SDK 类型定义未完全暴露，需要类型断言
   - 需要为每种工具类型定义清理规则

3. **递进式优化**
   - 先验证默认行为效果
   - 如果发现问题（如重要 tool result 被过早清理），再升级到精细控制
   - 避免过度工程

## API 默认行为

根据 Claude API 文档，默认的 Tool Result Clearing 策略：
- 自动清理较早轮次的 tool result
- 保留最近几轮的 tool result（具体轮数由 API 决定）
- 压缩时会进一步清理，只保留摘要中提到的关键信息

## 何时需要精细控制

如果在实际使用中发现以下问题，再考虑实现精细控制：

1. **重要信息过早清理**
   - 例如：Read 工具读取的文件内容被清理，导致 agent 需要重复读取

2. **无用信息占用空间**
   - 例如：某些工具的大量输出占用 token，但对后续对话无用

3. **特定工具需要特殊处理**
   - 例如：Skill 工具的输出需要保留更久

## 精细控制实现方案（备用）

如果需要实现，可以使用 `context_management` 参数：

```typescript
context_management: {
  edits: [
    {
      type: 'compact_20260112',
      instructions: '...',
      pause_after_compaction: false,
    },
    {
      type: 'tool_result_clearing',
      rules: [
        {
          tool_name: 'Read',
          keep_turns: 10, // 保留最近 10 轮
        },
        {
          tool_name: 'Bash',
          keep_turns: 3, // 只保留最近 3 轮
        },
        {
          tool_name: 'Skill',
          keep_turns: 20, // Skill 输出保留更久
        },
      ],
    },
  ],
}
```

注意：以上代码仅为示意，实际 API 参数可能不同。

## 当前状态

- ✅ 使用 API 默认 Tool Result Clearing
- ⏸️ 精细控制暂不实现，等待实际使用反馈
- 📊 需要在端到端测试中观察默认行为是否足够

## 参考

- 设计文档 Q6：Tool Result Clearing 需要精细控制吗？
- Claude API 文档：Context Management
