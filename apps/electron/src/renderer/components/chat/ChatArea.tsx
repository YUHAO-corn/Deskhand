import { useMemo, useEffect, useRef, useCallback } from 'react';
import { useAtom } from 'jotai';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import {
  activeSessionIdAtom,
  artifactPanelOpenAtom,
  sessionMessagesFamily,
  sessionProcessingFamily,
  loadedSessionsAtom,
} from '../../atoms/sessions';
import { groupMessagesByTurn, type Turn, type AssistantTurn } from './turn-utils';
import { useAgentEvents } from '../../hooks/useAgentEvents';
import { InputToolbar } from '../input/InputToolbar';
import { UserMessageBubble } from './UserMessageBubble';
import { TurnCard } from './TurnCard';
import { ProcessingIndicator } from './ProcessingIndicator';

function getTurnKey(turn: Turn): string {
  if (turn.type === 'assistant') {
    return (turn as AssistantTurn).turnId;
  }
  return turn.message.id;
}

export function ChatArea() {
  const [activeSessionId] = useAtom(activeSessionIdAtom);
  const [artifactPanelOpen, setArtifactPanelOpen] = useAtom(artifactPanelOpenAtom);

  useAgentEvents({
    sessionId: activeSessionId ?? '',
    enabled: !!activeSessionId,
  });

  const messagesAtom = sessionMessagesFamily(activeSessionId ?? '__empty__');
  const [messages, setMessages] = useAtom(messagesAtom);

  const processingAtom = sessionProcessingFamily(activeSessionId ?? '__empty__');
  const [isProcessing] = useAtom(processingAtom);

  const [loadedSessions, setLoadedSessions] = useAtom(loadedSessionsAtom);

  useEffect(() => {
    if (!activeSessionId) return;
    if (loadedSessions.has(activeSessionId)) return;

    const loadMessages = async () => {
      try {
        const stored = await window.electronAPI?.getSession(activeSessionId);
        if (stored?.messages?.length) {
          const msgs = stored.messages.map((sm) => ({
            id: sm.id,
            role: sm.type,
            content: sm.content,
            timestamp: sm.timestamp ?? 0,
            toolName: sm.toolName,
            toolUseId: sm.toolUseId,
            toolInput: sm.toolInput,
            toolResult: sm.toolResult,
            toolStatus: sm.toolStatus,
            toolDuration: sm.toolDuration,
            isIntermediate: sm.isIntermediate,
            turnId: sm.turnId,
            attachments: sm.attachments,
            planPath: sm.planPath,
            errorCode: sm.errorCode,
            errorTitle: sm.errorTitle,
            errorDetails: sm.errorDetails,
            errorCanRetry: sm.errorCanRetry,
            actions: sm.actions,
          }) as import('@deskhand/core').Message[]);
          setMessages(msgs);
        }
      } catch (err) {
        console.error('[ChatArea] Failed to load session messages:', err);
      }
      setLoadedSessions((prev) => new Set([...prev, activeSessionId]));
    };

    loadMessages();
  }, [activeSessionId, loadedSessions, setLoadedSessions, setMessages]);

  const turns = useMemo(() => groupMessagesByTurn(messages), [messages]);
  const isEmpty = turns.length === 0;

  const lastTurn = turns[turns.length - 1];
  const showPendingThinking = isProcessing && lastTurn?.type !== 'assistant';

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const isAtBottomRef = useRef(true);

  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    isAtBottomRef.current = atBottom;
  }, []);

  // Auto-scroll when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (isAtBottomRef.current && turns.length > 0) {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
    }
  }, [messages, turns.length]);

  return (
    <div className="relative flex min-w-[400px] flex-1 flex-col overflow-hidden bg-[var(--color-surface-canvas)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-[14%] top-[-22%] h-[64%] w-[66%] rounded-full bg-[radial-gradient(circle,_var(--color-accent-soft)_0%,_transparent_72%)]" />
        <div className="absolute right-[-20%] top-[8%] h-[48%] w-[60%] rounded-full bg-[radial-gradient(circle,_var(--color-surface-elevated)_0%,_transparent_68%)]" />
      </div>

      <div className="relative z-10 flex-1 overflow-hidden px-5">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-[440px] rounded-[var(--radius-card)] border border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] px-8 py-10 text-center shadow-[var(--elevation-1)]">
              <p className="font-display text-[26px] text-[var(--color-text-primary)]">New Conversation</p>
              <p className="mt-2 text-[var(--font-size-base)] text-[var(--color-text-muted)]">
                Ask a question, describe a task, or paste context to get started.
              </p>
              <p className="mt-1 text-[var(--font-size-sm)] text-[var(--color-text-muted)] opacity-80">
                Generated files will appear in Artifacts when they are created.
              </p>
            </div>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={turns}
            atBottomStateChange={handleAtBottomStateChange}
            followOutput="smooth"
            initialTopMostItemIndex={turns.length - 1}
            increaseViewportBy={200}
            itemContent={(index, turn) => (
              <div className="mx-auto max-w-[880px]">
                <TurnRenderer
                  key={getTurnKey(turn)}
                  turn={turn}
                  prevTurnType={index > 0 ? turns[index - 1].type : undefined}
                />
                {index === turns.length - 1 && showPendingThinking && (
                  <div className="mb-2">
                    <ProcessingIndicator />
                  </div>
                )}
              </div>
            )}
            components={{
              Header: () => <div className="h-8" />,
              Footer: () => <div className="h-8" />,
            }}
          />
        )}
      </div>

      <div
        className={[
          'absolute right-5 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-1.5 rounded-[var(--radius-card)] border border-[var(--color-line-soft)]',
          'bg-[var(--color-surface-panel)] p-2 shadow-[var(--elevation-1)] transition-opacity duration-200',
          artifactPanelOpen ? 'pointer-events-none opacity-0' : 'opacity-100',
        ].join(' ')}
      >
        <RightToolbarButton onClick={() => setArtifactPanelOpen(!artifactPanelOpen)} title="Artifacts">
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </RightToolbarButton>
      </div>

      <InputToolbar />
    </div>
  );
}

interface TurnRendererProps {
  turn: Turn;
  prevTurnType?: Turn['type'];
}

function TurnRenderer({ turn, prevTurnType }: TurnRendererProps) {
  const isConsecutiveAssistant = turn.type === 'assistant' && prevTurnType === 'assistant';
  const spacing = isConsecutiveAssistant ? 'mb-3' : 'mb-7';

  switch (turn.type) {
    case 'user':
      return (
        <div className={spacing}>
          <UserMessageBubble message={turn.message} />
        </div>
      );

    case 'assistant':
      return (
        <div className={spacing}>
          <TurnCard turn={turn} />
        </div>
      );

    case 'system':
      return (
        <div className={spacing}>
          <div className="py-2 text-center text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
            {turn.message.content}
          </div>
        </div>
      );

    default:
      return null;
  }
}

function RightToolbarButton({
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
      className="flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] transition-all duration-200 hover:-translate-y-px hover:border-[var(--color-line-strong)] hover:bg-[var(--hover-bg)] hover:text-[var(--color-text-primary)]"
    >
      {children}
    </button>
  );
}
