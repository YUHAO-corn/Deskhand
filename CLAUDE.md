# CLAUDE.md

## AI 接手流程（每次新对话必做）

### 1. 确认目标
看下方「产品开发 TODO」，找到当前要做的 Phase。

### 2. 读 SPEC 文档
> ‼️这是核心规格文档
- 路径：`/Users/godcorn/cursor/craft-agents-oss-main/docs/`
  - `SPEC.md` + Phase 标注的 `SPEC_*.md`
- 重点读 SPEC 中的「需求列表」，[x] 项是要实现的功能

### 3. 读目标文件 & 拆解任务
- 找到要改的文件，读懂现有代码和 TODO 注释
- 还需要阅读UI文件，假设缺少对应的UI或者现有的UI不符合预期，需要进行调整
- 如果执行量大，可只完成 Phase 的部分功能，不必一次做完
- 确认本次工作量，跟我口头对齐本次需求范围，和完成后预期会得到什么新体验

### 4. 原子化拆分和实现
- 拆分为原子化to-do，vertical slice端到端的方式，逐步开发逐步验证，让用户能体验到不断在推进
- 循环执行：实现一个小功能 → 检验（lint/typecheck/test/跑测）→ 提交
  - 不要攒一大堆再检验和提交
  - 每个 commit 只做一件事

### 5. 通知验收
告知用户「Phase X 已完成（或部分完成）」，列出手动验收点。

### 6. 等待反馈
- ✅ 通过 → 更新 TODO 打勾，进入下一步
- ❌ 失败 → 根据反馈修复，重复 4-6

### 7. 架构性检验（重复失败时）
如果多次修复仍失败，跳出局部视野：
- 回顾 SPEC 文档，检查是否偏离设计
- 对照 craft-agent 实现：`/Users/godcorn/cursor/craft-agents-oss-main/`
- 问用户澄清需求

---

## 产品开发 TODO（按阶段）

> **严格按顺序执行**。每个 Phase 标注了对应的 SPEC 文档。
> 采用vertical slice端到端的方式，先实现一个功能，再实现一个功能，直到所有功能都实现。
> phase0.5做好的UI不一定完全符合需求，在vertical过程里需要根据需求进行调整
> 每个功能都要端到端验证：UI → 状态 → 逻辑 → 实际运行。

### Phase 0: 框架跑通
> 📖 SPEC.md §1-2

- [x] Electron 启动 + React 界面渲染
- 验收：`bun run dev` 能看到 Hello World 界面

### Phase 0.5: UI 迁移（原型 → Deskhand）
> 📖 参考「UI 实现策略」章节

**原型路径**：`/Users/godcorn/cursor/craft-agents-oss-main/deskhand-prototype/`
- [x] 审视原型组件，决定是否需要进一步拆分
- [x] 复制组件到 Deskhand（去重、清理）
- [x] 组织布局，确保界面与原型一致
- [x] 添加 stub atoms 让组件能渲染
- [x] 接入 SettingsPage 和 InputPopups
- [x] 移除原型专用的假 macOS 按钮
- 验收：界面视觉效果与原型一致（可用 mock 数据）

### Phase 1: 基础设施
> 📖 SPEC.md §3-5
> **策略调整**：types 和 atoms 不提前定义，在各 feature 开发时按需添加。
> 只修复现有代码的类型错误，保持 `bun run typecheck` 通过即可。

- [x] 修复 tsconfig 配置（统一 typecheck）
- [x] 修复现有代码的类型错误
- 验收：`bun run typecheck` 通过

### Phase 2: 对话功能（最难，先攻克）
> 📖 SPEC_ChatArea.md + SPEC_InputToolbar.md + SPEC.md §5.7/§8
> 由于对话功能很大，所以拆分任务道 @PHASE2_CHAT_TODO.md

- [ ] ChatArea 模块
- [ ] InputToolbar 模块
- [ ] Agent 调用 + 流式响应
- 验收：SPEC 中 [x] 项全部实现 + 手动验收流式对话

### Phase 3: 会话管理
> 📖 SPEC_SessionSidebar.md

- [ ] SessionSidebar 模块
- 验收：SPEC 中 [x] 项全部实现 + 手动验收会话切换

### Phase 4: 认证流程
> 📖 SPEC_AuthGuard.md

- [ ] AuthGuard 模块
- 验收：SPEC 中 [x] 项全部实现 + 手动验收登录流程

### Phase 5: Artifact 面板
> 📖 SPEC_ArtifactPanel.md

- [ ] ArtifactPanel 模块
- 验收：SPEC 中 [x] 项全部实现 + 手动验收面板切换

### Phase 6: 设置页面
> 📖 SPEC_SettingsPage.md

- [ ] SettingsPage 模块
- [ ] Credential Manager（API KEY 加密存储）
- 验收：SPEC 中 [x] 项全部实现 + 手动验收设置保存

### Phase 7: 技能系统
> 📖 SPEC.md §技能系统

- [ ] 技能加载与执行
- 验收：技能能被触发并执行

---

## UI 实现策略

**原型路径**：`/Users/godcorn/cursor/craft-agents-oss-main/deskhand-prototype/`

**原则**：
- 视觉效果必须与原型一致
- 实现功能前，先读原型对应组件的代码
- 保留原型的样式和布局，替换 mock 数据为真实状态

**流程**：
1. 读原型组件 → 理解 UI 结构和样式
2. 在 Deskhand 对应位置实现 → 保持视觉一致
3. 先用 mock 数据让 UI 跑起来
4. 后续 Phase 逐步替换为真实数据（types → atoms → API）

---

## 支持信息

### 项目上下文

**技术栈**：Electron + React + TypeScript + Jotai + TailwindCSS

**目录结构**：
```
Deskhand/
├── apps/electron/src/
│   ├── main/           # 主进程
│   ├── preload/        # 预加载脚本
│   └── renderer/       # 渲染进程 (React)
├── packages/core/      # 核心类型定义
└── packages/shared/    # 共享逻辑（agent, sessions, skills）
```

### 开发策略

**难点优先**：先做对话功能（Phase 2），早验证核心能否跑通。

**开发阶段绕过配置**：
```bash
# 项目根目录创建 .env
ANTHROPIC_API_KEY=sk-ant-xxx
```
代码中用 `process.env.ANTHROPIC_API_KEY`，Phase 6 再补 Credential Manager。

### 开发规范

**技术方案**
- 不造轮子，优先复用 craft-agent 实现模式
- 遇到架构问题对照 craft-agent：`/Users/godcorn/cursor/craft-agents-oss-main/`

**Commit**
- 原子化：一个 commit 只做一件事
- 前缀：`fix` / `feat` / `docs` / `refactor` / `test` / `chore`

**协作**
- 先读后改：修改文件前必须先读取
- 小步快跑：宁可多次小改动，不要一次大重构
- 不确定就问

**代码质量**
- 不过度工程：只做当前需要的
- 删除干净：移除的代码直接删，不要注释保留
