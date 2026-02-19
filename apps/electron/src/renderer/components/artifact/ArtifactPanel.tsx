/**
 * Artifact 面板
 *
 * Agent 产出物的渲染查看器。
 * 自动捕获 Write/Edit 工具操作的文件，以渲染效果展示给用户。
 *
 * 布局：左侧 artifact 列表（200px）+ 右侧预览区域
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import {
  artifactPanelOpenAtom,
  artifactPanelWidthAtom,
  selectedArtifactAtom,
  filePreviewModeAtom,
  sessionArtifactsFamily,
  activeSessionIdAtom,
} from '../../atoms/sessions';
import { Markdown } from '../chat/markdown/Markdown';

// ============================================
// File type detection
// ============================================

type FileType = 'html' | 'markdown' | 'image' | 'text';

function getFileType(filePath: string): FileType {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (['md', 'markdown', 'mdx'].includes(ext)) return 'markdown';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)) return 'image';
  return 'text';
}

export function ArtifactPanel() {
  const [isOpen, setIsOpen] = useAtom(artifactPanelOpenAtom);
  const [width, setWidth] = useAtom(artifactPanelWidthAtom);
  const activeSessionId = useAtomValue(activeSessionIdAtom);
  const artifacts = useAtomValue(sessionArtifactsFamily(activeSessionId ?? ''));
  const [selectedArtifact, setSelectedArtifact] = useAtom(selectedArtifactAtom);
  const [viewMode, setViewMode] = useAtom(filePreviewModeAtom);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileBase64, setFileBase64] = useState<string | undefined>();
  const [fileExists, setFileExists] = useState(true);
  const isDragging = useRef(false);

  // Load file content when selected artifact changes
  const loadFileContent = useCallback(async (filePath: string) => {
    const result = await window.electronAPI?.readFile(filePath);
    if (result) {
      setFileContent(result.content);
      setFileBase64(result.base64);
      setFileExists(result.exists);
    }
  }, []);

  useEffect(() => {
    if (selectedArtifact) {
      loadFileContent(selectedArtifact);
    } else {
      setFileContent('');
      setFileExists(true);
    }
  }, [selectedArtifact, loadFileContent]);

  // Reload content when artifacts list changes (file was re-edited)
  useEffect(() => {
    if (selectedArtifact && artifacts.includes(selectedArtifact)) {
      loadFileContent(selectedArtifact);
    }
  }, [artifacts, selectedArtifact, loadFileContent]);

  // Drag resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const mainContent = document.querySelector('.main-content') as HTMLElement;
      if (!mainContent) return;
      const rect = mainContent.getBoundingClientRect();
      const newWidth = Math.max(320, Math.min(800, rect.right - e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.classList.remove('select-none');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setWidth]);

  const handleResizeStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    document.body.classList.add('select-none');
    e.preventDefault();
  };

  const fileName = selectedArtifact ? selectedArtifact.split('/').pop() ?? '' : '';
  const fileType = selectedArtifact ? getFileType(selectedArtifact) : 'text';

  return (
    <>
      {/* Drag handle */}
      {isOpen && (
        <div
          onMouseDown={handleResizeStart}
          className="w-1.5 bg-transparent cursor-col-resize relative hover:bg-[var(--hover-bg)]"
        />
      )}

      {/* Panel body */}
      <div
        style={{
          width: isOpen ? width : 0,
          minWidth: isOpen ? 320 : 0,
        }}
        className="
          bg-[var(--bg-secondary)]
          border-l border-[var(--border-color)]
          flex flex-col overflow-hidden
          transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        "
      >
        <div
          style={{ minWidth: 320, width }}
          className="h-full flex flex-col"
        >
          {/* Header */}
          <div className="h-12 border-b border-[var(--border-color)] flex items-center px-3 pr-2">
            <span className="text-[var(--font-size-sm)] font-medium text-[var(--text-primary)] flex-1">
              Artifacts
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="
                w-8 h-8 border-none bg-transparent
                rounded-[var(--radius-md)] cursor-pointer
                flex items-center justify-center
                text-[var(--text-secondary)]
                transition-colors duration-[var(--transition-fast)]
                hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]
              "
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Content: artifact list + preview */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left: artifact list */}
            <div className="w-[200px] min-w-[200px] border-r border-[var(--border-color)] overflow-y-auto">
              {artifacts.length === 0 ? (
                <div className="p-3 text-[var(--font-size-sm)] text-[var(--text-muted)]">
                  <div className="text-center leading-relaxed">
                    <div>No artifacts yet.</div>
                    <div className="mt-1 text-[var(--font-size-xs)]">Files created by AI will appear here.</div>
                  </div>
                </div>
              ) : (
                <div className="py-1">
                  {artifacts.map((filePath) => {
                    const name = filePath.split('/').pop() ?? filePath;
                    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
                    const isSelected = selectedArtifact === filePath;
                    return (
                      <button
                        key={filePath}
                        onClick={() => setSelectedArtifact(filePath)}
                        className={`
                          w-full text-left px-3 py-2 border-none cursor-pointer
                          transition-colors duration-[var(--transition-fast)]
                          ${isSelected
                            ? 'bg-[var(--hover-bg)]'
                            : 'bg-transparent hover:bg-[var(--hover-bg)]'
                          }
                        `}
                      >
                        <div className="text-[var(--font-size-sm)] text-[var(--text-primary)] truncate">
                          {name}
                        </div>
                        <div className="text-[var(--font-size-xs)] text-[var(--text-muted)] truncate mt-0.5">
                          {dir}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: preview area */}
            <div className="flex-1 flex flex-col bg-[var(--bg-secondary)]">
              {/* Preview toolbar */}
              <PreviewToolbar
                fileName={fileName}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                content={fileContent}
                onRefresh={() => selectedArtifact && loadFileContent(selectedArtifact)}
              />

              {/* Preview content */}
              <div className="flex-1 overflow-auto">
                {!selectedArtifact ? (
                  <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-[var(--font-size-sm)]">
                    Select a file to preview
                  </div>
                ) : !fileExists ? (
                  <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-[var(--font-size-sm)]">
                    File not found on disk
                  </div>
                ) : viewMode === 'code' ? (
                  <pre className="p-4 text-[var(--font-size-sm)] text-[var(--text-primary)] whitespace-pre-wrap break-words font-mono leading-relaxed m-0">
                    {fileContent}
                  </pre>
                ) : (
                  <ArtifactPreview
                    fileType={fileType}
                    content={fileContent}
                    base64={fileBase64}
                    fileName={fileName}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================
// PreviewToolbar
// ============================================

interface PreviewToolbarProps {
  fileName: string;
  viewMode: 'code' | 'preview';
  onViewModeChange: (mode: 'code' | 'preview') => void;
  content: string;
  onRefresh: () => void;
}

function PreviewToolbar({ fileName, viewMode, onViewModeChange, content, onRefresh }: PreviewToolbarProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="h-10 border-b border-[var(--border-color)] flex items-center justify-between px-3">
      <div className="flex items-center gap-3">
        {/* View mode toggle */}
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

        {/* File name */}
        <span className="text-[var(--font-size-xs)] text-[var(--text-muted)]">
          {fileName || 'No file selected'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {/* Copy button */}
        <button
          onClick={handleCopy}
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

        {/* Refresh button */}
        <button
          onClick={onRefresh}
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

// ============================================
// ArtifactPreview - Type-aware renderer
// ============================================

interface ArtifactPreviewProps {
  fileType: FileType;
  content: string;
  base64?: string;
  fileName: string;
}

function ArtifactPreview({ fileType, content, base64, fileName }: ArtifactPreviewProps) {
  switch (fileType) {
    case 'html':
      return (
        <iframe
          sandbox="allow-scripts"
          srcDoc={content}
          className="w-full h-full border-none bg-white"
          title={fileName}
        />
      );

    case 'markdown':
      return (
        <div className="p-4 prose prose-sm max-w-none">
          <Markdown content={content} />
        </div>
      );

    case 'image':
      return (
        <div className="h-full flex items-center justify-center p-4">
          {base64 ? (
            <img
              src={base64}
              alt={fileName}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <span className="text-[var(--text-muted)] text-[var(--font-size-sm)]">
              Unable to load image
            </span>
          )}
        </div>
      );

    default:
      return (
        <pre className="p-4 text-[var(--font-size-sm)] text-[var(--text-primary)] whitespace-pre-wrap break-words font-mono leading-relaxed m-0">
          {content}
        </pre>
      );
  }
}
