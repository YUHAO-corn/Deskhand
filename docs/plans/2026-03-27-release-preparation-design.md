# Release 准备行动计划

> Brainstormed 2026-03-27.

---

## 概览

| # | 类别 | 风险 |
|---|------|------|
| 1 | Widget 代码存档 + 回退 | 零 |
| 2 | 性能修复 | 低 |
| 3 | 代码清理 | 零 |
| 4 | UX 打磨 | 低 |
| 5 | 构建打包 | 低 |
| 6 | 发布 | — |

---

## 1. Widget 代码存档 + 回退

从当前 main 创建 `archive/live-widget` 分支保存代码，然后回到 main：
- 丢弃 4 个未提交的改动
- revert 5 个 widget commit（`00b3d18`, `e6704c3`, `43809fc`, `2ac2e3b`, `0e5d44d`）
- 验证 typecheck + lint 通过

后续重写 widget 时去 archive 分支参考，不追求合并。

---

## 2. 性能修复

解决聊天变长后卡顿。三个点：

- **列表虚拟化**：`ChatArea.tsx` 引入 `react-virtuoso`，只渲染可视区域
- **组件 Memo**：`TurnCard` 加 `React.memo`；`ActivityTree` 里 `groupActivitiesByParent()` 加 `useMemo`
- **流式更新节流**：`useAgentEvents.ts` 对 `text_delta` 做 `requestAnimationFrame` 节流

---

## 3. 代码清理

- 移除 console.log（`ipc.ts` ~13 处、`insight-pipeline.ts` ~6 处、`insight-agent.ts` ~3 处、`deskhand-agent.ts` ~4 处、`useAgentEvents.ts` ~3 处、`TurnCard.tsx` 1 处）。主进程保留 error 级别，渲染进程全删。
- 移除 widget demo 模式（revert 后应已消失，确认一下）
- 修复 10 个 lint warnings（未使用变量/import）

---

## 4. UX 打磨

- 交互按钮补 `aria-label`（`InputToolbar.tsx`, `TurnCard.tsx`, `ArtifactPanel.tsx`）
- 聊天发送失败时显示错误提示（`InputToolbar.tsx` 的 catch 里加 error state）
- 权限弹窗加焦点陷阱（`PermissionRequest.tsx`）

---

## 5. 构建打包

- 用户提供 app 图标（`icon.icns`），放到 `apps/electron/resources/`
- 创建 `electron-builder.yml`，配置 macOS DMG 输出
- 补充 `package.json` 元数据（author、license）
- 跑一遍 `electron-builder --mac`，确认能打出 DMG 并正常启动

首次发布不做签名，用户手动允许打开即可。

---

## 6. 发布

- 打 tag `v0.1.0`
- 创建 GitHub Release，上传 DMG
- README 加下载链接

---

## 执行顺序

1 → 2 → 3 → 4 → 5 → 6，线性执行。第 5 步需要用户提供图标。
