import { useMemo, useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import type { Message, MessageWidget } from '@deskhand/core';
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

function isWidgetDemoEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('widgetDemo') === '1';
}

function createWidgetDemoTurns(): Turn[] {
  const userMessage: Message = {
    id: 'demo-user-widget',
    role: 'user',
    content: '用一个图解释 TCP 三次握手，并告诉我每一步在确认什么。',
    timestamp: 1,
  };

  const widget: MessageWidget = {
    title: 'TCP 三次握手',
    mimeType: 'text/html',
    code: WIDGET_DEMO_CODE,
  };

  const assistantTurn: AssistantTurn = {
    type: 'assistant',
    turnId: 'demo-assistant-widget',
    activities: [],
    response: {
      text: '三次握手的本质不是形式上的“三步”，而是双方分别确认两件事：我发得出去，你收得到；你发得回来，我也收得到。',
      isStreaming: false,
    },
    widget,
    intent: undefined,
    isStreaming: false,
    isComplete: true,
    timestamp: 2,
  };

  return [
    { type: 'user', message: userMessage, timestamp: userMessage.timestamp },
    assistantTurn,
  ];
}

const WIDGET_DEMO_CODE = `
<section style="padding:6px 0 0;font-family:ui-sans-serif,system-ui,sans-serif;color:#14302a;background:transparent;">
  <svg viewBox="0 0 760 260" width="100%" style="display:block;height:auto;background:transparent;">
    <defs>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="#10a37f"></path>
      </marker>
    </defs>
    <rect x="44" y="38" width="168" height="54" rx="18" fill="#f6fbfa"></rect>
    <text x="128" y="60" text-anchor="middle" fill="#14302a" font-size="19" font-weight="700">客户端</text>
    <text x="128" y="80" text-anchor="middle" fill="#67827b" font-size="12">想建立连接的一方</text>
    <rect x="548" y="38" width="168" height="54" rx="18" fill="#f6fbfa"></rect>
    <text x="632" y="60" text-anchor="middle" fill="#14302a" font-size="19" font-weight="700">服务端</text>
    <text x="632" y="80" text-anchor="middle" fill="#67827b" font-size="12">接收连接请求的一方</text>
    <line x1="128" y1="110" x2="128" y2="222" stroke="#c8d9d4" stroke-width="2" stroke-dasharray="5 5"></line>
    <line x1="632" y1="110" x2="632" y2="222" stroke="#c8d9d4" stroke-width="2" stroke-dasharray="5 5"></line>
    <line x1="156" y1="132" x2="598" y2="132" stroke="#10a37f" stroke-width="3.5" marker-end="url(#arrow)"></line>
    <text x="377" y="118" text-anchor="middle" fill="#0d6b53" font-size="15" font-weight="700">1. SYN</text>
    <text x="377" y="149" text-anchor="middle" fill="#58716b" font-size="12">客户端说：我想开始通信，这是我的初始序号</text>
    <line x1="604" y1="178" x2="162" y2="178" stroke="#f28f3b" stroke-width="3.5" marker-end="url(#arrow)"></line>
    <text x="383" y="167" text-anchor="middle" fill="#a75416" font-size="15" font-weight="700">2. SYN + ACK</text>
    <text x="383" y="195" text-anchor="middle" fill="#7d5a3f" font-size="12">服务端说：收到你的 SYN，这里是我的序号，也确认你的序号</text>
    <line x1="156" y1="224" x2="598" y2="224" stroke="#4d7df2" stroke-width="3.5" marker-end="url(#arrow)"></line>
    <text x="377" y="212" text-anchor="middle" fill="#295ccf" font-size="15" font-weight="700">3. ACK</text>
    <text x="377" y="242" text-anchor="middle" fill="#50627f" font-size="12">客户端说：收到你的回应，双方都确认彼此具备收发能力</text>
  </svg>
</section>
`.trim();

function splitDemoIntoChunks(code: string): string[] {
  const chunks: string[] = [];
  let index = 0;

  while (index < code.length) {
    const size = 11 + ((index * 7) % 19);
    chunks.push(code.slice(index, index + size));
    index += size;
  }

  return chunks;
}

interface WidgetDemoState {
  enabled: boolean;
  code: string;
  isStreaming: boolean;
}

function createStreamingWidgetDemoTurns(widgetState: WidgetDemoState): Turn[] {
  const baseTurns = createWidgetDemoTurns();
  const assistantTurn = baseTurns[1];

  if (assistantTurn?.type !== 'assistant') {
    return baseTurns;
  }

  return [
    baseTurns[0]!,
    {
      ...assistantTurn,
      widget: {
        title: 'TCP 三次握手',
        mimeType: 'text/html',
        code: widgetState.code,
        isStreaming: widgetState.isStreaming,
      },
    },
  ];
}

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
  const [showWidgetDemo, setShowWidgetDemo] = useState(false);
  const [widgetDemoState, setWidgetDemoState] = useState<WidgetDemoState>({
    enabled: false,
    code: '',
    isStreaming: false,
  });
  const widgetDemoStartedRef = useRef(false);

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
            widget: sm.widget,
            planPath: sm.planPath,
            errorCode: sm.errorCode,
            errorTitle: sm.errorTitle,
            errorDetails: sm.errorDetails,
            errorCanRetry: sm.errorCanRetry,
            actions: sm.actions,
          }) as Message[]);
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
  const displayTurns = useMemo(() => {
    if (turns.length > 0) return turns;
    if (showWidgetDemo) {
      const state = widgetDemoState.enabled
        ? widgetDemoState
        : { enabled: true, code: '', isStreaming: true };
      return createStreamingWidgetDemoTurns(state);
    }
    return isWidgetDemoEnabled() ? createWidgetDemoTurns() : turns;
  }, [showWidgetDemo, turns, widgetDemoState]);
  const isEmpty = displayTurns.length === 0;

  const lastTurn = displayTurns[displayTurns.length - 1];
  const showPendingThinking = isProcessing && lastTurn?.type !== 'assistant';

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, widgetDemoState.code]);

  useEffect(() => {
    if (!showWidgetDemo || widgetDemoStartedRef.current) return;
    widgetDemoStartedRef.current = true;

    const chunks = splitDemoIntoChunks(WIDGET_DEMO_CODE);
    setWidgetDemoState({
      enabled: true,
      code: '',
      isStreaming: true,
    });

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let index = 0;

    const pump = () => {
      if (cancelled) return;

      index += 1;
      const nextCode = chunks.slice(0, index).join('');
      const done = index >= chunks.length;

      setWidgetDemoState({
        enabled: true,
        code: nextCode,
        isStreaming: !done,
      });

      if (!done) {
        timeoutId = setTimeout(pump, 70);
      }
    };

    timeoutId = setTimeout(pump, 120);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [showWidgetDemo]);

  return (
    <div className="relative flex min-w-[400px] flex-1 flex-col overflow-hidden bg-[var(--color-surface-canvas)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-[14%] top-[-22%] h-[64%] w-[66%] rounded-full bg-[radial-gradient(circle,_var(--color-accent-soft)_0%,_transparent_72%)]" />
        <div className="absolute right-[-20%] top-[8%] h-[48%] w-[60%] rounded-full bg-[radial-gradient(circle,_var(--color-surface-elevated)_0%,_transparent_68%)]" />
      </div>

      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-5">
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
              {import.meta.env.DEV && (
                <button
                  onClick={() => setShowWidgetDemo(true)}
                  className="mt-5 inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-line-soft)] bg-[var(--color-surface-panel)] px-4 py-2 text-[var(--font-size-sm)] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--color-text-primary)]"
                >
                  Load Widget Demo
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[880px] py-8">
            {displayTurns.map((turn, index) => (
              <TurnRenderer
                key={getTurnKey(turn)}
                turn={turn}
                prevTurnType={index > 0 ? displayTurns[index - 1].type : undefined}
              />
            ))}
            {showPendingThinking && (
              <div className="mb-2">
                <ProcessingIndicator />
              </div>
            )}
          </div>
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
