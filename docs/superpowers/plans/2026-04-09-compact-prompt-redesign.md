# Compact Prompt 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `DEFAULT_COMPACTION_PROMPT` 替换为结构化的 7 区块提示词，提升压缩后的任务连贯性和决策记忆。

**Architecture:** 只修改 `packages/shared/src/agent/workspace-memory.ts` 中的 `DEFAULT_COMPACTION_PROMPT` 常量。不覆盖已存在的 `.claude/compact.md`（`writeIfMissing` 已保证这一点）。

**Tech Stack:** TypeScript, Bun test

---

### Task 1: 更新 DEFAULT_COMPACTION_PROMPT

**Files:**
- Modify: `packages/shared/src/agent/workspace-memory.ts:57-64`
- Test: `packages/shared/src/agent/context-compaction.test.ts`

- [ ] **Step 1: 写失败测试**

在 `context-compaction.test.ts` 末尾添加：

```typescript
describe('DEFAULT_COMPACTION_PROMPT structure', () => {
  test('contains all 7 required sections', async () => {
    const workspaceDir = makeTempWorkspace();
    await ensureWorkspaceMemoryFiles(workspaceDir);
    const prompt = await fs.readFile(
      path.join(workspaceDir, '.claude', 'compact.md'),
      'utf-8',
    );
    expect(prompt).toContain('当前任务与意图');
    expect(prompt).toContain('关键决策与理由');
    expect(prompt).toContain('操作过的文件');
    expect(prompt).toContain('用户所有消息');
    expect(prompt).toContain('用户偏好与约束');
    expect(prompt).toContain('待处理任务');
    expect(prompt).toContain('下一步行动');
  });

  test('contains analysis/summary structure', async () => {
    const workspaceDir = makeTempWorkspace();
    await ensureWorkspaceMemoryFiles(workspaceDir);
    const prompt = await fs.readFile(
      path.join(workspaceDir, '.claude', 'compact.md'),
      'utf-8',
    );
    expect(prompt).toContain('<analysis>');
    expect(prompt).toContain('<summary>');
    expect(prompt).toContain('Do NOT call any tools');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/godcorn/cursor/Deskhand && bun test packages/shared/src/agent/context-compaction.test.ts
```

预期：2 个新测试 FAIL（`当前任务与意图` 不在旧提示词中）

- [ ] **Step 3: 替换 DEFAULT_COMPACTION_PROMPT**

在 `packages/shared/src/agent/workspace-memory.ts` 中，将第 57-64 行替换为：

```typescript
const DEFAULT_COMPACTION_PROMPT = `CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.
Your entire response must be plain text: an <analysis> block followed by a <summary> block.

你的任务是对当前对话创建一份详细摘要，供后续对话恢复上下文使用。
重点关注：用户的任务目标、关键决策、用户偏好，以及下一步行动。
用产品语言和任务语言总结，不需要保留代码细节。

在输出最终摘要之前，先在 <analysis> 标签内整理你的思路：

1. 按时间顺序梳理对话，识别：
   - 用户的核心任务和意图
   - 做了哪些关键决策，为什么这么决定
   - 操作了哪些文件
   - 用户表达了哪些偏好或约束
   - 还有哪些任务没有完成
2. 确认信息完整，没有遗漏关键内容。

摘要应包含以下区块：

1. 当前任务与意图：详细描述用户想做什么，现在做到哪一步了
2. 关键决策与理由：列出对话中做出的重要决定，以及为什么这么决定
3. 操作过的文件：列出读取或修改过的文件，说明为什么操作这个文件
4. 用户所有消息：逐条列出用户发送的所有消息（非工具结果），保留原话
5. 用户偏好与约束：记录用户表达的角色信息、长期偏好、约束条件
6. 待处理任务：列出明确被要求但还没完成的任务
7. 下一步行动：描述压缩前正在做的事，如果有明确的下一步，直接引用最近对话中的原话

输出格式示例：

<analysis>
[整理思路，确保覆盖所有关键信息]
</analysis>

<summary>
1. 当前任务与意图：
   [详细描述]

2. 关键决策与理由：
   - [决策 1]：[理由]
   - [决策 2]：[理由]

3. 操作过的文件：
   - [文件路径]：[为什么操作，做了什么]

4. 用户所有消息：
   - [用户消息原话 1]
   - [用户消息原话 2]

5. 用户偏好与约束：
   - 角色：[用户角色]
   - 偏好：[偏好列表]
   - 约束：[约束列表]

6. 待处理任务：
   - [任务 1]
   - [任务 2]

7. 下一步行动：
   [描述下一步，如有引用原话："[用户原话]"]
</summary>

如果某些信息已经过时，请明确标记为"已失效"而不是混在当前状态里。

REMINDER: Do NOT call any tools. Respond with plain text only.`;
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/godcorn/cursor/Deskhand && bun test packages/shared/src/agent/context-compaction.test.ts
```

预期：所有测试 PASS

- [ ] **Step 5: typecheck**

```bash
cd /Users/godcorn/cursor/Deskhand && bun run typecheck
```

预期：无错误

- [ ] **Step 6: commit**

```bash
git add packages/shared/src/agent/workspace-memory.ts packages/shared/src/agent/context-compaction.test.ts
git commit -m "feat(agent): restructure compact prompt with 7-section format"
```

---

### Task 2: 更新复盘文档

**Files:**
- Modify: `docs/retrospectives/2026-04-08-context-compaction-enhancement-retrospective.md`

- [ ] **Step 1: 在复盘文档末尾追加提示词重构章节**

在文件末尾追加：

```markdown

---

## 2026-04-09 补充：压缩提示词重构

### 问题

原始 `DEFAULT_COMPACTION_PROMPT` 只有 4 条模糊指引，没有结构要求：
- 摘要格式不稳定
- 没有保留用户原话
- 没有明确的"下一步"，压缩后 agent 不知道从哪里接

### 参考

读了 Claude Code 的 `src/services/compact/prompt.ts`，发现它使用：
- 9 个固定区块
- `<analysis>` 草稿机制（先整理思路再输出，最后剥掉）
- 明确要求保留用户原话
- "Optional Next Step" 要求引用最近对话原文

### 改动

借鉴 Claude Code 结构，针对非技术用户场景裁剪为 7 个区块：

1. 当前任务与意图
2. 关键决策与理由（加了"为什么"）
3. 操作过的文件（去掉代码片段）
4. 用户所有消息（逐条保留原话）
5. 用户偏好与约束（Deskhand 独有）
6. 待处理任务
7. 下一步行动（引用原文防漂移）

同时加入了 `<analysis>` 草稿机制和 `Do NOT call any tools` 前置声明。
```

- [ ] **Step 2: commit**

```bash
git add docs/retrospectives/2026-04-08-context-compaction-enhancement-retrospective.md
git commit -m "docs: add compact prompt redesign to retrospective"
```
