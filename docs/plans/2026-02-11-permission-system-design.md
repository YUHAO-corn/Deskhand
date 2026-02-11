# Permission System Design — Q&A 记录

> 日期：2026-02-11
> 对应：Phase 2 Step 8（权限请求弹窗）

---

## Q1: 需要支持哪些权限模式？

**结论：只做 ask 模式。**

讨论过的方案：
- A: ask + allow-all（两档）
- B: ask + allow-all + "Always Allow" 单工具记忆
- C: 三档（safe/ask/allow-all）
- D: 基于风险等级自动分类

最终选择只做 ask 模式，原因：
- 目标用户包含非技术人群（清理内存、写报告、做 PPT 等场景）
- 非技术用户不理解 "Always Allow Bash" 的含义
- allow-all 对非技术用户风险太大
- YAGNI — 后续如果用户觉得弹窗太烦，再加 "Always Allow" 和模式切换

## Q2: 哪些操作需要弹窗确认？

**结论：会改变文件系统的操作需确认，只读操作自动通过。**

需要确认：
- **Bash** — 风险最高，能执行任何命令
- **Edit** — 修改现有文件，可能覆盖重要内容
- **Write** — 创建或覆盖文件，有不可逆后果

自动通过：
- **Read** — 只读，无副作用
- **Glob / Grep** — 只搜索，无副作用
- **WebFetch / WebSearch** — 只浏览，无副作用

## Q3: 弹窗里怎么展示操作内容？

**结论：原始命令 + 简短描述。**

讨论过的方案：
- A: 只显示原始命令（如 `bash: ls -la`）
- B: AI 生成人话描述（如「要查看文件列表」）
- C: 原始命令 + 简短描述

选 C，兼顾技术和非技术用户。示例：
- `bash: ls -la`（查看文件列表）
- `edit: src/app.ts`（编辑文件）
- `write: report.docx`（创建文件）

## Q4: 弹窗按钮有哪些？

**结论：两个按钮 — 允许 / 拒绝。**

不做 "Always Allow"、不做 "Accept All"。保持最简。

## Q5: 用户拒绝后 agent 怎么办？

**结论：agent 自己处理。**

SDK 的 PreToolUse hook 返回拒绝结果后，agent 收到"操作被用户拒绝"的反馈，自己决定：
- 换个方法完成任务
- 跟用户解释为什么需要这个操作

这是 Claude Code 等产品的标准做法。

---

## 技术实现要点

### 架构
- Agent 端：在 `deskhand-agent.ts` 的 SDK 调用中添加 `PreToolUse` hook
- Hook 检查工具类型：Bash/Edit/Write → 发送权限请求到 renderer，等待响应
- Read/Glob/Grep/WebFetch/WebSearch → 自动放行

### 数据流
```
Agent (PreToolUse hook)
  → IPC event: permission_request { toolName, command, requestId }
  → Renderer: permissionRequestAtom 更新
  → UI: PermissionRequest 弹窗显示
  → 用户点击 允许/拒绝
  → IPC: respondToPermission(sessionId, requestId, 'allow' | 'deny')
  → Agent: hook 收到响应，继续或拒绝
```

### 涉及文件
1. `packages/shared/src/agent/deskhand-agent.ts` — 添加 PreToolUse hook
2. `apps/electron/src/renderer/atoms/sessions.ts` — 修正 permissionRequestAtom 类型
3. `apps/electron/src/renderer/components/chat/PermissionRequest.tsx` — 实现 IPC 调用
4. `apps/electron/src/main/ipc.ts` — 添加 respondToPermission handler
5. `apps/electron/src/preload/index.ts` — 暴露 respondToPermission API
