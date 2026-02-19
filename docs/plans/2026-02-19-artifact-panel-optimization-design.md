# Artifact Panel 优化设计

> 日期：2026-02-19
> 对应：Phase 5 优化迭代

---

## 变更概要

两项核心改动：
1. **比例制宽度** — 去掉固定 480px 默认值，改为占可用空间 50%，对话区最小 400px
2. **Sidebar → Dropdown** — 去掉左侧 200px artifact 列表，改为 toolbar 内的文件名下拉菜单

---

## 一、宽度与布局系统

### 当前问题
- 默认 480px，其中 sidebar 占 200px，实际预览区只有 ~280px
- 280px 无法展示任何有意义的网页内容
- max 800px 在大屏上仍然不够

### 新方案

**默认宽度：** 可用空间的 50%
- 可用空间 = 窗口宽度 - SessionSidebar 宽度
- 去掉 sidebar 后，整个面板宽度都是预览区

**约束条件：**
- 对话区最小宽度：400px
- 面板最小宽度：320px（不变）
- 面板最大宽度：无硬上限，由对话区最小宽度自然约束
  - 即 max = 可用空间 - 400px

**拖拽行为：**
- 拖拽时实时计算，确保两侧都不低于各自最小值
- 面板关闭再打开时，恢复上次的宽度
- 存储仍用像素值（atom），打开时 clamp 到当前窗口限制内

**窗口 resize 行为：**
- 窗口缩小时，如果面板宽度导致对话区 < 400px，自动收缩面板
- 窗口放大时，面板保持当前像素宽度不变（不自动扩张）

### 数值示例

| 屏幕 | 窗口宽度 | SessionSidebar | 可用空间 | 面板默认(50%) | 对话区 |
|------|---------|---------------|---------|-------------|-------|
| 13" MacBook | 1440px | 260px | 1180px | 590px | 590px |
| 14" MacBook | 1512px | 260px | 1252px | 626px | 626px |
| 27" 显示器 | 1920px | 260px | 1660px | 830px | 830px |

---

## 二、Toolbar 整合设计

### 当前问题
- 左侧 200px sidebar 占据了面板 40%+ 的宽度
- 非技术用户一次只关注一个 artifact，sidebar 常驻浪费空间

### 新方案：去掉 sidebar，文件切换融入 toolbar

**Toolbar 布局（一行）：**

```
[ Code | Preview ] | [ ▼ filename.html ] | [ 📂 Finder ] [ 📋 Copy ] [ 🔄 Refresh ]
```

- 左侧：Code / Preview segmented control（保持不变）
- 中间：Artifact Dropdown — 点击展开文件列表
- 右侧：Finder 按钮（新增）| 复制 | 刷新

### Artifact Dropdown 细节

**触发区域：** 文件名 + 下拉箭头，点击展开

**展开列表：**
- 每项包含：文件类型图标（彩色）+ 文件名 + 路径（truncated）
- 选中项有高亮背景
- 宽度：min(320px, 面板宽度 - 32px)
- 最大高度：400px，超出可滚动
- 点击外部或选择后关闭

**Finder 按钮：**
- toolbar 右侧独立按钮，操作当前选中文件
- dropdown 列表内不再放 Finder 按钮，保持列表简洁

**边界情况：**
- 0 个 artifact：dropdown 禁用，显示占位文本
- 1 个 artifact：dropdown 可点击但只显示一项
- 新 artifact 加入时：自动选中最新的（保持现有行为）

---

## 三、实现计划

### Slice 1：宽度系统重构
- 修改 `artifactPanelWidthAtom` 默认值计算逻辑（比例制）
- 对话区加 `min-width: 400px`
- 更新拖拽 handler，加入对话区最小宽度约束
- 监听窗口 resize，自动 clamp 面板宽度
- 去掉 max 800px 硬上限

### Slice 2：Sidebar → Dropdown
- 去掉左侧 200px artifact 列表
- 实现 Artifact Dropdown 组件（文件名触发 + 展开列表）
- toolbar 加入 Finder 快捷按钮
- 预览区扩展到面板全宽

---

## 四、不做的事

- 不做 tab bar（多文件场景不够常见，dropdown 足够）
- 不做面板比例持久化（存像素值就够了）
- 不做窗口放大时面板自动扩张（避免意外行为）
