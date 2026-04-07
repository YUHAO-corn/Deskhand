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
  permissionModeAtom,
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
      window.electronAPI?.saveConfig({ lastWorkingDirectory: path });
    }
  };

  const dirName = workingDirectory ? workingDirectory.split('/').pop() : null;

  return (
    <PopupContainer isOpen={isOpen} position="left-[0px]" minWidth={240}>
      <PopupHeader title="Workspace" />
      <div className="p-1.5">
        {workingDirectory && (
          <PopupItem
            icon={<FolderIcon />}
            label={dirName || workingDirectory}
            hint="current"
            selected
          />
        )}
        <PopupItem
          icon={<PlusIcon />}
          label={workingDirectory ? 'Change directory...' : 'Select directory...'}
          onClick={handleSelectDirectory}
        />
      </div>
    </PopupContainer>
  );
}

// ============================================
// AttachMenuPopup - 附件入口菜单（类似 Claude 的 + 下拉）
// ============================================

interface AttachMenuPopupProps {
  isOpen: boolean;
  onSelectFiles: () => void;
  onOpenClipboard: () => void;
  onOpenSkills: () => void;
  onOpenMCP: () => void;
}

export function AttachMenuPopup({ isOpen, onSelectFiles, onOpenClipboard, onOpenSkills, onOpenMCP }: AttachMenuPopupProps) {
  return (
    <PopupContainer isOpen={isOpen} position="left-[0px]" minWidth={240}>
      <div className="p-1.5">
        <PopupSectionLabel>Attach</PopupSectionLabel>
        <PopupItem
          icon={<FileUploadIcon />}
          label="Upload files"
          onClick={onSelectFiles}
        />
        <PopupItem
          icon={<ClipboardIcon />}
          label="Clipboard history"
          arrow
          onClick={onOpenClipboard}
        />

        <PopupDivider />

        <PopupSectionLabel>Skills</PopupSectionLabel>
        <PopupItem
          icon={<WrenchIcon />}
          label="Skills"
          arrow
          onClick={onOpenSkills}
        />

        <PopupDivider />

        <PopupSectionLabel>MCP</PopupSectionLabel>
        <PopupItem
          icon={<LayersIcon />}
          label="MCP Connections"
          arrow
          onClick={onOpenMCP}
        />
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
    <PopupContainer isOpen={isOpen} position="left-[32px]" minWidth={220}>
      <PopupHeader title="Interact" />
      <div className="p-1.5">
        {interactModes.map((mode) => (
          <PopupItem
            key={mode.tag}
            icon={mode.icon}
            label={mode.label}
            hint={mode.description}
            onClick={() => onSelect(mode.tag)}
          />
        ))}
      </div>
    </PopupContainer>
  );
}

// ============================================
// ToolsPopup - Skills 子面板（从 + 菜单进入）
// ============================================

interface ToolsPopupProps {
  isOpen: boolean;
  onBack: () => void;
}

export function ToolsPopup({ isOpen, onBack }: ToolsPopupProps) {
  const [skills, setSkills] = useAtom(skillsAtom);

  // Refresh skills from disk when popup opens
  const [lastOpen, setLastOpen] = useState(false);
  if (isOpen && !lastOpen) {
    window.electronAPI?.loadSkills().then(setSkills);
  }
  if (isOpen !== lastOpen) setLastOpen(isOpen);

  return (
    <PopupContainer isOpen={isOpen} position="left-[0px]" minWidth={260}>
      <PopupHeader title="Skills" onBack={onBack} />
      <div className="p-1.5 max-h-80 overflow-y-auto">
        {skills.length === 0 ? (
          <div className="px-2.5 py-3 text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
            No skills installed
          </div>
        ) : (
          skills.map((skill) => (
            <PopupItem
              key={skill.id}
              icon={<WrenchIcon />}
              label={skill.name}
              hint="active"
            />
          ))
        )}
        <PopupDivider />
        <PopupItem
          icon={<PlusIcon />}
          label="Install skill..."
        />
      </div>
    </PopupContainer>
  );
}

// ============================================
// MCPPopup - MCP Connections 子面板（从 + 菜单进入）
// ============================================

interface MCPPopupProps {
  isOpen: boolean;
  onBack: () => void;
}

export function MCPPopup({ isOpen, onBack }: MCPPopupProps) {
  // TODO: 从 MCP 配置加载 server 列表
  const mcpServers = [
    { name: 'Web fetch', toolCount: 1 },
    { name: 'Web search', toolCount: 1 },
  ];

  return (
    <PopupContainer isOpen={isOpen} position="left-[0px]" minWidth={260}>
      <PopupHeader title="MCP Connections" onBack={onBack} />
      <div className="p-1.5 max-h-80 overflow-y-auto">
        {mcpServers.length === 0 ? (
          <div className="px-2.5 py-3 text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
            No MCP servers connected
          </div>
        ) : (
          <>
            <PopupSectionLabel>Connected</PopupSectionLabel>
            {mcpServers.map((server) => (
              <PopupItem
                key={server.name}
                icon={<LayersIcon />}
                label={server.name}
                hint={`${server.toolCount} tool${server.toolCount !== 1 ? 's' : ''}`}
              />
            ))}
          </>
        )}
        <PopupDivider />
        <PopupItem
          icon={<PlusIcon />}
          label="Add MCP server..."
        />
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
    { id: 'claude-opus-4-6', name: 'Opus 4.6' },
    { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6' },
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
    <PopupContainer isOpen={isOpen} position="right-[0px]" minWidth={220}>
      <PopupHeader title="Model" />
      <div className="p-1.5">
        {models.map((model) => (
          <PopupItem
            key={model.id}
            label={model.name}
            selected={selectedModel === model.id}
            onClick={() => handleSelectModel(model.id)}
          />
        ))}
      </div>
    </PopupContainer>
  );
}

// ============================================
// PermissionPopup - 权限模式选择
// ============================================

interface PermissionPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PermissionPopup({ isOpen, onClose }: PermissionPopupProps) {
  const [permissionMode, setPermissionMode] = useAtom(permissionModeAtom);

  const handleSelect = (mode: 'ask' | 'allow-all') => {
    setPermissionMode(mode);
    onClose();
  };

  return (
    <PopupContainer isOpen={isOpen} position="left-[60px]" minWidth={260}>
      <PopupHeader title="Permission" />
      <div className="p-1.5">
        <PopupItem
          label="Ask"
          hint="Confirms dangerous operations"
          selected={permissionMode === 'ask'}
          onClick={() => handleSelect('ask')}
        />
        <PopupItem
          label="Auto"
          hint="Only confirms delete commands"
          selected={permissionMode === 'allow-all'}
          onClick={() => handleSelect('allow-all')}
        />
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
        bg-[var(--color-surface-panel)]
        rounded-[var(--radius-lg)]
        shadow-[var(--shadow-popup)]
        border border-[var(--color-line-soft)]
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
  onBack?: () => void;
}

function PopupHeader({ title, onBack }: PopupHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-line-soft)]">
      {onBack && (
        <button
          onClick={onBack}
          className="
            w-6 h-6 flex items-center justify-center
            border border-[var(--color-line-soft)] bg-transparent
            rounded-[var(--radius-sm)] cursor-pointer
            text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]
            hover:border-[var(--color-text-secondary)]
          "
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{title}</span>
    </div>
  );
}

function PopupSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
      {children}
    </div>
  );
}

interface PopupItemProps {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  arrow?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

function PopupItem({ icon, label, hint, arrow, selected, onClick }: PopupItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2.5 w-full p-2 px-2.5
        border-none bg-transparent
        rounded-[var(--radius-md)] cursor-pointer
        text-left text-[var(--font-size-sm)]
        transition-colors duration-[var(--transition-fast)]
        hover:bg-[var(--hover-bg)]
        ${selected ? 'bg-[var(--color-accent-soft)]' : ''}
      `}
    >
      {icon && (
        <span className="w-4 h-4 flex items-center justify-center text-[var(--color-text-muted)] shrink-0">
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0 truncate text-[var(--color-text-primary)]">{label}</span>
      {hint && (
        <span className="shrink-0 text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{hint}</span>
      )}
      {arrow && (
        <span className="shrink-0 text-[var(--color-text-muted)] text-[11px]">&gt;</span>
      )}
    </button>
  );
}

function PopupDivider() {
  return <div className="h-px bg-[var(--color-line-soft)] mx-2 my-1" />;
}

// ============================================
// ClipboardPopup - 剪贴板快速附加（v3 redesign）
// 设计理念：单列列表 + 单击即附加 + 时间分组
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
  onBack: () => void;
}

type TimeGroup = { label: string; entries: ClipboardEntry[] };

function groupByTime(entries: ClipboardEntry[]): TimeGroup[] {
  const now = Date.now();
  const groups: Record<string, ClipboardEntry[]> = {};
  const order: string[] = [];

  for (const entry of entries) {
    const diff = now - entry.timestamp;
    let label: string;
    if (diff < 300_000) label = 'Just now';
    else if (diff < 3600_000) label = 'Recent';
    else if (diff < 86400_000) label = 'Earlier today';
    else label = 'Older';

    if (!groups[label]) {
      groups[label] = [];
      order.push(label);
    }
    groups[label]!.push(entry);
  }

  return order.map((label) => ({ label, entries: groups[label]! }));
}

export function ClipboardPopup({ isOpen, onConfirm, onBack }: ClipboardPopupProps) {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    window.electronAPI?.getClipboardHistory().then((history) => {
      setEntries([...history].reverse());
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setShowSearch(false);
    }
  }, [isOpen]);

  const filteredEntries = searchQuery.trim()
    ? entries.filter((e) => {
        const q = searchQuery.toLowerCase();
        return e.preview.toLowerCase().includes(q) || e.content.toLowerCase().includes(q);
      })
    : entries;

  const groups = groupByTime(filteredEntries);

  const handleAttach = (entry: ClipboardEntry) => {
    onConfirm?.([entry]);
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <PopupContainer isOpen={isOpen} position="left-[0px]" minWidth={300}>
      {/* Header: reuse PopupHeader style but add search toggle */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-line-soft)]">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="
              w-6 h-6 flex items-center justify-center
              border border-[var(--color-line-soft)] bg-transparent
              rounded-[var(--radius-sm)] cursor-pointer
              text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]
              hover:border-[var(--color-text-secondary)]
            "
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">Clipboard history</span>
        </div>
        {entries.length > 5 && (
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`
              w-6 h-6 flex items-center justify-center
              rounded-[var(--radius-sm)] border-none cursor-pointer
              transition-colors
              ${showSearch
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                : 'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--hover-bg)]'
              }
            `}
          >
            <SearchIcon />
          </button>
        )}
      </div>

      {/* Collapsible search */}
      {showSearch && (
        <div className="px-3 pt-2 pb-1">
          <input
            type="text"
            placeholder="Filter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="
              w-full px-3 py-1.5
              border border-[var(--color-line-soft)]
              rounded-[var(--radius-md)]
              text-[var(--font-size-sm)]
              bg-[var(--color-surface-canvas)]
              text-[var(--color-text-primary)]
              placeholder:text-[var(--color-text-muted)]
              outline-none
              focus:border-[var(--color-accent)]
              transition-colors
            "
          />
        </div>
      )}

      {/* Content */}
      <div className="max-h-[380px] overflow-y-auto">
        {loading && (
          <div className="p-8 text-center text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
            Loading...
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-[var(--color-text-muted)] mb-2">
              <ClipboardEmptyIcon />
            </div>
            <div className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
              No clipboard history yet
            </div>
            <div className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] mt-1 opacity-60">
              Copy something to see it here
            </div>
          </div>
        )}

        {!loading && entries.length > 0 && filteredEntries.length === 0 && (
          <div className="p-6 text-center text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
            No matches
          </div>
        )}

        {!loading && groups.map((group) => (
          <div key={group.label}>
            {/* Time group header */}
            <div className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {group.label}
            </div>
            {/* Items */}
            <div className="px-2 pb-1">
              {group.entries.map((entry) => (
                <ClipboardRow
                  key={entry.id}
                  entry={entry}
                  formatTime={formatTime}
                  formatSize={formatSize}
                  onAttach={() => handleAttach(entry)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </PopupContainer>
  );
}

function ClipboardRow({ entry, formatTime, formatSize, onAttach }: {
  entry: ClipboardEntry;
  formatTime: (ts: number) => string;
  formatSize: (bytes: number) => string;
  onAttach: () => void;
}) {
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);

  useEffect(() => {
    if (entry.type !== 'image') return;
    window.electronAPI?.readFile(entry.content).then((result) => {
      if (result.exists && result.base64) {
        setThumbSrc(result.base64);
      }
    });
  }, [entry.type, entry.content]);

  return (
    <button
      onClick={onAttach}
      className="
        flex items-center gap-2.5 w-full p-1.5 px-2.5
        border-none bg-transparent
        rounded-[var(--radius-md)] cursor-pointer
        text-left
        transition-colors duration-[var(--transition-fast)]
        hover:bg-[var(--hover-bg)]
        group
      "
    >
      {/* Type icon - compact */}
      {entry.type === 'image' ? (
        <div className="w-6 h-6 rounded shrink-0 overflow-hidden bg-[var(--hover-bg)] flex items-center justify-center">
          {thumbSrc ? (
            <img src={thumbSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          )}
        </div>
      ) : (
        <div className="w-6 h-6 rounded shrink-0 flex items-center justify-center text-[var(--color-text-muted)]">
          {entry.type === 'link' ? <LinkIcon /> : <TextIcon />}
        </div>
      )}

      {/* Content - single line truncated */}
      <span className="flex-1 min-w-0 truncate text-[var(--font-size-sm)] text-[var(--color-text-primary)]">
        {entry.type === 'image' ? 'Screenshot' : entry.preview}
      </span>

      {/* Meta info - compact */}
      <span className="shrink-0 text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
        {entry.charCount ? `${entry.charCount.toLocaleString()} chars` :
         entry.fileSize ? formatSize(entry.fileSize) :
         entry.type === 'image' ? 'image' : formatTime(entry.timestamp)}
      </span>
    </button>
  );
}

function ClipboardEmptyIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-40">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
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

// Toolbar icons

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
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

function FileUploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}
