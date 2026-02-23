# Claude Code Skills 开发指南

## 概述

Skills 是 Claude Code 的扩展能力机制，通过 Markdown 文件形式向 Claude 提供专业领域知识、工作流程和工具集成。当用户请求匹配 Skill 的描述时，Claude 会自动调用相应的 Skill 来完成任务。

Skills 的核心价值在于将通用型 AI 转化为特定领域的专家，提供可重复、可分发的专业能力。

---

## 核心概念

### 工作原理

1. **发现阶段**: Claude 启动时加载所有可用 Skill 的 `name` 和 `description` 元数据
2. **激活阶段**: 用户请求匹配 Skill 描述时，Claude 请求使用该 Skill
3. **执行阶段**: Claude 加载 `SKILL.md` 完整内容，按指令执行任务

### 存储位置

| 类型 | 路径 | 适用范围 |
|------|------|----------|
| 个人 | `~/.claude/skills/` | 当前用户所有项目 |
| 项目 | `.claude/skills/` | 项目内所有协作者 |
| 插件 | 插件内 `skills/` 目录 | 安装该插件的用户 |
| 企业 | 托管配置路径 | 组织内所有用户 |

优先级：企业 > 个人 > 项目 > 插件

---

## 目录结构

```
skill-name/
├── SKILL.md              # 必需：核心指令文件
├── scripts/              # 可选：可执行脚本
├── references/           # 可选：参考文档
└── assets/               # 可选：模板、图片等资源
```

### 各目录用途

- **scripts/**: 确定性任务脚本（Python/Bash），可直接执行而不占用上下文
- **references/**: 按需加载的详细文档，保持 SKILL.md 精简
- **assets/**: 输出资源文件（模板、字体、图标），不加载到上下文

---

## SKILL.md 规范

### 基本格式

```markdown
---
name: skill-name
description: 技能功能描述及触发场景说明
---

# 技能标题

[具体指令内容]
```

### 元数据字段

| 字段 | 必需 | 说明 |
|------|------|------|
| `name` | 是 | 唯一标识符，小写字母，连字符分隔 |
| `description` | 是 | 功能描述 + 触发条件，Claude 据此判断何时使用 |
| `allowed-tools` | 否 | 限制可用工具，如 `Read, Bash(python:*)` |
| `user-invocable` | 否 | 设为 `false` 禁止用户直接调用，仅 Claude 可触发 |
| `context` | 否 | 设为 `fork` 在独立上下文中运行 |

### 描述编写原则

描述是 Skill 触发的关键，需回答两个问题：

1. **做什么**: 列出具体功能
2. **何时用**: 包含用户可能使用的关键词

示例：

```yaml
description: 从 PDF 文件中提取文本和表格，填写表单，合并文档。
当处理 PDF 文件或用户提及 PDF、表单、文档提取时使用。
```

---

## 设计原则

### 1. 精简原则

上下文窗口是共享资源。仅添加 Claude 本身不具备的知识。

- 假设 Claude 已具备通用智能
- 每段内容需证明其 token 成本合理
- 优先使用简洁示例而非冗长解释
- SKILL.md 正文控制在 500 行以内

### 2. 渐进式披露

三级加载机制优化上下文使用：

| 级别 | 内容 | 加载时机 | 建议规模 |
|------|------|----------|----------|
| L1 | name + description | 始终加载 | ~100 词 |
| L2 | SKILL.md 正文 | Skill 触发时 | <5000 词 |
| L3 | 关联资源 | 按需加载 | 不限 |

### 3. 自由度设置

根据任务特性设定约束级别：

| 自由度 | 适用场景 | 形式 |
|--------|----------|------|
| 高 | 多种方案均可、依赖上下文判断 | 文本指令 |
| 中 | 存在首选模式、允许变体 | 伪代码或带参数脚本 |
| 低 | 操作脆弱易错、需严格一致性 | 具体脚本，少量参数 |

---

## 开发流程

### 步骤 1: 需求分析

明确 Skill 的使用场景和触发方式：

- 该 Skill 应支持哪些功能
- 用户会如何描述相关需求
- 什么关键词应触发此 Skill

### 步骤 2: 资源规划

分析每个使用场景，识别可复用资源：

- **scripts/**: 重复编写的代码 → 封装为脚本
- **references/**: 需反复查阅的文档 → 分离为参考文件
- **assets/**: 输出模板或素材 → 存放为资产

### 步骤 3: 创建结构

创建 Skill 目录和 SKILL.md：

```bash
mkdir -p ~/.claude/skills/my-skill
touch ~/.claude/skills/my-skill/SKILL.md
```

### 步骤 4: 编写内容

SKILL.md 编写要点：

- 使用祈使句式
- 描述写入 frontmatter，触发条件不要放在正文
- 正文专注于执行指令
- 大型参考内容分离到 references/

### 步骤 5: 测试验证

1. 询问 Claude: "What Skills are available?"
2. 使用匹配描述的请求测试触发
3. 验证执行结果符合预期

---

## 常见模式

### 模式 1: 简单 Skill

单文件 Skill，适用于简单任务：

```markdown
---
name: commit-helper
description: 根据 git diff 生成清晰的提交信息。
编写提交信息或审查暂存更改时使用。
---

# 生成提交信息

1. 执行 `git diff --staged` 查看更改
2. 生成符合以下格式的提交信息：
   - 摘要：50 字符以内
   - 详细描述
   - 受影响组件

使用现在时态，说明改动内容和原因。
```

### 模式 2: 多文件 Skill

包含参考文档和脚本的复杂 Skill：

```
pdf-processing/
├── SKILL.md           # 概述和快速开始
├── forms.md           # 表单填写详细指南
├── reference.md       # API 参考
└── scripts/
    ├── fill_form.py
    └── extract_text.py
```

SKILL.md 中引用分离文件：

```markdown
## 进阶功能

- 表单填写: 参见 [forms.md](forms.md)
- API 参考: 参见 [reference.md](reference.md)
```

### 模式 3: 领域分离

支持多领域或多框架的 Skill：

```
cloud-deploy/
├── SKILL.md              # 工作流 + 选择指南
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

用户选择特定平台时，Claude 仅加载相关文档。

---

## 工具限制

使用 `allowed-tools` 限制 Skill 可用工具：

```yaml
---
name: pdf-processing
description: PDF 文件处理工具
allowed-tools: Read, Bash(python:*)
---
```

限制语法：

- `ToolName`: 允许指定工具
- `Bash(command:*)`: 允许特定命令前缀
- `~ToolName`: 显式禁止某工具

---

## 与其他机制对比

| 机制 | 用途 | 触发方式 |
|------|------|----------|
| **Skills** | 专业领域知识和工作流 | Claude 自动识别 |
| **Slash Commands** | 可复用提示词 | 用户输入 `/command` |
| **CLAUDE.md** | 项目级全局指令 | 每次对话自动加载 |
| **Subagents** | 独立上下文任务委托 | Claude 委托或用户调用 |
| **MCP** | 外部工具和数据源连接 | Claude 调用 MCP 工具 |

Skills 提供知识，MCP 提供工具；二者配合使用效果更佳。

---

## 故障排查

### Skill 未触发

- 检查 description 是否包含用户请求中的关键词
- 确保描述具体明确，避免模糊表述
- 尝试在请求中使用与描述匹配的措辞

### Skill 未加载

- 确认文件路径正确且文件名为 `SKILL.md`（大小写敏感）
- 检查 YAML frontmatter 格式：首行必须是 `---`
- 使用 `claude --debug` 查看加载错误

### 多 Skill 冲突

- 确保各 Skill 描述使用不同的触发关键词
- 使描述更具体以区分不同使用场景

---

## 参考资源

- 官方文档: https://code.claude.com/docs/en/skills
- 官方示例: https://github.com/anthropics/skills
- Agent Skills 规范: https://agentskills.io/specification
