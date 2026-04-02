# Deskhand Shared Mode — Vertical Slice 实现路径

_日期：2026-03-29_

---

## 前提假设

以下事项已在设计文档中确定，本文档不再讨论：

- Local Mode 和 Shared Mode 是独立两条轨，不共用 `session.jsonl`
- `cwd` 属于 Local Mode 的核心心智，Shared Mode 的主入口是 `workspace + conversation`
- `DeskhandAgent` 可继续复用，只在输入格式和审批路由上扩展
- Shared 先串行，不先并发
- 第一阶段在 Electron 内验证，最后才接飞书

---

## Slice 总览

| # | 名称 | 核心验证 | 风险 |
|---|------|----------|------|
| 0 | Local 不退化 | mode 概念引入不破坏现有 Local 体验 | 高（切错点会污染全链路） |
| 1 | Shared Shell | Shared 在 Electron 内独立跑通 | 高（依赖判断是否做对了） |
| 2 | Fake Multi-Participant | 权限 framing 能区分讨论/指挥 | 高（模型能力风险） |
| 3 | Approval Route | 危险操作能路由给 approver | 中 |
| 4 | First Real Channel | 飞书接入验证真实协作价值 | 中 |

---

## Slice 0：Local 不退化

### 目标

在 `mode` 概念引入后，验证现有 Local 体验完全不受影响。

### 实现路径

#### 步骤 0.1：引入 `mode` 类型，Session metadata 增加 `mode` 字段

**涉及文件**：
- `packages/core/src/types/index.ts` — 新增 `mode: 'local' | 'shared'` 字段
- `packages/shared/src/sessions/storage.ts` — 确认现有 `session.jsonl` 存储路径不变

**做法**：
- `SessionMeta` 和 `Session` 类型中增加 `mode: 'local'`，默认值 `'local'`
- 不改变任何现有存储路径和文件格式
- 这个改动对外无感知

**验收**：TypeScript 编译通过，现有的 `listSessions()` / `getSession()` 返回的 session `mode` 字段为 `'local'`

#### 步骤 0.2：新建入口支持 `New Local Chat`（如果尚未拆分）

**涉及文件**：
- `apps/electron/src/renderer/components/sidebar/` — sidebar 新建按钮
- `apps/electron/src/renderer/atoms/sessions.ts` — `activeSessionIdAtom`

**做法**：
- 新建按钮保持现有行为（选目录 → 创建 session）
- 新创建的 session metadata 带 `mode: 'local'`
- Sidebar 不做任何 mode 区分，只做列表展示

**验收**：打开 Deskhand → New Local Chat → 选目录 → 发送消息，流程与之前完全一致

#### 步骤 0.3：Sidebar 不做 mode 分组，只验证列表正常

**涉及文件**：
- `apps/electron/src/renderer/components/sidebar/SessionSidebar.tsx`

**做法**：
- 读取 session 列表（已含 `mode` 字段），全部渲染为现有列表项样式
- 不加 tab、不加分 section，零 UI 变化

**验收**：Sidebar 显示正常，hover 操作（重命名/归档/删除）可用

### 失败信号

- 引入 `mode` 后，Local session 列表变慢或数据丢失
- 选目录后 session 创建路径出现新分支
- TypeScript 出现大量 `mode` 相关的 `if/switch` 分支且无法简单处理

### 依赖

无。

---

## Slice 1：Shared Shell in Electron

### 目标

在 Electron 内把 Shared Mode 当作独立模式立起来：独立的存储路径、独立的 UI header、独立 conversation 对象，**不接飞书、不接多 participant、不接审批路由**。

### 实现路径

#### 步骤 1.1：定义 SharedConversation 类型和独立存储

**涉及文件**：
- `packages/core/src/types/index.ts` — 新增 `SharedConversation`、`Participant`、`ParticipantCapability` 类型
- `packages/shared/src/sessions/conversation-storage.ts` — 新建，参照现有 `storage.ts` 结构

**SharedConversation 最小字段**：
```typescript
interface SharedConversation {
  id: string
  mode: 'shared'
  createdAt: string
  lastMessageAt: string
  sdkSessionId: string
  workspaceId: string
  ownerParticipantId: string
  status: 'active' | 'paused' | 'archived'
  preview: string
  // 不带 workingDirectory（cwd 属于执行上下文，不是主入口）
}
```

**Participant 最小字段**：
```typescript
interface Participant {
  id: string
  displayName: string
  kind: 'human'
  capabilities: ParticipantCapability[]
}

type ParticipantCapability = 'message' | 'command' | 'approve'
```

**存储路径**：
```
~/.deskhand/shared/conversations/{conversationId}/
├── conversation.json    # SharedConversation 元数据
├── messages.jsonl       # 消息（每行 JSON，含 senderId）
└── runtime.json         # 当前运行状态（idle / running / queued）

~/.deskhand/shared/workspaces/{workspaceId}/
├── AGENTS.md
├── MEMORY.md
├── POLICY.md
├── PARTICIPANTS.json
```

**验收**：创建 SharedConversation 后，对应目录和文件在磁盘上正确生成

#### 步骤 1.2：Sidebar 支持显示 Shared Conversation 列表

**涉及文件**：
- `apps/electron/src/renderer/atoms/sessions.ts` — 新增 `sharedConversationsAtom`（独立于 `sessionMetaMapAtom`）
- `apps/electron/src/renderer/components/sidebar/SessionSidebar.tsx`

**做法**：
- 新建 `conversation-storage.ts` 提供 `listConversations()` / `getConversation()` / `createConversation()`
- Sidebar 底部或新建 section 显示 Shared Conversation 列表（最小实现：一个 flat list）
- 新建按钮支持 `New Shared Agent`：弹出 workspace 名称输入框（只输入 name，不配置 participants/policy）→ 创建 workspace → 创建 conversation

**验收**：Sidebar 能看到 Local sessions 和 Shared conversations 两个列表；点击 Shared conversation 进入对应 ChatArea

#### 步骤 1.3：Shared ChatArea header 和 toolbar（最小壳）

**涉及文件**：
- `apps/electron/src/renderer/components/chat/ChatArea.tsx`
- `apps/electron/src/renderer/components/input/InputToolbar.tsx` — 新建 `SharedInputToolbar.tsx`

**做法**：
- 在 `ChatArea` 读取当前 conversation 的 `mode`；若 `mode === 'shared'`，渲染 Shared header
- Shared header 显示：workspace 名称、conversation status badge
- `SharedInputToolbar`：不显示 "working directory badge"，显示 "workspace badge"
- 发送逻辑仍走 `chat:start` IPC，但 `prompt` 构造走新的 `buildSharedPrompt()` 函数（见步骤 1.4）

**验收**：进入 Shared conversation 后，header/toolbar 与 Local Mode 明显不同，且不显示任何 `workingDirectory` 信息

#### 步骤 1.4：`ConversationRuntime` 和 `buildSharedPrompt()`

**涉及文件**：
- `packages/shared/src/shared/conversation-runtime.ts` — 新建
- `packages/shared/src/shared/prompt-builder.ts` — 新建

**ConversationRuntime 职责**（最小版）：
```typescript
class ConversationRuntime {
  private agent: DeskhandAgent
  private conversation: SharedConversation

  async enqueue(message: {
    senderId: string
    text: string
    intentType: 'command' | 'chat'
  }): Promise<void>

  private async processQueue(): Promise<void>
  private buildPrompt(input: MessageInput): string
}
```

**buildSharedPrompt() 最小格式**（暂不做 policy 判断，所有消息默认当 command）：
```
[Conversation]
workspace: {workspaceName}
conversation: {conversationId}

[Participants]
- {ownerName} (owner, can_command=true)

[New message]
from: {ownerName}
type: command
text: {userMessage}
```

**IPC 层扩展**：
- `apps/electron/src/main/ipc.ts` — 在 `chat:start` handler 里判断 session mode
- 若 `mode === 'local'`：走现有 `DeskhandAgent.chat()` 路径
- 若 `mode === 'shared'`：走新的 `ConversationRuntime.enqueue()` 路径

**验收**：
1. 在 Shared conversation 里发一条消息，agent 正常回复
2. 回复写入 `~/.deskhand/shared/conversations/{id}/messages.jsonl`
3. Local session 和 Shared conversation 的 `sdkSessionId` 完全隔离

#### 步骤 1.5：Message 扩展字段写入

**涉及文件**：
- `packages/shared/src/sessions/conversation-storage.ts` — append message 函数

**messages.jsonl 每行格式**：
```json
{
  "role": "user",
  "senderId": "participant_xxx",
  "senderDisplayName": "Alice",
  "content": "帮我整理一下文档",
  "intentType": "command",
  "timestamp": "2026-03-29T10:00:00Z"
}
```

**验收**：Shared conversation 里每次对话的 messages.jsonl 都正确写入，且包含 senderId 字段

### 失败信号

- Shared conversation 必须引用 `workingDirectoryAtom` 才能运行
- Sidebar 里 Shared conversation 列表的实现需要修改现有 Local session 的渲染路径
- `DeskhandAgent` 的调用无法区分 Local 和 Shared 上下文

### 依赖

Slice 0 完成。

---

## Slice 2：Fake Multi-Participant

### 目标

在 Electron 内模拟多个 sender，验证 `discussion-only` 和 `can-command` 两种权限在 agent 行为上形成差异。**不接飞书，不做审批**。

### 实现路径

#### 步骤 2.1：Participant 模型完整化 + UI 切换 sender

**涉及文件**：
- `packages/core/src/types/index.ts` — `Participant` 新增 `capabilities: ParticipantCapability[]`
- `packages/shared/src/shared/workspace-storage.ts` — 新建，读写 `PARTICIPANTS.json`
- `apps/electron/src/renderer/components/input/SharedInputToolbar.tsx` — 新增 sender 切换下拉框

**做法**：
- Workspace 的 `PARTICIPANTS.json` 预置两个 participant：
  - Alice（`capabilities: ['message', 'command', 'approve']`）
  - Bob（`capabilities: ['message']`）
- `SharedInputToolbar` 显示当前 sender 名字（默认 Alice）
- 点击切换 sender（Alice / Bob），切换后 toolbar 显示对应名字 badge
- 发送时，把当前 sender 和其 capabilities 传入 `ConversationRuntime.enqueue()`

**验收**：切换 sender 后，消息的 `senderId` 和 capabilities 正确进入 runtime

#### 步骤 2.2：Policy Engine 最简版（两档 intent 判断）

**涉及文件**：
- `packages/shared/src/shared/policy-engine.ts` — 新建

**PolicyEngine 职责**：
```typescript
class PolicyEngine {
  constructor(private workspace: Workspace) {}

  classifyMessage(
    senderId: string,
    text: string
  ): { intentType: 'command' | 'chat'; reason: string } {
    const participant = this.workspace.getParticipant(senderId)
    if (!participant) return { intentType: 'chat', reason: 'unknown_sender' }
    if (participant.capabilities.includes('command')) {
      return { intentType: 'command', reason: 'has_command_capability' }
    }
    return { intentType: 'chat', reason: 'discussion_only' }
  }
}
```

#### 步骤 2.3：`buildSharedPrompt()` 按 intentType 生成不同 framing

**涉及文件**：
- `packages/shared/src/shared/prompt-builder.ts` — 扩展 `buildSharedPrompt()`

**Alice（command）发消息**：
```
[New message]
from: Alice (owner, can_command=true)
type: command
text: 帮我把这个项目重构一下

[Instruction]
This sender has command authority. Execute the requested task.
```

**Bob（discussion-only）发消息**：
```
[New message]
from: Bob (collaborator, can_command=false)
type: discussion
text: 我觉得这个模块的设计有点问题

[Instruction]
This sender can talk to you, but cannot direct you to take actions.
Respond conversationally. Do not execute tasks solely based on this message.
```

#### 步骤 2.4：ConversationRuntime 接入 PolicyEngine

**涉及文件**：
- `packages/shared/src/shared/conversation-runtime.ts`

**改动**：
- `enqueue()` 方法先调用 `policyEngine.classifyMessage()` 判定 intentType
- 根据 intentType 调用 `buildSharedPrompt()` 生成不同 prompt
- `intentType === 'chat'` 时：agent 只做对话回应，不产生工具调用

**验收**：
1. Alice 发 "帮我把 README 改成 Markdown 格式" → agent 执行 Edit/Write 工具
2. Bob 发同样内容 → agent 只做文字建议，不主动执行工具
3. 从 messages.jsonl 能看到两条消息的 `intentType` 字段不同

### 失败信号

- 同一段文字，Alice 和 Bob 发给 agent 后，agent 行为无明显差异
- Bob 的消息仍然触发了工具调用（说明 framing 没有生效）
- 仅仅切换 sender 就需要修改大量现有 atom（说明 UI 耦合太紧）

### 依赖

Slice 1 完成。

---

## Slice 3：Approval Route

### 目标

Shared Mode 下触发危险操作时，审批链路不再默认找"当前桌面唯一用户"，而是路由给 conversation policy 指定的 approver。

### 实现路径

#### 步骤 3.1：Policy Engine 支持 approver 查询

**涉及文件**：
- `packages/shared/src/shared/policy-engine.ts`

**扩展**：
```typescript
class PolicyEngine {
  // 查询某个危险操作是否需要审批
  requiresApproval(toolName: string, conversation: SharedConversation): boolean {
    // 最小实现：Read/Glob/Grep 自动通过，其余需审批
    return !['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'].includes(toolName)
  }

  // 返回需要审批的 participant IDs
  getApprovers(conversation: SharedConversation): string[] {
    // 最小实现：找所有 capabilities 包含 'approve' 的 participant
    return conversation.participants.filter(p => p.capabilities.includes('approve')).map(p => p.id)
  }
}
```

#### 步骤 3.2：DeskhandAgent PreToolUse hook 支持自定义 approver

**涉及文件**：
- `packages/shared/src/agent/deskhand-agent.ts` — `PreToolUse` hook
- `apps/electron/src/main/ipc.ts` — approval IPC handler

**最小实现**：
- `DeskhandAgent.chat()` 增加可选参数 `approverIds: string[]`
- `PreToolUse` hook 拦截危险工具时，不再发往 renderer 的 `permissionRequestAtom`
- 改为发往一个 `sharedApprovalQueue`（内存队列），并通过 IPC `chat:shared-approval-request` 通知 renderer
- IPC handler 根据 `approverIds` 决定通知哪些 participant（暂时先简单做：Alice 是 ownerapprover，发给 renderer 用 Alice 身份审批）

**验收**：在 Shared conversation 中触发 Bash/Write/Edit 工具，不再弹出 Local Mode 的权限弹窗，而是弹出 Shared Mode 专用审批提示（显示 workspace 名称 + 操作描述）

#### 步骤 3.3：Shared 审批 UI

**涉及文件**：
- `apps/electron/src/renderer/components/chat/PermissionRequest.tsx` — 扩展，识别 `mode: 'shared'`
- `apps/electron/src/renderer/components/shared/SharedApprovalCard.tsx` — 新建

**SharedApprovalCard 最小内容**：
- 显示当前 workspace 名称
- 显示操作者（sender）和操作描述
- Approve / Deny 按钮
- Deny 后消息不进入 agent 对话流

**验收**：
1. Alice 在 Shared conversation 发指令触发危险操作 → 弹出 SharedApprovalCard → Approve → 工具执行 → agent 继续回复
2. 点击 Deny → 工具不执行，agent 回复"操作被拒绝"
3. 此时 Local conversation 的权限弹窗逻辑完全不受影响

### 失败信号

- Shared 危险操作仍然弹出 Local Mode 的权限弹窗（说明 hook 没有区分 mode）
- 审批结果无法路由回正确的 conversation
- 审批超时（或者审批人不在场）时 conversation runtime 卡死

### 依赖

Slice 2 完成。

---

## Slice 4：First Real Channel（飞书）

### 目标

把飞书群作为第一个真实渠道接入，验证"多人围绕同一个 Shared agent 协作"的产品价值。

### 实现路径

#### 步骤 4.1：独立 channel service 进程（不是塞进 Electron）

**涉及文件**：
- `packages/channels/` — 新建 package

**目录结构**：
```
packages/channels/src/
├── adapters/
│   └── feishu/
│       ├── bot-server.ts      # 飞书 bot webhook server
│       ├── incoming-handler.ts # 处理飞书消息入站
│       └── outbound.ts        # agent 回复回飞书
├── conversation-runtime.ts    # 复用 shared conversation-runtime
└── index.ts
```

**最小 webhook server**：
- 用 `fastify` 或 `express` 起一个 HTTP server
- 监听 `/webhook/feishu` 端点
- 验签通过后解析消息体，映射 sender → participantId

#### 步骤 4.2：入站消息映射

**涉及文件**：
- `packages/channels/src/adapters/feishu/incoming-handler.ts`

**映射规则**（最小实现）：
```
飞书 open_id → PARTICIPANTS.json 中 externalUserId 匹配的 participant
未知用户 → 丢弃（workspace 不对新用户开放）
```

**消息入站后**：
1. 解析 sender（飞书 open_id → internal participantId）
2. 调用 `ConversationRuntime.enqueue()`
3. runtime 排队串行处理
4. 回复写入 messages.jsonl

#### 步骤 4.3：出站消息

**涉及文件**：
- `packages/channels/src/adapters/feishu/outbound.ts`

**做法**：
- agent 回复生成后，通过飞书 bot `send_message` API 回群
- 回复消息包含：`conversationId`、`agent 角色`、`消息内容`
- 不做 rich text 复杂渲染，先发纯文本

**验收**：
1. 飞书群里 @机器人 发消息，bot 能正确回复
2. 多人在群里发消息，按到达顺序串行处理
3. 切换 sender 后，agent 行为与 Slice 2 一致（Alice 能指挥，Bob 只能讨论）

### 失败信号

- 群里大量消息是无关噪声，agent 被频繁无效唤醒
- 用户不愿意为共享 agent 维护 PARTICIPANTS 列表
- 回复延迟超过 30s，且用户无法理解"agent 正在排队"

### 依赖

Slice 3 完成。

---

## 关键文件变更总览

| Slice | 文件 | 操作 |
|-------|------|------|
| 0 | `packages/core/src/types/index.ts` | 修改：Session 增加 `mode` 字段 |
| 1 | `packages/core/src/types/index.ts` | 新增：SharedConversation、Participant 类型 |
| 1 | `packages/shared/src/sessions/conversation-storage.ts` | 新建 |
| 1 | `packages/shared/src/sessions/workspace-storage.ts` | 新建 |
| 1 | `packages/shared/src/shared/conversation-runtime.ts` | 新建 |
| 1 | `packages/shared/src/shared/prompt-builder.ts` | 新建 |
| 1 | `apps/electron/src/main/ipc.ts` | 修改：chat:start 按 mode 分流 |
| 1 | `apps/electron/src/renderer/atoms/sessions.ts` | 修改：增加 sharedConversationsAtom |
| 1 | `apps/electron/src/renderer/components/sidebar/SessionSidebar.tsx` | 修改：显示两个列表 |
| 1 | `apps/electron/src/renderer/components/input/SharedInputToolbar.tsx` | 新建 |
| 2 | `packages/shared/src/shared/policy-engine.ts` | 新建 |
| 2 | `apps/electron/src/renderer/components/input/SharedInputToolbar.tsx` | 修改：sender 切换下拉框 |
| 3 | `packages/shared/src/agent/deskhand-agent.ts` | 修改：PreToolUse hook 支持 approver 参数 |
| 3 | `apps/electron/src/renderer/components/shared/SharedApprovalCard.tsx` | 新建 |
| 4 | `packages/channels/` | 新建整个 package |
| 4 | `packages/shared/src/shared/conversation-runtime.ts` | 修改：支持 channel service 远程调用 |

---

## Kill Criteria（快速止损）

| # | 条件 | 处理 |
|---|------|------|
| Kill 1 | Slice 0 中仅仅引入 `mode` 就导致 Local 代码大量分支 | 停，重画 mode 抽象边界 |
| Kill 2 | Slice 2 中模型无法稳定区分讨论/指挥 | 停，Shared 核心差异化不成立 |
| Kill 3 | Slice 3 中审批链路超过 30s 且用户无法理解 approver 语义 | 停，Shared 只能降级为只读助理 |
| Kill 4 | Slice 4 真实群里噪声远大于收益 | 停，重新评估"thread-bound vs group-bound" |

---

## 顺序原则

**永远不要在审批链路和渠道接入不 work 的情况下，去做 UI 打磨。**

每一 slice 完成后，**先跑回归**（打开现有 Local session，确认所有功能正常），再做下一个 slice。
