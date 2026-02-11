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

---

## 最小链路实现

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
