# 共享员工（Shared Employee）实现方案 Q&A

_日期：2026-03-27_

---

## Q1：我们到底想做什么？

不是做一个叫“共享员工”的孤立功能，而是让 Deskhand 支持一种新的工作模式：

- 多个人可以围绕同一个 agent 协作
- agent 能识别“谁在说话”
- 不同的人对 agent 有不同控制权
- agent 有共享的长期记忆和规则

一句话定义：

> 在 Deskhand 里新增一种 `Shared Mode`，让 agent 从“我的本地助手”变成“多人可协作的共享代理”。

---

## Q2：为什么值得做？

因为这是 Deskhand 相比普通单人 agent 更可能形成差异化的地方。

当前单人 agent 的问题是：

- 只能服务一个人
- 只能在一个人的上下文里工作
- 不能处理真实团队里的协作关系

而 Shared Mode 想解决的是：

- 多人同时需要一个 agent 协助
- 但不是所有人都能直接命令它
- agent 需要记住团队偏好，而不是只记住某个用户

这个能力不是换 system prompt 就能补出来的，它需要运行时支持。

---

## Q3：为什么不能直接在现有聊天上改？

因为现有本地聊天和共享协作的约束完全不同。

现有本地聊天的心智是：

- 我选一个本地目录
- agent 在这个目录里帮我做事
- 当前用户就是唯一的控制者

共享协作的心智是：

- 多个人围着同一个 agent 说话
- agent 要知道谁能聊天、谁能指挥、谁能审批
- `cwd` 只是执行配置，不再是最核心概念

如果硬塞进一个模式里，会出现三个问题：

1. 本地体验变差
2. `cwd` 语义混乱
3. session 模型越来越多条件分支

结论：

> Shared Employee 应该是一个独立模式，不应该直接污染现有 Local Chat。

---

## Q4：最终应该是什么产品形态？

建议明确分成两种模式：

### Local Mode

- 一人一 agent
- 继续沿用当前 Deskhand 主路径
- session 绑定本地 `workingDirectory`
- 解决“我在自己电脑上让 agent 干活”

### Shared Mode

- 多人围绕一个 agent 协作
- conversation 绑定 shared workspace
- `cwd` 只是运行时配置
- 解决“多人共同驱动一个 agent”

关键原则：

- session 不共用
- `sdkSessionId` 不共用
- 存储不共用
- UI 可以切换，但语义不能混

---

## Q5：为什么要把 Local 和 Shared 分轨？

因为这不是一个“加几个字段”的扩展，而是两种 interaction model。

Local 的核心是：

- `cwd`
- 本地文件操作
- 单用户权限

Shared 的核心是：

- participants
- policy
- workspace
- 协作消息流

如果用一个统一的大 `Session` 去撑两边，最后大概率会变成：

- 到处 `if local / if shared`
- toolbar、sidebar、storage、message 全部变脆
- AI 开发时也会被错误的“统一抽象”带偏

所以更稳的方式是：

- UI 层可以统一叫“会话”
- 领域层分成 `LocalSession` 和 `SharedConversation`

---

## Q6：`cwd` 和 shared workspace 到底是什么关系？

这是最容易混淆的地方，必须先说清。

### 在 Local Mode 里

`cwd` 是主入口。

用户心智是：

- 选一个目录
- agent 在这个目录里工作

因此：

- `cwd` 绑定 session
- 中途不能乱改
- 换目录基本等于新建 session

### 在 Shared Mode 里

shared workspace 才是主入口。

它表达的是：

- 这个共享员工是谁
- 这个共享员工怎么工作
- 它记住了什么
- 谁能指挥它

而 `cwd` 只是在需要真实操作文件时，给 agent 的执行上下文。

结论：

> Shared workspace 不是 Local `workingDirectory` 的替代品。

前者是协作状态，后者是执行环境。

---

## Q7：Shared Mode 最小需要哪些能力？

我认为最小闭环只需要 4 个能力：

1. **多人消息进入同一个 conversation**
2. **participant 级权限判断**
3. **共享 workspace / memory**
4. **串行 runtime**

先不要一上来做：

- 并发调度
- 专门的 agent discovery 协议
- 复杂多渠道抽象
- 全自动 memory 写入体系

Shared 先证明它在单条协作链路上成立，再扩。

---

## Q8：Shared Mode 的最小权限模型是什么？

先不要设计太复杂，最小先区分三件事：

1. `can_message`
   - 能不能跟 agent 说话

2. `can_command`
   - 能不能把消息当成正式指令

3. `can_approve_tools`
   - 能不能批准危险操作

这三个动作已经足够覆盖你原先想的三种模式：

- 共享员工
- 可交流但不可支配
- agent 对 agent

第一版 capability 可以非常少：

- `message`
- `command`
- `approve`

先别做太多角色系统。

---

## Q9：消息怎么进 agent？要不要大改 SDK 用法？

不需要先大改。

Deskhand 已经有两个很关键的基础：

- `sdkSessionId`
- `resume`

所以第一版最稳的方式是：

- 继续复用现有 `DeskhandAgent`
- 继续用 Claude Agent SDK 的会话续接能力
- 只是在每次输入前，把“谁发的、他有没有 command 权限、当前 conversation 是什么”格式化进 prompt

也就是说，第一版不需要先重做底层 agent runtime，只需要补一层 SharedConversation runtime。

---

## Q10：Shared Mode 的 workspace 最小怎么设计？

建议先非常克制，目录就这些：

```text
~/.deskhand/workspaces/{workspaceId}/
  AGENTS.md
  MEMORY.md
  POLICY.md
```

这三个文件已经够表达第一版：

- `AGENTS.md`
  - 这个共享员工的工作方式

- `MEMORY.md`
  - 团队长期事实和上下文摘要

- `POLICY.md`
  - 谁能说话、谁能指挥、谁来审批

第一版不建议把 memory 设计得太自动化。

更稳的方式是：

- 先把 workspace 当成共享上下文来源
- memory 更新先走保守路径
- 不要急着让 agent 无限自写长期记忆

---

## Q11：Shared Mode 的 runtime 应该是什么样？

我建议非常简单：

> 一个 SharedConversation 对应一个串行消息队列和一个 agent 会话。

也就是：

- 同一个 conversation 的消息按顺序处理
- 当前 agent 忙时，新消息排队
- 完成一轮再处理下一条

先不要并发。

原因：

1. Claude SDK 的 `resume` 天然更适合串行线程
2. 多人同时说话时，串行更容易解释
3. 可以先验证价值，不被调度问题拖死

---

## Q12：渠道接入应该什么时候做？

不要一上来先接真实渠道。

更稳的路径是：

1. 先在 Electron 内做出 Shared Mode 的壳
2. 再在本地模拟多 participant
3. 再补审批链路
4. 最后接第一个真实渠道

如果直接先接飞书，会很容易把“渠道接入”误当成“产品验证”。

但真正需要先验证的是：

- 多人围绕一个 agent 协作到底有没有产品价值
- “只能讨论”和“可以指挥”这两个权限层次在实际交互里是否成立

---

## Q13：为什么要用 vertical slice，而不是先写完整架构？

因为 Shared Mode 风险很高，最怕这种情况：

- 先做了一堆看起来合理的基础设施
- 结果最核心的用户假设没有成立

所以这里更重要的不是“架构完整”，而是“尽快证明最危险的点”。

换句话说：

> 不是先把 Shared 做完整，而是先证明 Shared 值得做下去。

---

## Q14：推荐的 vertical slices 是什么？

我建议按下面的顺序推进。

### Slice 0：Local 不退化

目标：

- 在引入 mode 概念后，确保现有 Local 体验完全不退化

要验证的事：

- 引入 `Local / Shared` 后，现有本地聊天是不是还能像现在一样工作
- `workingDirectory` 心智有没有被破坏

如果这一步都做不稳，就不要继续 Shared。

### Slice 1：Shared Shell in Electron

目标：

- 先把 Shared 当成一个独立模式立起来

实现思路：

- 支持 `New Shared Agent`
- Shared 走独立存储和独立 session 边界
- UI 上能看出“我现在不是 Local Chat”

要验证的事：

- Shared 能不能不依赖 Local 的 `workingDirectory` 心智而存在

### Slice 2：Fake Multi-Participant

目标：

- 在不接真实渠道的前提下，证明 participant + policy 值得做

实现思路：

- 在 Shared UI 里模拟不同 sender
- 至少支持两档权限：
  - `discussion-only`
  - `can-command`

要验证的事：

- agent 对两类 sender 的响应是否真的能形成差异

### Slice 3：Approval Route

目标：

- 证明 Shared 模式下的危险操作审批链路可用

实现思路：

- Shared conversation 配 approver
- 工具调用时不再默认只找当前本机用户审批

要验证的事：

- “共享员工执行危险操作”这件事能不能跑通

### Slice 4：First Real Channel

目标：

- 接入第一个真实渠道，验证真实协作价值

建议：

- 飞书优先

要验证的事：

- 真实群聊里，这个模式到底有没有明显收益

---

## Q15：每个 slice 的失败信号是什么？

这一步很重要，不然很容易越做越多停不下来。

### Slice 0 的失败信号

- 仅仅引入 mode，Local 就明显变复杂
- 本地 `cwd` 体验被干扰

### Slice 1 的失败信号

- Shared 其实只是 Local 换壳，本质并没有独立起来
- Shared 必须深度依赖 Local-only atoms 才能跑

### Slice 2 的失败信号

- 模型无法稳定地区分“讨论”和“指挥”
- 用户在交互上几乎感知不到权限差异

### Slice 3 的失败信号

- 审批链路明显拖慢到不可用
- 用户无法理解“谁在为共享员工点同意”

### Slice 4 的失败信号

- 真实群聊噪声远大于收益
- 大部分消息对 agent 都是污染，而不是帮助

---

## Q16：对当前代码，最重要的工程判断是什么？

三个判断。

### 判断 1

`DeskhandAgent` 可以继续复用。

原因：

- 已有 `sdkSessionId + resume`
- 已有 `systemPromptAppendBlocks`
- 已有 `PreToolUse` hook

这些都是 Shared 可以借力的基础。

### 判断 2

session / conversation 不能继续只靠现有 `Session` 硬扩。

Local 和 Shared 最好分成不同领域对象。

### 判断 3

Shared 的入口层不该继续强耦合 Electron IPC。

第一阶段可以先在 Electron 内模拟。
但一旦进入真实渠道，就应该有 Shared 自己的 runtime / storage / adapter 边界。

---

## Q17：现在有哪些东西应该先定，哪些东西不该先定？

### 现在应该定的

- 必须分成 `Local Mode` 和 `Shared Mode`
- 两种 mode 的 session 不共用
- `cwd` 和 shared workspace 不是一回事
- 先做 vertical slices，不先做终局大重构
- Shared 先串行，不先并发

### 现在不该定太死的

- 所有类型字段最终长什么样
- toolbar / sidebar 的最终 UI 细节
- runtime 内部要拆成几个类
- 多渠道抽象最终接口长什么样

这些东西应该在 slice 推进过程中再收敛。

---

## Q18：最终建议是什么？

最终建议可以压成 5 句话：

1. Shared Employee 值得做，但不要直接改现有本地聊天。
2. Deskhand 应明确分成 `Local Mode` 和 `Shared Mode`。
3. `cwd` 继续属于 Local 的核心心智，Shared 的核心是 workspace + policy + participants。
4. Shared 第一阶段先在 Electron 内做独立壳和假多人，不要先接真实渠道。
5. 整个项目必须按 vertical slice 去验证，先证明最危险假设，再决定要不要继续扩。

---

## Q19：如果要把这份文档交给 AI 开发，它最该拿到什么？

不是超长详规，而是这 5 件事：

1. 目标
2. 模式边界
3. 不变量
4. 当前 slice
5. 验证标准

这份文档的作用也应该只到这里。

它负责告诉 AI：

- 哪个方向是对的
- 哪些边界不能碰
- 先验证什么

而不是现在就替它把所有局部实现都定死。
