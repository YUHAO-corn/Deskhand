# CLAUDE.md

## 项目上下文
- 开始任务前，先阅读 `Deskhand-Dev-Package/SPEC-DESKHAND.md` 了解产品规格
- 该文件包含完整的功能定义、UI 设计规范、技术架构

## Commit 规范
- 原子化提交：一个 commit 只做一件事，改完立即提交
  - ✅ 好："fix: 修复登录按钮点击无响应" (只改了按钮相关代码)
  - ❌ 坏："fix: 修复登录和优化样式" (混合了两件事)
  - 每完成一个独立改动就 commit，不要攒着一起提交
- 类型前缀：fix / feat / docs / refactor / test / chore
- 便于回退：出问题只需 revert 一个小 commit

## AI 协作模式
- 模块边界清晰：不同功能放不同文件/目录，避免冲突
- 先读后改：修改文件前必须先读取，不要盲改
- 小步快跑：宁可多次小改动，不要一次大重构

## 代码质量
- 功能完成后，对照 `Deskhand-Dev-Package/SPEC-DESKHAND.md` 验证是否符合设计
- 改完立即验证，运行以下命令检查：
  ```bash
  bun run lint      # 代码风格检查
  bun run typecheck # 类型检查
  bun run test      # 跑测试
  ```
- 不过度工程：只做当前需要的，不预设未来需求
- 删除干净：移除的代码不要注释保留，直接删

## 沟通习惯
- 不确定就问，不要猜
- 复杂任务先列 TODO 再动手
