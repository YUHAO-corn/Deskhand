# InputToolbar 布局重构 — Q&A 记录

> 日期：2026-03-05
> 对应：InputToolbar 布局调整
> 线框图：`wireframe.html`（项目根目录）

---
## Q0：为什么要改？

按更加清晰的功能层面划分
1.资源层：文件、剪贴板、技能、MCP
用户视角：我要添加什么内容？
2.配置层：Workspace、Permission、Model
用户视角：我要智能体做到什么水平？
3.交互层：playground, this or that
用户视角：我要怎么和智能体交互？

## Q1: 整体布局怎么调整？

**结论：分「输入框内」和「输入框外」两层。**

原布局：所有按钮都在输入框内底部工具栏，左图标右文字一字排开。

新布局：
```
┌─────────────────────────────────────┐
│ Type a message...                    │
│                                      │
│ [+] [/]                          [↑] │
└─────────────────────────────────────┘
 Deskhand ▾   Ask ▾              Opus 4.5 ▾
```

- **输入框内**：只放直接影响「这条消息」的操作 — 附件/interact + 发送
- **输入框外下方**：放 agent 级配置 — Workspace、Permission、Model

## Q2: [+] 按钮点击后弹什么？

**结论：一级菜单分三组，带二级子面板。**

一级菜单：
```
Attach
  Upload files          （直接打开文件选择器）
  Clipboard history  >  （进入二级面板）
─────────
Skills
  Skills             >  （进入二级面板）
─────────
MCP
  MCP Connections    >  （进入二级面板）
```

点击带 `>` 的项进入二级子面板，子面板左上角有 `<` 返回按钮。

## Q3: Clipboard history 子面板长什么样？

**结论：紧凑列表，一行一条，按时间分组。**

```
< Clipboard history
─────────
Just now
  [T] const handleClick = () => ...     482 chars
  [T] https://api.example.com/v2        link
Earlier
  [I] Screenshot 2026-03-05             image
```

相比之前的独立大面板，改为 `+` 菜单的二级子面板，风格统一、更紧凑。
缩略图更小，一行展示标题即可。

## Q4: Skills 子面板长什么样？

**结论：已安装列表 + 安装入口。**

```
< Skills
─────────
  [on] playground                       active
  [on] frontend-design                  active
  [on] find-skills                      active
  [on] skill-creator                    active
─────────
  [+]  Install skill...
```

## Q5: MCP Connections 子面板长什么样？

**结论：已连接 server 列表 + 添加入口。**

```
< MCP Connections
─────────
Connected
  [--] Figma                            3 tools
  [--] Linear                           5 tools
─────────
  [+]  Add MCP server...
```

MCP 是外部服务连接（Figma、Linear、GitHub 等），通过 MCP 协议提供工具。
与 Skills（内置插件系统）是不同的概念，UI 上分开展示。

## Q6: [/] interact 按钮弹什么？

**结论：保持不变，两个选项。**

```
Interact mode
  [ps] Pick a Style
  [tt] This or That
```

## Q7: 底部配置栏的布局？

**结论：左侧 Workspace + Permission，右侧 Model。**

```
 Deskhand ▾   Ask ▾              Opus 4.5 ▾
 └─左对齐─┘                      └─右对齐─┘
```

每个都有向上弹出的选择面板，和输入框内的弹窗风格一致。

## Q8: 弹窗定位规则？

**结论：贴近触发按钮，向上弹出。**

- 输入框内按钮（+、/）→ 弹窗从输入框上方弹出，左对齐到按钮位置
- 配置栏按钮（Workspace、Permission）→ 弹窗从配置栏上方弹出，左对齐
- Model → 弹窗从配置栏上方弹出，右对齐

## Q9: 弹窗组件规范

**问题：各弹窗样式各自为营，没有统一的列表项组件。**

现状：
- `PopupContainer` 和 `PopupHeader` 存在但用法不统一
- Workspace/Interact 用旧的大标题 PopupHeader（14px + 描述段落）
- Skills/MCP/Clipboard 用自己写的返回按钮 header（13px）
- 每个弹窗的列表项都 inline 写样式，导致间距/图标/字号不一致

**结论：抽出一套共享原子组件，所有弹窗强制使用。**

```
PopupContainer      — 外层容器（已有，保留）
PopupHeader         — 标题行，统一为：可选返回按钮 + 标题（13px semibold）
PopupSectionLabel   — 分组标签（10px uppercase tracking-wider）
PopupItem           — 列表项（icon 16px + label font-size-sm + 可选 hint/箭头）
PopupDivider        — 分隔线（h-px mx-2 my-1）
```

标准尺寸规范（以 AttachMenuPopup 为基准）：
- 弹窗内容区 padding: `p-1.5`
- 列表项: `p-2 px-2.5`, `gap-2.5`
- 列表项图标: `16px`
- 列表项文字: `var(--font-size-sm)` (~13px)
- 列表项 hint: `var(--font-size-xs)` (~11px)
- 分组标签: `10px`, uppercase, `px-2.5 pt-2 pb-1`

## Q10: 视觉一致性问题清单

**1. 配置栏文字太小**
- 现状：`11px`，相对弹窗内文字（13px）差距过大
- 修复：改为 `var(--font-size-sm)`（~13px），下拉箭头等比

**2. Workspace 弹窗标题风格不统一**
- 现状：用旧的 PopupHeader（14px 粗体 + 描述段落）
- 修复：改为统一的 PopupHeader（13px 标题行），去掉描述段落

**3. Interact 弹窗标题风格不统一**
- 现状：同上，14px 标题 + 描述 + 每项有副标题
- 修复：改为统一的 PopupHeader，列表项改为单行

**4. Model 弹窗不需要搜索框**
- 现状：顶部有搜索框，但只有 4 个选项
- 修复：去掉搜索框，直接列表

**5. Permission 没有弹窗**
- 现状：点击直接切换 Ask/Auto，用户不知道含义
- 修复：改为弹窗选择，每项带简短说明，和 Model 弹窗风格一致

**6. 各弹窗间距/图标不统一**
- 修复：全部使用 Q9 定义的共享组件
