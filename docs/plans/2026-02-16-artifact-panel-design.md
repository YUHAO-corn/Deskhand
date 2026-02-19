# Artifact Panel Design — Q&A 记录

> 日期：2026-02-16
> 对应：Phase 5（Artifact 面板）

---

## Q1: 为什么需要 Artifact Panel？

**结论：让 agent 的产出物可见、可感知。**

关键线索：
- agent 能操作整个电脑的文件，不限于某个目录
- 用户每次去 Finder 找文件太麻烦
- 只展示某个目录的话，被操作的文件不一定在范围内
- MD/HTML/Mermaid 等文件渲染前难以阅读，非技术者没有趁手工具
- 没有这个面板，agent 说"我创建了 index.html"跟 ChatGPT 没区别

## Q2: 核心定位？

**结论：agent 产出物的渲染查看器，默认展示渲染效果而非源码。**

讨论过的方案：
- A: 展示文件（偏开发者）— 文件树、代码高亮、diff
- B: 展示效果（偏非技术者）— 渲染后的网页、文档、图表
- C: 不需要独立面板 — 在聊天流里内联展示

选择 B，理由：
- Deskhand 面向非技术者，技术用户会选 Cursor 等 IDE
- 非技术用户不关心源码，关心"成品"
- "帮我做个网页" → 直接看到渲染后的网页，这才是差异化体验

## Q3: 多文件怎么组织？UI 结构怎么调？

**结论：单文件聚焦 + 侧边 artifact 列表。去掉顶部 4 个 tab。**

讨论过的方案：
- A: 平铺列表 — 按时间排列
- B: 标签页切换 — 每个文件一个 tab
- C: 单文件聚焦 — 侧边列表可切换，同一时间只展示一个文件

选择 C，理由：
- 现有 UI 已经是左 200px + 右预览的布局，直接复用
- 非技术用户一次只需关注一个产出物

UI 变化：
- 去掉 4 个 tab（Files/Changes/Terminal/Browser）— Changes 和 Terminal 是开发者概念，Browser 合并到预览
- 左侧 200px：artifact 列表，按操作时间排序，显示文件名 + 类型图标
- 右侧：渲染预览区，默认 preview 模式
- 保留 code/preview 切换，但默认 preview
- 保留复制、刷新按钮
- 每个 artifact 项提供"在 Finder 中打开"

## Q4: 数据怎么捕获？

**结论：从工具事件中实时提取。**

讨论过的方案：
- A: 监听 tool_start/tool_result 事件，Write/Edit 时提取文件路径
- B: 从 tool_use 消息内容中解析

选择 A，理由：
- useAgentEvents.ts 已经在处理这些事件，加个分支就行
- 实时性好，agent 一写文件面板就响应
- Bash 间接创建文件的情况先不管，后续再补

流程：
1. agent 调用 Write/Edit → tool_start 事件
2. 提取文件路径 → IPC 读取文件内容
3. 加入 artifactsAtom → 面板自动打开并选中
4. 同一文件多次编辑不重复，预览自动刷新

## Q5: 第一版支持哪些文件类型？

**结论：HTML + Markdown + 图片，其他代码高亮兜底。**

- HTML — iframe 渲染（最有冲击力的场景）
- Markdown — 格式化文档（非技术用户最常遇到）
- 图片（png/jpg/svg）— 直接展示
- 其他 — 代码高亮兜底，后续可扩展 Mermaid、CSV 等

## Q6: HTML 渲染的安全策略？

**结论：iframe sandbox 基本放开，允许脚本和外部资源。**

讨论过的方案：
- A: 完全沙箱 — 不加载外部资源，不执行 JS
- B: 允许外部资源，不执行 JS
- C: 基本放开 — allow-scripts，不加 allow-same-origin，srcdoc 注入
- D: Electron webview — 独立进程

选择 C，理由：
- agent 生成的 HTML 大概率用 Tailwind CDN 等外部资源，不让加载页面就废了
- `sandbox="allow-scripts"` 不加 `allow-same-origin`，通过 srcdoc 注入内容
- 无法访问父窗口、本地文件系统、Electron API
- 跟 Claude.ai Artifacts 做法一致
- webview 在新版 Electron 中不推荐，且复杂度高

## Q7: Artifact 列表是否持久化？

**结论：跟随会话持久化，存文件路径数组。**

讨论过的方案：
- A: 不持久化 — 关 app 就没了
- B: 跟随会话持久化 — 存在会话元数据里
- C: 不持久化，提供"在 Finder 中打开"按钮

选择 B，理由：
- 打开历史对话，聊天记录写着"我创建了 index.html"但面板是空的 — 体验割裂
- 实现简单：会话元数据里存 `artifacts: string[]`（文件路径数组）
- 打开会话时检查文件是否还在磁盘上，不在的标灰或移除
- 不缓存文件内容，每次从磁盘实时读取

---

## Vertical Slice 实现计划

### Slice 1：最小端到端链路（纯文本）

目标：agent 写文件 → 面板自动弹出并显示内容

- 监听 Write/Edit 工具事件 → 提取文件路径 → 加入 artifactsAtom
- 去掉 4 个 tab，简化为单一视图
- 左侧显示 artifact 列表（文件名 + 路径）
- 点击 artifact → IPC 读取文件内容 → 右侧显示纯文本
- 面板在首个 artifact 出现时自动打开
- 验收：让 agent 写个文件，面板自动弹出并显示内容

### Slice 2：渲染能力

目标：agent 做网页 → 面板里直接看到渲染效果

- HTML → iframe sandbox 渲染（srcdoc 注入，allow-scripts）
- Markdown → 格式化文档渲染
- 图片（png/jpg/svg）→ 直接展示
- code/preview 切换（默认 preview）
- 其他文件 → 代码高亮兜底
- 验收：让 agent 做个网页，面板里直接看到渲染效果

### Slice 3：持久化 + 体验打磨

目标：关掉 app 重开，历史对话的 artifact 还在

- artifact 路径存入会话元数据（`artifacts: string[]`）
- 打开历史会话时恢复 artifact 列表
- 文件不存在时标灰处理
- "在 Finder 中打开"按钮
- artifact 列表项的图标和样式优化
- 验收：关掉 app 重开，历史对话的 artifact 还在
