# Phase 2 对话功能 - 进度追踪

---
  Phase 2 架构全景

  数据流总览

  ┌─────────────────────────── RENDERER 进程 ───────────────────────────┐
  │                                                                      │
  │  InputToolbar                                                        │
  │      │ [发送]                                                        │
  │      ▼                                                               │
  │  sessionMessagesFamily ◄─── append user message                      │
  │      │                                                               │
  │      │ window.electronAPI.chat(sessionId, message)                   │
  │      ▼                                                               │
  ├──────────────────────────────────────────────────────────────────────┤
  │                         IPC (preload)                                │
  ├──────────────────────────────────────────────────────────────────────┤
                                 │
  ┌─────────────────────────── MAIN 进程 ────────────────────────────────┐
  │                              ▼                                       │
  │  ipc.ts: AGENT_CHAT handler                                          │
  │      │                                                               │
  │      ▼                                                               │
  │  DeskhandAgent.chat(message, { onEvent })                            │
  │      │                                                               │
  │      │ 调用 Claude Agent SDK                                          │
  │      │                                                               │
  │      ▼ AgentEvent 流                                                  │
  │  onEvent(event) → event.sender.send('agent:event', sessionId, event) │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘
                                 │
                      IPC (agent:event)
                                 │
  ┌─────────────────────────── RENDERER 进程 ───────────────────────────┐
  │                              ▼                                       │
  │  useAgentEvents hook                                                 │
  │      │ window.electronAPI.onAgentEvent(callback)                     │
  │      │                                                               │
  │      │ 按事件类型处理：                                                │
  │      │ ├─ text_delta → 追加 AI 消息内容                               │
  │      │ ├─ text_complete → 标记消息完成                                │
  │      │ ├─ tool_start → 创建 tool 消息                                 │
  │      │ ├─ tool_result → 更新 tool 结果                                │
  │      │ ├─ permission_request → 显示权限弹窗                           │
  │      │ └─ complete → 更新统计，持久化                                  │
  │      ▼                                                               │
  │  sessionMessagesFamily(sessionId) 更新                               │
  │      │                                                               │
  │      ▼                                                               │
  │  ChatArea                                                            │
  │      │ useAtom(sessionMessagesFamily(sessionId))                     │
  │      │                                                               │
  │      │ groupMessagesByTurn(messages) → Turn[]                        │
  │      ▼                                                               │
  │  ┌─ UserTurn ────────────────────────────────────────────┐          │
  │  │  <UserMessageBubble message={turn.message} />         │          │
  │  └───────────────────────────────────────────────────────┘          │
  │  ┌─ AssistantTurn ───────────────────────────────────────┐          │
  │  │  <TurnCard turn={turn}>                               │          │
  │  │    ├─ <ThinkingIndicator /> (V3)                      │          │
  │  │    ├─ <ToolActivityRow /> × N (V2)                    │          │
  │  │    └─ <ResponseCard content={turn.response} />        │          │
  │  └───────────────────────────────────────────────────────┘          │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘

  各层实现状态
  ┌───────┬──────────────────────────────────┬────────────────────────┬───────────┐
  │  层   │               文件               │          状态          │  V1 需要  │
  ├───────┼──────────────────────────────────┼────────────────────────┼───────────┤
  │ IPC   │ preload/index.ts                 │ ✅ 完成                │ -         │
  ├───────┼──────────────────────────────────┼────────────────────────┼───────────┤
  │ IPC   │ main/ipc.ts                      │ ✅ 框架完成            │ -         │
  ├───────┼──────────────────────────────────┼────────────────────────┼───────────┤
  │ Agent │ shared/agent/deskhand-agent.ts   │ ⚠️ 框架存在，逻辑 TODO │ 🔧 需实现 │
  ├───────┼──────────────────────────────────┼────────────────────────┼───────────┤
  │ Hook  │ renderer/hooks/useAgentEvents.ts │ ⚠️ 框架存在，逻辑 TODO │ 🔧 需实现 │
  ├───────┼──────────────────────────────────┼────────────────────────┼───────────┤
  │ Atoms │ renderer/atoms/sessions.ts       │ ✅ 结构完成            │ -         │
  ├───────┼──────────────────────────────────┼────────────────────────┼───────────┤
  │ UI    │ ChatArea.tsx                     │ ⚠️ 外壳存在，渲染 TODO │ 🔧 需实现 │
  ├───────┼──────────────────────────────────┼────────────────────────┼───────────┤
  │ UI    │ InputToolbar.tsx                 │ ⚠️ UI 完成，发送 TODO  │ 🔧 需实现 │
  ├───────┼──────────────────────────────────┼────────────────────────┼───────────┤
  │ UI    │ TurnCard.tsx                     │ ❌ 不存在              │ 🆕 需新建 │
  ├───────┼──────────────────────────────────┼────────────────────────┼───────────┤
  │ UI    │ UserMessageBubble.tsx            │ ❌ 不存在              │ 🆕 需新建 │
  ├───────┼──────────────────────────────────┼────────────────────────┼───────────┤
  │ UI    │ ResponseCard.tsx                 │ ❌ 不存在              │ 🆕 需新建 │
  ├───────┼──────────────────────────────────┼────────────────────────┼───────────┤
  │ UI    │ ToolActivityRow.tsx              │ ❌ 不存在              │ V2        │
  ├───────┼──────────────────────────────────┼────────────────────────┼───────────┤
  │ UI    │ ThinkingIndicator.tsx            │ ❌ 不存在              │ V3        │
  └───────┴──────────────────────────────────┴────────────────────────┴───────────┘
  V1-V3 实现清单

  V1: 基础对话流
  [主进程]
  1. DeskhandAgent.chat() - 实际调用 Claude API，发出事件流

  [渲染进程 - 事件]
  2. useAgentEvents - 处理 text_delta/text_complete/complete 事件

  [渲染进程 - UI]
  3. InputToolbar - handleSend() 发送消息
  4. ChatArea - 读取 messages，调用 groupMessagesByTurn，渲染 Turn
  5. UserMessageBubble - 用户消息气泡
  6. TurnCard - AI 回复卡片（简化版，只显示 response）
  7. ResponseCard - 响应文本渲染（简单 markdown）

  V2: 工具显示
  [渲染进程 - 事件]
  1. useAgentEvents - 处理 tool_start/tool_result 事件

  [渲染进程 - UI]
  2. TurnCard - 显示 activities 区域
  3. ToolActivityRow - 工具行（状态图标、名称、结果摘要）

  V3: 动态 UI
  [渲染进程 - UI]
  1. ThinkingIndicator - "Thinking..." + Spinner
  2. TurnCard - 根据 deriveTurnPhase 显示/隐藏 ThinkingIndicator
  3. 状态图标动画（framer-motion）
  4. 自动滚动逻辑

  ---

✻ Cooked for 1m 15s

  Todos · ctrl+t to hide todos
  ☐ 架构铺路：梳理 V1-V3 的完整数据流和组件关系
  ☐ V1: 实现基础对话流（发送消息→用户气泡→AI流式响应）
  ☐ V2: 实现工具显示（ToolActivityRow、状态图标、结果展示）
  ☐ V3: 实现动态UI（Thinking indicator、状态动画、自动滚动）
  ---

> 最后更新: 2026-02-06

## 总体进度

| Vertical Slice | 状态 | 说明 |
|----------------|------|------|
| V1 基础对话 | 🔧 代码完成，待验证 | 发消息→流式响应→渲染 |
| V2 工具显示 | ❌ 未开始 | ToolActivityRow, 状态图标, 结果展示 |
| V3 动态UI | ❌ 未开始 | Thinking indicator, 动画, 自动滚动 |
| V4 权限管理 | ❌ 未开始 | Permission popup, Allow/Deny 流程 |

---

## V1 基础对话 - 详细状态

### 已提交

| Commit | 说明 | 风险 |
|--------|------|------|
| `2daa9da` | ESM 修复: 主进程 bundle deps | **Tradeoff 点** - 无官方文档支持 |

### 未提交（代码完成，typecheck 通过）

| 层 | 文件 | 状态 | 作用 |
|----|------|------|------|
| Agent | `packages/shared/src/agent/deskhand-agent.ts` | ✅ Modified | 调用 Claude SDK, 事件流转换 |
| Hook | `apps/electron/src/renderer/hooks/useAgentEvents.ts` | ✅ Modified | 订阅 IPC 事件, 更新 atoms |
| UI | `apps/electron/src/renderer/components/chat/ChatArea.tsx` | ✅ Modified | 消息列表渲染, Turn 分组 |
| UI | `apps/electron/src/renderer/components/input/InputToolbar.tsx` | ✅ Modified | 发送消息逻辑 |
| UI | `apps/electron/src/renderer/components/chat/TurnCard.tsx` | ✅ **New** | AI 回复卡片 |
| UI | `apps/electron/src/renderer/components/chat/UserMessageBubble.tsx` | ✅ **New** | 用户消息气泡 |

### 待验证

- [ ] `bun run electron:dev` 启动后发送消息
- [ ] 收到 Claude 流式响应
- [ ] UI 正确渲染用户消息和 AI 回复

---

## 架构数据流

```
[Renderer]                    [Main Process]
    │                              │
InputToolbar                       │
    │ click send                   │
    ▼                              │
sessionMessagesFamily ◄── user msg │
    │                              │
    │ window.electronAPI.chat()    │
    └──────────────────────────────┼──► ipc.ts: AGENT_CHAT
                                   │         │
                                   │         ▼
                                   │    DeskhandAgent.chat()
                                   │         │
                                   │         │ Claude SDK query()
                                   │         ▼
                                   │    AgentEvent stream
                                   │         │
    ┌──────────────────────────────┼─────────┘
    │ event.sender.send()          │
    ▼                              │
useAgentEvents hook                │
    │ text_delta → append          │
    │ text_complete → finalize     │
    │ tool_start → add tool msg    │
    │ tool_result → update result  │
    ▼                              │
sessionMessagesFamily              │
    │                              │
    ▼                              │
ChatArea                           │
    │ groupMessagesByTurn()        │
    ▼                              │
TurnCard / UserMessageBubble       │
```

---

## ESM Tradeoff 记录

**问题**: claude-agent-sdk 是 ESM-only，Electron 主进程用 CJS

**解决方案**: 移除 `packages: "external"`，让 esbuild bundle 依赖并转换 ESM→CJS

**依据**: craft-agent production build 采用相同方式

**风险**: 无官方文档支持，如有问题可能需要换方案（dynamic import 等）

**回退影响**: 业务代码保留，只需改构建配置

---

## 下一步行动

1. [ ] 验证 V1 聊天功能是否正常工作
2. [ ] 提交 V1 代码
3. [ ] 开始 V2 工具显示
