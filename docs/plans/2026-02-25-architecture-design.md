# Phase 0 & 1 架构决策 Q&A

> 📅 2026-02-25 回顾记录
> Phase 0-1 在 2026-01~02 期间完成，有 SPEC 文档但漏写了决策 Q&A，现补充回顾决策经历。
> 对应 SPEC：`docs/SPEC.md` §1-5

---

## Q1: 产品最基础的模块有哪些？先搭什么？

**结论：** 最基础的模块分为三层：

**框架层（Phase 0）：**
- Electron 桌面容器
- React 渲染层

**UI 骨架层（Phase 0.5）：**
- 三栏布局：SessionSidebar（左）+ ChatArea（中）+ ArtifactPanel（右）
- InputToolbar（底部输入区）
- SettingsPage（设置页）

**基础设施层（Phase 1）：**
- 类型系统（packages/core）
- 状态管理（Jotai atoms）
- IPC 通信桥（main ↔ renderer）

**搭建顺序：** 框架层 → UI 骨架层（用 mock 数据跑起来）→ 基础设施层 → 然后才进入功能开发（Phase 2 对话功能）。

**理由：** 先让界面能看到、能点，再往里填真实逻辑。这样每一步都有可验收的产出，而不是写了一堆看不见的基础代码。

---

## Q2: 技术架构怎么定？怎么确保它是跑得通的？

**结论：** 找一个已经跑通的同类项目，参考它的技术架构，业务逻辑完全自己实现。

**背景：** 如果凭空搭一套架构，万一跑不通，推倒重来的成本太高。所以策略是：先找已经验证过的架构参考。在对比了多个同类开源项目（包括 open-cowork 等）之后，最终选择了 craft-agent 的架构。

**为什么这套架构是 work 的：**
- Electron + React + Jotai + Tailwind 是成熟的桌面应用技术栈，社区生态完善
- Monorepo 结构（apps/electron + packages/core + packages/shared）把 UI、类型、业务逻辑清晰分层
- Claude Agent SDK 作为 Agent 层，直接获得工具调用、权限管理、流式响应等能力
- IPC 三进程模型（main/preload/renderer）是 Electron 的安全最佳实践
- 事件驱动的数据流（AgentEvent → Atoms → UI）天然适配流式场景
- 作为 vibe coder，这套技术栈是 AI 最熟悉的——Electron + React + TypeScript 的训练数据最多，AI 写这些代码的犯错率最低。相比之下 Tauri + Rust 这样的组合，AI 出错概率明显更高，调试成本也更大

**怎么用的：** 技术架构照着来，业务逻辑从零写。遇到具体问题时去翻 craft-agent 的实现看它怎么解决的，但不 fork、不照搬代码。

---

## Q3: 桌面客户端框架怎么选？

**结论：** Electron。

**讨论过的方案：**
- **A. Electron** — Chromium + Node.js，VSCode/Slack/Discord 都在用，生态最成熟
- **B. Tauri** — 系统 WebView + Rust，包体小性能好，但生态年轻
- **C. Flutter Desktop** — 跨平台 UI 框架，但不是 Web 技术栈

**选择 A，理由：**
- 参考项目 craft-agent 用的就是 Electron，架构已验证可行
- Claude Agent SDK 是 Node.js 生态的，Electron 的 main 进程天然是 Node.js，集成零摩擦
- Tauri 的 Rust 后端和 Node.js SDK 之间需要额外的桥接层，增加复杂度
- AI 对 Electron + React 的熟悉度远高于 Tauri + Rust，vibe coding 的犯错率更低

---

## Q4: 整体 UI 布局怎么设计？

**结论：** 三栏布局 — 左侧会话列表（SessionSidebar）+ 中间对话区（ChatArea）+ 右侧成果面板（ArtifactPanel），底部输入栏（InputToolbar）。

**讨论过的方案：**
- **A. 三栏（会话列表 + 对话 + 成果面板）** — 在 AI 对话基础上增加成果展示区
- **B. 两栏（会话列表 + 对话）** — 标准 AI 聊天布局，ChatGPT/Claude 都是这样
- **C. 单栏对话** — 最简洁，移动端常见
- **D. 任务看板 + 对话** — 像 Linear/Notion，以任务为中心

**选择 A，决策过程：**

**从用户习惯出发：** 左侧会话列表 + 中间对话区，这是用户已经习惯的 AI 对话布局（ChatGPT、Claude、豆包都是这样）。没有理由在这里创新，用户打开就知道怎么用。

**从产品差异出发：** 但只有两栏是不够的。桌面 agent 和普通 AI 聊天有一个本质区别——它的操作 scope 非常大，可能跨不同文件、不同目录去操作。如果没有成果面板：

- 用户说「帮我整理下载文件夹」，AI 做完了说「已整理好」，但用户得自己打开 Finder 去找到那个文件夹，一个个点开看效果
- 用户说「帮我生成一个网页」，AI 生成了 HTML 文件，但用户得自己找到文件、用浏览器打开才能看到渲染后的效果
- 用户说「帮我做一张数据图表」，AI 输出了一段代码，用户看到的是代码而不是图表

这些体验都很差。所以需要一个成果面板，让 AI 操作的结果直接在产品内展示——文件改了什么、生成了什么、渲染后长什么样，用户不需要离开 Deskhand 就能看到。

**对比竞品：** ChatGPT 和 Claude 的 Artifact 是在对话区内嵌展示，但它们不操作本地文件，所以够用。Deskhand 操作的是用户电脑上的真实文件，涉及的文件数量和类型远多于聊天场景，需要一个独立的面板来承载。

**排除 D（任务看板）：** 用户和 AI 的交互本质是对话——「帮我做这个」「好的，做完了」「这里改一下」。这是对话节奏，不是拖拽卡片的节奏。看板适合项目管理，不适合「我说你做」的助理模式。

---

## Q5: Agent 层怎么实现？用什么方案？

**结论：** 使用 Claude Agent SDK。

**讨论过的方案：**
- **A. Claude Agent SDK** — Anthropic 官方 Agent 框架
- **B. 直接调 Anthropic API** — 自己实现 Agent 循环
- **C. LangChain / CrewAI 等通用框架** — 支持多模型的 Agent 框架
- **D. 自研 Agent 框架** — 完全自己造

**选择 A，理由：**

**从产品核心能力看：** Deskhand 的核心是「AI 操作你的电脑」，这意味着 Agent 层需要：文件读写、命令执行、权限确认、流式响应、子任务分发、错误恢复。Claude Agent SDK 把这些全部内置了——Read、Write、Edit、Bash 等工具开箱即用，权限拦截机制现成，子任务（Task）支持复杂多步操作。

**从事件流架构看：** SDK 的 AgentEvent 机制天然适配流式 UI。Agent 执行过程中会发出 text_delta、tool_start、tool_result、permission_request 等事件，UI 只需要监听这些事件就能实时展示「AI 正在做什么」。这正好解决了产品愿景里提到的痛点——普通人需要看到过程，不是只看到结果。

**从开发效率看：** SDK 封装了大量底层细节（token 管理、重试逻辑、上下文压缩等），让产品层可以专注在体验差异化上，而不是重复造轮子。

**关于方案 B（直接调 Anthropic API）：** 看起来更「轻量」，实际上工作量巨大。直接调 API 意味着你需要自己实现整个 Agent 循环：发送消息 → 模型返回 tool_use → 执行工具 → 把结果发回去 → 模型继续 → 循环直到完成。这个循环本身不难，但围绕它的工程量很大：
- 权限拦截：在工具执行前拦截、展示给用户、等待确认、处理拒绝后的回退
- 流式处理：SSE 事件解析、部分 JSON 拼接、中途取消
- 上下文管理：token 计数、对话过长时的截断或摘要策略
- 错误恢复：API 限流重试、工具执行失败后的优雅降级
- 子任务编排：复杂任务拆分成多个子 Agent 并行执行

这些 SDK 都已经处理好了。自己实现不是不行，但相当于在做产品之前先做一个 SDK，优先级不对。

**关于方案 C（LangChain / CrewAI）：** 这类框架的核心价值是「模型无关」——同一套代码可以切换 OpenAI、Claude、Gemini。但这恰恰不是 Deskhand 需要的。具体问题：
- 抽象层过多：LangChain 的 Chain → Agent → Tool → Memory 层层封装，调试时很难定位问题出在哪一层，对 vibe coder 来说调试成本很高
- 工具定义不对齐：这些框架有自己的工具定义格式，和 Claude 原生的 tool_use 协议之间需要转换，转换过程中容易丢失信息
- 更新频繁且不稳定：LangChain 的 API 变动非常快，经常出现 breaking changes，维护成本高
- 性能开销：多层抽象带来额外的延迟，在流式场景下尤其明显

简单说：这些框架解决的是「多模型切换」的问题，但 Deskhand 不需要多模型——深度绑定 Claude 的 Agent 能力，把体验做到极致，比什么模型都能用但什么都不精更有价值。而且Claude agent sdk也支持配置第三方模型，所以切换模型的能力底层支持的。

**关于 vendor lock-in：** 用 Claude Agent SDK 意味着绑定 Anthropic 生态。但 Deskhand 本身就是基于 Claude 的能力来做差异化的，这个绑定是主动选择而非被动接受。

---

## Q6: 代码仓库怎么组织？

**结论：** Monorepo，三个包：
- `apps/electron/` — Electron 应用（main/preload/renderer）
- `packages/core/` — 核心类型定义
- `packages/shared/` — 共享业务逻辑（agent、sessions、skills）

**讨论过的方案：**
- **A. 单包结构** — 所有代码放在一个 `src/` 下，简单直接
- **B. Monorepo 三包** — apps/electron + packages/core + packages/shared
- **C. 多仓库** — UI、Agent 逻辑、类型定义各一个仓库

**选择 B，决策过程：**

**从 vibe coding 的实际体验看：** 一开始也想过全部放一个 `src/` 下面，简单。但实际用 AI 写代码的时候发现一个问题——如果所有代码都在一起，AI 经常搞混边界。你让它改 agent 逻辑，它可能顺手改了 UI 组件；你让它改 UI，它可能引入了 Node.js 的模块，renderer 进程直接崩了。

分成三个包之后，AI 的「活动范围」变清晰了：
- 你说「改 agent 调用逻辑」，它知道去 `packages/shared/src/agent/`
- 你说「改聊天界面」，它知道去 `apps/electron/src/renderer/`
- 你说「加一个新类型」，它知道去 `packages/core/src/types/`

相当于给 AI 画了格子，每个格子里的代码职责单一，AI 犯错的概率就低了。出 bug 的时候排查范围也小——UI 渲染出问题肯定在 renderer 里，agent 调用出问题肯定在 shared 里，不用在一大坨代码里翻。

**从 Electron 的特殊性看：** Electron 有 main 进程（Node.js）和 renderer 进程（浏览器），运行环境不同但需要共享类型定义（IPC 消息类型、Session 类型等）。如果都放一个包里，renderer 代码不小心 import 了 Node.js 模块，TypeScript 不会报错但运行时会崩。`packages/core` 独立出来放纯类型定义，两个进程都能安全引用。

**从复用性看：** `packages/shared` 里的 agent 调用逻辑、会话存储逻辑不依赖 Electron API，是纯业务逻辑。分出来之后如果未来要做 Web 版或 CLI 版，这些逻辑可以直接复用。近期的好处是：改 UI 不影响 agent 逻辑，改 agent 逻辑不影响 UI，互不干扰。

**排除 C（多仓库）：** 项目还小，多仓库的协调成本（版本同步、联调）远大于收益。

---

## Q7: 会话数据怎么存？

**结论：** JSONL 文件（每个会话一个 `.jsonl` 文件）。

**讨论过的方案：**
- **A. JSONL 文件** — 每条消息一行 JSON，追加写入
- **B. SQLite** — 嵌入式数据库，结构化查询
- **C. 内存 + JSON 文件** — 运行时在内存，退出时整体写入 JSON

**选择 A，理由：**
- 追加写入天然适配流式场景——AI 每产生一条消息就 append 一行，不需要读取整个文件再写回
- 调试友好，直接用文本编辑器就能看会话内容，出了 bug 可以手动检查数据
- 对 vibe coder 来说，文件读写比 SQL 操作更直觉，AI 写文件操作代码的出错率也更低
- craft-agent 也用的 JSONL，验证过在桌面场景下性能足够
- SQLite 的优势是复杂查询，但会话数据的查询需求很简单（按 session 读取、按时间排序），不需要 SQL 的能力

---

## Q8: 产品的领域模型怎么设计？哪些概念要有，哪些不要？

**结论：** 只保留 5 个核心概念：Session、Message、Skill、Source、Artifact。

**设计过程：**

先看用户的使用场景：用户打开 Deskhand，开始一段对话（Session），在对话里发消息（Message），AI 用某种技能（Skill）去完成任务，可能连接外部数据（Source），最终产出成果（Artifact）。

这 5 个概念覆盖了完整的使用链路，每一个都对应用户能感知到的东西。

**明确不要的概念：**

对比了同类产品后，有几个常见概念被刻意去掉了：

- **工作区（Workspace）** — 很多开发者工具支持多工作区切换（不同项目不同目录）。但普通人不会这样想——他们就是打开一个应用开始用，不会先想「我现在要进入哪个工作区」。一个应用就是一个工作区。
- **标签（Labels）** — 给会话打标签分类，看起来有用但普通人不会主动去做。按时间排序的会话列表就够了，需要找的时候搜索比打标签更自然。
- **任务状态（Status）** — Todo/In Progress/Done 是项目管理的概念。Deskhand 的用户不是在管理项目，是在让助理帮忙做事。「帮我整理照片」不需要一个状态流转，做完了就是做完了。
- **权限配置（Permissions Config）** — 开发者工具会让用户配置「哪些操作自动允许、哪些需要确认」。但普通人不理解 bash 命令和文件写入的区别，分开配置只会让他们困惑。统一用确认模式就好——所有操作都让用户看一眼再执行。

**减法的原则：** 如果一个概念需要用户理解技术背景才能使用，不要。如果一个概念是给「管理者」设计的而不是给「使用者」设计的，不要。宁可少几个功能，也不要让用户在打开产品的第一秒就感到困惑。
