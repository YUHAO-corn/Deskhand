# Project Rules

## 开始任务前必读
每次开始新任务时，先执行：
```bash
cat Deskhand-Dev-Package/SPEC-DESKHAND.md
```
该文件包含完整的功能定义、UI 设计规范、技术架构。

## Commit 规范
每完成一个独立改动就立即 commit，不要攒着一起提交。

**格式：** `类型: 描述`
- `fix:` 修复 bug
- `feat:` 新功能
- `docs:` 文档
- `refactor:` 重构
- `test:` 测试
- `chore:` 构建/配置

**示例：**
- ✅ `fix: 修复登录按钮点击无响应`
- ❌ `fix: 修复登录和优化样式` (混合了两件事)

## 修改文件流程
1. 先读取文件内容，理解现有代码
2. 只改必要的部分
3. 改完立即运行检查：
```bash
bun run lint      # 代码风格
bun run typecheck # 类型检查
bun run test      # 测试
```

## 开发原则
- 不同功能放不同文件/目录，避免冲突
- 小步快跑：宁可多次小改动，不要一次大重构
- 功能完成后对照 `SPEC-DESKHAND.md` 验证
- 删除的代码直接删，不要注释保留
- 只做当前需要的，不预设未来需求

## 沟通
- 不确定就问，不要猜
- 复杂任务先列 TODO 再动手