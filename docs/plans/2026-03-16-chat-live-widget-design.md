# Chat 内 Live Widget 设计 Q&A

> 日期：2026-03-16
> 状态：设计确认，待实现
> 目标：在聊天区域中支持 assistant turn 内联的流式可交互 widget，并与输入框桥接。

---

## Q1：这个功能本质上是什么？

它不是 Artifact 预览，也不是右侧面板的缩略版，而是 **assistant turn 的原生内容块**。

用户感知应该像 Claude 这类产品里的可视化回复：

1. AI 先正常输出文字。
2. 说到合适的位置时，开始在同一条回复里“画图”或“搭界面”。
3. 图会随着流式输出逐步出现。
4. 图中元素可以交互，交互结果可以回到聊天输入框，必要时也可以直接发送。

因此，这个功能不是“生成一个 HTML 文件给用户点开”，而是让 ChatArea 自己具备承载轻量可视化回复的能力。

---

## Q2：widget 在 turn 里是临时预览，还是历史内容的一部分？

结论：**是历史内容的一部分，但只保留最终态，不回放生成过程。**

具体规则：

1. Live session 中，用户看到 widget 被逐步画出来。
2. 流结束后，只持久化最终 HTML/SVG 代码。
3. 重新打开会话时，直接渲染最终态，不重放 chunk。

原因很直接：

1. “逐步出现”的动画感属于生成过程体验，不是内容本身。
2. 用户回看历史时，核心诉求是看到最终图和可交互控件，而不是再看一遍绘制过程。
3. 持久化 chunk 日志或中间快照，复杂度很高，收益很低。

---

## Q3：流式协议选什么？

结论：**选 A，纯增量注入。**

不选“整体快照替换”或“节流版快照刷新”，因为它们都给不了“边说边画”的感觉。用户要看到的是元素逐步出现，而不是整个 iframe 一闪一闪地整体重绘。

这里的关键不是换协议，而是在渲染层补两个机制：

1. **标签完整性缓冲层**
   token 先进入 buffer，不直接喂给 iframe。
   只有检测到一段合法、完整的 HTML/SVG 片段后，才 append 进 DOM。

2. **脚本延迟激活**
   流式阶段把 `<script>` 改为阻塞态，不立即执行。
   等 `widget_complete` 到达，再统一激活。

一句话总结：**流式协议保持纯增量，稳定性靠缓冲与延迟执行兜底。**

---

## Q4：点击 widget 后，是填入输入框，还是直接发送？

结论：**协议同时支持两者，但默认是填入输入框。**

推荐桥接接口：

```ts
sendPrompt(text)
sendPrompt(text, { submit: true })
```

语义如下：

1. `sendPrompt(text)`：只把文本放进输入框，不自动发送。
2. `sendPrompt(text, { submit: true })`：由宿主侧触发真正的发送流程。

这样做的原因：

1. 默认填入输入框更安全，避免 widget 替用户误发消息。
2. 直接发送在“明确 CTA”场景里仍然可用，比如“继续解释这个节点”或“按这个方案展开”。
3. 宿主保留最终控制权，后续可以在用户正编辑 draft 时增加保护逻辑。

---

## Q5：一个 assistant turn 里允许几个 live widget？

结论：**先限制为每轮最多一个。**

这样做的原因不是保守，而是为了控制第一版复杂度：

1. 一个 turn 只需要维护一套 widget 生命周期。
2. 只需要一个 buffer、一个 iframe、一套桥接、一套高度同步。
3. `TurnCard` 中的展示位置和状态管理都更清晰。
4. 避免模型滥用，一轮回复里堆出多个交互块，破坏聊天感。

如果后续真有“一轮多个交互中心”的需求，再把数据结构升级成列表。

---

## Q6：widget 在 turn 里的默认位置放哪？

结论：**放在 assistant 正文之后。**

原因：

1. 流式场景下通常是文字先到，widget code 后到。
2. 放在正文后面最符合自然渲染顺序，不需要后插内容导致正文整体下移。
3. 可以减少 turn 高度的二次跳动。

因此，一个 assistant turn 的顺序为：

1. Activity 区
2. 正文 Markdown
3. Live Widget Block
4. Action buttons（若有）

---

## Q7：widget 的来源协议是什么？

结论：**必须走专门的 tool call，不从 Markdown 代码块里解析。**

推荐做法：

1. Agent 调用 `show_widget` 之类的专用工具。
2. 该工具触发专门的 widget 事件流。
3. 正文继续走现有 `text_delta/text_complete` 通道。
4. widget 走独立的 `widget_chunk/widget_complete/widget_error` 通道。

不选“在 Markdown 里塞特殊代码块再由前端提取”，因为那样会把 UI 解析和自然语言流混在一起，容错更差，持久化也更难定义。

---

## Q8：chat 内 widget 的能力边界是什么？

结论：**先做轻量沙箱，不做复杂 app。**

第一版边界：

1. 只承载轻量 HTML/SVG 可视化与局部交互。
2. 支持基础内联 CSS 和基础 JS。
3. 通过宿主注入的 `sendPrompt` 与聊天系统通信。
4. 不开放复杂外部能力，不把它做成完整网页运行时。

对应的产品边界也要明确：

1. 适合解释图、流程图、局部可交互 mock、小选择器、小问答组件。
2. 不适合大型 playground、复杂多页应用、重资源内容。
3. 复杂场景继续走 Artifact Panel。

---

## Q9：渲染管道和提示词层的关系是什么？

结论：**先做渲染管道，再做提示词层。两者是关联的，但不应混在一个开发阶段里。**

当前设计明确拆成两块：

1. **渲染管道**
   解决“模型产出的代码，如何稳定显示在 ChatArea 里”。

2. **内容生成 / 提示词层**
   解决“模型什么时候该调 `show_widget`，调了之后该画什么，遵循什么设计规范”。

目前先做第一块。等管道打通后，再进入第二块：

1. 用手写 HTML/SVG 通过 `show_widget` 验证渲染效果。
2. 管道稳定后，再设计 system prompt 路由规则。
3. 再决定是否增加 `read_me` 工具和按需加载的规范文档。

相关参考：

1. `docs/plans/pipeline_vs_content_architecture.html`
2. `docs/plans/full_request_lifecycle.html`
3. `docs/plans/a2ui_full_architecture.html`

---

## Q10：在这个仓库里，真实的实现落点在哪里？

### 10.1 协议与类型层

需要修改：

1. `packages/core/src/types/event.ts`
   新增 `widget_chunk`、`widget_complete`、`widget_error` 等事件类型。

2. `packages/core/src/types/message.ts`
   给 `Message` / `StoredMessage` 增加 `widget` 字段，用于持久化最终代码与运行态元信息。

### 10.2 Agent 事件接入层

需要修改：

1. `apps/electron/src/renderer/hooks/useAgentEvents.ts`

职责：

1. 识别 `show_widget` 对应的 tool start。
2. 接收 widget 流式事件并更新对应 message。
3. 在 complete 时只持久化最终代码。

### 10.3 Turn 组装与 UI 层

需要修改：

1. `apps/electron/src/renderer/components/chat/turn-utils.ts`
   提取 turn 级唯一 widget。

2. `apps/electron/src/renderer/components/chat/TurnCard.tsx`
   在正文后插入 live widget block。

建议新增：

1. `apps/electron/src/renderer/components/chat/LiveWidgetFrame.tsx`
   封装 iframe、buffer、桥接、高度同步与脚本激活。

如实现中需要拆开字符串模板或宿主注入脚本，可再新增：

1. `apps/electron/src/renderer/components/chat/live-widget/runtime.ts`
2. `apps/electron/src/renderer/components/chat/live-widget/buffer.ts`

### 10.4 Agent / tool 侧

需要检查并按实际接入方式修改：

1. `packages/shared/src/agent/*`
2. `packages/shared/src/agent/index.ts`
3. 未来新增或接入 `show_widget` tool 的位置

目标不是在这里一次性定义完整提示词系统，而是先确保 tool 能把 widget 相关事件发到 renderer。

---

## Q11：第一版的核心风险是什么？

### 风险 1：标签缓冲误判

不能简单地“看到一个 `>` 就 append”，否则属性值、注释、`style`、`script`、SVG 嵌套都可能出问题。

建议：

1. 做一个有限状态的轻量 parser。
2. 只在确认片段完整时提交给 iframe。

### 风险 2：DOM 注入方式不稳

不要在流式过程中反复 `document.write` 或整体覆盖 `srcDoc`。

建议：

1. iframe 初始化后有一个固定 `#widget-root`。
2. 合法片段统一 append 到这个 root 下。

### 风险 3：高度同步抖动

SVG 或复杂布局连续增长时，会频繁触发高度变化。

建议：

1. iframe 内用 `ResizeObserver`。
2. 对 postMessage 回传做节流。

### 风险 4：自动发送误触

即使协议支持 `submit: true`，宿主也不能无脑发。

建议：

1. 默认只填入输入框。
2. 自动发送场景由宿主仲裁。
3. 后续可以加“输入框非空时不自动发”的保护。

---

## Q12：建议的开发顺序是什么？

### Phase 1：渲染管道打通

1. 定义 widget 事件类型。
2. 让 Agent/tool 能发出 widget 事件。
3. renderer 能接收并在 turn 内渲染 iframe。
4. 手写 HTML/SVG 验证：
   - 能流式出现
   - 高度自适应正常
   - `sendPrompt` 可用
   - 历史恢复显示最终态

### Phase 2：稳定性收口

1. 完善 buffer 规则。
2. 处理脚本延迟激活。
3. 处理异常、超长内容、iframe 错误态。

### Phase 3：提示词层 / 内容生成

1. 设计 system prompt 路由规则。
2. 明确什么时候用 `show_widget`。
3. 视需要增加 `read_me` 工具。
4. 编写具体的设计规范文档和 few-shot 示例。

---

## Q13：第一版验收标准是什么？

满足以下条件即可认为“渲染管道跑通”：

1. assistant turn 中可在正文后显示 live widget。
2. widget 可随 chunk 流式增长，而不是整页替换闪烁。
3. iframe 高度能随内容变化自动同步。
4. 流式阶段脚本不会提前执行。
5. 流结束后脚本可激活，交互可用。
6. `sendPrompt(text)` 能把内容送入输入框。
7. `sendPrompt(text, { submit: true })` 能走宿主发送链路。
8. 关闭并重新打开会话时，widget 直接显示最终态。

---

## Q14：本次设计刻意不解决什么？

以下内容明确延后，不进入本次“渲染管道实现”范围：

1. 什么时候该自动触发 `show_widget`
2. 哪些任务适合用 widget、哪些不适合
3. read_me 工具的最终形态
4. widget 视觉设计规范与代码模板
5. 多 widget per turn
6. 富能力 mini-app 沙箱

这样拆分的原因很简单：先把水管接通，再调水的配方。

---

## Q15：Vertical Slice 应该怎么切？

结论：**先切得更细，先验证“能塞进去”，再验证“能被实时塞进去”。**

不建议第一刀就直接接真实 agent/tool 链路。因为这个功能横跨：

1. tool 定义
2. agent 事件发射
3. renderer 状态更新
4. turn 内嵌 iframe runtime

如果一开始全连上，任何一层出问题，定位都会很慢。

更合理的做法是分 4 个 vertical slice：

### VS1：静态 widget 容器

目标：

1. 先不接真实 agent。
2. 在 renderer 里用本地 mock 数据，给一个 assistant turn 塞入最终 HTML/SVG。
3. 验证 widget 能稳定显示在正文后。

验收：

1. `TurnCard` 能稳定渲染 `LiveWidgetFrame`。
2. 静态 HTML/SVG 显示正常。
3. 高度自适应正常。
4. 不影响现有 turn 渲染结构。

### VS2：假流式

目标：

1. 仍然不接真实 agent。
2. 用前端定时器按 chunk 模拟 widget 增量到达。
3. 验证 buffer、增量 append 和“边画边长”的视觉效果。

验收：

1. chunk 是逐步长出来的，不是整页替换。
2. 半截标签不会破坏 DOM。
3. 高度变化可控，没有明显抖动或闪烁。

### VS3：真实事件流接入

目标：

1. 接入 `show_widget` 和真实 widget 事件。
2. 让 `useAgentEvents` 能把 widget 流正确写入对应 message。
3. turn 层按真实 session 数据渲染 widget。

验收：

1. `widget_chunk/widget_complete/widget_error` 事件能走通。
2. 当前 turn 能正确关联唯一 widget。
3. 不影响现有 text/tool/activity 渲染链路。

### VS4：交互与持久化

目标：

1. 加入 `sendPrompt(text, { submit? })` bridge。
2. 完成脚本延迟激活。
3. 完成最终态持久化与历史恢复。
4. 补错误态、异常态和边界处理。

验收：

1. widget 完成后交互可用。
2. `sendPrompt` 默认填入输入框，可选直接发送。
3. 关闭并重开会话后，最终态可直接显示。
4. 脚本不会在流式阶段提前执行。

这个切法的核心思想是：

1. 先把问题缩成纯前端嵌入问题。
2. 再验证流式 runtime。
3. 最后才把 agent/tool 链路和持久化接上。

这样每一刀都能独立验收，失败时也更容易定位。

---

## Q16：VS3 验证后的真实结论是什么？

结论：**当前基于 MCP `show_widget` tool input 的真实链路，已经能跑通完成态渲染，但拿不到我们需要的流式 code delta。**

已经验证成功的部分：

1. 模型可以调用真实的 `show_widget` tool。
2. renderer 可以把该 tool 的最终代码渲染成 chat 内 widget。
3. `show_widget` 的工具痕迹可以从 Activity 区隐藏，不让界面看起来像“露出工具调用”。
4. 历史里可以保留最终态 widget。

已经验证失败的部分：

1. 在当前 `Claude Agent SDK + MCP tool` 路径下，没有拿到 `input_json_delta`。
2. 因此 `widget_chunk` 在真实链路里没有触发。
3. 结果是：真实 `show_widget` 目前只能“最终一下子出现”，不能“边生成边画”。

这不是 renderer 的 bug，也不是少写了一层 buffer，而是**事件源没有提供工具输入的流式增量**。

这条结论非常重要，因为它说明：

1. “MCP tool 被真实调用”不等于“tool input 可以流式拿到”。
2. 如果继续沿着当前 MCP tool input 路线深挖，大概率只是在错误方向上耗时间。

---

## Q17：下一阶段应该走哪条路线？

结论：**推荐方案 B：设计一条独立于 MCP tool input 的 widget streaming 通道。**

当前有两条候选路线：

### 路线 A：继续深挖 SDK / SSE 原始事件

思路：

1. 再往更底层拿原始流事件。
2. 确认 SDK 是否在别处暴露了工具输入增量，只是当前封装层没接到。

优点：

1. 如果拿到了原始 delta，可以保留“tool call 即渲染协议”的一致性。

缺点：

1. 风险大，不确定 SDK 是否真的暴露了我们需要的字段。
2. 可能继续投入后，结论仍然是“没有”。

### 路线 B：独立 streaming 通道

思路：

1. 不再依赖 MCP tool input 本身流式传 code。
2. 设计一条专门的 widget streaming 协议，把代码增量作为独立事件通道发送给 renderer。
3. `show_widget` 或其他 tool 只负责“建立 widget 生命周期 / 最终确认”，不承担 code delta 的运输。

优点：

1. 协议和渲染目标更一致，直接围绕“live widget”设计。
2. 不受 MCP tool input streaming 能力限制。
3. 更容易精确控制 chunk、complete、error、script activation 等生命周期事件。

缺点：

1. 需要重新定义一层 agent -> renderer 的专用协议。
2. 不再是“只靠现有 MCP tool 就自然获得流式”。

本轮讨论后的推荐是：**优先走路线 B。**

原因不是偏好，而是因为路线 A 已经通过一次真实验证暴露出明显的不确定性，而路线 B 至少能把“边生成边画”作为一等目标来设计。

---

## Q18：如果换一个窗口继续做，下一位 Codex 最需要知道什么？

进入下一窗口时，最重要的上下文不是“我们已经写了哪些代码”，而是这三条结论：

1. **VS1 已完成**
   ChatArea 中已经能在 assistant turn 正文后渲染独立 widget block。

2. **VS2 已完成**
   前端 fake streaming + iframe 增量渲染 runtime 已验证可行，说明 renderer 侧的“纯增量注入”方向成立。

3. **VS3 部分完成，且关键结论已拿到**
   真实 `show_widget` tool 已打通完成态显示，但当前 MCP tool input 路线无法提供 live code delta。

因此，下一窗口不应该再花时间重复验证：

1. widget 能不能嵌在 turn 里
2. iframe buffer 能不能工作
3. MCP `show_widget` 能不能显示最终态

下一窗口应该直接从新的协议设计开始，重点讨论：

1. 独立 streaming 通道的事件模型
2. 它与 `show_widget` 的关系
3. 如何让 Agent 在运行时同时管理“正文流”和“widget 流”

---

## 附：本次讨论的结论清单

1. widget 是 assistant turn 的原生内容块。
2. 每轮最多一个 widget。
3. 放在正文之后。
4. 走专用 tool call，不从 markdown 提取。
5. 协议选纯增量注入。
6. 通过缓冲层保证只注入完整标签。
7. 流式阶段阻塞脚本，完成后再激活。
8. 历史只存最终 HTML/SVG。
9. `sendPrompt` 默认填入输入框，支持参数控制直接发送。
10. 第一阶段只做轻量 chat widget，复杂场景继续走 Artifact。
11. 开发顺序按 4 个 vertical slice 推进：静态容器 → 假流式 → 真事件流 → 交互与持久化。
12. 当前 MCP `show_widget` 真实链路只能完成态显示，拿不到我们要的流式 code delta。
13. 下一阶段推荐改走独立于 MCP tool input 的 widget streaming 通道。
