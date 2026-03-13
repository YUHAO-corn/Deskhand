# Chat 内 Artifact 卡片设计（对齐新风格）

> 日期：2026-03-09  
> 类型：交互与展示层设计文档（供另一个 Codex 实现）  
> 目标：在聊天流中显式展示“已生成文件”，并支持一键打开 Artifact 面板。

---

## 1. 方案确认（本次拍板）

基于讨论，本次采用以下固定决策：

1. 卡片形态：**Turn 内附件卡片**（不新增独立消息 role）。  
2. 面板行为：**保留自动弹出**（现有行为不变）。  
3. 触发范围：**全部文件**（Write/Edit/A2UI 产物均展示）。  

---

## 2. “Turn 内卡片”与“独立消息卡”的区别（给产品/开发统一口径）

## 2.1 Turn 内附件卡片（本次选择）

1. 卡片作为 Assistant Turn 的一个区块，显示在该轮活动/回复下面。  
2. 不需要新增 `MessageRole`，不改消息存储结构。  
3. 技术改动集中在 TurnCard 和 turn-utils，风险更低。  

## 2.2 独立消息卡（本次不做）

1. 每次产物都插入一条新的聊天消息（类似新 role）。  
2. 需要改 core message types、存储、分组渲染链路。  
3. 更接近“系统通知流”，但实现复杂度和回归风险更高。  

---

## 3. 用户体验目标

1. 用户在聊天区明确看到“生成了哪些文件”。  
2. 点击文件卡片后，右侧 Artifact 面板打开并定位到该文件。  
3. 在多文件场景下不刷屏、可快速扫读。  
4. 视觉风格与当前新主题一致（Editorial / Column 语气）。  

---

## 4. 交互设计

## 4.1 展示位置

在 [TurnCard.tsx](apps/electron/src/renderer/components/chat/TurnCard.tsx) 中，放在 `Activity` 区块与 `response` 之间（或 response 下方，二选一保持一致）。

建议顺序：
1. Phase chip + Activity。  
2. Artifact 卡片区（若本轮有文件）。  
3. Assistant 响应正文。  

## 4.2 卡片结构

卡片标题：
- `Artifacts · {count}`  

卡片内容：
- 文件列表（默认显示前 3 项，超出显示 `+N more`）。  
- 每项包含：文件图标、文件名、相对/完整路径。  

卡片操作：
1. 点击文件项：打开 panel + 选中该文件。  
2. 次级操作：`Show in Folder`（可选，P2）。  

## 4.3 多文件与去重规则

1. 同一轮内同一路径多次写入，只显示一次（取最后一次）。  
2. 列表按时间顺序显示（最新在前）。  
3. 全部文件都展示，不做类型过滤。  

## 4.4 自动弹出策略

沿用现有逻辑：当捕获到 artifact 时自动打开 Artifact 面板。  
本需求只补“聊天内可见反馈”，不改变当前自动弹出规则。

---

## 5. 视觉设计（与新风格对齐）

1. 卡片容器：`surface-elevated` + 轻边框 + 软阴影。  
2. 标题与计数：胶囊标签语法（pill）。  
3. 文件项 hover：背景轻提亮 + 字体加深 + 图标强调色。  
4. 与 TurnCard 保持统一圆角、间距、字号系统。  

禁止：
1. 重新引入旧主题色硬编码。  
2. 使用与主界面不一致的按钮/边框语法。  

---

## 6. 技术方案（实现指导）

## 6.1 数据来源

来源 1：Write/Edit 工具  
- 从 activity 的 `toolInput.file_path` 获取。  
- 新增规范：在捕获阶段写入 `file_path_resolved`（绝对路径）供点击打开使用。  

来源 2：A2UI 工具结果  
- 从 `toolResult` JSON 中解析 `a2ui=true && filePath`。  
- 该 `filePath` 为绝对路径，可直接打开。  

## 6.2 核心实现点

1. 在 [useAgentEvents.ts](apps/electron/src/renderer/hooks/useAgentEvents.ts) 的 Write/Edit 捕获处，把 resolved path 回填到 tool message（例如 `toolInput.file_path_resolved`）。  
2. 在 [turn-utils.ts](apps/electron/src/renderer/components/chat/turn-utils.ts) 新增 `extractArtifactsFromTurn(turn)`，统一提取并去重。  
3. 在 [TurnCard.tsx](apps/electron/src/renderer/components/chat/TurnCard.tsx) 渲染 `ArtifactAttachmentSection`。  
4. 点击文件项时设置：
- `selectedArtifactAtom`  
- `artifactPanelOpenAtom = true`  

## 6.3 建议新增组件

1. `ArtifactAttachmentSection`（TurnCard 内部或独立文件）  
2. `ArtifactAttachmentItem`（文件行）  

组件要求：
1. 纯展示/交互，不改业务流程。  
2. 支持空态保护（路径缺失时不可点击）。  

---

## 7. 非目标与约束

1. 不新增消息 role（不做 `artifact` role）。  
2. 不改 session 持久化协议。  
3. 不改 Artifact Panel 主体结构。  
4. 不改 A2UI tool schema。  

---

## 8. 开发拆分（原子提交）

## Commit 1：数据打通

文件：
- `useAgentEvents.ts`  
- `turn-utils.ts`  

内容：
1. 回填 resolved path。  
2. 提取 turn artifacts 的 util。  

验收：
1. 能在控制台/调试看到 turn 级 artifact 列表正确。  

## Commit 2：UI 渲染

文件：
- `TurnCard.tsx`  
-（可选）新建 `ArtifactAttachmentSection.tsx`  

内容：
1. 渲染卡片与文件列表。  
2. 点击打开 artifact 面板并选中。  

验收：
1. 生成文件后聊天区出现卡片。  
2. 点击卡片可打开对应文件。  

## Commit 3：风格与边界

文件：
- `TurnCard.tsx`  
- `index.css`（如需 token）  

内容：
1. 对齐新风格细节。  
2. 处理多文件截断/去重/缺失文件边界。  

验收：
1. 多文件场景不混乱。  
2. 无旧样式硬编码回归。  

---

## 9. 验收清单（硬门槛）

1. 功能：
- Write/Edit 生成文件后，聊天区出现 Artifact 卡片。  
- A2UI 生成文件后，聊天区也出现 Artifact 卡片。  
- 点击文件项可打开 Artifact 面板并定位。  

2. 边界：
- 同一文件重复写入不重复刷多条。  
- 文件不存在时有可理解反馈（禁用态或提示）。  

3. 质量：
- 不改业务核心逻辑。  
- 保持自动弹出行为。  
- 扫描通过（旧变量/旧 class/硬编码颜色按现有门禁执行）。  

---

## 10. 相关文件

核心实现文件：
- [useAgentEvents.ts](apps/electron/src/renderer/hooks/useAgentEvents.ts)  
- [turn-utils.ts](apps/electron/src/renderer/components/chat/turn-utils.ts)  
- [TurnCard.tsx](apps/electron/src/renderer/components/chat/TurnCard.tsx)  

参考文件：
- [ArtifactPanel.tsx](apps/electron/src/renderer/components/artifact/ArtifactPanel.tsx)  
- [ToolActivityRow.tsx](apps/electron/src/renderer/components/chat/ToolActivityRow.tsx)  
- [2026-03-07-column-style-migration-design-plan.md](docs/plans/2026-03-07-column-style-migration-design-plan.md)  

