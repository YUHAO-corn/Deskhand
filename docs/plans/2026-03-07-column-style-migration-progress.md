# Column 风格迁移进度台账（执行中）

> 对应总计划：`docs/plans/2026-03-07-column-style-migration-design-plan.md`  
> 维护要求：每个原子提交后立即更新本文件。  
> 唯一进度真相来源（Single Source of Truth）。

---

## 1. 元信息

- Owner: `codex`
- Start Date: `2026-03-07`
- Last Updated: `2026-03-07 03:36 CST`
- Current Phase: `P2`
- Current Status: `doing`
- Current Branch: `main`
- Related PR: `tbd`

---

## 2. Phase 看板

### P0 基线与 token
- [ ] 设计回归截图基线建立
- [x] 新语义 token 上线
- [x] 字体系统上线
- [x] 兼容层映射完成

### P1 骨架迁移
- [x] TitleBar
- [x] SessionSidebar
- [x] ChatArea 背景层

### P2 核心交互迁移
- [x] TurnCard
- [x] UserMessageBubble
- [ ] Markdown
- [ ] ActivityTree
- [ ] ToolActivityRow
- [ ] PermissionRequest
- [ ] InputToolbar
- [ ] InputPopups
- [x] ProcessingIndicator

### P3 扩展与精修
- [ ] ArtifactPanel
- [ ] AuthForm
- [ ] AuthGuard
- [ ] SettingsPage

---

## 3. 原子提交记录（按时间倒序）

| Time | Commit | Phase | Scope | Files | Verification | Notes |
|---|---|---|---|---|---|---|
| `2026-03-07 02:54 CST` | `c25e30a` | `P2` | `chat core cards` | `3` | `typecheck + targeted scans` | `完成 TurnCard / UserMessageBubble / ProcessingIndicator 的新 token 迁移与 phase 标签` |
| `2026-03-07 02:51 CST` | `bfa9c09` | `P0+P1` | `token + shell` | `6` | `typecheck + 3 scans` | `完成全局 token / 字体 / App / TitleBar / Sidebar / ChatArea 第一批迁移` |

---

## 4. 门禁扫描记录

每次原子提交后更新一次。

### 4.1 硬编码颜色扫描
- Command: `rg -n "#[0-9a-fA-F]{3,8}|rgb\(|rgba\(" apps/electron/src/renderer`
- Result: `19 hits`
- Summary:
  - `index.css` 中语义 token 定义命中（预期内）。
  - `UserMessageBubble.tsx` 已清零；仍有遗留硬编码：`ActivityTree.tsx`、`InputToolbar.tsx`、`PermissionRequest.tsx`。

### 4.2 旧变量引用扫描
- Command: `rg -n "var\(--bg-|var\(--text-|var\(--border-" apps/electron/src/renderer/components apps/electron/src/renderer/pages`
- Result: `158 hits`
- Summary: `P2/P3 组件仍大量使用旧变量命名，需分阶段清理。`

### 4.3 旧视觉 class 扫描
- Command: `rg -n "bg-white|border-r|shadow-sm" apps/electron/src/renderer/components apps/electron/src/renderer/pages`
- Result: `10 hits`
- Summary: `主要分布在 ArtifactPanel / InputToolbar / Settings / Auth / PermissionRequest / ActivityTree。`

---

## 5. 截图与验收证据

- Baseline:
  - `tbd`
- Latest:
  - `tbd`
- Diff Notes:
  - `本次先完成代码迁移与门禁扫描，截图基线尚未补齐。`

---

## 6. Blockers / 风险

| Time | Type | Description | Owner | Mitigation | Status |
|---|---|---|---|---|---|
| `2026-03-07 02:51 CST` | `risk` | `未建立截图基线，后续视觉回归证据不完整` | `codex` | `下一原子任务前先补 6 个关键页面基线截图` | `open` |
| `2026-03-07 02:54 CST` | `risk` | `P2/P3 旧变量引用量高（158 命中），存在“两不像”风险` | `codex` | `按组件分批迁移并在每批后跑扫描` | `open` |

---

## 7. Next Action（会话恢复入口）

> 新会话只看这 3 行即可继续执行。

1. `进入 P2 第二批：迁移 Markdown + ActivityTree + ToolActivityRow 到新 token/排版语法。`
2. `验证命令：npm run typecheck && rg -n "var\(--bg-|var\(--text-|var\(--border-" apps/electron/src/renderer/components/chat/{markdown/Markdown.tsx,ActivityTree.tsx,ToolActivityRow.tsx}`
3. `完成标准：上述 3 文件无旧变量引用，并通过聊天区手工回归。`

---

## 8. 会话恢复最小命令集

```bash
git status --short
git log --oneline -n 20
sed -n '1,240p' docs/plans/2026-03-07-column-style-migration-design-plan.md
sed -n '1,260p' docs/plans/2026-03-07-column-style-migration-progress.md
```
