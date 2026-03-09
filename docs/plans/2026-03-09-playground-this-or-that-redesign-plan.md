# Playground / This or That 重设计规划（对齐新风格）

> 日期：2026-03-09  
> 范围：`playground.html` + `tournament.html`（This or That）  
> 目的：使 A2UI 交互页面与 Deskhand 新风格（Column 化）一致，提升视觉舒适度与完成任务效率。  
> 交付类型：设计规划文档（供另一个 Codex 落地实现）

---

## 1. 讨论结论（先看这个）

本次建议采用“**同一视觉系统 + 两页重构**”方案：

1. 不先碰业务逻辑和 schema，先做表现层重设计。  
2. 先抽一套 A2UI 共用 design token（颜色、字体、圆角、阴影、间距、动效）。  
3. 在共用 token 上分别重做：
- `playground`：从“工具面板”升级为“编辑式实验台”。  
- `this or that`：从“轻量对比卡片”升级为“偏好竞技场”。  
4. 通过扫描和功能自测验收，不把截图作为硬门槛。  

---

## 2. 当前问题诊断（现状）

## 2.1 共性问题

1. 与主应用新风格不一致：仍是旧薄荷灰 + 系统字体语气。  
2. 模板内各自维护 token，缺少统一视觉语法。  
3. 文字层级偏弱，标题/说明/元信息对比不足。  
4. 组件细节粗糙：边框和阴影语义不稳定，交互反馈偏“功能态”而非“产品态”。  

## 2.2 Playground 页面问题

1. 控制区过窄（260px），复杂场景下阅读与操作拥挤。  
2. 控件组视觉密度高，但信息节奏弱（难以快速扫读）。  
3. options 模式像“列表”而不是“方案画廊”，选择仪式感不足。  
4. Prompt bar 存在感弱，和“Send to Chat”闭环关系不够强。  

## 2.3 This or That 页面问题

1. 对战区视觉张力不足，选择行为缺乏“决策时刻”感。  
2. 维度/轮次信息存在，但层级与叙事弱。  
3. 结果页“偏好画像”可读但不够可用（缺少结构化摘要感）。  
4. 卡片反馈动画有，但氛围感和品牌语气不足。  

---

## 3. 设计目标与边界

## 3.1 目标

1. 风格统一：与 Deskhand 新主题保持一致（暖纸底、编辑感排版、胶囊控件）。  
2. 体验更顺：用户更快完成“选方案/做偏好决策/回传到聊天”。  
3. 视觉更舒服：降低噪音、提升层级与阅读节奏。  

## 3.2 边界（红线）

1. 默认不改业务逻辑、不改 tool schema、不改消息回传协议。  
2. 允许的改动：HTML 结构重排、CSS token 重构、文案微调、动效优化。  
3. 若必须改逻辑，需单独提交并在进度文档登记 `Logic Change Request`。  

---

## 4. 统一视觉系统（A2UI Shared Style）

建议在两个模板内使用同一套变量命名（可先重复定义，后续再抽共享模板）。

## 4.1 颜色与材质（建议）

- `--a2ui-bg-canvas: #f4efe6`  
- `--a2ui-bg-panel: #fff9f0`  
- `--a2ui-bg-elevated: #fffdf7`  
- `--a2ui-text-strong: #1f2522`  
- `--a2ui-text-normal: #4f5a54`  
- `--a2ui-text-muted: #6a746d`  
- `--a2ui-line: #d6cec0`  
- `--a2ui-accent: #0b6a60`  
- `--a2ui-accent-soft: #e9f6f3`  

背景建议使用轻量层叠：径向光斑 + 纸面渐变（静态，不做高频动画）。

## 4.2 字体体系

1. 标题/分区标题：`Fraunces`（或主应用统一 display 字体）。  
2. 正文/控件：`IBM Plex Sans` + `Noto Sans SC`。  
3. 数值与代码：`ui-monospace`。  

## 4.3 组件语法

1. 胶囊类：preset、状态、维度标签统一 pill 语法。  
2. 卡片类：统一圆角与阴影等级，不混用“重边框+重阴影”。  
3. 按钮类：主按钮/次按钮/幽灵按钮语义固定。  
4. 输入控件：focus ring 与 hover 规则统一。  

## 4.4 动效语法

1. 进入动效：`lift-in`（轻微上浮+淡入）。  
2. 交互动效：hover 微抬升 + 阴影增强。  
3. 选择/确认动效：强调“反馈明确，不花哨”。  

---

## 5. Playground 重设计方案

文件：`apps/electron/resources/a2ui-templates/playground.html`

## 5.1 结构重组

1. 顶部 Header 改为“编辑实验台”语气：标题、说明、模式标识。  
2. 主体分区：
- 左：Controls / Presets（固定宽度建议 300-320）。  
- 右：Preview Stage（更大留白，强调结果）。  
- 下：Prompt Composer + Send 行为条。  
3. Options 模式采用“卡片画廊 + 右侧大预览”，弱化列表感。  

## 5.2 控件区优化

1. Control Group 采用“标签 + 当前值 + 控件”三层，提升扫读速度。  
2. Slider 增加视觉轨道填充一致性，减少细碎风格差异。  
3. Select / Toggle / Color 统一边框、focus、hover、disabled 状态。  

## 5.3 预览区优化

1. 预览容器用“工作台卡片”语义（轻边框+软阴影+空气感）。  
2. 默认预览（无 previewHtml）改为更有信息密度的参数摘要样式。  
3. Options 模式下选中方案增加“已选标签 + 描述补充区”。  

## 5.4 Prompt 区优化

1. Prompt 文本区可读性提升（字号、行高、滚动反馈）。  
2. `Send to Chat` 主按钮强化，形成清晰闭环。  
3. 发送后的反馈由“文本替换”升级为“短时状态 chip + 按钮复位”。  

## 5.5 响应式与极限状态

1. 窄宽度下切为上下布局（controls 在上，preview 在下）。  
2. 内容过长时优先保证 controls 与 prompt 可用。  
3. options 过多时支持分组或最小化滚动干扰。  

---

## 6. This or That 重设计方案

文件：`apps/electron/resources/a2ui-templates/tournament.html`

## 6.1 叙事框架

1. 把页面定位成“偏好竞技场”，不是普通二选一。  
2. 头部强化三类信息：
- 当前维度名。  
- 当前轮次 / 总进度。  
- 一句阶段提示（帮助用户理解正在做什么）。  

## 6.2 对战区重构

1. 左右卡片视觉等级更高：标题更强、描述更清晰、emoji 与文本关系更协调。  
2. 中间 `or` 改为更具“对决语义”的分隔组件。  
3. 选中瞬间反馈加强（边框、阴影、轻动效），但不增加等待。  

## 6.3 进度区重构

1. 顶部进度条保留，但加维度标签 chip。  
2. 轮次文案改为可扫读格式（维度/轮次分离展示）。  
3. 完成维度时给短反馈（例如 “风格偏好已完成”）。  

## 6.4 结果页重构

1. 偏好画像做成“主结论卡”（高优先级）。  
2. 详细记录做成结构化列表（维度分组、淘汰信息可折叠）。  
3. Prompt 区与 Send 按钮风格对齐 Playground。  

## 6.5 动效优化

1. 保留 `exitLeft / exitRight / enter` 机制。  
2. 调整节奏和缓动，使“决策反馈更利落”。  
3. 避免连续动画疲劳，确保长轮次体验稳定。  

---

## 7. 落地实施计划（给开发 Codex）

## Phase A：视觉系统统一（0.5 天）

1. 在 `playground.html`、`tournament.html` 引入同名 token。  
2. 统一字体、色彩、阴影、圆角、按钮语法。  

验收：两页第一屏肉眼可见同源风格。

## Phase B：Playground 重构（1 天）

1. 改 layout（controls/preview/prompt）。  
2. 改控件与 options 卡片。  
3. 改发送反馈与状态文案。  

验收：controls 模式和 options 模式都顺滑可用。

## Phase C：Tournament 重构（1 天）

1. 改 header/progress/battle/result 四区。  
2. 调整对战与结果页视觉等级。  
3. 校准动效时序与按钮反馈。  

验收：多维度流程完整，无交互回归。

## Phase D：整体验收（0.5 天）

1. 跑扫描：硬编码颜色/旧变量/旧 class。  
2. 跑功能自测：Send to Chat、轮次推进、结果生成。  
3. 更新进度文档并准备交付说明。  

---

## 8. 强制验收清单

1. 风格一致：playground 和 tournament 不再像两套产品。  
2. 可读性：标题、说明、控制值、结果摘要层级清晰。  
3. 可用性：主要任务路径点击次数不增加。  
4. 回归：Send to Chat 行为、状态切换、维度推进均正常。  
5. 红线：无未批准的业务逻辑改动。  

---

## 9. 非目标（本次不做）

1. 不扩展新的 control type 或新 schema 字段。  
2. 不改 MCP tool handler 协议。  
3. 不改 Artifact Panel 的载入机制。  
4. 不把 guided-form 一并重做（可在下一轮做 A2UI 全量统一）。  

---

## 10. 相关文件（实现时会改）

核心：
- `apps/electron/resources/a2ui-templates/playground.html`  
- `apps/electron/resources/a2ui-templates/tournament.html`  

参考：
- `docs/plans/2026-03-07-column-style-migration-design-plan.md`  
- `apps/electron/resources/a2ui-templates/guided-form.html`  
- `packages/shared/src/agent/a2ui-tools.ts`（确认 schema/行为边界）  

---

## 11. 交付要求（与之前一致）

1. 原子提交：一个 commit 一个可验收单元。  
2. 磁盘进度：每次提交后更新进度文件（含 Next Action）。  
3. 硬门禁：扫描结果 + 功能自测。  
4. 可选证据：截图非强制，只在需要时补。  

