/**
 * Artifact 面板
 *
 * Agent 产出物的渲染查看器。
 * 自动捕获 Write/Edit 工具操作的文件，以渲染效果展示给用户。
 *
 * 布局：toolbar（含文件切换 dropdown）+ 全宽预览区域
 * 宽度：比例制，默认占可用空间 50%，对话区最小 400px
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  artifactPanelOpenAtom,
  artifactPanelWidthAtom,
  selectedArtifactAtom,
  filePreviewModeAtom,
  sessionArtifactsFamily,
  activeSessionIdAtom,
  sessionMetaMapAtom,
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
  const setArtifacts = useSetAtom(sessionArtifactsFamily(activeSessionId ?? ''));
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom);
  const [selectedArtifact, setSelectedArtifact] = useAtom(selectedArtifactAtom);
  const [viewMode, setViewMode] = useAtom(filePreviewModeAtom);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileBase64, setFileBase64] = useState<string | undefined>();
  const [fileExists, setFileExists] = useState(true);
  const isDragging = useRef(false);

  const CHAT_MIN_WIDTH = 400;
  const PANEL_MIN_WIDTH = 320;

  // Calculate available space for ChatArea + ArtifactPanel
  const getAvailableSpace = useCallback(() => {
    const mainContent = document.querySelector('.main-content') as HTMLElement;
    if (!mainContent) return 1000;
    const sidebar = mainContent.querySelector('aside');
    const sidebarWidth = sidebar?.getBoundingClientRect().width ?? 0;
    return mainContent.getBoundingClientRect().width - sidebarWidth;
  }, []);

  // Calculate effective width: if 0 (auto), use 50% of available space
  const [effectiveWidth, setEffectiveWidth] = useState(() => {
    if (width === 0) return PANEL_MIN_WIDTH; // will be recalculated after mount
    return width;
  });

  // Recalculate effective width when width atom changes or on mount
  useEffect(() => {
    if (width === 0) {
      const available = getAvailableSpace();
      setEffectiveWidth(Math.max(PANEL_MIN_WIDTH, Math.floor(available * 0.5)));
    } else {
      setEffectiveWidth(width);
    }
  }, [width, getAvailableSpace]);

  // Clamp panel width on window resize
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      const available = getAvailableSpace();
      const maxWidth = available - CHAT_MIN_WIDTH;
      if (effectiveWidth > maxWidth && maxWidth >= PANEL_MIN_WIDTH) {
        setWidth(maxWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, effectiveWidth, getAvailableSpace, setWidth]);

  // Restore artifacts from session metadata when switching sessions
  useEffect(() => {
    if (!activeSessionId) return;
    const meta = sessionMetaMap.get(activeSessionId);
    if (meta?.artifacts && meta.artifacts.length > 0 && artifacts.length === 0) {
      setArtifacts(meta.artifacts);
      // Auto-select the last artifact
      setSelectedArtifact(meta.artifacts[meta.artifacts.length - 1]);
    }
  }, [activeSessionId, sessionMetaMap, artifacts.length, setArtifacts, setSelectedArtifact]);

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

  // Reload content when panel opens (handles restore-then-open timing)
  useEffect(() => {
    if (isOpen && selectedArtifact) {
      loadFileContent(selectedArtifact);
    }
  }, [isOpen, selectedArtifact, loadFileContent]);

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
      const sidebar = mainContent.querySelector('aside');
      const sidebarWidth = sidebar?.getBoundingClientRect().width ?? 0;
      const available = rect.width - sidebarWidth;
      const maxWidth = available - CHAT_MIN_WIDTH;
      const newWidth = Math.max(PANEL_MIN_WIDTH, Math.min(maxWidth, rect.right - e.clientX));
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
          width: isOpen ? effectiveWidth : 0,
          minWidth: isOpen ? PANEL_MIN_WIDTH : 0,
        }}
        className="
          bg-[var(--bg-secondary)]
          border-l border-[var(--border-color)]
          flex flex-col overflow-hidden flex-shrink-0
          transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        "
      >
        <div
          style={{ minWidth: PANEL_MIN_WIDTH, width: effectiveWidth }}
          className="h-full flex flex-col"
        >
          {/* Toolbar (replaces header + sidebar) */}
          <PreviewToolbar
            fileName={fileName}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            content={fileContent}
            onRefresh={() => selectedArtifact && loadFileContent(selectedArtifact)}
            artifacts={artifacts}
            selectedArtifact={selectedArtifact}
            onSelectArtifact={setSelectedArtifact}
            onClose={() => setIsOpen(false)}
            onShowInFinder={() => selectedArtifact && window.electronAPI?.showInFolder(selectedArtifact)}
          />

          {/* Full-width preview area */}
          <div className="flex-1 overflow-auto">
            {artifacts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-[var(--font-size-sm)]">
                <div className="text-center leading-relaxed">
                  <div>No artifacts yet.</div>
                  <div className="mt-1 text-[var(--font-size-xs)] opacity-60">Files created by AI will appear here.</div>
                </div>
              </div>
            ) : !selectedArtifact ? (
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
    </>
  );
}

// ============================================
// PreviewToolbar (with artifact dropdown)
// ============================================

interface PreviewToolbarProps {
  fileName: string;
  viewMode: 'code' | 'preview';
  onViewModeChange: (mode: 'code' | 'preview') => void;
  content: string;
  onRefresh: () => void;
  artifacts: string[];
  selectedArtifact: string | null;
  onSelectArtifact: (path: string) => void;
  onClose: () => void;
  onShowInFinder: () => void;
}

function PreviewToolbar({
  fileName, viewMode, onViewModeChange, content, onRefresh,
  artifacts, selectedArtifact, onSelectArtifact, onClose, onShowInFinder,
}: PreviewToolbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="h-10 border-b border-[var(--border-color)] flex items-center justify-between px-2 gap-1">
      {/* Left: view mode toggle + artifact dropdown */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* View mode toggle */}
        <div className="flex items-center bg-[var(--hover-bg)] rounded-[var(--radius-md)] p-[3px] flex-shrink-0">
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

        {/* Artifact dropdown */}
        <div ref={dropdownRef} className="relative min-w-0 flex-1">
          <button
            onClick={() => artifacts.length > 0 && setDropdownOpen(!dropdownOpen)}
            disabled={artifacts.length === 0}
            className={`
              flex items-center gap-1.5 min-w-0 max-w-full
              px-2 py-1 rounded-[var(--radius-md)] border-none
              text-[var(--font-size-xs)] cursor-pointer
              transition-colors duration-[var(--transition-fast)]
              ${artifacts.length === 0
                ? 'bg-transparent text-[var(--text-muted)] cursor-default'
                : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
              }
            `}
          >
            {selectedArtifact && <FileTypeIcon type={getFileType(selectedArtifact)} />}
            <span className="truncate">{fileName || 'No file selected'}</span>
            {artifacts.length > 0 && (
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                className={`flex-shrink-0 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </button>

          {/* Dropdown list */}
          {dropdownOpen && (
            <div className="
              absolute top-full left-0 mt-1 z-50
              bg-white rounded-lg shadow-lg border border-[var(--border-color)]
              max-h-[400px] overflow-y-auto
              min-w-[240px] max-w-[320px]
            ">
              {artifacts.map((filePath) => {
                const name = filePath.split('/').pop() ?? filePath;
                const dir = filePath.substring(0, filePath.lastIndexOf('/'));
                const isSelected = selectedArtifact === filePath;
                const type = getFileType(filePath);
                return (
                  <div
                    key={filePath}
                    className={`
                      flex items-start gap-2 px-3 py-2 cursor-pointer
                      transition-colors duration-[var(--transition-fast)]
                      ${isSelected ? 'bg-[var(--hover-bg)]' : 'hover:bg-[var(--hover-bg)]'}
                    `}
                    onClick={() => {
                      onSelectArtifact(filePath);
                      setDropdownOpen(false);
                    }}
                  >
                    <FileTypeIcon type={type} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[var(--font-size-sm)] text-[var(--text-primary)] truncate">{name}</div>
                      <div className="text-[var(--font-size-xs)] text-[var(--text-muted)] truncate mt-0.5">{dir}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* Show in Finder */}
        {selectedArtifact && (
          <button
            onClick={onShowInFinder}
            className="
              w-7 h-7 border-none bg-transparent
              rounded-[var(--radius-md)] cursor-pointer
              flex items-center justify-center
              text-[var(--text-muted)]
              transition-all duration-[var(--transition-fast)]
              hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]
            "
            title="Show in Finder"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        )}

        {/* Copy */}
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
          title="Copy content"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>

        {/* Refresh */}
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
          title="Refresh"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>

        {/* Close panel */}
        <button
          onClick={onClose}
          className="
            w-7 h-7 border-none bg-transparent
            rounded-[var(--radius-md)] cursor-pointer
            flex items-center justify-center
            text-[var(--text-muted)]
            transition-all duration-[var(--transition-fast)]
            hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]
          "
          title="Close panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
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
          allow="clipboard-write"
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

// ============================================
// FileTypeIcon
// ============================================

function FileTypeIcon({ type }: { type: FileType }) {
  const color = {
    html: 'text-orange-500',
    markdown: 'text-blue-500',
    image: 'text-green-500',
    text: 'text-[var(--text-muted)]',
  }[type];

  return (
    <div className={`w-4 h-4 mt-0.5 flex-shrink-0 ${color}`}>
      {type === 'html' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ) : type === 'markdown' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ) : type === 'image' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )}
    </div>
  );
}
