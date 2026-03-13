# Deskhand 设计风格迁移规划（对齐 Column）

> 日期：2026-03-07  
> 角色：设计规划（不含代码落地）  
> 目标：将 Deskhand 的整体视觉与交互风格迁移到 Column 的设计语言，同时保持桌面生产力工具的效率与可读性。

---

## 1. 结论先行（可直接执行）

建议采用的方向不是“复制 Column 网站”，而是做 **Column 风格的 Deskhand 桌面化变体**：

1. 视觉语气：从“冷静工具 UI”升级为“编辑部工作台（Editorial Workbench）”。  
2. 视觉系统：从“薄荷灰 + 系统字体 + 功能块”升级为“暖纸色基底 + 衬线标题 + 胶囊控件 + 卡片层次”。  
3. 交互语义：从“控件驱动”升级为“阅读流 + 决策流”导向，突出“正在推演/正在决策”的过程感。  
4. 实施策略：先做 Design Token 和基础骨架迁移，再做组件批量替换，最后做动效和细节打磨。  

---

## 2. 研究摘要：Column 的设计 DNA

基于样式与页面结构分析，Column 的风格核心如下：

1. **色彩基因**：暖纸底色（`#f4efe6`）+ 低饱和绿青强调（`#0b6a60`）+ 米金线框（`#d6cec0`）。  
2. **排版基因**：标题使用高识别衬线（Fraunces），正文用易读无衬线（IBM Plex Sans / Noto Sans SC）。  
3. **控件基因**：大量使用胶囊 chip、轻描边、微浮层阴影，减少“表格式分割线”感。  
4. **空间基因**：卡片有空气感（留白、圆角、软阴影），背景有层次（径向渐变+纸感）。  
5. **动效基因**：克制但明确（lift-in、hover 微抬升、展开/收起有节奏）。  
6. **内容基因**：强调“决策过程可读性”，信息组织围绕“连续阅读与连续判断”。  

---

## 3. Deskhand 当前状态与差距

### 3.1 当前状态（概览）

1. 已有基础 Design Token 和层级意识（`index.css`）。  
2. 主体组件结构清晰（TitleBar / Sidebar / Chat / Input / Artifact / Settings）。  
3. 风格更偏“通用 AI 工具壳”，辨识度不足。  

### 3.2 关键差距（按设计层）

1. **品牌识别差距**：字体与色彩语气偏系统默认，缺少 Column 的“编辑感”。  
2. **视觉层次差距**：已有卡片化，但大面仍偏平，缺少背景氛围与材质感。  
3. **信息叙事差距**：聊天内容是“消息流”，还不是“决策流”。  
4. **交互一致性差距**：弹窗、按钮、状态芯片语法不完全统一。  
5. **细节质量差距**：Markdown、表格、代码块与正文风格还未形成统一排版系统。  

---

## 4. 迁移目标：Deskhand x Column 的目标风格定义

### 4.1 风格命名

**Editorial Command Center（编辑式决策中枢）**

### 4.2 风格原则

1. 先可读，后装饰。  
2. 先统一语法，再堆细节。  
3. 先核心路径（会话-输入-产物），再外围页面（设置等）。  
4. 风格迁移不牺牲效率：快捷操作、信息密度、扫描速度必须保留。  

### 4.3 一句话体验目标

用户打开 Deskhand 的第一感受应从“在用聊天工具”变成“在看一份可执行的决策工作台”。

---

## 5. 方向上要改什么（战略层）

### 5.1 视觉方向

1. 从冷色系统 UI 转为暖中性色“纸面工作台”。  
2. 引入“衬线标题 + 无衬线正文”双字体系统。  
3. 增强背景层次与空间深度（轻纹理、渐变、半透明层）。  
4. 强化 chip 语言（状态、模型、权限、标签统一胶囊语法）。  

### 5.2 交互方向

1. 将“消息展示”升级为“轮次/决策单元展示”。  
2. 强化“进行中状态”的可感知节奏（thinking、tool、response 分段清晰）。  
3. 让所有浮层交互采用一致的开合、定位、阴影、圆角规则。  

### 5.3 信息架构方向

1. 会话列表从“名称列表”升级为“决策条目列表”（标题+状态+最近动作）。  
2. 主聊天区突出“当前决策上下文”（主题、阶段、状态 chips）。  
3. Artifact 区从“文件预览”升级为“产物阅读台”（预览优先、代码次级）。  

### 5.4 品牌与文案方向

1. 文案语气从通用工具提示改为“编辑/决策”语气。  
2. 空状态、引导文案统一成 Column 风格叙述。  

---

## 6. 具体落地要改什么（执行层）

以下按“另一个 Codex 可直接改文件”的粒度给出。

### 6.1 Design Token 与全局基础层（P0）

目标：先建立“可全局复用”的 Column 化 token，不直接散改组件。

1. 重构全局变量  
文件：`apps/electron/src/renderer/index.css`  
动作：
- 新增语义 token 分层：`--color-surface-*`、`--color-text-*`、`--color-accent-*`、`--elevation-*`、`--radius-*`、`--motion-*`。  
- 引入纸感背景 token（渐变+径向高光）和面板 token（暖白）。  
- 将现有 `--bg-*` / `--text-*` 映射为新语义别名，保证渐进兼容。  

2. 字体系统迁移  
文件：`apps/electron/src/renderer/index.html`、`apps/electron/src/renderer/index.css`  
动作：
- 引入 `Fraunces`（标题）+ `IBM Plex Sans`（正文）+ `Noto Sans SC`（中文）。  
- 约束字体落位：标题、面板标题、会话名使用 display 字体；正文与操作文本使用 body 字体。  

3. 阴影与圆角规范升级  
文件：`apps/electron/src/renderer/index.css`  
动作：
- 统一阴影等级：`--elevation-1/2/3`。  
- 统一圆角等级：`--radius-card`, `--radius-chip`, `--radius-control`。  

### 6.2 框架骨架（TitleBar / Sidebar / Main Canvas）（P0-P1）

1. TitleBar 视觉语义重构  
文件：`apps/electron/src/renderer/components/app-shell/TitleBar.tsx`  
动作：
- 从“纯功能栏”改为“编辑抬头栏”：会话标题强化、元信息标签 chip 化。  
- 图标按钮改为统一 chip/button 语法（默认透明，hover 柔和填充）。  

2. Sidebar 迁移为“目录卡片”  
文件：`apps/electron/src/renderer/components/app-shell/SessionSidebar.tsx`  
动作：
- 会话项新增层级：标题、摘要/状态、时间。  
- active 态由纯色底改为“高亮边+软阴影+色块引导”。  
- 底部操作区与列表语义统一（不做断裂感）。  

3. 主画布背景氛围  
文件：`apps/electron/src/renderer/App.tsx`、`apps/electron/src/renderer/components/chat/ChatArea.tsx`  
动作：
- 主区域叠加低强度背景层（径向光斑/渐变），避免纯平涂。  
- 保持性能优先：仅 CSS 背景，不做高频动画背景。  

### 6.3 Chat 内容层（P1）

1. User / Assistant 消息视觉重构  
文件：`apps/electron/src/renderer/components/chat/UserMessageBubble.tsx`  
文件：`apps/electron/src/renderer/components/chat/TurnCard.tsx`  
动作：
- 用户气泡减少“聊天气泡感”，改为“注释卡片感”。  
- Assistant turn 标题区加入“阶段标签”（Thinking / Running / Responding）。  
- Action buttons 统一为 Column 风格胶囊按钮系统。  

2. Markdown 排版系统  
文件：`apps/electron/src/renderer/components/chat/markdown/Markdown.tsx`  
动作：
- 标题层级、段落间距、列表、表格、blockquote 改成 Column 同源排版语言。  
- code block 改为“轻边框 + 温和底色 + 语言标签”，减少冷硬终端感。  

3. Processing 反馈统一  
文件：`apps/electron/src/renderer/components/chat/ProcessingIndicator.tsx`、`TurnCard.tsx`  
动作：
- 制定统一 loading 动效与文案，避免多个组件各自表达。  

### 6.4 Input 与 Popups（P1）

1. 输入框风格 Column 化  
文件：`apps/electron/src/renderer/components/input/InputToolbar.tsx`  
动作：
- 输入框容器改为“暖白浮卡”，强调可写区域和附加信息层次。  
- 左右按钮全部统一尺寸/形态/交互动效。  

2. 所有弹窗统一控件语法  
文件：`apps/electron/src/renderer/components/input/popups/InputPopups.tsx`  
动作：
- `PopupContainer/Header/Item` 完全统一：圆角、阴影、边框、hover、selected。  
- 标题、分组、列表项字号体系与 token 对齐。  
- 减少“系统菜单感”，强化“编辑工具盘”感。  

### 6.5 Artifact 面板（P1-P2）

1. 改为“阅读优先”的产物工作台  
文件：`apps/electron/src/renderer/components/artifact/ArtifactPanel.tsx`  
动作：
- toolbar 控件 chip 化，文件切换菜单与主系统统一。  
- 预览区背景/边框与 Chat 内容视觉一致。  
- 代码/预览双模式状态更明显（segment control 风格化）。  

### 6.6 Settings 页（P2）

1. 从“系统设置页”改为“编辑式配置页”  
文件：`apps/electron/src/renderer/pages/settings/SettingsPage.tsx`  
动作：
- 左导航和内容卡片采用统一 token。  
- 表单控件（select/input/switch）统一视觉语义。  
- 头部结构简化，聚焦可扫读性。  

### 6.7 散组件补齐（防漏改，必须）

> 以下组件在首次版本中未被明确点名，现补充为必改项。

1. 认证入口  
文件：`apps/electron/src/renderer/components/auth/AuthForm.tsx`  
动作：迁移到新 token、统一表单控件语法、错误态与按钮风格对齐主系统。  

2. 认证守卫空态  
文件：`apps/electron/src/renderer/components/auth/AuthGuard.tsx`  
动作：加载态/错误态背景和文案语气改为 Column 风格，不保留旧底色。  

3. 活动树  
文件：`apps/electron/src/renderer/components/chat/ActivityTree.tsx`  
动作：层级缩进、连线/节点、折叠交互统一到“决策流”视觉语法。  

4. 工具活动行  
文件：`apps/electron/src/renderer/components/chat/ToolActivityRow.tsx`  
动作：状态色、标签、耗时、hover 反馈统一 chip 规则；去除旧风格孤岛。  

5. 权限请求卡片  
文件：`apps/electron/src/renderer/components/chat/PermissionRequest.tsx`  
动作：弹层、代码区、确认按钮改为新主题；确保高风险操作视觉突出但不跳戏。  

---

## 7. Design Token 映射建议（供落地 AI 直接套用）

### 7.1 色彩（建议值）

- `--color-surface-canvas: #f4efe6`  
- `--color-surface-panel: #fff9f0`  
- `--color-surface-elevated: #fffdf7`  
- `--color-text-primary: #1f2522`  
- `--color-text-secondary: #4f5a54`  
- `--color-text-muted: #66716b`  
- `--color-line-soft: #d6cec0`  
- `--color-line-strong: #c9bfae`  
- `--color-accent: #0b6a60`  
- `--color-accent-soft: #e9f6f3`  

### 7.2 阴影

- `--elevation-1: 0 8px 18px rgba(23, 30, 26, 0.06)`  
- `--elevation-2: 0 14px 28px rgba(24, 30, 28, 0.10)`  
- `--elevation-3: 0 22px 35px rgba(25, 32, 29, 0.14)`  

### 7.3 圆角

- `--radius-control: 10px`  
- `--radius-card: 16px`  
- `--radius-pill: 999px`  

### 7.4 动效

- `--motion-fast: 180ms cubic-bezier(0.2, 0.8, 0.2, 1)`  
- `--motion-base: 260ms cubic-bezier(0.22, 1, 0.36, 1)`  
- `--motion-slow: 420ms cubic-bezier(0.19, 1, 0.22, 1)`  

---

## 8. 分阶段实施路线图（完整计划）

### Phase 0：基线与风险控制（0.5 天）

1. 建立“门禁扫描基线”（硬编码颜色/旧变量/旧视觉 class 的当前命中数）。  
2. 建立 token 迁移开关（如 body 增加 `data-theme="column"`），支持灰度切换。  

### Phase 1：基础系统迁移（1-2 天）

1. 落地全局 token、字体、背景、阴影体系。  
2. 改 TitleBar + Sidebar + ChatArea 基础骨架。  

验收：不改交互逻辑，仅视觉已明显呈现 Column 语气。

### Phase 2：核心交互迁移（2-3 天）

1. 改 TurnCard / Markdown / InputToolbar / Popups。  
2. 统一 chip、按钮、状态、hover/active/focus 交互语法。  

验收：主要工作流（发消息-看过程-看结果）风格一致，不跳戏。

### Phase 3：扩展区域与精修（1-2 天）

1. 改 ArtifactPanel + SettingsPage。  
2. 细节 polish：空状态、错误态、动效节奏、暗处对比度。  

验收：全应用视觉一致，无“旧系统残片”。

---

## 9. 验收标准（必须满足）

### 9.1 视觉一致性

1. 任意页面不出现“旧 token 直出颜色”（尤其旧青灰背景与随机白底）。  
2. 字体层级清晰：标题与正文可一眼区分。  
3. 边框使用显著减少，以层次与留白替代分割线。  

### 9.2 交互一致性

1. 所有弹窗开合、悬停、选中样式一致。  
2. 按钮体系统一：主按钮、次按钮、幽灵按钮、chip 按钮语义稳定。  
3. 键盘焦点态清晰且不破坏整体审美。  

### 9.3 可读性与可用性

1. 消息正文、代码块、表格可读性优于当前版本。  
2. 主流程操作步数不增加。  
3. 在 13~14 英寸和 4K 屏均保持层级清晰。  

---

## 10. 风险与规避

1. 风险：风格迁移导致信息密度下降。  
规避：正文字号与行高只微调，不做大幅放大。  

2. 风险：暖色背景下对比度不足。  
规避：文本最小对比度不低于 WCAG AA（普通文本 4.5:1）。  

3. 风险：大量视觉改动引入回归。  
规避：按 Phase 拆分 PR；每 phase 保留扫描记录与关键功能自测记录。  

4. 风险：动效过多影响性能。  
规避：仅保留必要动效；避免大面积实时 blur/复杂滤镜动画。  

---

## 11. 业务逻辑零改动红线（必须）

> 本项目此次迁移定义为“纯设计/表现层改造”。

### 11.1 不可变更范围

1. 不改业务流程与状态机（会话创建、消息发送、权限流程、持久化流程）。  
2. 不改数据结构与类型定义（`@deskhand/core` 的 message/session 等结构）。  
3. 不改 IPC 协议与主进程行为（`electronAPI` 调用语义不变）。  
4. 不改任何影响功能结果的条件分支与副作用。  

### 11.2 允许变更范围

1. CSS / token / 字体 / 间距 / 圆角 / 阴影 / 动效时序。  
2. TSX 中仅与视觉相关的 JSX 结构微调（容器层级、className、展示文案）。  
3. 可访问性增强（ARIA、焦点样式）但不得改变业务行为。  

### 11.3 例外流程（必须审批）

若出现“必须改逻辑才能完成视觉目标”的情况，执行顺序：

1. 先在进度文件记录 `Logic Change Request`（原因、影响、替代方案）；  
2. 拆出单独 commit 与 PR；  
3. 获得明确批准后再合入。未批准不得改。  

### 11.4 逻辑回归闸门（必须）

每个 Phase 完成前，必须确认：

1. 功能路径可用：新建会话、发送消息、停止生成、切换模型/权限、查看 Artifact、打开设置。  
2. 代码审查中未出现业务逻辑差异（仅样式/展示层变更）。  
3. 若存在逻辑差异，必须能关联到已批准的例外单据。  

---

## 12. 反“两不像”强制机制（新增）

> 目标：防止“部分组件新主题、部分组件旧主题”并存。

### 12.1 单一主题入口（必须）

1. 只允许一个顶层主题开关：`html[data-theme="column"]`。  
2. 组件层禁止自行定义“局部新主题开关”。  
3. 任何样式迁移都必须通过全局 token 生效，不允许组件私有色盘。  

### 12.2 样式来源禁令（必须）

1. 禁止新增硬编码颜色（`#xxxxxx`、`rgb(...)`），仅允许 token。  
2. 禁止新增旧命名变量（如 `--bg-primary` 一类历史变量）直接被业务组件消费。  
3. 历史变量只保留在兼容层，由兼容层映射到新语义 token。  

### 12.3 自动扫描门禁（必须）

每个迁移 PR 必须跑 3 条扫描并在 PR 描述贴结果：

1. 硬编码颜色扫描：`rg -n \"#[0-9a-fA-F]{3,8}|rgb\\(|rgba\\(\" apps/electron/src/renderer`  
2. 旧变量引用扫描：`rg -n \"var\\(--bg-|var\\(--text-|var\\(--border-\" apps/electron/src/renderer/components apps/electron/src/renderer/pages`  
3. 旧视觉 class 扫描（按需扩展词典）：`rg -n \"bg-white|border-r|shadow-sm\" apps/electron/src/renderer/components apps/electron/src/renderer/pages`  

规则：
- 扫描命中不一定非法，但必须在 PR 中逐条解释“保留原因/替换计划”。  
- 无解释即不允许合并。  

### 12.4 Phase 准入门槛（必须）

1. Phase 1 结束前，不允许进入 Phase 2，除非：
- 全局 token 与字体迁移完成；
- 核心壳层（TitleBar/Sidebar/ChatArea）样式扫描与功能自测通过；
- 旧变量引用数下降到目标阈值（建议 <= 当前的 30%）。

2. Phase 2 结束前，不允许进入 Phase 3，除非：
- Input/Popups/TurnCard/Markdown 完成统一语法；
- “旧视觉 class 扫描”仅剩可解释白名单。  

### 12.5 白名单与截止日期（必须）

1. 允许短期白名单文件（例如第三方渲染区），但必须在文档登记：文件、原因、截止日期。  
2. 截止日期建议不晚于 2026-03-31；逾期自动升级为阻断项。  

### 12.6 发布前最终闸门（必须）

发布前必须满足：

1. 全局关键页面完成人工巡检（主界面/会话/聊天/输入/Artifact/Settings），无旧主题残片。  
2. 随机抽样 20 个组件，无“旧 token + 新 token 混用”现象。  
3. 设计评审结论明确写“通过/不通过”，不接受“基本可用”。

---

## 13. 长任务执行协议（原子提交 + 磁盘进度）

> 目标：在上下文压缩/会话重开后，仍能无损续跑。

### 13.1 原子提交规则（必须）

1. 一个 commit 只做一个“可验收单元”（例如：仅 Sidebar 视觉迁移）。  
2. 一个 commit 的改动范围建议控制在 1-3 个相关文件；超过 6 个文件默认拆分。  
3. 每个 commit 必须可独立回滚且不破坏运行。  
4. commit message 建议格式：`[column-style][P{phase}][scope] summary`。  

### 13.2 磁盘进度文件（必须）

1. 进度主文件固定为：`docs/plans/2026-03-07-column-style-migration-progress.md`。  
2. 每完成一个原子提交，必须同步更新进度文件中的：
- 当前阶段状态；
- 已完成项；
- Commit 记录；
- 下一步动作（`Next Action`）。  
3. 不允许只在聊天上下文里报进度，不落盘视为未完成。  

### 13.3 会话重开恢复流程（必须）

每次新会话开始，执行顺序固定：

1. 读 `design-plan.md`（本文件）与 `progress.md`；  
2. 读 `git status --short` 与最近 20 条提交；  
3. 仅从 `progress.md` 的 `Next Action` 继续，不从聊天记忆继续；  
4. 如发现冲突，以磁盘文件为准并先写入“冲突说明”再改代码。  

### 13.4 阶段完成定义（必须）

一个 Phase 只有同时满足以下条件才算完成：

1. 代码已提交（原子 commit 完成）；  
2. 进度文件已更新；  
3. 扫描门禁结果已记录；  
4. 关键功能自测结果已写入进度文件。  

---

## 14. 给落地 Codex 的执行提示（简明版）

1. 先做 `index.css` token 体系，不要先散改组件。  
2. 所有组件优先“替换变量引用”，再微调结构。  
3. 每改完一个模块就跑扫描 + 关键功能自测。  
4. 保持逻辑不动，只改视觉与交互表现。  
5. 最后跑一轮“旧样式清理”（搜索硬编码颜色/半成品 class）。  

---

## 15. 全量组件覆盖清单（防漏改）

本次审计范围（`apps/electron/src/renderer/components` + `pages`）共 16 个 TSX 文件，要求 100% 纳入迁移：

1. `app-shell/TitleBar.tsx`（P1）  
2. `app-shell/SessionSidebar.tsx`（P1）  
3. `chat/ChatArea.tsx`（P1）  
4. `chat/TurnCard.tsx`（P2）  
5. `chat/UserMessageBubble.tsx`（P2）  
6. `chat/markdown/Markdown.tsx`（P2）  
7. `chat/ActivityTree.tsx`（P2）  
8. `chat/ToolActivityRow.tsx`（P2）  
9. `chat/ProcessingIndicator.tsx`（P2）  
10. `chat/PermissionRequest.tsx`（P2）  
11. `input/InputToolbar.tsx`（P2）  
12. `input/popups/InputPopups.tsx`（P2）  
13. `artifact/ArtifactPanel.tsx`（P3）  
14. `auth/AuthForm.tsx`（P3）  
15. `auth/AuthGuard.tsx`（P3）  
16. `pages/settings/SettingsPage.tsx`（P3）  

执行规则：
1. 每个 Phase 完成后必须更新“已完成清单”。  
2. 任何未进入清单的新增 TSX 组件，默认阻断发布。  

---

## 16. 参考源文件（本次分析依据）

### Deskhand（当前）

- `apps/electron/src/renderer/index.css`  
- `apps/electron/src/renderer/App.tsx`  
- `apps/electron/src/renderer/components/app-shell/TitleBar.tsx`  
- `apps/electron/src/renderer/components/app-shell/SessionSidebar.tsx`  
- `apps/electron/src/renderer/components/chat/ChatArea.tsx`  
- `apps/electron/src/renderer/components/chat/TurnCard.tsx`  
- `apps/electron/src/renderer/components/chat/UserMessageBubble.tsx`  
- `apps/electron/src/renderer/components/chat/markdown/Markdown.tsx`  
- `apps/electron/src/renderer/components/input/InputToolbar.tsx`  
- `apps/electron/src/renderer/components/input/popups/InputPopups.tsx`  
- `apps/electron/src/renderer/components/artifact/ArtifactPanel.tsx`  
- `apps/electron/src/renderer/pages/settings/SettingsPage.tsx`  

### Column（目标风格源）

- `column/src/styles/global.css`
- `column/tailwind.config.mjs`
- `column/src/layouts/Layout.astro`
- `column/src/components/Header.astro`
- `column/src/components/ReadFlow.astro`
- `column/src/components/TopicCard.astro`  

---

## 17. 最终交付定义

这份文档可作为“设计迁移总规范”。  
建议落地团队按 Phase 建立 3 个独立 PR（基础系统 / 核心交互 / 扩展精修），每个 PR 附扫描结果与 token 变更说明。
