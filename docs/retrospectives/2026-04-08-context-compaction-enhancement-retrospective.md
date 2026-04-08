# Context Compaction 增强功能实现回顾

> 日期：2026-04-08  
> 主题：Slice 5-6 实现总结（上下文恢复增强 + Tool Result 清理策略）  
> 前置：[Context Compacting MVP 复盘](./2026-04-07-context-compacting-mvp-retrospective.md)

---

## 这次做了什么

在 MVP（Slice 1-4）的基础上，完成了两个增强功能：

1. **Slice 5：上下文恢复增强** — 压缩后自动恢复最近编辑的文件和 Skill 上下文
2. **Slice 6：Tool Result 清理策略** — 明确采用 API 默认行为，暂不实现精细控制

---

## Slice 5：上下文恢复增强

### 实现内容

创建了 `context-restore.ts` 模块，实现两个核心功能：

#### 1. 最近编辑文件恢复

**功能**：压缩后自动读取最近编辑过的 3 个文件（不超过 5000 tokens）

**实现逻辑**：
- 解析 transcript JSONL，提取所有 `Edit` 和 `Write` 工具调用
- 按时间倒序去重，取最近 3 个不同的文件
- 读取文件内容，按 token 限制截断（1 token ≈ 4 字符）
- 格式化为 Markdown 代码块，注入到 PostCompact 上下文

**为什么这么做**：
- 压缩后 agent 可能忘记刚才编辑了哪些文件
- 重新读取文件需要额外的工具调用，影响效率
- 5000 tokens 的限制确保不会占用过多上下文空间

#### 2. 最近 Skill 调用恢复

**功能**：如果最近 5 轮对话内有 Skill 调用，则恢复该 Skill 的上下文

**实现逻辑**：
- 解析 transcript JSONL，提取所有 `Skill` 工具调用
- 检查最后一次 Skill 调用距离当前是否在 5 轮以内
- 如果是，则在 PostCompact 上下文中注明最近使用的 Skill

**为什么这么做**：
- Skill 通常是多步骤的复杂操作
- 压缩后 agent 可能忘记正在执行哪个 Skill
- 5 轮阈值是经验值，确保只恢复"真正最近"的 Skill

### 集成方式

修改了 `buildPostCompactHookOutput()` 函数：

```typescript
// 之前：只注入 tasks 和 user
const baseContext = await buildPostCompactRestoreContext(workspaceDir);

// 现在：还会注入最近文件和 Skill
const enhancedContext = await buildEnhancedRestoreContext(workspaceDir, transcriptPath);
```

### 提交记录

- `8ce748e` - feat(agent): add enhanced context restore for recent files and skills
- `fa6ac37` - feat(agent): integrate enhanced context restore into PostCompact hook
- `7e1b542` - fix(agent): resolve type errors in context-restore

---

## Slice 6：Tool Result 清理策略

### 决策内容

**采用 API 默认的 Tool Result Clearing 行为，暂不实现精细控制。**

### 理由

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

### 何时需要精细控制

如果在实际使用中发现以下问题，再考虑实现：

1. **重要信息过早清理** — 例如 Read 工具读取的文件内容被清理，导致 agent 需要重复读取
2. **无用信息占用空间** — 例如某些工具的大量输出占用 token，但对后续对话无用
3. **特定工具需要特殊处理** — 例如 Skill 工具的输出需要保留更久

### 文档输出

创建了 `docs/decisions/tool-result-clearing-strategy.md`，记录这个决策和未来的升级路径。

### 提交记录

- `d140199` - docs: add tool result clearing strategy decision

---

## 端到端测试指南

创建了 `docs/testing/context-compaction-e2e-test.md`，包含 4 个测试场景：

1. **任务记忆测试** — 验证压缩后 agent 仍然记得当前任务
2. **用户偏好测试** — 验证压缩后 agent 仍然遵守用户偏好
3. **对话连贯性测试** — 验证压缩后 agent 能接上最近的对话
4. **压缩频率测试** — 验证压缩不会过于频繁

### 提交记录

- `50b0d73` - docs: add context compaction e2e test guide

---

## 实现过程中的关键决策

### 1. 为什么选择 3 个文件？

- 3 个文件通常能覆盖当前工作的主要上下文
- 更多文件会占用过多 token，影响其他上下文
- 可以根据实际使用反馈调整

### 2. 为什么选择 5 轮对话作为 Skill 阈值？

- 5 轮对话通常是一个完整的交互周期
- 太短（如 2 轮）可能遗漏正在进行的 Skill
- 太长（如 10 轮）可能恢复已经结束的 Skill

### 3. 为什么不立即实现精细化 Tool Result 清理？

- 遵循"先简单后复杂"的原则
- API 默认行为已经比较合理
- 需要实际使用数据来指导精细化策略

---

## 原子化提交实践

这次实现严格遵循了原子化提交原则：

1. **功能拆分**
   - 先创建 `context-restore.ts`（新功能）
   - 再集成到 `context-compaction.ts`（集成）
   - 最后修复类型错误（修复）

2. **每个 commit 只做一件事**
   - `8ce748e` - 添加新模块
   - `fa6ac37` - 集成到现有代码
   - `7e1b542` - 修复类型错误

3. **好处**
   - 如果某个功能有问题，可以精确回滚
   - 代码审查时更容易理解每个改动的意图
   - Git 历史清晰，方便后续维护

---

## 当前完成度

### 已完成（Slice 1-6）

- ✅ Slice 1: 70% 阈值触发压缩
- ✅ Slice 2: workspace memory 工具（TaskCreate/TaskUpdate/TaskList/TaskGet/UpdateUserPreference）
- ✅ Slice 3: PostCompact Hook 注入 tasks/user 信息
- ✅ Slice 4: compact.md 压缩提示词
- ✅ Slice 5: 上下文恢复增强（最近文件 + Skill）
- ✅ Slice 6: Tool Result 清理策略（采用 API 默认）

### 待验证

- ⏸️ 端到端测试（需要手动验收）
- ⏸️ 长对话场景下的实际效果
- ⏸️ 压缩频率是否合理
- ⏸️ 恢复的文件和 Skill 是否足够

---

## 技术债务和后续优化

### 1. 测试覆盖

**当前状态**：
- 有单元测试覆盖 workspace memory 基础功能
- 缺少 context-restore 的单元测试
- 缺少端到端自动化测试

**后续计划**：
- 为 `extractRecentFileEdits()` 和 `extractRecentSkillCalls()` 添加单元测试
- 考虑添加集成测试，模拟完整的压缩-恢复流程

### 2. 性能优化

**当前状态**：
- 每次压缩都会解析完整的 transcript JSONL
- 文件读取没有缓存机制

**后续计划**：
- 如果 transcript 很大，考虑只解析最近 N 轮
- 考虑缓存最近读取的文件内容

### 3. 配置化

**当前状态**：
- 硬编码了 3 个文件、5000 tokens、5 轮对话等参数

**后续计划**：
- 考虑将这些参数暴露为配置项
- 允许用户根据自己的使用场景调整

---

## 如果要讲这个项目

可以这样描述：

**Slice 5（上下文恢复增强）**：
- 实现了压缩后的智能上下文恢复机制，自动提取最近编辑的 3 个文件和最近使用的 Skill
- 通过解析 transcript JSONL，追踪 agent 的工具调用历史，识别关键上下文
- 设计了 token 限制机制（5000 tokens），平衡恢复效果和上下文占用
- 集成到 PostCompact Hook，确保压缩后 agent 能快速恢复工作状态

**Slice 6（Tool Result 清理策略）**：
- 评估了精细化 Tool Result 清理的成本和收益，决定采用 API 默认行为
- 编写了决策文档，明确了何时需要升级到精细控制
- 遵循"先简单后复杂"的工程原则，避免过度设计

**原子化提交实践**：
- 严格遵循每个 commit 只做一件事的原则
- 功能开发、集成、修复分别提交，保持 Git 历史清晰
- 方便代码审查和问题定位

---

## 最后

这次实现完成了 Context Compaction 的完整闭环：

1. **触发** — 70% 阈值自动触发
2. **记录** — workspace memory 工具持续记录任务和偏好
3. **压缩** — API 自动压缩，保留最近对话
4. **恢复** — PostCompact Hook 注入 tasks、user、最近文件、Skill
5. **归档** — PreCompact Hook 保存完整历史

从产品角度看，Deskhand 现在已经具备了基本的"抗遗忘能力"。

接下来需要的是：**真实场景下的验证和迭代**。

---

## 2026-04-09 补充：压缩提示词重构

### 问题

原始 `DEFAULT_COMPACTION_PROMPT` 只有 4 条模糊指引，没有结构要求：
- 摘要格式不稳定，每次压缩结果差异大
- 没有保留用户原话，决策理由容易失真
- 没有明确的"下一步"，压缩后 agent 不知道从哪里接

### 参考

读了 Claude Code 的 `src/services/compact/prompt.ts`，发现它使用：
- 9 个固定区块（Primary Request、Files、All user messages 等）
- `<analysis>` 草稿机制（先整理思路再输出，最后剥掉）
- 明确要求逐条保留用户原话
- "Optional Next Step" 要求引用最近对话原文，防止任务漂移

### 改动

借鉴 Claude Code 结构，针对非技术用户场景裁剪为 7 个区块：

1. 当前任务与意图
2. 关键决策与理由（加了"为什么"，不只是"决定了什么"）
3. 操作过的文件（去掉代码片段，只保留文件名和操作摘要）
4. 用户所有消息（逐条保留原话）
5. 用户偏好与约束（Deskhand 独有，Claude Code 没有）
6. 待处理任务
7. 下一步行动（引用原文防漂移）

同时加入了 `<analysis>` 草稿机制和 `Do NOT call any tools` 前置声明。

### 关键判断

Claude Code 的提示词是面向开发者的，要求保留完整代码片段、函数签名、错误信息。Deskhand 面向非技术用户，这些都不需要，但需要额外的"用户偏好与约束"区块——这是 Claude Code 没有的。
