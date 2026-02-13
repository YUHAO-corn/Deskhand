/**
 * 会话侧边栏
 *
 * 📐 SPEC: docs/SPEC_SessionSidebar.md
 * 🎨 原型: deskhand-prototype/src/components/SessionSidebar.tsx
 *
 * 职责：
 * - 显示会话列表（按时间排序）
 * - 切换当前会话
 * - 会话操作菜单（Rename / Archive / Delete）
 * - 提供设置入口
 */

import { useState, useRef, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import {
  sidebarOpenAtom,
  settingsOpenAtom,
  activeSessionIdAtom,
  sessionMetaMapAtom,
  sessionIdsAtom,
  memoryOnlySessionsAtom,
} from '../../atoms/sessions';
import type { SessionMeta } from '@deskhand/core';

export function SessionSidebar() {
  const [isOpen] = useAtom(sidebarOpenAtom);
  const [, setSettingsOpen] = useAtom(settingsOpenAtom);
  const [activeSessionId, setActiveSessionId] = useAtom(activeSessionIdAtom);
  const [sessionMetaMap, setSessionMetaMap] = useAtom(sessionMetaMapAtom);
  const [sessionIds, setSessionIds] = useAtom(sessionIdsAtom);
  const setMemoryOnlySessions = useSetAtom(memoryOnlySessionsAtom);

  // Menu state: which session's menu is open
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  // Rename state: which session is being renamed
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sessions: SessionMeta[] = sessionIds
    .map((id) => sessionMetaMap.get(id))
    .filter((s): s is SessionMeta => s != null && !s.hidden);

  // ─── Actions ───

  const handleSessionClick = (sessionId: string) => {
    setActiveSessionId(sessionId);
    // Clear unread indicator
    const meta = sessionMetaMap.get(sessionId);
    if (meta?.hasUnread) {
      setSessionMetaMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(sessionId);
        if (existing) next.set(sessionId, { ...existing, hasUnread: false });
        return next;
      });
      window.electronAPI?.updateSessionMeta(sessionId, { hasUnread: false });
    }
  };

  const handleRename = async (sessionId: string, newName: string) => {
    setRenamingId(null);
    if (!newName.trim()) return;
    // Update atom
    setSessionMetaMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(sessionId);
      if (existing) next.set(sessionId, { ...existing, name: newName.trim() });
      return next;
    });
    // Persist
    await window.electronAPI?.updateSessionMeta(sessionId, { name: newName.trim() });
  };

  const handleArchive = async (sessionId: string) => {
    setMenuOpenId(null);
    // Update atom
    setSessionMetaMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(sessionId);
      if (existing) next.set(sessionId, { ...existing, hidden: true });
      return next;
    });
    // If archived session was active, switch to next
    if (activeSessionId === sessionId) {
      const remaining = sessionIds.filter((id) => {
        if (id === sessionId) return false;
        const meta = sessionMetaMap.get(id);
        return meta && !meta.hidden;
      });
      setActiveSessionId(remaining[0] ?? null);
    }
    // Persist
    await window.electronAPI?.updateSessionMeta(sessionId, { hidden: true });
  };

  const handleDelete = async (sessionId: string) => {
    setDeletingId(null);
    setMenuOpenId(null);
    // Remove from atoms
    setSessionIds((prev) => prev.filter((id) => id !== sessionId));
    setSessionMetaMap((prev) => {
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
    // If deleted session was active, switch to next
    if (activeSessionId === sessionId) {
      const remaining = sessionIds.filter((id) => id !== sessionId);
      setActiveSessionId(remaining[0] ?? null);
    }
    // Remove from memory-only if applicable
    setMemoryOnlySessions((prev) => {
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });
    // Delete from disk
    await window.electronAPI?.deleteSession(sessionId);
  };

  return (
    <aside
      className={`
        bg-[var(--bg-sidebar)]
        border-r border-[var(--border-color)]
        flex flex-col overflow-hidden
        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isOpen ? 'w-[var(--sidebar-width)] min-w-[var(--sidebar-width)]' : 'w-0 min-w-0'}
      `}
    >
      <div className="w-[var(--sidebar-width)] h-full flex flex-col pt-2">
        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto px-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center">
              <p className="text-[var(--font-size-sm)] text-[var(--text-muted)]">
                No conversations yet
              </p>
              <p className="text-[var(--font-size-xs)] text-[var(--text-muted)] mt-1 opacity-60">
                Start a new conversation to get going
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                isRenaming={session.id === renamingId}
                isMenuOpen={session.id === menuOpenId}
                isDeleting={session.id === deletingId}
                onClick={() => handleSessionClick(session.id)}
                onMenuToggle={() => setMenuOpenId(menuOpenId === session.id ? null : session.id)}
                onMenuClose={() => setMenuOpenId(null)}
                onRenameStart={() => { setMenuOpenId(null); setRenamingId(session.id); }}
                onRenameConfirm={(name) => handleRename(session.id, name)}
                onRenameCancel={() => setRenamingId(null)}
                onArchive={() => handleArchive(session.id)}
                onDeleteStart={() => { setMenuOpenId(null); setDeletingId(session.id); }}
                onDeleteConfirm={() => handleDelete(session.id)}
                onDeleteCancel={() => setDeletingId(null)}
              />
            ))
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="border-t border-[var(--border-color)] px-3 py-2.5 flex items-center justify-between">
          <button
            onClick={() => setSettingsOpen(true)}
            className="
              text-[16px] text-[var(--text-muted)]
              px-2 py-1 rounded-[var(--radius-sm)]
              tracking-[1.5px]
              hover:bg-[var(--hover-bg)] hover:text-[var(--text-secondary)]
              transition-colors duration-[var(--transition-fast)]
              border-none bg-transparent cursor-pointer
            "
          >
            ···
          </button>
          <button
            onClick={() => {}}
            className="
              text-[var(--font-size-xs)] text-[var(--text-secondary)]
              px-3 py-1.5 rounded-[var(--radius-md)]
              hover:bg-[var(--hover-bg)]
              transition-colors duration-[var(--transition-fast)]
              border-none bg-transparent cursor-pointer
              font-medium flex items-center gap-1
            "
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="16 12 12 8 8 12" />
              <line x1="12" y1="16" x2="12" y2="8" />
            </svg>
            Update
          </button>
        </div>
      </div>
    </aside>
  );
}

// ============================================
// SessionItem
// ============================================

interface SessionItemProps {
  session: SessionMeta;
  isActive: boolean;
  isRenaming: boolean;
  isMenuOpen: boolean;
  isDeleting: boolean;
  onClick: () => void;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onRenameStart: () => void;
  onRenameConfirm: (name: string) => void;
  onRenameCancel: () => void;
  onArchive: () => void;
  onDeleteStart: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}

function SessionItem({
  session, isActive, isRenaming, isMenuOpen, isDeleting,
  onClick, onMenuToggle, onMenuClose,
  onRenameStart, onRenameConfirm, onRenameCancel,
  onArchive, onDeleteStart, onDeleteConfirm, onDeleteCancel,
}: SessionItemProps) {
  const displayName = session.name || session.preview || 'New Chat';
  const timeAgo = formatRelativeTime(session.lastMessageAt ?? session.createdAt);
  const [renameValue, setRenameValue] = useState(displayName);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(session.name || session.preview || '');
      setTimeout(() => renameInputRef.current?.focus(), 0);
    }
  }, [isRenaming, session.name, session.preview]);

  // Delete confirmation overlay
  if (isDeleting) {
    return (
      <div className="rounded-[var(--radius-md)] px-[14px] py-[10px] mb-1 bg-red-50 border border-red-200">
        <p className="text-[var(--font-size-xs)] text-red-700 mb-2">Delete this conversation?</p>
        <div className="flex gap-2">
          <button
            onClick={onDeleteConfirm}
            className="text-[var(--font-size-xs)] px-2.5 py-1 rounded bg-red-500 text-white border-none cursor-pointer hover:bg-red-600"
          >
            Delete
          </button>
          <button
            onClick={onDeleteCancel}
            className="text-[var(--font-size-xs)] px-2.5 py-1 rounded bg-transparent text-[var(--text-secondary)] border border-[var(--border-color)] cursor-pointer hover:bg-[var(--hover-bg)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Rename mode
  if (isRenaming) {
    return (
      <div className="rounded-[var(--radius-md)] px-[14px] py-[8px] mb-1 bg-[var(--selected-bg)]">
        <input
          ref={renameInputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRenameConfirm(renameValue);
            if (e.key === 'Escape') onRenameCancel();
          }}
          onBlur={() => onRenameConfirm(renameValue)}
          className="
            w-full bg-white border border-[var(--border-color)] rounded px-2 py-1
            text-[var(--font-size-sm)] text-[var(--text-primary)]
            outline-none focus:border-[var(--accent-color)]
          "
        />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`
        group relative
        rounded-[var(--radius-md)] cursor-pointer
        text-[var(--font-size-sm)] font-medium
        px-[14px] py-[10px] mb-1
        transition-colors duration-[var(--transition-fast)]
        flex items-center justify-between gap-2
        ${isActive
          ? 'bg-[var(--selected-bg)] text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
        }
      `}
    >
      {/* Unread indicator */}
      {session.hasUnread && (
        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
      )}
      <span className="whitespace-nowrap overflow-hidden text-ellipsis flex-1">
        {displayName}
      </span>

      {/* Time / ··· button area */}
      <span className="flex-shrink-0 relative">
        {/* Time (hidden when menu button visible on hover) */}
        {timeAgo && (
          <span className="text-[var(--font-size-xs)] text-[var(--text-muted)] group-hover:invisible">
            {timeAgo}
          </span>
        )}
        {/* ··· button (visible on hover) */}
        <button
          onClick={(e) => { e.stopPropagation(); onMenuToggle(); }}
          className={`
            absolute right-0 top-1/2 -translate-y-1/2
            text-[14px] text-[var(--text-muted)] tracking-[1px]
            px-1 py-0.5 rounded
            border-none bg-transparent cursor-pointer
            hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]
            transition-colors
            ${isMenuOpen ? 'visible' : 'invisible group-hover:visible'}
          `}
        >
          ···
        </button>
      </span>

      {/* Dropdown menu */}
      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onMenuClose(); }} />
          <div className="absolute right-2 top-full z-50 mt-1 py-1 bg-white rounded-lg shadow-lg border border-[var(--border-color)] min-w-[140px]">
            <MenuItem onClick={onRenameStart}>
              <PencilIcon /> Rename
            </MenuItem>
            <MenuItem onClick={onArchive}>
              <ArchiveIcon /> Archive
            </MenuItem>
            <MenuItem onClick={onDeleteStart} danger>
              <TrashIcon /> Delete
            </MenuItem>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// Menu helpers
// ============================================

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`
        w-full text-left px-3 py-1.5
        text-[var(--font-size-sm)] flex items-center gap-2
        border-none bg-transparent cursor-pointer
        transition-colors
        ${danger
          ? 'text-red-500 hover:bg-red-50'
          : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
        }
      `}
    >
      {children}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/** Format timestamp to relative time (2m / 1h / 3d) */
function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}
