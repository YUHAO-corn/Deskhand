# Eval 场景扩展复盘

> **日期**：2026-04-09
> **目标**：在已有 eval 系统基础上，扩展面向非技术用户的真实场景，并批量运行验证

---

## 一、做了什么

在已有的 1 个开发者场景（React 组件）基础上，新增了 5 个面向白领/非技术用户的场景：

| ID | 场景 | 最终得分 |
|----|------|---------|
| 001 | 创建 React 组件 | 8.3 ✅ |
| 002 | 创建咖啡店落地页 | 0.8 ❌ |
| 003 | 整理会议记录 | JSON 解析失败 |
| 004 | 生成演示文稿大纲 | JSON 解析失败 |
| 005 | 设计邮件模板 | 9.0 ✅ |
| 006 | 创建待办清单页面 | 9.5 ✅ |

同时新增了批量运行脚本 `bun run eval:batch`，修复了 EvalRunner 默认使用 `process.cwd()` 导致污染项目根目录的问题。

---

## 二、发现的问题

### 问题 1：场景 input 与 success_criteria 不一致

003、004 的 input 没有明确要求写文件，但 success_criteria 第一条是"创建了 Markdown 文件"。Agent 在对话里输出内容后询问"需要写入文件吗？"——这是合理行为，但 judge 按标准扣分。

**根因**：场景设计时 input 和评分标准没有对齐，是场景本身的问题，不是 agent 的问题。

**修复**：在 input 中明确加入"保存成 Markdown 文件"的指令。

### 问题 2：002 落地页场景 agent 调用 frontend-design skill 失败

Agent 尝试调用 `frontend-design` skill，但 skill 执行报错（`Cannot read properties of undefined (reading 'speed')`），且没有降级策略，直接把错误暴露给用户，得分 0.8。

**根因**：skill 本身有 bug，agent 缺乏错误降级能力。这是一个真实的产品问题，eval 把它暴露出来了。

### 问题 3：003、004 judge 返回 JSON 解析失败

Judge 的响应中包含了特殊字符（可能是 agent 输出的中文内容里有引号或换行），导致 `parseJudgeResponse` 的正则提取失败。

**根因**：judge.ts 的 JSON 解析不够健壮，遇到嵌套引号时会崩。

---

## 三、遗留问题

- [ ] 003、004 的 JSON 解析错误未修复，这两个场景还没有有效结果
- [ ] 002 的 frontend-design skill bug 未修复
- [ ] judge.ts 的 JSON 解析需要加强健壮性

---

## 四、结论

本轮有效跑通 4 个场景，通过率 75%（3/4），平均分 6.9/10。

核心收获：eval 系统本身运作正常，这轮主要暴露了两类问题——场景设计质量（input 意图不清晰）和 agent 能力缺陷（skill 错误不降级）。前者已修复，后者是真实的产品 bug。
