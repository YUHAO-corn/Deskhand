# Eval 场景扩展复盘

> **日期**：2026-04-09 ~ 2026-04-10
> **目标**：在已有 eval 系统基础上，扩展面向非技术用户的真实场景，并批量运行验证

---

## 一、做了什么

在已有的 1 个开发者场景（React 组件）基础上，新增了 5 个面向白领/非技术用户的场景，并新增批量运行脚本 `bun run eval:batch`。

**最终结果（2026-04-10 全量跑通）**：

| ID | 场景 | 最终得分 |
|----|------|---------|
| 001 | 创建 React 组件 | 8.8 ✅ |
| 002 | 创建咖啡店落地页 | 10.0 ✅ |
| 003 | 整理会议记录 | 8.0 ✅ |
| 004 | 生成演示文稿大纲 | 9.3 ✅ |
| 005 | 设计邮件模板 | 9.3 ✅ |
| 006 | 创建待办清单页面 | 8.5 ✅ |

**通过率 100%，平均 9.0/10。**

---

## 二、过程中发现和修复的问题

### 问题 1：场景 input 与 success_criteria 不一致

003、004 的 input 没有明确要求写文件，但评分标准第一条是"创建了文件"。Agent 在对话里输出内容后询问"需要写入文件吗？"——这是合理行为，但 judge 按标准扣分。

**根因**：场景设计时 input 和评分标准没有对齐，是场景本身的问题，不是 agent 的问题。

**修复**：在 input 中明确加入"保存成 Markdown 文件"的指令。

**教训**：场景的 input 必须和 success_criteria 完全对齐。不能在 input 里说一件事，在标准里评另一件事。

### 问题 2：Judge 无法使用 Claude Code 专属 API key 直接调用

Judge 用 `@anthropic-ai/sdk` 直接调用 API，被返回 403（渠道仅限 Claude Code 客户端）。

**修复**：换用独立的第三方代理 API，通过环境变量 `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY` 注入，agent 和 judge 完全独立于 Claude Code 全局配置。

### 问题 3：Judge 响应包含 thinking 块导致解析失败

第三方代理返回的响应中 `content[0]` 是 `thinking` 类型而非 `text`，导致 judge 崩溃。

**修复**：改为在 `content` 数组中查找 `type === 'text'` 的块，而不是直接取 `[0]`。

### 问题 4：EvalRunner 默认 workingDirectory 污染项目根目录

Agent 创建的文件（HTML、MD 等）落到了项目根目录。

**修复**：EvalRunner 默认创建 `os.tmpdir()` 下的临时目录作为 workingDirectory。

---

## 三、运行方式

```bash
cd packages/eval
ANTHROPIC_API_KEY=xxx ANTHROPIC_BASE_URL=yyy bun run eval:batch
```

---

## 四、结论

6 个场景全部通过，平均 9.0/10。过程中发现的问题主要是：场景设计不严谨（input 意图不明）和 eval 基础设施问题（API key 限制、响应格式兼容）。核心 agent 能力本身表现良好。

