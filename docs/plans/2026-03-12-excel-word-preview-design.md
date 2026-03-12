# Excel & Word Artifact Preview — 设计文档

> 以 Q&A 形式记录讨论决策和待定事项。标注 ✅ 的为已讨论确认，🔲 的为待讨论。

---

## Q1: 支持哪些文件格式？ ✅

**A:** 第一版支持 Excel（`.xlsx`）和 Word（`.docx`）。

PPT（`.pptx`）暂不做——纯前端没有成熟的高保真渲染方案，开发成本远高于 Excel/Word，后续单独评估。

## Q2: 文件来源是什么？ ✅

**A:** Agent 生成的文件。不是用户上传的已有文件。

这意味着：
- 文件复杂度可控（agent 生成的通常不会有极端复杂的格式）
- 不需要处理所有 Office 格式的边界情况

## Q3: 预览保真度要求？ ✅

**A:** 内容优先。能看到数据和结构就行，样式还原不是第一版重点。

具体来说：
- Excel：表格数据 + 多 sheet 切换 + 行号列号 ✅ | 合并单元格、背景色、条件格式 ❌（V2）
- Word：标题、段落、列表、表格、图片 ✅ | 字体颜色、页眉页脚、分栏 ❌（V2）

## Q4: Excel 需要支持多 sheet 吗？ ✅

**A:** 需要。底部 tab 切换，和 Claude.ai 的 artifact 体验类似。

## Q5: 开发节奏？ ✅

**A:** 先跑通再迭代。MVP 做出来能用，后续再补样式还原。

---

## Q6: 用什么库解析？ 🔲（有推荐方案）

**推荐方案：**

| 格式 | 库 | 大小 | 说明 |
|------|-----|------|------|
| Excel | `xlsx`（SheetJS CE） | ~300KB gzip | 纯 JS，零外部依赖，社区版免费，业界标准 |
| Word | `mammoth` | ~60KB gzip | .docx → 语义化 HTML，专注内容结构，轻量可靠 |

**备选方案：**
- Excel 备选：`exceljs`——功能更全（支持样式读写），但体积更大（~500KB），V2 如果需要样式还原可以考虑切换
- Word 备选：`docx-preview`——保真度更高（保留原始样式），但体积大且维护不活跃

**待确认：** SheetJS CE 够用吗？还是需要 Pro 版（支持更多样式读取）？
→ MVP 阶段 CE 足够，样式还原时再评估。

## Q7: 解析在哪个进程执行？ 🔲（有推荐方案）

**推荐：Renderer 进程。**

理由：
- SheetJS 和 mammoth 都是纯 JS，可以直接在浏览器环境运行
- 避免 IPC 传输解析后的大量 HTML/JSON 数据
- 当前架构：主进程读文件（binary buffer）→ base64 传给 renderer → renderer 解析渲染

**替代方案：** 主进程解析 → 传 HTML 给 renderer。好处是 renderer 更轻，坏处是 IPC 传输量大且主进程阻塞风险。

## Q8: 大文件怎么处理？ 🔲（待讨论）

**场景：** Agent 生成了一个几万行的 Excel，渲染会卡。

**可选策略：**
- A) 不处理——agent 生成的文件通常不会太大，先不管
- B) 截断显示——超过 N 行只渲染前 N 行，底部提示"显示前 1000 行"
- C) 虚拟滚动——用 `react-window` 或 `@tanstack/virtual` 只渲染可视区域

**建议：** MVP 先不处理（方案 A），遇到性能问题再加截断（方案 B）。虚拟滚动是 V2 的事。

## Q9: Word 渲染用 iframe 还是 dangerouslySetInnerHTML？ 🔲（有推荐方案）

**推荐：iframe srcDoc。**

理由：
- 与现有 HTML artifact 渲染方式一致（已有 sandbox iframe 方案）
- 样式隔离，不会污染主应用
- 安全性更好（sandbox 限制脚本执行）

**替代方案：** `dangerouslySetInnerHTML` + scoped styles。更轻量但有样式泄漏风险。

## Q10: 需要"用 Office 打开"按钮吗？ 🔲（待讨论）

当前 toolbar 已有"在 Finder 中显示"按钮。是否需要额外加一个"用默认应用打开"按钮？

**建议：** MVP 不加，用户可以通过"在 Finder 中显示"→ 双击打开。V2 可以加 `shell.openPath()` 一键打开。

## Q11: 旧格式（.xls / .doc）需要支持吗？ 🔲（待讨论）

**建议：** 不支持。Agent 生成的文件一定是新格式（`.xlsx` / `.docx`）。旧格式是用户上传场景才会遇到的，不在当前范围内。

## Q12: 预览失败时怎么处理？ 🔲（有推荐方案）

**推荐：** 降级到文件信息卡片——显示文件名、大小、类型，加一个"在 Finder 中显示"按钮。不要白屏。

---

## 技术方案摘要

### 改动点

1. **IPC 层**（`main/ipc.ts`）：`READ_FILE` handler 扩展 binary 读取支持 `.xlsx` / `.docx`
2. **文件类型检测**（`ArtifactPanel.tsx`）：`FileType` 新增 `'excel' | 'word'`，`getFileType()` 新增扩展名匹配
3. **ExcelPreview 组件**（新建）：SheetJS 解析 → 表格渲染 + sheet tabs
4. **WordPreview 组件**（新建）：mammoth 解析 → iframe srcDoc 渲染
5. **ArtifactPreview**：switch 新增两个 case
6. **FileTypeIcon**：新增 excel / word 图标

### Excel 预览 UI 结构

```
┌─────────────────────────────────┐
│  A    B       C       D    ... │  ← 列号
├─────────────────────────────────┤
│1 标题  数据1   数据2   ...      │
│2 ...   ...    ...     ...      │
│3 ...   ...    ...     ...      │
├─────────────────────────────────┤
│ [数据概览] [文章分析] [清洗数据] │  ← sheet tabs
└─────────────────────────────────┘
```

### 实现步骤

1. `bun add xlsx mammoth` 安装依赖
2. 修改 IPC handler 支持 binary 读取
3. 更新 `getFileType()` + `FileType` 类型
4. 实现 `ExcelPreview` 组件
5. 实现 `WordPreview` 组件
6. 更新 `ArtifactPreview` switch + `FileTypeIcon`
7. 端到端测试

### V2 迭代方向

- Excel 样式还原（合并单元格、背景色、字体色、数字格式）
- Excel 冻结行/列
- Word 更丰富的样式映射
- 大文件虚拟滚动
- "用 Office 打开"按钮
