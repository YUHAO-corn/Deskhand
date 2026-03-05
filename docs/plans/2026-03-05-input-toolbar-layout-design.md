# InputToolbar 布局重构 — Q&A 记录

> 日期：2026-03-05
> 对应：InputToolbar 布局调整
> 线框图：`wireframe.html`（项目根目录）

---
## Q0：为什么要改？

按更加清晰的功能层面划分
1.资源层：文件、剪贴板、技能、MCP
2.配置层：Workspace、Permission、Model
3.交互层：playground, this or that

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
