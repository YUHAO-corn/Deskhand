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

---

## 迭代：加回 allow-all 模式（2026-02-11 补充）

> 背景：实现完 ask-only 后，重新讨论认为技术用户需要快捷模式。

### Q6: 是否需要 allow-all 模式？

**结论：需要。加回 allow-all 模式。**

原始决策（Q1）是只做 ask 模式，理由是 YAGNI + 非技术用户安全。
但实际考虑后，技术用户对速度的需求很强，每次 Edit/Write 都弹窗会严重打断心流。

修正后的模式：
- **ask**（默认）：Bash/Edit/Write 全部弹窗确认
- **allow-all**：大部分操作自动放行，仅明确的删除命令仍弹窗

### Q7: allow-all 模式下哪些操作仍需拦截？

**结论：只拦截明确的删除类 bash 命令。**

检测方式：提取 bash 命令的第一个词（base command），匹配删除命令黑名单：
- `rm`、`rmdir`、`unlink`、`shred`

Edit/Write 在 allow-all 下全部放行（修改文件 ≠ 删除文件）。

已知局限：
- `find . -delete`、`git clean -f`、`xargs rm` 等间接删除无法检测
- V1 先覆盖 90% 场景，后续可加更多模式匹配

### Q8: 模式切换入口在哪？

**结论：放在 InputToolbar 的 toolbar 上。**

类似现有的 model selector，用户可以随时切换。默认 ask 模式。

### 两种模式行为对比

| 操作 | ask 模式 | allow-all 模式 |
|------|----------|---------------|
| Read/Glob/Grep | 自动通过 | 自动通过 |
| WebFetch/WebSearch | 自动通过 | 自动通过 |
| Edit | 弹窗确认 | 自动通过 |
| Write | 弹窗确认 | 自动通过 |
| Bash（普通命令） | 弹窗确认 | 自动通过 |
| Bash（删除命令） | 弹窗确认 | 弹窗确认 |

### 新增涉及文件
1. `packages/shared/src/agent/deskhand-agent.ts` — PreToolUse hook 增加 allow-all 逻辑
2. `apps/electron/src/renderer/atoms/sessions.ts` — 恢复 permissionModeAtom
3. `apps/electron/src/renderer/components/input/InputToolbar.tsx` — 添加模式切换 UI
4. `apps/electron/src/main/ipc.ts` — chat 接收 permissionMode 参数
5. `apps/electron/src/preload/index.ts` — ChatConfig 增加 permissionMode
