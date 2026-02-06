/**
 * Files Tab 内容
 *
 * 📐 SPEC: docs/SPEC_ArtifactPanel.md
 * 🎨 原型: deskhand-prototype/src/components/ArtifactPanel.tsx
 *
 * 布局：左侧文件树（200px）+ 右侧预览区域
 */

import { useState } from 'react';
import { useAtom } from 'jotai';
import {
  selectedFileAtom,
  filePreviewModeAtom,
} from '../../../atoms/sessions';
import type { FileNode, PreviewMode } from '@deskhand/core';

export function FilesTabContent() {
  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [viewMode, setViewMode] = useAtom(filePreviewModeAtom);

  // TODO: 从 sessionFileTreeFamily(activeSessionId) 获取文件树
  const fileTree: FileNode[] = [];

  return (
    <div className="flex-1 flex">
      {/* ============================================
          区域：文件树（左侧）
          宽度：固定 200px
          功能：显示目录结构，点击切换文件
          ============================================ */}
      <div className="w-[200px] min-w-[200px] border-r border-[var(--border-color)] bg-white overflow-y-auto">
        {fileTree.length === 0 ? (
          // 空状态
          <div className="p-3 text-[var(--font-size-sm)] text-[var(--text-muted)]">
            <div className="text-center leading-relaxed">
              <div>No files yet. AI will create</div>
              <div>files here.</div>
            </div>
          </div>
        ) : (
          // TODO: 渲染 FileTree 组件
          <div className="p-2">
            {/* <FileTree files={fileTree} /> */}
          </div>
        )}
      </div>

      {/* ============================================
          区域：预览区域（右侧）
          功能：显示文件内容预览
          ============================================ */}
      <div className="flex-1 flex flex-col bg-[var(--bg-secondary)]">
        {/* 预览工具栏 */}
        <FilePreviewToolbar
          fileName={selectedFile?.name}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* 预览内容 */}
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-[var(--font-size-sm)]">
          {selectedFile ? (
            // TODO: 根据 viewMode 和文件类型渲染不同的预览组件
            <div>Preview: {selectedFile.name}</div>
          ) : (
            'Select a file to preview'
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// FilePreviewToolbar - 预览工具栏
// ============================================

interface FilePreviewToolbarProps {
  fileName?: string;
  viewMode: PreviewMode;
  onViewModeChange: (mode: PreviewMode) => void;
}

function FilePreviewToolbar({ fileName, viewMode, onViewModeChange }: FilePreviewToolbarProps) {
  return (
    <div className="h-10 border-b border-[var(--border-color)] flex items-center justify-between px-3">
      <div className="flex items-center gap-3">
        {/* 视图模式切换 - Claude.ai 风格 */}
        <div className="flex items-center bg-[var(--hover-bg)] rounded-[var(--radius-md)] p-[3px]">
          <button
            onClick={() => onViewModeChange('code')}
            className={`
              w-7 h-7 border-none rounded cursor-pointer
              flex items-center justify-center
              transition-all duration-[var(--transition-fast)]
              ${viewMode === 'code'
                ? 'bg-white text-[var(--text-primary)] shadow-sm'
                : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }
            `}
            title="Code"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
          <button
            onClick={() => onViewModeChange('preview')}
            className={`
              w-7 h-7 border-none rounded cursor-pointer
              flex items-center justify-center
              transition-all duration-[var(--transition-fast)]
              ${viewMode === 'preview'
                ? 'bg-white text-[var(--text-primary)] shadow-sm'
                : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }
            `}
            title="Preview"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        {/* 文件名 */}
        <span className="text-[var(--font-size-xs)] text-[var(--text-muted)]">
          {fileName || 'No file selected'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {/* 复制按钮 */}
        <button
          onClick={() => {
            // TODO: 复制文件内容到剪贴板
          }}
          className="
            w-7 h-7 border-none bg-transparent
            rounded-[var(--radius-md)] cursor-pointer
            flex items-center justify-center
            text-[var(--text-muted)]
            transition-all duration-[var(--transition-fast)]
            hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]
          "
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>

        {/* 刷新按钮 */}
        <button
          onClick={() => {
            // TODO: 重新加载文件内容
          }}
          className="
            w-7 h-7 border-none bg-transparent
            rounded-[var(--radius-md)] cursor-pointer
            flex items-center justify-center
            text-[var(--text-muted)]
            transition-all duration-[var(--transition-fast)]
            hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]
          "
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
