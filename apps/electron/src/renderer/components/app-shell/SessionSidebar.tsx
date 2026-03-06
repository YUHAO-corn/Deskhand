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

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sessions: SessionMeta[] = sessionIds
    .map((id) => sessionMetaMap.get(id))
    .filter((s): s is SessionMeta => s != null && !s.hidden);

  const handleSessionClick = (sessionId: string) => {
    setActiveSessionId(sessionId);
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
    setSessionMetaMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(sessionId);
      if (existing) next.set(sessionId, { ...existing, name: newName.trim() });
      return next;
    });
    await window.electronAPI?.updateSessionMeta(sessionId, { name: newName.trim() });
  };

  const handleArchive = async (sessionId: string) => {
    setMenuOpenId(null);
    setSessionMetaMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(sessionId);
      if (existing) next.set(sessionId, { ...existing, hidden: true });
      return next;
    });

    if (activeSessionId === sessionId) {
      const remaining = sessionIds.filter((id) => {
        if (id === sessionId) return false;
        const meta = sessionMetaMap.get(id);
        return meta && !meta.hidden;
      });
      setActiveSessionId(remaining[0] ?? null);
    }

    await window.electronAPI?.updateSessionMeta(sessionId, { hidden: true });
  };

  const handleDelete = async (sessionId: string) => {
    setDeletingId(null);
    setMenuOpenId(null);

    setSessionIds((prev) => prev.filter((id) => id !== sessionId));
    setSessionMetaMap((prev) => {
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });

    if (activeSessionId === sessionId) {
      const remaining = sessionIds.filter((id) => id !== sessionId);
      setActiveSessionId(remaining[0] ?? null);
    }

    setMemoryOnlySessions((prev) => {
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });

    await window.electronAPI?.deleteSession(sessionId);
  };

  return (
    <aside
      className={[
        'relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        isOpen ? 'w-[calc(var(--sidebar-width)+20px)] min-w-[calc(var(--sidebar-width)+20px)]' : 'w-0 min-w-0',
      ].join(' ')}
    >
      <div className="m-2.5 flex h-[calc(100%-20px)] w-[var(--sidebar-width)] flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line-soft)] bg-[var(--color-surface-panel)] shadow-[var(--elevation-2)]">
        <div className="border-b border-[var(--color-line-soft)] px-4 py-3">
          <p className="font-display text-[12px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Session Ledger</p>
          <p className="mt-1 text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">
            {sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2.5">
          {sessions.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-5 text-center">
              <p className="font-display text-[18px] text-[var(--color-text-secondary)]">No Brief Yet</p>
              <p className="mt-2 text-[var(--font-size-sm)] text-[var(--color-text-muted)]">Create a new session to start your first decision trail.</p>
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
                onRenameStart={() => {
                  setMenuOpenId(null);
                  setRenamingId(session.id);
                }}
                onRenameConfirm={(name) => handleRename(session.id, name)}
                onRenameCancel={() => setRenamingId(null)}
                onArchive={() => handleArchive(session.id)}
                onDeleteStart={() => {
                  setMenuOpenId(null);
                  setDeletingId(session.id);
                }}
                onDeleteConfirm={() => handleDelete(session.id)}
                onDeleteCancel={() => setDeletingId(null)}
              />
            ))
          )}
        </div>

        <div className="border-t border-[var(--color-line-soft)] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <GhostPillButton onClick={() => setSettingsOpen(true)} title="Settings">
              <svg className="h-[14px] w-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </GhostPillButton>

            <GhostPillButton onClick={() => {}} title="Update">
              <svg className="h-[14px] w-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Update
            </GhostPillButton>
          </div>
        </div>
      </div>
    </aside>
  );
}

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
  session,
  isActive,
  isRenaming,
  isMenuOpen,
  isDeleting,
  onClick,
  onMenuToggle,
  onMenuClose,
  onRenameStart,
  onRenameConfirm,
  onRenameCancel,
  onArchive,
  onDeleteStart,
  onDeleteConfirm,
  onDeleteCancel,
}: SessionItemProps) {
  const displayName = session.name || session.preview || 'Untitled Decision';
  const timeAgo = formatRelativeTime(session.lastMessageAt ?? session.createdAt);
  const [renameValue, setRenameValue] = useState(displayName);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(session.name || session.preview || '');
      setTimeout(() => renameInputRef.current?.focus(), 0);
    }
  }, [isRenaming, session.name, session.preview]);

  if (isDeleting) {
    return (
      <div className="mb-1.5 rounded-[var(--radius-control)] border border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] px-3 py-2.5">
        <p className="text-[var(--font-size-xs)] font-medium text-[var(--color-danger)]">Delete this session permanently?</p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={onDeleteConfirm}
            className="rounded-[var(--radius-pill)] border border-[var(--color-danger)] bg-[var(--color-danger)] px-2.5 py-1 text-[var(--font-size-xs)] font-medium text-[var(--color-surface-elevated)] transition-colors hover:bg-[var(--color-accent-strong)]"
          >
            Delete
          </button>
          <button
            onClick={onDeleteCancel}
            className="rounded-[var(--radius-pill)] border border-[var(--color-line-strong)] bg-[var(--color-surface-elevated)] px-2.5 py-1 text-[var(--font-size-xs)] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--hover-bg)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (isRenaming) {
    return (
      <div className="mb-1.5 rounded-[var(--radius-control)] border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-3 py-2">
        <input
          ref={renameInputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRenameConfirm(renameValue);
            if (e.key === 'Escape') onRenameCancel();
          }}
          onBlur={() => onRenameConfirm(renameValue)}
          className="w-full rounded-[var(--radius-control)] border border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] px-2.5 py-1.5 text-[var(--font-size-sm)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
        />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={[
        'group relative mb-1.5 cursor-pointer rounded-[var(--radius-control)] border px-3 py-2.5 transition-all',
        'duration-200',
        isActive
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] shadow-[var(--elevation-1)]'
          : 'border-transparent bg-[var(--color-surface-elevated)] hover:-translate-y-px hover:border-[var(--color-line-soft)] hover:bg-[var(--hover-bg)]',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">{displayName}</p>
          <div className="mt-1 flex items-center gap-1.5 text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
            <span>{timeAgo || 'just now'}</span>
            {session.hasUnread && <span className="inline-flex rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-surface-elevated)]">New</span>}
          </div>
        </div>

        <span className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle();
            }}
            className={[
              'rounded-[var(--radius-pill)] border border-transparent px-1.5 py-0.5 text-[14px] text-[var(--color-text-muted)] transition-colors',
              'hover:border-[var(--color-line-soft)] hover:bg-[var(--hover-bg)] hover:text-[var(--color-text-primary)]',
              isMenuOpen ? 'visible border-[var(--color-line-soft)] bg-[var(--hover-bg)]' : 'invisible group-hover:visible',
            ].join(' ')}
          >
            ···
          </button>
        </span>
      </div>

      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onMenuClose(); }} />
          <div className="absolute right-1 top-full z-50 mt-1.5 min-w-[160px] overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] py-1 shadow-[var(--elevation-2)]">
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

function GhostPillButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] px-2.5 py-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-text-secondary)] transition-all duration-200 hover:-translate-y-px hover:border-[var(--color-line-strong)] hover:bg-[var(--hover-bg)] hover:text-[var(--color-text-primary)]"
    >
      {children}
    </button>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={[
        'flex w-full items-center gap-2 border-none bg-transparent px-3 py-1.5 text-left text-[var(--font-size-sm)] transition-colors',
        danger
          ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--hover-bg)]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

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
