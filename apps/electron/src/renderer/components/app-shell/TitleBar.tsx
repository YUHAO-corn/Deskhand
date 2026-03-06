import { useAtom, useSetAtom } from 'jotai';
import { generateSessionId } from '@deskhand/core';
import {
  sidebarOpenAtom,
  activeSessionIdAtom,
  sessionMetaMapAtom,
  sessionIdsAtom,
  memoryOnlySessionsAtom,
} from '../../atoms/sessions';

export function TitleBar() {
  const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom);
  const [activeSessionId, setActiveSessionId] = useAtom(activeSessionIdAtom);
  const [sessionMetaMap, setSessionMetaMap] = useAtom(sessionMetaMapAtom);
  const setSessionIds = useSetAtom(sessionIdsAtom);
  const setMemoryOnlySessions = useSetAtom(memoryOnlySessionsAtom);

  const handleNewChat = () => {
    const newId = generateSessionId();
    const now = Date.now();
    setSessionMetaMap((prev) => {
      const next = new Map(prev);
      next.set(newId, { id: newId, createdAt: now });
      return next;
    });
    setSessionIds((prev) => [newId, ...prev]);
    setActiveSessionId(newId);
    setMemoryOnlySessions((prev) => new Set([...prev, newId]));
  };

  const currentSession = activeSessionId
    ? sessionMetaMap.get(activeSessionId)
    : null;

  const sessionTitle = currentSession?.name || currentSession?.preview || 'Untitled Decision';
  const messageCount = currentSession?.messageCount ?? 0;
  const workingDirectoryName = currentSession?.workingDirectory?.split('/').pop() || '';

  return (
    <header
      className="
        drag-region relative flex h-[var(--titlebar-height)] items-center gap-3 border-b border-[var(--color-line-soft)]
        bg-[var(--color-surface-panel)] px-4 shadow-[var(--elevation-1)]
      "
    >
      <div className="w-[72px] shrink-0" />

      <div className="flex items-center gap-1.5">
        <TitleBarButton
          isActive={sidebarOpen}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title="Toggle sidebar"
        >
          <svg className="h-[16px] w-[16px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </TitleBarButton>

        <TitleBarButton
          onClick={() => {
            // TODO: 激活搜索模式
          }}
          title="Search"
        >
          <svg className="h-[16px] w-[16px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </TitleBarButton>

        <TitleBarButton onClick={handleNewChat} title="New chat">
          <svg className="h-[16px] w-[16px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </TitleBarButton>
      </div>

      <div className="pointer-events-none absolute left-1/2 flex max-w-[58%] min-w-0 -translate-x-1/2 flex-col items-center gap-1">
        <span className="font-display w-full truncate text-center text-[15px] font-semibold text-[var(--color-text-primary)]">
          {sessionTitle}
        </span>
        <div className="flex items-center gap-1.5 text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          <MetaChip>{messageCount} messages</MetaChip>
          {workingDirectoryName && (
            <MetaChip>
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              {workingDirectoryName}
            </MetaChip>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center">
        <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
          {activeSessionId ? 'Live Session' : 'Idle'}
        </span>
      </div>
    </header>
  );
}

interface TitleBarButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  isActive?: boolean;
  title?: string;
}

function TitleBarButton({ children, onClick, isActive, title }: TitleBarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        'h-[34px] w-[34px] rounded-[var(--radius-pill)] border border-[var(--color-line-soft)]',
        'flex items-center justify-center bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]',
        'transition-all duration-200 hover:-translate-y-px hover:border-[var(--color-line-strong)]',
        'hover:bg-[var(--hover-bg)] hover:text-[var(--color-text-primary)]',
        isActive ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] px-2 py-0.5">
      {children}
    </span>
  );
}
