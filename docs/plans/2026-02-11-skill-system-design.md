# Skill System Design — Q&A 记录

> 日期：2026-02-11
> 对应：Phase 7（技能系统）

---

## Q1: 技能选择的粒度是什么？

**结论：全局选择。**

讨论过的方案：
- A: 全局选择 — 勾选对所有会话生效
- B: 按会话选择 — 每个 session 独立技能组合
- C: 全局默认 + 会话可覆盖

选择 A，理由：
- YAGNI — 先跑通最小链路
- 目标用户是非技术人群，全局开关最直观
- 后续需要再加会话级覆盖

## Q2: 技能内容怎么注入到 agent？

**结论：拼接到用户消息前面。**

讨论过的方案：
- A: 拼接到 prompt — `skillContent + "\n\n" + userMessage`
- B: 作为 system prompt 参数注入

选择 A，理由：
- 当前 SDK 的 `query()` 只暴露 `prompt` 参数，没有 system prompt 入口
- craft-agent 也是类似做法
- 最低成本，不需要改 SDK 调用方式

## Q3: 技能的默认选中状态？

**结论：全部默认选中。**

讨论过的方案：
- A: 全部默认选中，不想用的手动关
- B: 全部默认不选，需手动勾选
- C: 根据 SKILL.md 的 enabled 字段决定

选择 A，理由：
- 目标用户是非技术人群，装了技能就应该直接能用
- 减少操作步骤

## Q4: 选择状态怎么持久化？

**结论：存到 config 文件，记录 `disabledSkillIds`。**

讨论过的方案：
- A: 存到 config 文件（复用现有 saveConfig/loadConfig）
- B: 存到 localStorage
- C: 存到 skill 目录的 meta 文件

选择 A，理由：
- 复用现有的 config 持久化机制，零额外基础设施
- 因为默认全选，只需存 `disabledSkillIds: string[]`（被关掉的）
- localStorage 清缓存就没了，不够可靠

## Q5: 技能列表什么时候刷新？

**结论：启动时加载 + 打开 SkillsPopup 时刷新。**

讨论过的方案：
- A: 仅 app 启动时加载
- B: 启动时加载 + SkillsPopup 打开时刷新
- C: 文件系统监听（fs.watch）实时检测

选择 B，理由：
- 成本很低（打开弹窗时多一次 IPC 调用）
- 体验明显好于仅启动加载（用户新装技能不用重启）
- 比 fs.watch 简单得多，YAGNI

## Q6: 技能内容注入方式需要修正吗？

**结论：是。从手动拼接改为 SDK plugin 机制。**

原实现（Q2 的结论）：
- 启动时加载所有 skill 完整内容到 renderer
- 每次发消息时，把所有启用 skill 的 content 拼到 prompt 前面
- 问题：每条消息都带全部 skill 内容，浪费 token；且不符合官方设计

官方 Claude Code Skills 的三阶段机制：
1. **发现**：启动时只加载 name + description 元数据
2. **激活**：用户请求匹配 skill 描述时，Claude 自己决定调用 Skill tool
3. **执行**：此时才加载 SKILL.md 完整内容

craft-agent 的做法：
- 把目录作为 plugin 传给 SDK：`plugins: [{ type: 'local', path: workspaceRoot }]`
- SDK 内置 Skill tool，自动处理发现→激活→执行
- craft-agent 自己不做任何 skill 内容加载/注入

修正方案：
- 在 DeskhandAgent 的 SDK options 中添加 `plugins`，传入 `~/.claude/` 和 `~/.deskhand/`
- 如果用户选了 workspace，也传入 workspace 路径
- 删除 InputToolbar 中的 prompt 拼接逻辑
- 删除 `disabledSkillIdsAtom` 和相关持久化（SDK 管理激活，不需要手动开关）
- 保留 `loadSkills()` IPC 和 `skillsAtom` 用于 UI 展示（SkillsPopup 显示可用技能列表）

理由：
- 符合官方设计，按需加载节省 token
- 复用 SDK 内置能力，不造轮子
- Skill 调用会作为 tool_start/tool_result 事件出现在消息流中

## Q7: 如何让用户知道 skill 被使用了？

**结论：在 activity tree 中展示，和其他 tool 一样。**

讨论过的方案：
- A: 在 activity tree 中展示（和 Read/Write/Bash 等工具一样）
- B: 单独的 skill 激活通知
- C: 在消息气泡中标注

选择 A，理由：
- SDK 的 Skill tool 调用会产生 `tool_start` 和 `tool_result` 事件
- 现有的 ToolActivityRow 已经支持渲染任意工具调用
- 只需添加 Skill 的图标和描述提取逻辑
- 用户体验一致：所有 agent 行为都在同一个 activity tree 中可见

实现：
- ToolActivityRow 的 ToolIcon 添加 `Skill` case（扳手图标）
- getToolDescription 添加 `Skill` case（显示 skill 名称）

## Q8: Claude Code 已有 skills 是否自动兼容？

**结论：是。零配置自动兼容，这是 SDK plugin 方案的天然副产品。**

发现：切换到 SDK plugin 机制（Q6）后，Deskhand 扫描 `~/.claude/skills/` 目录——这和 Claude Code CLI 使用的是同一个路径。

效果：
- 用户在 Claude Code 中已配置的 skills，打开 Deskhand 后直接可用
- 无需任何迁移、导入或重新配置
- SkillsPopup 中会自动列出这些 skills
- Claude 在对话中会按需激活它们（三阶段机制不变）

为什么值得记录：
- 对从 Claude Code 迁移过来的用户，体验是无缝的
- 降低了产品的上手门槛——"装了就能用"
- 这不是刻意设计的功能，而是选择正确架构（复用 SDK plugin 系统）的自然结果

## Q9: 用户如何获取和安装 skills？（讨论中）

**状态：brainstorming 进行中，尚未结论。**

### 问题背景

当前用户获取 skill 的方式：手动找到 skill → 下载/clone → 放到正确目录。对非技术用户来说门槛太高。类比：如果 Claude Code 要求用户自己去找依赖、下载、判断要不要用，体验会很差。

### 候选方案（6 个）

**1. 内置精选 Skills（开箱即用）**
- 打包精选 SKILL.md 进 app，首次启动复制到 `~/.deskhand/skills/`
- 优点：零门槛，离线可用，质量可控
- 缺点：种类有限，更新绑定发版
- 工程量：低

**2. Agent 自主获取（用户无感）** ❌ 已排除
- Agent 自动判断+下载+安装，用户不感知
- 排除理由：安全风险；skill 元数据膨胀会降低 AI 判断质量（选择困难）

**3. Agent 搜索+展示+用户确认（find-skills 模式）**
- 内置 find-skills skill，agent 搜索 skills.sh 生态，展示结果，用户确认后安装
- 参考：https://github.com/vercel-labs/skills/blob/main/skills/find-skills/
- 优点：复用现有生态，用户有选择权，agent 处理技术细节
- 缺点：依赖 skills.sh 生态质量，需处理 Electron 中的 CLI 调用
- 待讨论：搜索结果质量参差不齐时，agent 推荐质量也会受影响

**4. 应用内 Skill 商店** ❌ 已排除
- 类似 VS Code Extension Marketplace
- 排除理由：本质是软件时代应用商店思路，把"去 GitHub 找"换成"去商店找"，用户认知负担没变。不是最佳解。

**5. Skill Recommend（行为分析推荐）**
- 分析用户历史对话 → 匹配 skill 目录 → 在对话外 UI 推荐
- 优点：主动式，个性化
- 缺点：推荐不准会烦人，需要 skill 目录匹配，需要对话外 UI
- 工程量：中-高

**6. Skill Auto-Create（自动生成）**
- 检测用户反复做的事 → 自动生成 SKILL.md → 下次自动激活
- 优点：真正个性化，创造市场上不存在的 skill，最有差异化
- 缺点：生成质量不确定，需要模式检测，隐私顾虑
- 工程量：高

### 早期倾向（已修正，保留作为思路记录）

- ~~1（内置精选）作为地基，几乎确定要做~~
- ~~3（find-skills）作为桥梁，但对外部生态质量有顾虑~~
- ~~5 vs 6 需要进一步讨论——推荐别人的 skill vs 自己生成 skill~~
- ~~核心张力：**从外部获取** vs **系统自己生长**，哪个更适合非技术用户？~~

修正：之前错误地把 1（内置）归类为"服务知道 skill 的用户"。实际上内置 skills 恰恰服务不知道 skill 的用户——默认配置让 AI 遇到匹配场景自然使用，用户无需知情。

### 战略分层（关键洞察）

**深度用户（知道 skill，红海）**：
- 他们自己会获取 skills，也知道主动让 AI 去 find
- 用运营手段解决（文档、推荐优质源、社区分享），不需要产品投入

**浅层用户（不知道 skill，蓝海）**：
- 他们只会说"帮我做 XX"，不知道也不关心 skill 的存在
- 可以享受默认预设的通用 skill（哪怕自己不知情）
- 这批用户是产品要服务的核心对象

### 结论

**1（内置精选）✅ 确定做**
- 服务对象：浅层用户
- 实现：增加优质通用 skills 作为默认配置
- 用户无需知道 skill 的存在，AI 遇到匹配场景自然使用

**3（find-skills）✅ 确定做**
- 服务对象：深度用户
- 实现：将 find-skills 作为默认配置的 skill 之一
- 深度用户主动说"帮我找个做 XX 的 skill"时，agent 自动搜索+安装

**5+6（Skill Insight Agent）✅ 设计完成**

5（推荐已有 skill）和 6（自动生成 skill）合并为同一个 agent——目标相同（洞察用户行为、提升效率），只是手段不同。agent 自己判断走哪条路径。

#### 为什么合并？

最初把 5 和 6 当作两个独立功能讨论。但深入思考后发现：两者的输入相同（用户行为模式），触发条件相同（发现有价值的模式），呈现方式相同（需要告知用户）。区别只在输出——推荐现成的还是生成新的。这是同一个 agent 的两个分支，不是两个系统。

#### 通知形式：为什么是新 session 而不是 UI 组件？

讨论过的方案：
- A: 对话开场提示（嵌入聊天区顶部）
- B: 侧边栏洞察卡片（独立 UI 区域）
- C: 周期性摘要消息（特殊系统消息）
- D: 新 session + 未读提醒

选择 D，关键思考：A 和 B 都是传统 UI 做法，不够 AI Native。问题在于——如果用户看到推荐后想说"这个方向对但还需要微调"，静态卡片或提示做不到。新 session 的本质是把"推荐"变成一次对话，用户可以直接回复、讨论、修改。类似微信/Instagram 的系统消息机制，用户看到未读提醒，打开就是一个可以互动的对话。而且业务逻辑上，对于我们而言只是创建了一个新的session并且给他安排了任务，额外的开发成本小，用户体验好。

#### 触发条件：为什么是固定周期？

讨论过的方案：
- A: 固定周期（每周/每 N 次对话）+ 质量门槛
- B: 阈值触发（某行为出现 X 次以上）
- C: 用户可配置周期

选择 A，理由：B 听起来更智能，但"什么算一个模式"本身很难定义（同样指令 3 次？相似意图 5 次？），实现复杂度高。A 更简单——定期跑分析，加质量门槛：没有有价值的发现就不创建 session。用户感知上像 B（"系统有洞察时才找我"），实现上是 A。C 是优化项，不影响核心体验，后续再加。

#### 搜索精准度：宁缺毋滥

agent 搜索现成 skill 时必须高精准度匹配。反例：用户只是写了一份述职报告，就把任意"报告模板" skill 推荐过去——这种宽泛匹配无意义，反而损害信任。agent 需要真正理解用户的行为模式，而不是做关键词匹配。

#### 创建流程：为什么是"先描述再创建"？

讨论过的方案：
- A: 展示 SKILL.md 草稿，等用户确认
- B: 直接创建并激活，事后告知
- C: 用自然语言描述打算创建的 skill，用户确认后再生成

选择 C，理由：A 的问题是 SKILL.md 对非技术用户是天书。B 是先斩后奏，缺乏信任感（和之前排除"静默生效"的理由一致）。C 最自然——agent 用人话说"我打算做什么、它会怎么工作"，用户回复"好"或"好但再加个 XX"，全程不接触技术细节。

示例对话：
> agent："我注意到你每周都会整理项目进展，格式都差不多——标题、本周亮点、遇到的问题、下周计划。我可以帮你创建一个专门的技能，以后你只需要说'帮我写周报'就行。要我创建吗？"
> 用户："好，但是再加一个'需要协助的事项'"
> agent："好的，已创建。下次你说'写周报'我就会用这个模板。"

#### 存储位置：为什么是 Deskhand 专属目录？

讨论过的方案：
- A: `~/.deskhand/skills/` — Deskhand 专属
- B: `~/.claude/skills/` — 和 Claude Code 共享
- C: 让用户选

选择 A，理由：自动生成的 skill 来自用户在 Deskhand 里的行为模式，放到 `~/.claude/skills/` 会污染 Claude Code 环境——一个"写周报" skill 在 CLI 里未必有意义。方向是单向兼容的：Claude Code 的 skill → Deskhand 能用（Q8），Deskhand 生成的 skill → 不反向污染 Claude Code。

#### 完整流程

```
定期后台分析用户对话历史
  → 发现有价值的行为模式？
    → 否：不出声
    → 是：创建新 session + 未读提醒
      → agent 展示行为模式分析报告 + 建议
      → 搜索是否有匹配的现成 skill（高精准度）
        → 有：推荐 + 理由，用户确认后安装
        → 没有：用自然语言描述打算创建的 skill
      → 用户在对话中确认/修改/拒绝
      → 确认后生成 skill，存到 ~/.deskhand/skills/
```

## Q10: Claude Code /insights 命令的启发

**结论：借鉴其多阶段 pipeline 架构，并在此基础上增加"静态报告→skill 推荐"的两步流程。**

### 发现

Claude Code 内置了 `/insights` 命令，功能与我们的 Skill Insight Agent 高度相关。通过探查其实现，梳理出完整流程：

1. 读取 `~/.claude/` 下的所有历史会话数据
2. 对每个 session 提取元数据（工具调用次数、token 用量、语言分布、git 操作、响应时间等）——纯本地计算
3. 用 Claude 模型对每个 session 做 facet extraction——让模型判断用户目标、满意度、摩擦点、session 类型等，输出结构化 JSON
4. 汇总所有 session 的统计数据
5. 把汇总数据分发给多个并行的 prompt（project_areas、interaction_style、what_works、friction_analysis、suggestions、on_the_horizon、fun_ending 等维度），每个维度用一个独立的 Claude API 调用生成分析
6. 最后跑一个 at_a_glance 汇总 prompt，把前面所有维度的结果综合成简短摘要
7. 所有结果拼装成 HTML 报告，写到 `~/.claude/usage-data/report.html`

本质上是一个多阶段 AI pipeline：本地统计 → 逐 session AI 提取（带缓存）→ 汇总 → 多维度并行分析 → 最终摘要。

### 我们可以借鉴什么？

**facet 提取 + 缓存机制**：先对每个 session 做结构化提取，缓存结果，再做跨 session 的模式分析。比直接把所有对话丢给 AI 分析高效得多。

**多维度并行分析**：不同分析维度用独立的 prompt 并行跑，最后汇总。这个架构可以直接复用。

### 我们比它更进一步的地方

| 维度 | Claude Code /insights | Deskhand Skill Insight Agent |
|------|----------------------|------------------------------|
| 触发方式 | 手动（用户输入 /insights） | 定期自动触发 |
| 输出形式 | 静态 HTML 报告 | 可交互的 session 对话 |
| 后续动作 | 建议用户自己改 CLAUDE.md | 直接帮用户创建/安装 skill |
| 目标用户 | 技术用户（需理解 CLAUDE.md） | 非技术用户（自然语言对话） |

### 关键补充：静态报告作为前置步骤

讨论后决定：Skill Insight Agent 的 session 应该先输出一份工作分析报告，再进行 skill 推荐/创建。

理由：
- 报告是"诊断"，skill 推荐是"处方"——先让用户看到"我了解你的工作模式"，建立信任和上下文
- 用户看到分析后可能自己就有想法："对，这个事情我确实经常做，能不能帮我优化？"
- 报告本身就有价值，即使用户不需要新 skill

### 更新后的完整流程

```
定期后台分析用户对话历史
  → 阶段 1：facet 提取（逐 session，带缓存）
  → 阶段 2：跨 session 模式分析（多维度并行）
  → 发现有价值的行为模式？
    → 否：不出声
    → 是：创建新 session + 未读提醒
      → 先展示工作分析报告（你最近在做什么、怎么做的、哪里有摩擦）
      → 基于分析，提出 skill 建议：
        → 搜索匹配的现成 skill（高精准度）→ 推荐
        → 没有匹配的 → 用自然语言描述打算创建的 skill
      → 用户在对话中确认/修改/拒绝
      → 确认后生成 skill，存到 ~/.deskhand/skills/
```

---

## ~~最小链路实现（v1 - 已废弃）~~

> 以下为 Q2 时的设计，已被 Q6 修正。保留作为决策记录。

**端到端流程：**

```
磁盘 skills/ → main process loadSkills() → IPC → renderer skillsAtom
→ SkillsPopup 展示/勾选 → disabledSkillIds 持久化
→ 用户发消息时拼接选中 skill content → agent.chat(enrichedPrompt)
```

**实现步骤（vertical slice）：**

1. **IPC 通道** — 在 preload/main 添加 `skills:load` channel，main 调用已有的 `loadSkills()`
2. **Atoms** — 添加 `skillsAtom` 和 `disabledSkillIdsAtom`，后者从 config 初始化
3. **App 初始化** — 启动时通过 IPC 加载技能，写入 skillsAtom
4. **SkillsPopup 接真实数据** — 替换 mock，从 atom 读取，支持勾选切换
5. **InputToolbar badge** — 显示已启用技能数量（总数 - disabled 数）
6. **Prompt 注入** — 发消息时，把选中技能的 content 拼接到 prompt 前面
7. **持久化** — disabledSkillIds 变化时通过 saveConfig 写入磁盘
