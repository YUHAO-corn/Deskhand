# Context Compacting Design — Q&A 记录

> 日期：2026-04-07
> 对应：Context Management 功能

---

## Q1: 为什么需要 Context Compacting？

**结论：解决长对话中的"答非所问"问题，保持 agent 的任务连贯性。**

关键线索：
- 200K context window 看起来很大，但任务型长对话很容易填满
- Context Rot：上下文快满时（90%+），模型注意力被稀释，回答质量下降
- 被动压缩（90% 触发）时，"烂输出"已经污染了上下文
- 压缩后如果信息丢失，agent 会忘记任务目标和用户偏好
- 非技术用户对"突然变蠢"零容忍，需要主动预防

## Q2: 核心策略是什么？

**结论：70% 主动触发 + 压缩后无损注入关键信息。**

讨论过的方案：
- A: 等 API 默认触发（90%）— 太晚，质量已下降
- B: 70% 主动触发 — 提前预防，保持输出质量
- C: 精细控制每个工具的清理规则 — 过度工程

选择 B，理由：
- 参考 HumanLayer 的 FIC（Frequent Intentional Compaction）原则
- 70% 是一个经验值，可以后续调整
- 先用简单方案验证效果，不够再加精细控制

## Q3: 压缩后会丢失什么信息？

**结论：压缩摘要可能失真，但 API 会自动保留最近 2-3 轮原文。**

压缩的工作原理：
```
压缩前（20万 tokens）：
├─ 100 轮对话历史
├─ 大量工具调用结果
└─ 用户偏好和任务细节

              ↓ 压缩

压缩后（5万 tokens）：
├─ [压缩摘要] — API 自动生成的对话总结
├─ [最近 2-3 轮原文] — API 自动保留（Rolling Window）
└─ 用户新消息
```

会丢失的信息：
- 工具调用的详细结果（Tool Result Clearing 自动清理）
- 对话的具体细节（被总结成摘要）
- 用户的精确表述（摘要可能改写）

不会丢失的信息：
- 最近 2-3 轮对话原文（API 自动保留）
- 系统提示词（技能列表等，每次请求都发送）

## Q4: 如何避免关键信息丢失？

**结论：压缩后直接注入 todo.md 和 user.md，不走压缩流程。**

讨论过的方案：
- A: 压缩前注入（PreCompact Hook）— 信息会被二次加工，可能失真
- B: 压缩后注入 — 无损保留原文
- C: 依赖压缩摘要 — 不可控，可能遗漏关键信息

选择 B，理由：
- **第一性原理**：压缩后唯一影响的是输入的上下文
- PreCompact Hook 注入的内容会被压缩 API 总结，可能失真
  - 例如："我不喜欢吃饺子馒头包子" → 可能被总结成"我不喜欢吃淀粉类"
- 压缩后直接注入，确保信息完整性
- todo.md 和 user.md 是任务连贯性的核心，不能有任何失真

需要注入的内容：
1. **todo.md** — 任务进度、关键决策、下一步行动
2. **user.md** — 用户偏好、工作习惯
3. **（可选）项目文件结构** — 如果 agent 探查过，可以注入避免重复探查

不需要注入的内容：
- ~~技能列表~~ — 在系统提示词里，不会被压缩
- ~~技能执行结果~~ — 重要的应该记录在 todo.md
- ~~最近 2-3 轮原文~~ — API 自动保留

## Q5: PreCompact Hook 还有用吗？

**结论：暂不使用，或仅用于日志记录。**

PreCompact Hook 的问题：
- 注入的内容会被压缩 API 总结，无法保证完整性
- 适合注入"压缩提示"（告诉 API 重点关注什么），但效果不确定
- 我们的核心需求是无损保留信息，不是引导压缩方向

可能的用途：
- 记录压缩事件日志（"压缩即将发生"）
- 后续如果需要引导压缩方向，可以再启用

## Q6: Tool Result Clearing 需要精细控制吗？

**结论：先用 API 默认行为，不够再加 context_management 参数。**

讨论过的方案：
- A: 用 `context_management` 参数精细控制（保留读取类工具、清理执行类工具）
- B: 用 API 默认的 Tool Result Clearing
- C: 不清理工具结果

选择 B，理由：
- API 的默认清理策略已经比较合理
- 精细控制需要 TypeScript 类型断言（SDK 类型定义未暴露）
- 先验证简单方案效果，如果发现 API 清理得不合理再升级
- 递进关系：方案 B → 效果不好 → 升级到方案 A

## Q7: 如何实现压缩后注入？

**结论：用 PostCompact Hook 注入 todo.md 和 user.md。**

实现流程：
```
1. SDK 检测到 token 使用量达 70%（140K tokens）
2. 触发压缩（autoCompactWindow 配置）
3. API 返回压缩后的上下文：[摘要] + [最近 2-3 轮原文]
4. 触发 PostCompact Hook
5. Hook 读取 todo.md 和 user.md
6. 将内容作为系统消息注入到上下文
7. 继续对话
```

技术细节：
- 使用 SDK 的 `Settings.autoCompactWindow: 140000`（70% of 200K）
- 使用 `PostCompact Hook` 注入内容
- 注入格式：系统消息，包含文件路径和内容
- 如果文件不存在，跳过注入

## Q8: 压缩阈值为什么选 70%？

**结论：经验值，平衡质量和频率。**

讨论过的阈值：
- 90%（API 默认）— 太晚，质量已下降
- 80% — 可能还是有点晚
- 70% — 提前预防，留有余地
- 50% — 太频繁，压缩本身有成本

选择 70%，理由：
- 参考 HumanLayer 的 FIC 原则（40-60% 利用率）
- 桌面 agent 面向非技术用户，对质量波动敏感
- 70% 是一个保守的起点，可以根据实际效果调整
- 140K tokens 对于任务型对话已经很大，足够完成一个完整任务

## Q9: 如何验证压缩效果？

**结论：手动验收 + 长对话测试。**

验收点：
1. 触发压缩后，agent 仍然记得当前任务（todo.md 生效）
2. 触发压缩后，agent 仍然遵守用户偏好（user.md 生效）
3. 触发压缩后，agent 能接上最近的对话（Rolling Window 生效）
4. 压缩不会过于频繁（70% 阈值合理）

测试场景：
- 长对话（100+ 轮）持续修改代码
- 中途切换任务，压缩后能否记住新任务
- 用户表达偏好后压缩，agent 是否仍然遵守

后续优化：
- 如果发现压缩后"答非所问"，检查 todo.md 和 user.md 是否正确注入
- 如果发现工具结果清理不合理，考虑启用 `context_management` 精细控制
- 如果 70% 触发太频繁或太晚，调整阈值

## Q10: 项目文件结构需要注入吗？

**结论：可选，先不做，观察 agent 是否会重复探查。**

讨论：
- agent 通过 Glob/Grep 等工具自己探查项目结构
- 压缩后可能忘记项目结构，需要重新探查
- 重新探查的成本不高（几次工具调用）
- 如果发现频繁重复探查影响体验，再考虑注入

实现方式（如果需要）：
- 在 PostCompact Hook 中生成项目文件树
- 作为系统消息注入："项目结构：src/App.tsx, src/ChatArea.tsx, ..."
- 格式可以参考 `tree` 命令输出

---

## Deskhand 版 Context Compacting 流程图

```text
每一轮对话
+------------------+
| Tool call result |
+------------------+
        |
        v
[Layer 1: micro_compact]        （silent, every turn）
  - 清理 3 轮之前的旧 tool_result
  - 只保留简短占位符："[Previous: used {tool_name}]"
        |
        v
[Check: tokens > 50000?]
   |               |
   no              yes
   |               |
   v               v
继续对话   [Layer 2: auto_compact]
              - 触发 SDK / API 摘要压缩
              - 将完整转录写入 .transcripts/
              - 生成结构化摘要
                    |
                    v
            [Layer 3: compact tool]
              - 用户或系统显式触发压缩
              - 与 auto_compact 走同一套摘要逻辑
                    |
                    v
            [Layer 4: post_compact_restore]
              - 恢复 .claude/user.md
              - 恢复 .claude/tasks.jsonl
              - 恢复最近读取 / 编辑的关键文件
              - 必要时恢复少量项目结构信息
                    |
                    v
               继续对话
```

```text
Deskhand 的重点不是“再做一次压缩”，而是“压缩之后把关键工作记忆补回来”。

Claude Code 负责底座能力：
- micro_compact
- auto_compact
- compact tool

Deskhand 额外负责产品层恢复：
- user.md
- todo / tasks.jsonl
- 关键文件上下文
```

## 实现计划

### Vertical Slice 实现顺序

按可交付的最小闭环推进，先把“压缩后还能继续工作”跑通，再加增强项。采用 **Vertical Slice + 原子化提交** 的方式开发：

- 每完成一小段可验证功能，就先提交这一小段
- 不把多个子功能攒在一起一次性提交
- 这样如果后续某一步出错，只需要回退最近的一小块，而不是整坨回滚

1. **阈值触发 compact**
   - 先确定触发阈值
   - 在接近阈值时自动压缩
   - 生成 summary，并确保 summary 保留最近 2~3 轮原始对话

2. **注册 user / task 工具 + workspace 初始化**
   - 启动时初始化 workspace 级别的 `.claude/user.md` 和 `.claude/tasks.jsonl`
   - 设计工具描述、触发时机、写入内容和文件格式
   - 让 agent 知道什么时候该记录什么信息

3. **压缩后恢复 user / task 文件**
   - compact 完成后读取 `.claude/user.md` 和 `.claude/tasks.jsonl`
   - 作为恢复上下文注入到新的会话起点
   - 验证压缩后仍能记住用户偏好和当前任务

4. **编写压缩提示词文件**
   - 在压缩阶段给 API 传入更贴近非技术用户视角的指引
   - 让 summary 更重视任务、偏好、下一步，而不是开发者式细节

5. **上下文恢复增强**
   - 压缩后自动读取最近编辑过的 3 个文件
   - 总量不超过 5000 tokens
   - 如果最近一次 Skill 调用在 5 轮对话内，则恢复该 Skill 的上下文

6. **精细化 tool result 清理规则**
   - 在基础闭环跑通后，再做更细的 tool result 生命周期控制
   - 先保证简单可用，再考虑按工具类型做差异化清理

### MVP 边界

第一版先只做 1~4，形成完整闭环；5~6 作为增强项后置。

### 配置参数

```typescript
// SDK 配置
Settings.autoCompactWindow = 140000; // 70% of 200K

// PostCompact Hook
hooks: {
  PostCompact: async (input) => {
    // 读取 todo.md 和 user.md
    // 注入到上下文
    return {
      additionalContext: `
当前任务状态：
${todoContent}

用户偏好：
${userContent}
      `
    };
  }
}
```

### 不做的事情

- ❌ 不使用 PreCompact Hook（会失真）
- ❌ 不注入技能列表（在系统提示词里）
- ❌ 不注入技能执行结果（应该记录在 todo.md）
- ❌ 不把最近文件恢复放进第一版 MVP
- ❌ 不把精细 Tool Result Clearing 放进第一版 MVP

## Q11: 任务和用户偏好如何维护？

**结论：采用 Claude Code 的 Task 系统设计，存储为 JSONL 文件。**

讨论过的方案：
- A: Markdown 格式的 todo.md — 简单但难以管理依赖关系
- B: 结构化 Task（参考 Claude Code）— 支持状态流转和依赖关系
- C: 用户手动维护 — 依赖用户主动性
- D: 后台自动分析 — 过重且不准确

选择 B，理由：
- Claude Code 的 Task 系统已经验证过，设计成熟
- 结构化数据易于查询、更新和管理依赖关系
- 支持明确的状态流转（pending → in_progress → completed）
- 可以拆分复杂任务为多个独立任务
- 工具描述可以精确指导 Agent 什么时候用

### 工具设计

#### TaskCreate 工具

**用途**：创建新任务

**输入参数**：
```typescript
{
  subject: string,      // 任务标题（祈使句，如 "实现 PostCompact Hook"）
  description: string,  // 任务描述
  activeForm?: string   // 进行中时显示的文本（如 "实现 PostCompact Hook 中"）
}
```

**使用时机**（参考 Claude Code）：
- 复杂多步骤任务（3+ 步骤）
- 非平凡的复杂任务
- 用户明确要求 todo list
- 用户提供多个任务
- 收到新指令后立即捕获需求

**不使用时机**：
- 单一、直接的任务
- 平凡任务，跟踪无益
- 少于 3 个简单步骤的任务
- 纯对话或信息查询

#### TaskUpdate 工具

**用途**：更新任务状态

**输入参数**：
```typescript
{
  taskId: string,
  subject?: string,
  description?: string,
  activeForm?: string,
  status?: "pending" | "in_progress" | "completed" | "deleted",
  addBlocks?: string[],      // 此任务阻塞的任务 ID
  addBlockedBy?: string[],   // 阻塞此任务的任务 ID
  metadata?: Record<string, unknown>
}
```

**使用时机**：
- 开始工作时标记为 in_progress
- 完成工作时标记为 completed
- 任务不再需要时标记为 deleted
- 建立任务依赖关系

**重要原则**：
- 只有完全完成时才标记为 completed
- 遇到错误、阻塞时保持 in_progress
- 完成后调用 TaskList 查找下一个任务

#### TaskList 工具

**用途**：列出所有任务

**输出**：返回所有任务的列表，包括状态、依赖关系等

#### TaskGet 工具

**用途**：获取单个任务的详细信息

**输入参数**：
```typescript
{
  taskId: string
}
```

#### UpdateUserPreference 工具

**用途**：记录用户的长期偏好到 user.md 文件

**输入参数**：
```typescript
{
  category: "role" | "preference" | "constraint",
  content: string
}
```

**使用时机**：
- 用户明确表达偏好时（"我不喜欢..."、"我希望..."）
- 用户提供角色信息时（"我是产品经理"、"我不懂代码"）
- 用户设置约束条件时（"不要用 TypeScript"、"只用简单方案"）

**不使用时机**：
- 临时的、针对当前任务的要求
- 已经记录过的偏好（避免重复）
- 对话中的随口一说

**重要原则**：
- 只记录长期、稳定的偏好，不记录流水账
- 记录前先检查 user.md 是否已有类似内容
- 工具描述要严格，避免 Agent 记录过多无用信息

### 文件存储

**存储路径**：
- `.claude/tasks.jsonl` — 任务列表（JSONL 格式，每行一个任务）
- `.claude/user.md` — 用户偏好（Markdown 格式）

**作用范围**：
- Workspace 级别（项目级别）
- 不同项目有独立的 tasks.jsonl 和 user.md
- 不是全局配置

**初始化**：
- 启动时检查文件是否存在
- 不存在则创建空文件

**格式示例**：

`tasks.jsonl`:
```jsonl
{"id":"1","subject":"实现 PostCompact Hook","status":"in_progress","description":"在压缩后注入 tasks 和 user 信息","activeForm":"实现 PostCompact Hook 中","blockedBy":[],"blocks":["2"],"metadata":{}}
{"id":"2","subject":"实现 TaskCreate 工具","status":"pending","description":"创建任务管理工具","blockedBy":["1"],"blocks":[],"metadata":{}}
{"id":"3","subject":"Phase 2: 对话功能","status":"completed","description":"实现核心对话功能","blockedBy":[],"blocks":[],"metadata":{}}
```

`user.md`:
```markdown
# 用户信息

## 角色
- 产品经理，不懂代码

## 偏好
- 用产品语言解释，不要发代码
- 用 Q&A 格式写设计文档
- 先做简单方案，不够再优化

## 约束
- 不使用复杂的架构模式
```

### 压缩后注入格式

**Tasks 注入示例**：
```
当前任务状态：

进行中：
- #1: 实现 PostCompact Hook

待处理：
- #2: 实现 TaskCreate 工具 (blocked by #1)

已完成：
- #3: Phase 2: 对话功能
```

**User Preference 注入示例**：
```
用户信息：

角色：产品经理，不懂代码

偏好：
- 用产品语言解释，不要发代码
- 用 Q&A 格式写设计文档
- 先做简单方案，不够再优化
```

---

## 参考资料

- `/Users/godcorn/cursor/Deskhand/docs/internal/context-compacting-mvp.md` — 学习笔记
- `/Users/godcorn/cursor/Deskhand/docs/internal/context-compacting-sdk-verification.md` — SDK 验证报告
- `/Users/godcorn/cursor/claude-code-source-main/src/tools/TaskCreateTool/prompt.ts` — Claude Code Task 工具设计
- Claude Agent SDK 文档 — `autoCompactWindow`, `PreCompact Hook`, `PostCompact Hook`
- HumanLayer FIC 原则 — Frequent Intentional Compaction
- Factory.ai Anchored Iterative Summarization — 结构化压缩
