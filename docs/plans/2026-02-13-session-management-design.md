# Session 管理设计 — Q&A 记录

> 日期：2026-02-13
> 对应：Phase 3（会话管理）
> SPEC：SPEC_SessionSidebar.md

---

## 现状分析

基础设施已 80% 就绪，但没有接通：

**已完成**：
- 存储层（JSONL 读写）— `packages/shared/src/sessions/storage.ts`
- IPC 通道（list/get/create/delete）— `apps/electron/src/main/ipc.ts`
- Preload bridge — `apps/electron/src/preload/index.ts`
- Atoms 定义 — `apps/electron/src/renderer/atoms/sessions.ts`
- Agent 事件处理 — `useAgentEvents` hook
- 消息展示 + 发送 — ChatArea + InputToolbar

**断开的地方**：
- App 启动时不加载已有 sessions（每次创建临时内存 session）
- 消息只存在 atoms 里，从不写入磁盘
- SessionSidebar 读的 atoms 永远是空的
- 没有新建/删除/重命名会话的 UI

本质：管道都铺好了，阀门没打开。

---

## Q1: 首次启动时怎么处理？

**结论：加载已有 sessions，没有的话自动创建一个。**

讨论过的方案：
- A: 启动时自动创建一个空 session（用户打开就能直接聊）
- B: 启动时不创建，显示空状态，用户点「New Chat」才创建
- C: 启动时加载已有 sessions，如果没有才自动创建一个

选择 C，理由：
- 首次用户不需要额外操作就能开始聊
- 回访用户能看到历史会话
- 兼顾两种场景

## Q2: 消息持久化的时机？

**结论：每条消息到达时立即写入，后期可优化为队列+防抖。**

讨论过的方案：
- A: 每条消息到达时立即写入（用户消息发送时 + 每个 agent 事件到达时）
- B: Agent 完成一轮回复后批量写入（等 `complete` 事件再一次性写）
- C: 像 craft-agent 那样用队列 + 防抖（事件到达时入队，合并频繁写入）

选择 A，理由：
- 最简单，JSONL 的 append-only 特性天然适合逐条追加
- App 崩溃也不会丢消息
- A 到 C 的升级路径自然——只需在写入调用外包一层队列+防抖，接口不变

## Q3: 会话切换时的消息加载策略？

**结论：懒加载。启动时只加载元数据，切换到某个 session 时才加载消息。**

讨论过的方案：
- A: 启动时全部加载（所有 session 的消息都读进内存）
- B: 懒加载（启动时只加载元数据，切换时才加载消息）

选择 B，理由：
- 和 craft-agent 一致
- Session 多了以后 A 会很慢
- 元数据（名称、时间、预览）足够渲染 sidebar

## Q4: 新建会话的持久化时机？

**结论：先创建内存态，用户发第一条消息时才持久化到磁盘。**

讨论过的方案：
- A: 点击按钮 → 立即创建 session 并写入磁盘 → 切换过去
- B: 点击按钮 → 先创建内存中的空 session → 用户发第一条消息时才持久化

选择 B，理由：
- 避免产生一堆空 session 文件（用户可能误点或创建了但没用）
- craft-agent 也是类似模式

## Q5: 会话的自动命名？

**结论：先用首条消息截断作为 preview，AI 命名后面再加。**

讨论过的方案：
- A: 用第一条用户消息的前 N 个字作为 preview（简单截断，不调 AI）
- B: Agent 第一轮回复完成后，用 AI 生成简短标题
- C: 先用 A 作为临时名称，后续再加 B 作为优化

选择 C，理由：
- A 零成本立即可用
- B 需要额外 API 调用和 prompt 设计，可以后面再加
- Sidebar 显示「帮我做个网页...」这种截断预览就够用

## Q6: 会话删除/重命名的交互方式？

**结论：Hover 时显示 `···` 按钮，点击弹出操作菜单。**

讨论过的方案：
- A: Hover 时显示删除按钮
- B: 右键菜单（Rename / Delete）
- C: Hover 显示 `···` 按钮，点击弹出菜单

选择 C，理由：
- `···` 按钮是最常见的模式，hover 时出现不占空间
- 菜单可扩展，后续有新操作直接往里加
- 和 craft-agent 的交互一致

第一版菜单项：
- Rename — 点击后 inline 编辑名称
- Archive — 设置 `hidden: true`，从列表消失
- Delete — 弹确认框，确认后删除

## Q7: 日期分组显示？

**结论：不做日期分组，按时间倒序平铺。**

SPEC 要求按日期分组（Today / Yesterday / Dec 19），但讨论后决定不做：
- 简单按 `lastMessageAt` 倒序排列，最近聊的在最上面
- 和 ChatGPT 一样的模式，用户最熟悉
- 减少实现复杂度

## Q8: 会话搜索？

**结论：第一版不做，后面再加。**

讨论过的方案：
- A: 第一版就做（输入框过滤）
- B: 先不做，后面再加

选择 B，理由：
- 会话少的时候搜索没什么用
- 先把核心链路跑通

## Q9: 未读标记？

**结论：蓝色圆点，点击进入后自动消除。**

讨论过的方案：
- A: 简单的蓝色圆点，点击进入后自动消除
- B: 数字 badge（显示未读消息数）
- C: 先不做

选择 A，理由：
- 蓝色圆点最简洁，够用
- 数字 badge 对非技术用户来说信息过载
- 实现很轻（`hasUnread: boolean`）
- 直接满足 Skill 系统 Slice C 的需求

## Q10: 是否需要分类机制？

**结论：不需要。第一版只做 Rename / Delete / Archive。**

讨论过的方案：
- 目录分类
- 人工 label 分类
- 收藏/Pin

全部不做，理由：
- 目标用户是非技术人群，分类本身就是认知负担
- ChatGPT 也没有分类，按时间排就够用
- SPEC 里也已经把 Labels、Flag、动态标签标记为 [-] 不实现
- Archive（`hidden` 字段）是唯一保留的"分类"——二元的（可见/隐藏），帮助保持列表干净
- 分类机制等用户量上来后根据反馈再考虑

---

## 设计总结

### Session 生命周期

```
App 启动
  → listSessions() 加载元数据
  → 有 sessions → 选中最近的
  → 没有 sessions → 创建内存态空 session

用户点 New Chat
  → 创建内存态 session（生成 ID，加入 atoms）
  → 设为 active

用户发第一条消息
  → createSession() 持久化到磁盘
  → appendMessage() 写入用户消息

Agent 事件到达
  → 更新 atoms（实时 UI）
  → appendMessage() 写入磁盘
  → 更新 sessionMetaMap（lastMessageAt, preview）

用户切换会话
  → 更新 activeSessionIdAtom
  → 检查 loadedSessionsAtom
  → 未加载 → getSession() 加载消息
  → 已加载 → 使用缓存
```

### SessionItem 显示

```
┌─────────────────────────────────────┐
│ ● Session Name                 2m   │
│                                ···  │  ← hover 时显示
└─────────────────────────────────────┘

● = 未读蓝色圆点 或 处理中 spinner
名称 = name > preview > "New Chat"
时间 = 相对时间（2m / 1h / 3d）
```

### `···` 菜单

```
┌──────────────┐
│ ✏️ Rename     │
│ 📦 Archive    │
│ 🗑 Delete     │  ← 红色，带确认框
└──────────────┘
```

### 不做的事（YAGNI）

- 日期分组
- 会话搜索
- AI 自动命名
- 分类/标签/收藏
- 虚拟滚动
- 多窗口

---

## 实现 Vertical Slices

### Slice 1：Session 持久化链路（地基）

- 做什么：
  - App 启动 → `listSessions()` 加载元数据 → 写入 atoms → sidebar 显示真实数据
  - 当前的临时 session 改为：没有已有 session 时自动创建一个
  - 用户发消息 → `createSession()` + `appendMessage()` 写入磁盘
  - Agent 事件到达 → `appendMessage()` 写入磁盘 + 更新 metadata
- 端到端验证：发消息 → 关闭 app → 重新打开 → sidebar 显示会话 → 点进去消息还在
- 依赖：无
- 复杂度：高（核心链路，涉及多层改动）

### Slice 2：新建会话 + 切换

- 做什么：
  - TitleBar 的 New Chat 按钮 → 创建内存态空 session → 切换过去
  - 点击 sidebar 项 → 切换 active session → 懒加载消息
  - SessionItem 显示名称（preview 截断）+ 相对时间
- 端到端验证：创建多个会话 → 来回切换 → 各自消息独立 → 最近的在最上面
- 依赖：Slice 1
- 复杂度：中

### Slice 3：会话操作菜单

- 做什么：
  - Hover 时显示 `···` 按钮
  - 点击弹出菜单：Rename / Archive / Delete
  - Rename → inline 编辑名称
  - Archive → 设置 `hidden: true`，从列表消失
  - Delete → 确认框 → 删除文件 + 从 atoms 移除
- 端到端验证：三个操作各自正常工作
- 依赖：Slice 2
- 复杂度：中

### Slice 4：未读标记（= Skill 系统 Slice C）

- 做什么：
  - `hasUnread: boolean` 持久化到 session metadata
  - SessionItem 显示蓝色圆点
  - 点击进入后自动消除（`updateSessionMeta({ hasUnread: false })`）
  - 提供 `sessions:update-meta` IPC 供后台创建 session 时使用
- 端到端验证：手动创建一个 `hasUnread: true` 的 session → 蓝色圆点出现 → 点击后消失
- 依赖：Slice 1
- 复杂度：低

### 依赖关系

```
Slice 1（持久化链路）──→ Slice 2（新建+切换）──→ Slice 3（操作菜单）
         │
         └──→ Slice 4（未读标记 = Skill Slice C）
```

Slice 1 是地基，完成后 Slice 2/4 可以并行。Slice 3 依赖 Slice 2（需要多个会话才能测试操作）。
