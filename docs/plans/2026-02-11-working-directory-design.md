# Step 10: 工作目录选择 — 设计文档

> 日期：2026-02-11
> 状态：已确认，待实现

---

## Q&A 设计决策

### Q1: 用户场景是什么？

用户打开 app 后，先选一个项目目录，然后在这个目录下跟 agent 对话。类似 Cursor 打开一个项目。

### Q2: 选择目录的入口？  

用现有的 WorkspacePopup（工具栏的文件夹按钮）。点击弹出目录列表 + "Select Directory..." 按钮，调用系统目录选择器。不新增额外 UI。

### Q3: 未选目录时怎么办？

不阻断对话。agent 用 app 数据目录兜底（`app.getPath('userData')/workspace/`），不污染用户 home 目录。工具栏提示"未选择工作目录"。

### Q4: 选择后要不要记住？

记住最近选择的目录。下次打开 app 自动恢复。存一个 `lastWorkingDirectory` 到 config。

### Q5: 对话中能换目录吗？

不能。SDK 的 `cwd` 绑定到 session，设了就不能改（SDK 在 `~/.claude/projects/{cwd-slugified}/` 下存 transcript，改了就找不到）。换目录 = 开新 session。

### Q6: 工具栏 badge 显示什么？

- 未选目录：显示提示文字（如 "No directory"）
- 已选目录：显示目录名（如 "Deskhand"）

---

## 数据流

```
用户点击 "Select Directory..."
  → Electron dialog.showOpenDialog()
  → 返回路径
  → 存到 workingDirectoryAtom（renderer 侧）
  → 同时持久化到 config（通过 IPC saveConfig）
  → 下次启动时从 config 恢复到 atom

发送消息时：
  InputToolbar 读取 workingDirectoryAtom
  → 传给 IPC chat()
  → ipc.ts 创建 agent 时传入 cwd
  → agent 在该目录下工作
```

---

## 改动点

| 文件 | 改动 |
|------|------|
| `apps/electron/src/preload/index.ts` | 新增 `selectDirectory()` API |
| `apps/electron/src/main/ipc.ts` | 新增 `select-directory` handler（调用 `dialog.showOpenDialog`）+ chat 时传 workingDirectory |
| `apps/electron/src/renderer/atoms/sessions.ts` | 新增 `workingDirectoryAtom`，初始值 `null` |
| `apps/electron/src/renderer/components/input/popups/InputPopups.tsx` | WorkspacePopup 接通 `selectDirectory()`，选完更新 atom |
| `apps/electron/src/renderer/components/input/InputToolbar.tsx` | 读取 atom 传给 chat()，badge 显示目录名 |
| `packages/shared/src/config/` | config 类型加 `lastWorkingDirectory` 字段 |

---

## 技术约束

- SDK `cwd` 绑定 session，不可中途更改
- SDK 在 `~/.claude/projects/{cwd-slugified}/` 存 session transcript
- resume 时必须用相同 cwd，否则找不到历史
- 参考 craft-agents 的 `sdkCwd` vs `workingDirectory` 分离模式（当前不需要，后续可扩展）
