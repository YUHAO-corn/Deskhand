# Playground 探索模式设计 — Q&A 记录

> 日期：2026-02-19
> 前置依赖：Phase 5（Artifact Panel）
> 参考：[Claude 官方 Playground 插件](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/playground)

---

## Q1: 要解决什么问题？

**结论：用户常有"说不清但看到就知道"的模糊需求，纯文本对话无法高效解决。**

关键线索：
- 用户心中有一种想要的配色/布局/风格，但自己都说不出来具体是哪一种
- 如果给几个示例对比，用户一眼就能找到最接近心中印象的那个
- 这类需求在纯文本对话里需要反复来回描述，效率很低
- Playground 提供了一种"通过视觉对比和微调找到答案"的交互模式

## Q2: 方案是什么？

**结论：直接复用 Claude 官方 Playground 插件，适配 Deskhand 的 Artifact Panel。**

讨论过的方案：
- A: 从零设计一套探索式交互系统
- B: 复用官方插件，微调适配
- C: 只做配色探索这一个场景

选择 B，理由：
- 官方插件已有 6 个成熟模板，覆盖设计、数据、概念图、文档审阅、代码审查、架构可视化
- 模板规范详细（布局、控件、状态管理、prompt 输出），生成质量稳定
- Deskhand 已有 Skills 系统，插件结构可直接纳入
- 改动量极小，只需调整输出目标和触发方式

## Q3: 怎么触发？

**结论：Agent 建议 + 用户确认，不自动弹出。**

讨论过的方案：
- A: Agent 自动判断并弹出 playground（体验流畅，但实现复杂，可能打扰用户）
- B: 用户主动触发（可控，但用户需要知道有这个功能）
- C: Agent 建议，用户确认后再弹出

选择 C，理由：
- 不会突然冒出来吓人，也不需要用户自己想到"我应该用探索模式"
- Agent 的判断依据来自官方 SKILL.md："when the input space is large, visual, or structural and hard to express as plain text"
- 建议话术示例："这个需求比较适合用可视化方式探索，要不要试试？"

## Q4: Playground 在哪里展示？

**结论：Artifact Panel，复用 HTML iframe 渲染能力。**

讨论过的方案：
- A: Artifact Panel 的 iframe（不离开 Deskhand，复用已有基础设施）
- B: 独立 Electron 窗口（空间大，但多窗口管理复杂）
- C: 对话流内嵌 iframe（最紧凑，但交互空间受限）

选择 A，理由：
- Artifact Panel 设计文档已确定：HTML 通过 `sandbox="allow-scripts"` + srcdoc 注入渲染
- Agent 生成 playground HTML → Write 事件被捕获 → 自动出现在 Artifact Panel
- 零额外 UI 开发，完全复用 Phase 5 的基础设施

## Q5: 用户选好后，结果怎么回到对话？

**结论：复制 Prompt，粘贴回聊天框。不做自动回流。**

讨论过的方案：
- A: 全自动回流 — 点确认后 postMessage 直接发送到对话（最流畅，但用户失去审阅机会）
- B: 自动填入输入框 — postMessage 填入聊天输入框，用户可改再发（需要新通信管道）
- C: 复制 Prompt — playground 底部生成自然语言 prompt，用户复制粘贴

选择 C，理由：
- 官方插件已内置 prompt 输出 + 复制按钮，零额外开发
- 复制粘贴是所有人都会的操作，不构成体验瓶颈
- 用户能看到、能改、能决定发不发
- 真正有价值的部分是 playground 本身（视觉探索），不是结果怎么传回去
- 如果后续用户反馈说复制粘贴太麻烦，再升级到 postMessage 方案也不迟

## Q6: 具体要改什么？

**结论：只改 SKILL.md 两处，模板文件不动。**

改动 1 — 输出目标：
- 原版第 4 步："Open in browser. After writing the HTML file, run `open <filename>.html`"
- 改为："写入文件。Artifact Panel 会自动捕获 Write 事件并渲染 playground"

改动 2 — 触发逻辑：
- 原版 "When to use"："When the user asks for an interactive playground"
- 追加："当 Agent 识别到用户需求涉及视觉、结构或多选项对比，且难以用纯文本表达时，主动建议用户使用 playground 探索"

不改的部分：
- 6 个模板文件（design-playground、data-explorer、concept-map、document-critique、diff-review、code-map）— 它们只是教 Agent 怎么写 HTML 的规范，与展示位置无关
- 核心要求（单 HTML 文件、实时预览、prompt 输出、复制按钮、预设方案、暗色主题）— 全部适用
- 状态管理模式（单一 state 对象 + updateAll）— 全部适用

## Q7: 依赖关系？

**结论：依赖 Phase 5 Artifact Panel 完成，但 Skill 本身可以提前准备。**

- Phase 5 提供 HTML iframe 渲染能力 → playground 才能在 Deskhand 内展示
- 在 Phase 5 完成前，playground skill 仍可以 fallback 到 `open` 命令在浏览器中打开
- Skills 系统（Phase 7）已完成，skill 文件可以随时放入 `~/.deskhand/skills/`
