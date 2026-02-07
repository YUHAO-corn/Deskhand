# Phase 2 Chat 渐进式开发 TODO

> 最后更新：2026-02-07
> 目标：端到端跑通对话功能

---

## 当前状态总结

**已完成**：
- 数据流架构完整（InputToolbar → IPC → Agent → Events → Atoms → UI）
- 基础组件存在（ChatArea、InputToolbar、TurnCard、UserMessageBubble）
- turn-utils.ts 功能完善（消息分组、状态机、嵌套工具支持）
- useAgentEvents hook 正确处理所有事件类型
- App.tsx 创建随机 sessionId 并设置 activeSessionIdAtom
- 基础对话能收到响应（2026-02-07 验证）
- turn.id bug 已修复

**主要差距**：
- TurnCard 只显示纯文本，不渲染工具调用/Markdown/代码
- 无停止按钮
- 配置（模型/思考级别）未传递给 Agent
- 权限流程未启用

**已知 Bug（需在 Step 0 修复）**：
- 用户消息白色文字在浅色背景看不清（UserMessageBubble.tsx）
- SDK 会话不复用 - 每次发消息都创建新对话（DeskhandAgent 没传 resume 参数）
- 对话历史在工作目录创建，污染用户项目

---

## Step 0: 验证基础对话流程（必须先做！）

### 做什么
1. ~~**修复 turn.id bug** - ChatArea.tsx 第 83 行改为正确的 key~~ ✅
2. ~~**手动测试数据流** - 验证消息能发送并收到响应~~ ✅
3. **修复用户消息颜色** - UserMessageBubble.tsx 白色文字看不清
4. **修复 SDK 会话复用** - DeskhandAgent 需要传递 `resume` 参数
   - 首次对话后捕获 SDK session ID
   - 存储到会话状态
   - 后续对话传入 `resume: sdkSessionId`
5. **配置 SDK 存储目录** - 避免在用户工作目录创建对话历史

### 涉及文件
- `apps/electron/src/renderer/components/chat/ChatArea.tsx`（已修复 key）
- `apps/electron/src/renderer/components/chat/UserMessageBubble.tsx`（修复颜色）
- `packages/shared/src/agent/deskhand-agent.ts`（添加 resume 参数）
- `apps/electron/src/main/ipc.ts`（传递和存储 SDK session ID）

### 验证步骤
```bash
bun run dev
# 打开开发者工具 Console

# 1. 检查 sessionId 是否设置
# 预期: 在 Console 看到 sessionId 是一个 UUID

# 2. 发送一条简单消息: "hello"
# 预期:
#   - 用户消息气泡显示 "hello"
#   - Console 有 [IPC] agent:chat 日志
#   - AI 响应显示在 TurnCard 中（可能只是纯文本）

# 3. 如果 AI 没响应，检查:
#   - .env 是否有 ANTHROPIC_API_KEY
#   - Console 是否有错误信息
```

### 完成后体验
- [x] 用户消息能正确显示
- [x] AI 文本响应能显示（哪怕是纯文本）
- [x] 没有 React key 警告

### 可能遇到的问题
| 现象 | 可能原因 | 解决方案 |
|------|----------|----------|
| 用户消息不显示 | Turn key 问题导致渲染失败 | 修复 turn.id → 正确的 key |
| AI 不响应 | API key 未配置 | 检查 .env |
| AI 不响应 | IPC 事件未送达 | 检查 Console 日志 |
| 显示 "No API key" 错误 | hasApiKey() 返回 false | 配置 .env 或临时跳过检查 |

---

## Step 1: TurnCard 渲染工具调用

### 做什么
1. 在 `TurnCard.tsx` 中渲染 `turn.activities` 数组
2. 创建 `ToolActivityRow.tsx` 组件显示单个工具调用
3. 显示工具状态图标（running/completed/error）

### 涉及文件
- `apps/electron/src/renderer/components/chat/TurnCard.tsx`
- `apps/electron/src/renderer/components/chat/ToolActivityRow.tsx`（新建）

### 完成后体验
- [x] 发送消息后，能看到 AI 正在调用的工具（如 Read、Edit、Bash）
- [x] 工具执行中显示 spinner/loading 状态
- [x] 工具完成后显示 ✓ 或 ✗

### 验收命令
```bash
bun run dev
# 发送: "读取 package.json 文件"
# 预期: 看到 "Read package.json" 工具调用行
```

---

## Step 2: Markdown 渲染（基础版）

### 做什么
1. 安装 `react-markdown` 和 `remark-gfm`
2. 在 TurnCard 的 response 区域使用 Markdown 组件
3. 添加基础样式（标题、列表、链接）

### 涉及文件
- `package.json`（添加依赖）
- `apps/electron/src/renderer/components/chat/TurnCard.tsx`
- `apps/electron/src/renderer/components/markdown/Markdown.tsx`（新建）

### 完成后体验
- [x] AI 响应中的 **粗体**、*斜体*、列表、链接正确渲染
- [x] 代码块显示为灰色背景（暂无语法高亮）

### 验收命令
```bash
bun run dev
# 发送: "用 markdown 格式介绍 React hooks"
# 预期: 看到格式化的标题、列表、代码块
```

---

## Step 3: 停止生成按钮

### 做什么
1. 在 ChatArea 或 InputToolbar 添加停止按钮
2. 按钮仅在 `isStreaming` 时显示
3. 点击调用 `window.electronAPI.stopAgent(sessionId)`

### 涉及文件
- `apps/electron/src/renderer/components/chat/ChatArea.tsx`
- `apps/electron/src/renderer/components/input/InputToolbar.tsx`（可选位置）

### 完成后体验
- [x] AI 响应时，发送按钮变成停止按钮（或旁边出现停止按钮）
- [x] 点击停止后，AI 停止输出

### 验收命令
```bash
bun run dev
# 发送一个需要长时间处理的任务
# 点击停止按钮
# 预期: 输出立即停止
```

---

## Step 4: 配置传递到 Agent

### 做什么
1. 将 `selectedModelAtom` 的值传给 `DeskhandAgent`
2. 将 `thinkingLevelAtom` 的值映射到 SDK 参数
3. 从 InputToolbar 传递到 IPC 调用

### 涉及文件
- `apps/electron/src/renderer/components/input/InputToolbar.tsx`
- `apps/electron/src/preload/index.ts`（修改 chat 参数）
- `apps/electron/src/main/ipc.ts`
- `packages/shared/src/agent/deskhand-agent.ts`

### 完成后体验
- [x] 在 ModelSelector 选择 "Haiku"，发送消息后响应明显更快
- [ ] 在 ReasoningPopup 选择 "Max"，AI 响应前有更长的思考时间（需要进一步实现 SDK 参数映射）

>当前跑测遗留问题（非阻塞，后面回来弄）： 1. 选择reasoning后未出现思考 2.使用opus4.5 模型进行对话后，UI切换到haiku模型后，对话里回复说它依然是原来opus，不确定是未实现切换，还是不支持对话中切换

### 验收命令
```bash
bun run dev
# 1. 选择 Haiku 模型，发送简单问题，观察响应速度
# 2. 选择 Sonnet 模型，发送同样问题，对比速度
# 3. 切换思考级别，观察行为变化
```

---

## Step 5: 思考指示器 (Thinking Indicator)

### 做什么
1. 在 TurnCard 中使用 `deriveTurnPhase()` 和 `shouldShowThinkingIndicator()`
2. 显示 "Thinking..." + Spinner 而不是空白
3. 实现智能缓冲（`shouldShowContent()`）

### 涉及文件
- `apps/electron/src/renderer/components/chat/TurnCard.tsx`
- `apps/electron/src/renderer/components/chat/ThinkingIndicator.tsx`（新建）

### 完成后体验
- [ ] 发送消息后立即看到 "Thinking..." 动画
- [ ] 工具调用之间的空隙也显示 "Thinking..."
- [ ] 响应文本达到一定长度/结构后才显示（智能缓冲）

### 验收命令
```bash
bun run dev
# 发送消息，观察是否有 Thinking 指示器
# 预期: 永远不会出现"空白等待"的情况
```

---

## Step 6: 错误/状态消息渲染

### 做什么
1. 在 ChatArea 的 TurnRenderer 中处理 `SystemTurn`
2. 根据 `message.role` 渲染不同样式（error=红色、warning=黄色、info=灰色）
3. 显示错误详情（如有）

### 涉及文件
- `apps/electron/src/renderer/components/chat/ChatArea.tsx`
- `apps/electron/src/renderer/components/chat/SystemMessage.tsx`（新建）

### 完成后体验
- [ ] API 错误时显示红色错误卡片
- [ ] 状态信息（如 "Generation stopped"）正确显示
- [ ] 警告信息显示黄色样式

### 验收命令
```bash
bun run dev
# 1. 断网后发送消息，预期看到错误提示
# 2. 点击停止按钮，预期看到 "Generation stopped" 信息
```

---

## Step 7: 代码块语法高亮 (Shiki)

### 做什么
1. 安装 `shiki` 和 `@shikijs/transformers`
2. 创建 `CodeBlock.tsx` 组件
3. 集成到 Markdown 渲染器
4. 支持常用语言（ts、js、python、bash、json）

### 涉及文件
- `package.json`
- `apps/electron/src/renderer/components/markdown/CodeBlock.tsx`（新建）
- `apps/electron/src/renderer/components/markdown/Markdown.tsx`

### 完成后体验
- [ ] 代码块有语法高亮
- [ ] 支持 dark/light 主题
- [ ] 显示语言标签

### 验收命令
```bash
bun run dev
# 发送: "写一个 TypeScript 函数计算斐波那契数列"
# 预期: 代码块有语法高亮，关键字、字符串、数字颜色不同
```

---

## Step 8: 权限请求弹窗

### 做什么
1. 创建 `PermissionRequest.tsx` 组件
2. 监听 `permissionRequestAtom`，有值时显示弹窗
3. 实现 Allow / Deny / Always Allow 按钮
4. 修改 DeskhandAgent 启用权限模式（移除 bypassPermissions）

### 涉及文件
- `apps/electron/src/renderer/components/chat/PermissionRequest.tsx`（新建）
- `apps/electron/src/renderer/components/chat/ChatArea.tsx`
- `packages/shared/src/agent/deskhand-agent.ts`

### 完成后体验
- [ ] AI 要执行 Bash 命令时弹出权限确认
- [ ] 显示要执行的命令内容
- [ ] 点击 Allow 后命令执行
- [ ] 点击 Deny 后 AI 知道被拒绝

### 验收命令
```bash
bun run dev
# 发送: "运行 ls -la 命令"
# 预期: 弹出权限请求，显示 "ls -la"，可以选择允许或拒绝
```

---

## Step 9: Token 使用统计

### 做什么
1. 在 useAgentEvents 中捕获 `complete` 事件的 `usage` 数据
2. 存储到 session 或 turn 状态
3. 在 TurnCard 底部显示 token 统计

### 涉及文件
- `apps/electron/src/renderer/hooks/useAgentEvents.ts`
- `apps/electron/src/renderer/components/chat/TurnCard.tsx`
- `apps/electron/src/renderer/components/chat/TokenUsageDisplay.tsx`（新建）

### 完成后体验
- [ ] 每个 AI 回复底部显示 "1.2k in / 0.5k out"
- [ ] 可选：显示估算成本

### 验收命令
```bash
bun run dev
# 发送几条消息
# 预期: 每条 AI 回复下方显示 token 统计
```

---

## Step 10: 工作目录选择（实际功能）

### 做什么
1. WorkspacePopup 调用 Electron 的 `dialog.showOpenDialog`
2. 保存选择的目录到配置
3. 传递 `workingDirectory` 给 Agent

### 涉及文件
- `apps/electron/src/renderer/components/input/popups/InputPopups.tsx`
- `apps/electron/src/preload/index.ts`（添加 selectDirectory API）
- `apps/electron/src/main/ipc.ts`

### 完成后体验
- [ ] 点击目录选择按钮打开系统目录选择器
- [ ] 选择后显示在 Popup 中
- [ ] AI 的文件操作基于选择的目录

### 验收命令
```bash
bun run dev
# 1. 点击目录选择，选择一个项目目录
# 2. 发送: "列出当前目录的文件"
# 预期: AI 列出你选择的目录的文件
```

---

## Step 11: 嵌套 Task 子代理树形展示

### 做什么
1. 使用 turn-utils 的 `groupActivitiesByParent()` 分组工具调用
2. 渲染树形缩进和连接线
3. Task 工具可展开/折叠显示子活动

### 涉及文件
- `apps/electron/src/renderer/components/chat/TurnCard.tsx`
- `apps/electron/src/renderer/components/chat/ActivityTree.tsx`（新建）

### 完成后体验
- [ ] Task 子代理的工具调用显示为缩进的子树
- [ ] 有树形连接线（├─ └─）
- [ ] 可以折叠/展开子代理活动

### 验收命令
```bash
bun run dev
# 发送复杂任务，触发 Task 子代理
# 预期: 看到嵌套的工具调用树形结构
```

---

## Step 12: 动画效果 (framer-motion)

### 做什么
1. 安装 `framer-motion`
2. 工具调用行出现动画（slide in）
3. 状态图标切换动画（crossfade）
4. 响应卡片淡入动画

### 涉及文件
- `package.json`
- `apps/electron/src/renderer/components/chat/TurnCard.tsx`
- `apps/electron/src/renderer/components/chat/ToolActivityRow.tsx`

### 完成后体验
- [ ] 新工具调用行从左侧滑入
- [ ] 工具状态图标平滑切换
- [ ] 整体交互感觉流畅

### 验收命令
```bash
bun run dev
# 发送消息，观察动画效果
# 预期: 工具调用出现有动画，状态切换有过渡
```

---

## 后续可选 (P2)

以下功能可在核心对话功能稳定后实现：

- [ ] 重新生成消息
- [ ] 编辑用户消息
- [ ] 文件附件上传
- [ ] 斜杠命令菜单
- [ ] @提及系统
- [ ] 拖放/粘贴图片

---

## 依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│ 核心流程（必须按顺序）                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1 (工具调用) ──▶ Step 5 (Thinking) ──┐               │
│       │                                    │               │
│       │                                    ▼               │
│       └─────────────────────────────▶ Step 11 (嵌套树形)   │
│                                            │               │
│                                            ▼               │
│                                       Step 12 (动画)       │
│                                                             │
│  Step 2 (Markdown) ──▶ Step 3 ──▶ Step 4 ──▶ Step 6       │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 独立功能（可并行，无依赖）                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 7 (Shiki 代码高亮) ── 依赖 Step 2                     │
│  Step 8 (权限弹窗)      ── 独立                             │
│  Step 9 (Token统计)    ── 独立                             │
│  Step 10 (目录选择)    ── 独立                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 建议执行顺序

### 第零阶段：验证基础流程
```
0 (验证对话流程)
```
完成后：确认发消息能收到 AI 响应，数据流通畅

### 第一阶段：核心对话 + 完整输出效果
```
1 → 2 → 3 → 4 → 5 → 6 → 11 → 12
```
完成后：对话功能基本可用，工具调用有树形展示 + 动画效果

### 第二阶段：增强功能（可并行）
```
7 (Shiki)  ─┐
8 (权限)    ├── 并行开发，无依赖
9 (Token)  ─┤
10 (目录)  ─┘
```
完成后：代码高亮、权限确认、统计信息、目录选择 全部可用

---

## 里程碑检查点

- [ ] **M0 (Step 0)**：基础对话能跑通 → 发消息有响应 → **前提条件**
- [ ] **M1 (Step 1-3)**：能看到工具调用 + Markdown + 停止按钮
- [ ] **M2 (Step 4-6)**：配置生效 + Thinking指示器 + 错误显示
- [ ] **M3 (Step 11-12)**：嵌套树形 + 动画效果 → **核心验收完成**
- [ ] **M4 (Step 7-10)**：增强功能全部完成 → **Phase 2 完成**
