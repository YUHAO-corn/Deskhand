/**
 * InputToolbar 弹窗组件集合
 *
 * 📐 SPEC: docs/SPEC_InputToolbar.md
 * 🎨 原型: deskhand-prototype/src/components/Popups.tsx
 *
 * 包含：
 * - WorkspacePopup: 工作目录选择
 * - InteractPopup: 交互方式菜单（Pick a Style / This or That）
 * - ToolsPopup: 统一工具选择（MCP Tools + Skills）
 * - ModelSelectorPopup: 模型选择
 * - ClipboardPopup: 剪贴板历史
 */

import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import {
  selectedModelAtom,
  workingDirectoryAtom,
  skillsAtom,
} from '../../../atoms/sessions';

// ============================================
// WorkspacePopup - 工作目录选择
// ============================================

interface WorkspacePopupProps {
  isOpen: boolean;
}

export function WorkspacePopup({ isOpen }: WorkspacePopupProps) {
  const [workingDirectory, setWorkingDirectory] = useAtom(workingDirectoryAtom);

  const handleSelectDirectory = async () => {
    const path = await window.electronAPI?.selectDirectory();
    if (path) {
      setWorkingDirectory(path);
      // Persist to config
      window.electronAPI?.saveConfig({ lastWorkingDirectory: path });
    }
  };

  const dirName = workingDirectory ? workingDirectory.split('/').pop() : null;

  return (
    <PopupContainer isOpen={isOpen} position="left-[14px]">
      {/* Header */}
      <PopupHeader
        title="Workspace"
        description="All tool operations will use this directory as working directory"
      />

      <div className="p-2">
        {/* Current directory */}
        {workingDirectory && (
          <div className="flex items-start gap-3 p-2.5 rounded-[var(--radius-md)] bg-[var(--accent-bg)]">
            <FolderIcon />
            <div className="flex-1 min-w-0">
              <div className="text-[var(--font-size-sm)] font-medium text-[var(--text-primary)] mb-0.5">
                {dirName}
              </div>
              <div className="text-[var(--font-size-xs)] text-[var(--text-muted)] leading-tight truncate">
                {workingDirectory}
              </div>
            </div>
          </div>
        )}

        {/* Select directory button */}
        <button
          className="
            flex items-center gap-2 w-full p-2.5
            border-none bg-transparent
            rounded-[var(--radius-md)] cursor-pointer
            text-[var(--font-size-sm)] text-[var(--text-secondary)]
            hover:bg-[var(--hover-bg)]
          "
          onClick={handleSelectDirectory}
        >
          <PlusIcon />
          {workingDirectory ? 'Change Directory...' : 'Select Directory...'}
        </button>
      </div>
    </PopupContainer>
  );
}

// ============================================
// InteractPopup - 交互方式菜单
// ============================================

interface InteractPopupProps {
  isOpen: boolean;
  onSelect: (tag: string) => void;
}

const interactModes = [
  {
    tag: 'Pick a Style',
    label: 'Pick a Style',
    description: 'Browse options and choose your favorite',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    tag: 'This or That',
    label: 'This or That',
    description: 'Quick rounds to discover what you want',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 3H5a2 2 0 0 0-2 2v3" />
        <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
        <path d="M3 16v3a2 2 0 0 0 2 2h3" />
        <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
];

export function InteractPopup({ isOpen, onSelect }: InteractPopupProps) {
  return (
    <PopupContainer isOpen={isOpen} position="left-[40px]" minWidth={260}>
      <PopupHeader
        title="Interact"
        description="Not sure how to describe it? Try these"
      />

      <div className="p-1.5">
        {interactModes.map((mode) => (
          <button
            key={mode.tag}
            onClick={() => onSelect(mode.tag)}
            className="
              flex items-start gap-3 w-full p-2.5
              border-none bg-transparent
              rounded-[var(--radius-md)] cursor-pointer
              text-left
              transition-colors duration-[var(--transition-fast)]
              hover:bg-[var(--hover-bg)]
            "
          >
            <div className="text-[var(--text-muted)] mt-0.5 shrink-0">
              {mode.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[var(--font-size-sm)] font-medium text-[var(--text-primary)] mb-0.5">
                {mode.label}
              </div>
              <div className="text-[var(--font-size-xs)] text-[var(--text-muted)] leading-snug">
                {mode.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </PopupContainer>
  );
}

// ============================================
// ToolsPopup - 统一工具选择（MCP Tools + Skills）
// ============================================

interface ToolsPopupProps {
  isOpen: boolean;
}

export function ToolsPopup({ isOpen }: ToolsPopupProps) {
  const [skills, setSkills] = useAtom(skillsAtom);

  // Refresh skills from disk when popup opens
  const [lastOpen, setLastOpen] = useState(false);
  if (isOpen && !lastOpen) {
    window.electronAPI?.loadSkills().then(setSkills);
  }
  if (isOpen !== lastOpen) setLastOpen(isOpen);

  // TODO: 从 MCP 配置加载工具列表
  const mcpTools = [
    { title: 'Web fetch', desc: 'Fetch the raw contents of a URL.' },
    { title: 'Web search', desc: 'Search the web for fresh information.' },
  ];

  return (
    <PopupContainer isOpen={isOpen} position="left-[40px]" minWidth={300}>
      <PopupHeader
        title="Tools"
        description="Tools and skills available for the next response."
      />

      <div className="p-2 max-h-80 overflow-y-auto">
        {/* MCP Tools section */}
        <div className="px-2.5 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          MCP Tools
        </div>
        {mcpTools.map((tool) => (
          <CheckboxItem key={tool.title} title={tool.title} desc={tool.desc} />
        ))}

        {/* Skills section */}
        <div className="px-2.5 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Skills
        </div>
        {skills.length === 0 ? (
          <div className="px-2.5 py-3 text-[var(--font-size-sm)] text-[var(--text-muted)]">
            No skills installed
          </div>
        ) : (
          skills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-start gap-3 p-2.5 rounded-[var(--radius-md)] hover:bg-[var(--hover-bg)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[var(--font-size-sm)] font-medium text-[var(--text-primary)] mb-0.5">
                  {skill.name}
                </div>
                <div className="text-[var(--font-size-xs)] text-[var(--text-muted)] leading-tight">
                  {skill.description}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </PopupContainer>
  );
}

// ============================================
// ModelSelectorPopup - 模型选择
// ============================================

interface ModelSelectorPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ModelSelectorPopup({ isOpen, onClose }: ModelSelectorPopupProps) {
  const [selectedModel, setSelectedModel] = useAtom(selectedModelAtom);

  const models = [
    { id: 'claude-opus-4-5-20251101', name: 'Opus 4.5' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5' },
    { id: 'claude-sonnet-4-20250514', name: 'Sonnet 4' },
    { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' },
  ];

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    onClose();
  };

  return (
    <PopupContainer isOpen={isOpen} position="right-[14px]" minWidth={280}>
      {/* 搜索框 */}
      <div className="px-4 py-3 border-b border-[var(--border-light)]">
        <input
          type="text"
          placeholder="Search models..."
          className="
            w-full px-3 py-2
            border border-[var(--border-color)]
            rounded-[var(--radius-md)]
            text-[var(--font-size-sm)]
            outline-none
            focus:border-[var(--accent-color)]
          "
        />
      </div>

      {/* 模型列表 */}
      <div className="p-2 max-h-80 overflow-y-auto">
        {models.map((model) => (
          <div
            key={model.id}
            onClick={() => handleSelectModel(model.id)}
            className={`
              flex items-start gap-3 p-2.5
              rounded-[var(--radius-md)] cursor-pointer
              transition-colors duration-[var(--transition-fast)]
              hover:bg-[var(--hover-bg)]
              ${selectedModel === model.id ? 'bg-[var(--accent-bg)]' : ''}
            `}
          >
            {selectedModel === model.id && (
              <CheckIcon className="text-[var(--accent-color)] mt-0.5" />
            )}
            <div
              className="flex-1 min-w-0"
              style={{ marginLeft: selectedModel === model.id ? '0' : '24px' }}
            >
              <div className="text-[var(--font-size-sm)] font-medium text-[var(--text-primary)] mb-0.5">
                {model.name}
              </div>
              <div className="text-[var(--font-size-xs)] text-[var(--text-muted)] leading-tight">
                {model.id}
              </div>
            </div>
          </div>
        ))}
      </div>
    </PopupContainer>
  );
}

// ============================================
// 共享组件
// ============================================

interface PopupContainerProps {
  isOpen: boolean;
  position?: string;
  minWidth?: number;
  fullWidth?: boolean;
  children: React.ReactNode;
}

function PopupContainer({ isOpen, position, minWidth = 240, fullWidth, children }: PopupContainerProps) {
  return (
    <div
      className={`
        absolute bottom-[calc(100%+8px)]
        ${fullWidth ? 'left-0 right-0 max-w-[520px]' : position ?? ''}
        bg-[var(--bg-secondary)]
        rounded-[var(--radius-lg)]
        shadow-[var(--shadow-popup)]
        border border-[var(--border-light)]
        z-[200]
        transition-all duration-[250ms]
        ${isOpen
          ? 'opacity-100 visible translate-y-0'
          : 'opacity-0 invisible translate-y-2'
        }
      `}
      style={fullWidth ? undefined : { minWidth }}
    >
      {children}
    </div>
  );
}

interface PopupHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

function PopupHeader({ title, description, icon }: PopupHeaderProps) {
  return (
    <div className="px-4 py-3 pb-2.5 border-b border-[var(--border-light)]">
      <h3 className="text-[14px] font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-1">
        {icon}
        {title}
      </h3>
      {description && (
        <p className="text-[var(--font-size-xs)] text-[var(--text-muted)] leading-snug">
          {description}
        </p>
      )}
    </div>
  );
}

interface CheckboxItemProps {
  title: string;
  desc: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

function CheckboxItem({ title, desc, checked, onChange }: CheckboxItemProps) {
  return (
    <div
      className="
        flex items-start gap-3 p-2.5
        rounded-[var(--radius-md)] cursor-pointer
        transition-colors duration-[var(--transition-fast)]
        hover:bg-[var(--hover-bg)]
      "
      onClick={() => onChange?.(!checked)}
    >
      <div
        className={`
          w-[18px] h-[18px]
          border-2 rounded
          flex items-center justify-center
          ${checked
            ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
            : 'border-[var(--border-color)]'
          }
        `}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className={`w-3 h-3 text-white ${checked ? 'opacity-100' : 'opacity-0'}`}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[var(--font-size-sm)] font-medium text-[var(--text-primary)] mb-0.5">
          {title}
        </div>
        <div className="text-[var(--font-size-xs)] text-[var(--text-muted)] leading-tight">
          {desc}
        </div>
      </div>
    </div>
  );
}

// ============================================
// ClipboardPopup - 剪贴板历史（v2 设计）
// ============================================

interface ClipboardEntry {
  id: string;
  type: 'text' | 'image' | 'link';
  content: string;
  preview: string;
  timestamp: number;
  charCount?: number;
  fileSize?: number;
}

interface ClipboardPopupProps {
  isOpen: boolean;
  onConfirm?: (entries: ClipboardEntry[]) => void;
}

export function ClipboardPopup({ isOpen, onConfirm }: ClipboardPopupProps) {
  const [activeTab, setActiveTab] = useState<'files' | 'clipboard'>('clipboard');
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen || activeTab !== 'clipboard') return;
    setLoading(true);
    window.electronAPI?.getClipboardHistory().then((history) => {
      setEntries([...history].reverse());
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [isOpen, activeTab]);

  // Clear selection and search when popup closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set());
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredEntries = searchQuery.trim()
    ? entries.filter((e) => {
        const q = searchQuery.toLowerCase();
        return e.preview.toLowerCase().includes(q) || e.content.toLowerCase().includes(q);
      })
    : entries;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = entries.filter((e) => selectedIds.has(e.id));
    onConfirm?.(selected);
    setSelectedIds(new Set());
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <PopupContainer isOpen={isOpen} fullWidth>
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-2">
        <button
          onClick={() => setActiveTab('files')}
          className={`
            px-3 py-1.5 rounded-[var(--radius-md)]
            text-[var(--font-size-sm)] font-medium
            border-none cursor-pointer transition-colors
            ${activeTab === 'files'
              ? 'bg-[var(--accent-bg)] text-[var(--accent-color)]'
              : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'
            }
          `}
        >
          Files
        </button>
        <button
          onClick={() => setActiveTab('clipboard')}
          className={`
            px-3 py-1.5 rounded-[var(--radius-md)]
            text-[var(--font-size-sm)] font-medium
            border-none cursor-pointer transition-colors
            ${activeTab === 'clipboard'
              ? 'bg-[var(--accent-bg)] text-[var(--accent-color)]'
              : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'
            }
          `}
        >
          Clipboard
        </button>
      </div>

      {/* Files tab (placeholder) */}
      {activeTab === 'files' && (
        <div className="p-6 text-center text-[var(--font-size-sm)] text-[var(--text-muted)]">
          Drag files here or click to browse
        </div>
      )}

      {/* Clipboard tab */}
      {activeTab === 'clipboard' && (
        <div className="flex flex-col">
          {/* Search box */}
          <div className="px-3 pb-2">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search clipboard..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="
                  w-full pl-8 pr-3 py-1.5
                  border border-[var(--border-light)]
                  rounded-[var(--radius-md)]
                  text-[var(--font-size-sm)]
                  bg-[var(--bg-primary)]
                  text-[var(--text-primary)]
                  placeholder:text-[var(--text-muted)]
                  outline-none
                  focus:border-[var(--accent-color)]
                  transition-colors
                "
              />
            </div>
          </div>

          <div className="max-h-[360px] overflow-y-auto px-3 pb-3">
          {loading && (
            <div className="p-6 text-center text-[var(--font-size-sm)] text-[var(--text-muted)]">
              Loading...
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div className="p-6 text-center text-[var(--font-size-sm)] text-[var(--text-muted)]">
              No clipboard history yet. Copy something to get started.
            </div>
          )}

          {!loading && entries.length > 0 && filteredEntries.length === 0 && (
            <div className="p-6 text-center text-[var(--font-size-sm)] text-[var(--text-muted)]">
              No matches for "{searchQuery}"
            </div>
          )}

          {!loading && filteredEntries.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {filteredEntries.map((entry) => (
                <ClipboardCard
                  key={entry.id}
                  entry={entry}
                  formatTime={formatTime}
                  selected={selectedIds.has(entry.id)}
                  onClick={() => toggleSelect(entry.id)}
                />
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Bottom confirmation bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-light)]">
          <span className="text-[var(--font-size-sm)] text-[var(--text-secondary)]">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleConfirm}
            className="
              px-4 py-1.5 rounded-[var(--radius-md)]
              bg-[var(--accent-color)] text-white
              text-[var(--font-size-sm)] font-medium
              border-none cursor-pointer
              hover:opacity-90 transition-opacity
            "
          >
            Attach
          </button>
        </div>
      )}
    </PopupContainer>
  );
}

function ClipboardCard({ entry, formatTime, selected, onClick }: {
  entry: ClipboardEntry;
  formatTime: (ts: number) => string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);

  // Load image thumbnail
  useEffect(() => {
    if (entry.type !== 'image') return;
    window.electronAPI?.readFile(entry.content).then((result) => {
      if (result.exists && result.base64) {
        setThumbSrc(result.base64);
      }
    });
  }, [entry.type, entry.content]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      onClick={onClick}
      className={`
        flex flex-col gap-2 p-3 h-[140px]
        rounded-[var(--radius-md)]
        border-2
        bg-[var(--bg-primary)]
        cursor-pointer
        transition-colors duration-[var(--transition-fast)]
        overflow-hidden
        relative
        ${selected
          ? 'border-[var(--accent-color)] bg-[var(--accent-bg)]'
          : 'border-[var(--border-light)] hover:border-[var(--border-color)]'
        }
      `}
    >
      {/* Selection checkmark */}
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--accent-color)] flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
      {entry.type === 'image' ? (
        <>
          {/* Image thumbnail */}
          <div className="flex-1 min-h-0 rounded overflow-hidden bg-[var(--hover-bg)] flex items-center justify-center">
            {thumbSrc ? (
              <img src={thumbSrc} alt="Clipboard image" className="w-full h-full object-cover" />
            ) : (
              <div className="text-[var(--text-muted)]"><ImageIcon /></div>
            )}
          </div>
          {/* Meta */}
          <div className="text-[var(--font-size-xs)] text-[var(--text-muted)] mt-auto">
            {formatTime(entry.timestamp)}
            {entry.fileSize ? ` · ${formatSize(entry.fileSize)}` : ''}
          </div>
        </>
      ) : (
        <>
          {/* Type icon */}
          <div className="text-[var(--text-muted)]">
            {entry.type === 'link' ? <LinkIcon /> : <TextIcon />}
          </div>
          {/* Content preview (multi-line) */}
          <div className="text-[var(--font-size-sm)] text-[var(--text-primary)] leading-snug line-clamp-3 break-all">
            {entry.preview}
          </div>
          {/* Meta */}
          <div className="text-[var(--font-size-xs)] text-[var(--text-muted)] mt-auto">
            {formatTime(entry.timestamp)}
            {entry.charCount ? ` · ${entry.charCount.toLocaleString()} chars` : ''}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// Icons
// ============================================

// Clipboard card type icons
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

// Toolbar icons

function FolderIcon() {
  return (
    <div className="w-5 h-5 flex items-center justify-center text-[var(--text-muted)]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
