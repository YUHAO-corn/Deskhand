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

### 当前倾向

- 1（内置精选）作为地基，几乎确定要做
- 3（find-skills）作为桥梁，但对外部生态质量有顾虑
- 5 vs 6 需要进一步讨论——推荐别人的 skill vs 自己生成 skill
- 核心张力：**从外部获取** vs **系统自己生长**，哪个更适合非技术用户？

### 待澄清问题

- 3 的外部生态质量问题是否可接受？
- 5 和 6 的优先级？
- 是否存在混合方案？
- 非技术用户对"skill"这个概念的认知程度？

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
