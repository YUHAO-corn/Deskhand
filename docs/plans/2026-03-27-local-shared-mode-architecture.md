# Local Mode / Shared Mode 双轨架构方案

_日期：2026-03-27_

---

## 1. 结论先行

Shared Employee 不应该作为现有本地聊天的一次“增强开关”塞进去。

更合理的做法是把 Deskhand 明确分成两种模式：

- `Local Mode`
- `Shared Mode`

两者：

- UI 可切换
- session 不共用
- `sdkSessionId` 不共用
- 存储不共用
- `cwd` 语义不共用

但底层仍复用同一套核心能力：

- `DeskhandAgent`
- Claude Agent SDK
- tool hooks
- artifact / event stream

这相当于在一个产品里承载两种 interaction model，而不是让一个 session 同时兼容两套语义。

---

## 2. 为什么必须分轨

### 2.1 Local 和 Shared 的本质约束不同

#### Local Mode

用户心智是：

- 我在自己的电脑上
- 我选一个工作目录
- 我让 agent 在这个目录里帮我做事

它的核心约束是：

- 单人
- session 绑定 `cwd`
- 权限主体就是当前本机用户

#### Shared Mode

用户心智是：

- 多个人围着一个 agent 协作
- agent 需要知道谁在说话
- 不是每个人都能指挥它

它的核心约束是：

- 多 participant
- conversation 绑定 policy + workspace
- `cwd` 只是执行上下文，不再是产品主心智

这两者不是一个 session 加几个字段就能兼容的差异。

### 2.2 如果不分轨，会出现什么问题

1. 本地体验变差
   - 用户原本只想在本地目录里干活
   - 却要承受 participant / policy / channel 的复杂度

2. `cwd` 语义混乱
   - Local 里 `cwd` 是核心入口
   - Shared 里 `cwd` 只是 runtime 配置

3. session 模型会失控
   - 到处出现 `if local / if shared`
   - Sidebar、message、storage、permissions 全部变脆

4. 用户搞不清 agent 现在代表谁
   - 是“我的本地助理”
   - 还是“群里的共享员工”

---

## 3. 模式定义

### 3.1 Local Mode

定义：

- 一人一 agent 的本地工作模式

目标场景：

- 打开某个项目目录
- 让 agent 读写本地文件
- 做文档、代码、调研、整理等单人任务

核心特征：

- `LocalSession`
- 强绑定 `workingDirectory`
- 默认沿用当前侧边栏和输入区模型
- 权限由当前本地用户审批

### 3.2 Shared Mode

定义：

- 多人围绕一个 agent 协作的共享模式

目标场景：

- 群聊里共同驱动一个 agent
- 不同角色拥有不同控制权
- agent 维护共享记忆和工作规则

核心特征：

- `SharedConversation`
- 绑定 `workspace + policy + participants`
- `cwd` 可选，不是首要概念
- 权限由 conversation policy 决定

---

## 4. 顶层对象模型

建议不要继续用一个统一的 `Session` 撑所有模式。

### 4.1 LocalSession

- `id`
- `mode: local`
- `createdAt`
- `lastMessageAt`
- `sdkSessionId`
- `workingDirectory`
- `permissionMode`
- `model`
- `preview`
- `artifacts`

### 4.2 SharedConversation

- `id`
- `mode: shared`
- `createdAt`
- `lastMessageAt`
- `sdkSessionId`
- `workspaceId`
- `channelBindings`
- `defaultExecutionCwd`
- `ownerParticipantId`
- `status`
- `preview`

### 4.3 为什么不建议继续统一成一个大 Session

因为两边真正共享的字段很少，硬统一的结果通常是：

- 类型越来越多 optional 字段
- UI 和存储都要到处判断
- 以后新增第三种 mode 更难

更稳妥的是：

- UI 层统一叫“会话”
- 领域层拆成不同实体

---

## 5. `cwd` 和 workspace 的关系

这是这次讨论里最关键的点。

### 5.1 Local Mode 的 `cwd`

在 Local Mode 里：

- `cwd` 是主入口
- 用户通过 WorkspacePopup 选目录
- Claude SDK session 与这个目录强绑定

所以：

- 换目录 = 新建 LocalSession
- 不能在一个 LocalSession 中途切换目录

这与当前设计保持一致。

### 5.2 Shared Mode 的 workspace

在 Shared Mode 里：

- 首要概念不是 `cwd`
- 而是共享 workspace

建议目录：

```text
~/.deskhand/workspaces/{workspaceId}/
  AGENTS.md
  MEMORY.md
  POLICY.md
  PARTICIPANTS.json
  CHANNELS.json
```

这里的 workspace 用来表达：

- 这个共享员工是谁
- 这个共享员工怎么工作
- 它记住了什么
- 谁能指挥它

### 5.3 Shared Mode 的 `cwd`

Shared Mode 仍然可以有执行目录，但它应该是次级配置：

- `defaultExecutionCwd`
- 或一组允许的 execution roots

用途是：

- 当共享员工需要真正操作文件或项目时，知道去哪儿执行

但它不应该变成主入口，也不应该出现在用户最先理解的产品心智里。

### 5.4 关键原则

不能把：

- **共享 workspace**

和

- **Claude SDK 执行 cwd**

混为一谈。

前者是协作状态，后者是执行环境。

---

## 6. UI 方案

### 6.1 入口方案

推荐两层入口之一：

#### 方案 A：顶部模式切换

- `Local`
- `Shared`

优点：

- 当前模式非常明确
- 两种工作流天然隔离

#### 方案 B：新建时选模式

- `New Local Chat`
- `New Shared Agent`

优点：

- 对现有 UI 改动更小

我的建议是：

- 第一阶段先做 **新建时选模式**
- 等 Shared Mode 成熟，再考虑做顶部常驻切换

### 6.2 Sidebar

Sidebar 不建议一锅炖。

更好的方式：

- `Local` 列表
- `Shared` 列表

可以是：

1. 顶部 tab
2. section 分组

如果想最小改动，我更建议：

- 先做 section 分组
- 现有 sidebar 组件继续复用渲染骨架

### 6.3 ChatArea

`ChatArea` 组件可以继续复用，但 header 和输入提示要变：

#### Local

- 显示当前目录
- 显示本地权限模式

#### Shared

- 显示 workspace 名称
- 显示 channel / participant / policy 摘要

### 6.4 InputToolbar

现有 `InputToolbar` 里的“工作目录 badge”只适合 Local。

Shared 下应该换成：

- workspace badge
- participant status
- channel status

所以建议不要继续让一个 toolbar 组件只靠 `if` 撑住全部 UI，最好拆为：

- `LocalInputToolbar`
- `SharedInputToolbar`

它们底层可以复用发送逻辑。

---

## 7. 存储方案

### 7.1 Local 存储保持原状

继续使用：

```text
~/.deskhand/sessions/{sessionId}/session.jsonl
```

### 7.2 Shared 单独存储

建议新增：

```text
~/.deskhand/shared/
  conversations/{conversationId}/
    conversation.json
    messages.jsonl
    runtime.json
  workspaces/{workspaceId}/
    AGENTS.md
    MEMORY.md
    POLICY.md
    PARTICIPANTS.json
    CHANNELS.json
```

这样 Local 和 Shared 的生命周期完全隔离。

---

## 8. 运行时复用关系

### 8.1 可以复用的部分

- `DeskhandAgent`
- `sdkSessionId` 捕获与 resume 机制
- `PreToolUse` hook
- tool event stream
- artifact 抽取逻辑

### 8.2 应该拆开的部分

- session/conversation storage
- sidebar item metadata
- message envelope
- toolbar / header UI
- permission routing
- workspace injection logic

### 8.3 一个好用的边界

建议新增一层 adapter：

- `LocalAgentRuntime`
- `SharedAgentRuntime`

二者都调用 `DeskhandAgent.chat()`，但负责各自：

- 输入上下文构造
- 状态持久化
- 事件解释
- 审批路由

这比把所有逻辑都塞回 `DeskhandAgent` 本体干净得多。

---

## 9. 用户路径

### 9.1 Local 用户路径

```text
打开 Deskhand
  -> New Local Chat
  -> 选择目录
  -> 开始对话
  -> agent 在该 cwd 下工作
```

### 9.2 Shared 用户路径

```text
打开 Deskhand
  -> New Shared Agent
  -> 创建 workspace
  -> 配置成员与权限
  -> 绑定一个渠道或本地模拟 shared room
  -> 开始多人协作
```

### 9.3 从本地进入共享

注意，不应是“把当前 LocalSession 升级成 SharedConversation”。

正确动作应该是：

- 基于当前上下文“创建一个新的 Shared Agent”
- 可选择复制一部分背景信息
- 但新对象是全新的 SharedConversation

也就是：

- 可以迁移上下文
- 不能复用 session 身份

---

## 10. 对现有代码的影响

### 10.1 第一阶段不必大拆

可以先在现有结构上增加 mode 层：

- session 列表 metadata 增加 `mode`
- sidebar 先按 `mode` 分组
- 新建入口先让用户选择 `Local / Shared`

但 Shared 的实际底层存储和 runtime 应从一开始就单独建。

### 10.2 绝对不要做的事情

1. 不要让 `workingDirectoryAtom` 成为 Shared 的核心状态
2. 不要让同一个 `session.jsonl` 同时存 Local 和 Shared 消息
3. 不要让同一个 `activeSessionId` 同时代表 LocalSession 和 SharedConversation 而没有 mode 区分
4. 不要把 participant/policy/channel 字段硬塞进 Local-only 的 UI 流程

---

## 11. Vertical Slice 路线

这里不按“先把完整架构做完”推进，而按“先证明最危险假设”推进。

原则：

- 每个 slice 都必须可单独验收
- 每个 slice 都必须尽量少改 Local Mode
- 每个 slice 都必须有明确的失败信号

### Slice 0: Local 不退化

目标：

- 在引入 mode 概念后，确保现有 Local 完全不退化

只做：

- 顶层引入 `mode`
- 新建入口支持 `New Local Chat`
- Local session 生命周期保持原样

不做：

- Shared runtime
- participant
- policy
- channel

验收：

- 本地 chat 继续能选目录、发消息、续接会话
- 现有 sidebar / input / artifacts 不回归

失败信号：

- 仅仅引入 mode 就让 Local 代码到处出现复杂分支
- Local 的 `workingDirectory` 体验被打断

结论：

- 如果 Slice 0 都做不稳，说明 mode 抽象位置不对，先停，不要继续 Shared

### Slice 1: Shared Shell in Electron

目标：

- 不接真实群聊，先在 Deskhand 内部证明 Shared 是一种独立模式

只做：

- `New Shared Agent`
- SharedConversation 独立存储
- Shared workspace 目录
- Shared header / toolbar 的最小壳
- conversation 绑定自己的 `sdkSessionId`

输入方式：

- 仍然从本地客户端输入
- 但 UI 和存储走 Shared 路径

不做：

- 多 participant
- 审批路由
- 飞书接入

验收：

- Local 和 Shared 可以并存
- 两边 session 不串
- Shared 不依赖 Local `workingDirectoryAtom`

失败信号：

- Shared 必须复用大量 Local-only atom 才能跑
- Shared UI 只能通过给现有 Local 组件打很多补丁实现

结论：

- 如果这一步都不能自然落地，说明 Shared 不该是一个 mode，而可能只是某种外挂工作流

### Slice 2: Fake Multi-Participant

目标：

- 在不接真实渠道的前提下，证明 participant / policy 值得做

只做：

- SharedConversation 支持多个 participant
- 在 Electron 内部做“切换 sender”模拟
- 增加两档权限：
  - `discussion-only`
  - `can-command`

运行方式：

- 用户在 Shared UI 中选择“以 Alice / Bob 身份发言”
- runtime 根据 participant capability 改写 prompt framing

不做：

- 外部 webhook
- 真正的审批卡片
- agent-to-agent

验收：

- 同一 SharedConversation 中，不同 sender 会得到不同 agent 行为
- `discussion-only` 发言不会直接驱动执行
- `can-command` 发言可以驱动执行

失败信号：

- 模型对权限 framing 完全不稳定
- 用户几乎感知不到“只能讨论”和“可以指挥”的区别

结论：

- 如果 Slice 2 不成立，Shared 的核心差异化就站不住，不要急着接飞书

### Slice 3: Approval Route

目标：

- 证明 Shared 模式下的危险操作审批链路是可用的

只做：

- conversation 级 approver 配置
- `PreToolUse` hook 走 Shared policy
- 在 Electron 内先做最小审批 UI

不做：

- 复杂角色管理
- 外部消息卡片审批

验收：

- Shared agent 触发危险操作时，不再默认找“当前本机唯一用户”
- approver 明确、链路可闭环

失败信号：

- 审批路径明显拖慢到无法使用
- 使用者无法理解“谁在替共享员工点确认”

结论：

- 如果审批链路不可用，Shared 只能做“只读协作助理”，不能做真正的共享员工

### Slice 4: First Real Channel

目标：

- 只接一个真实渠道，验证外部协作价值

推荐：

- 飞书群

只做：

- webhook 入站
- send message 出站
- 群与 SharedConversation 绑定
- sender mapping

不做：

- 多渠道抽象完备化
- discovery 协议
- 并发 runtime

验收：

- 群里多人能围绕同一个 Shared agent 协作
- 共享上下文比单人本地 chat 明显更有价值

失败信号：

- 外部群聊噪声远大于收益
- 用户不愿意为一个共享 agent 维护角色和规则

结论：

- 如果真实渠道里没有出现明显价值，Shared 应停留在实验功能，不要升主航道

---

## 12. Kill Criteria

为了避免“开发半天最后全盘皆输”，建议提前接受这几个止损条件。

### Kill 1

如果 Shared Mode 需要持续侵入现有 Local 的核心 atoms、sidebar、toolbar、session 存储，说明分轨不彻底，先停下来重画边界。

### Kill 2

如果在 Fake Multi-Participant 阶段，模型无法稳定区分“讨论”和“指挥”，说明权限价值无法被可靠表达，不要急着做渠道接入。

### Kill 3

如果 Shared 的审批链路显著比 Local 更慢，且用户无法理解 approver 语义，说明“共享员工”只适合作为轻协作对话，不适合作为真正执行代理。

### Kill 4

如果飞书真实场景里，大部分消息都是噪声，agent 大量被无关群聊污染，说明产品需要转向“thread-bound agent”而不是“group-bound agent”。

---

## 13. 推荐实施顺序

1. Slice 0：先保证 Local 不退化
2. Slice 1：做 Shared 的独立壳，不接渠道
3. Slice 2：做假多人和权限验证
4. Slice 3：补审批链路
5. Slice 4：最后接第一个真实渠道

顺序不能反。先接渠道再补 mode 边界，代价会高很多。

---

## 14. 最终判断

把 Shared Employee 做成一个**独立模式**，明显优于直接改造现有本地聊天。

这是因为它解决了两个最危险的问题：

1. 不破坏 Local Mode 现有 `cwd` 心智
2. 不让 Shared Mode 的 participant / policy 复杂度污染本地体验

简化后的产品定义可以写成一句话：

> Deskhand 不再只有一种 chat，而是至少有两种工作模式：本地个人代理，与共享协作代理。

这条边界一旦立住，后面无论是架构实现还是产品表达，都会顺很多。
