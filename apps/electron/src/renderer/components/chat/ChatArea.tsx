/**
 * 对话区域
 *
 * 📐 SPEC: docs/SPEC_ChatArea.md
 * 🎨 原型: deskhand-prototype/src/components/ChatArea.tsx
 *
 * 职责：
 * - 渲染会话中的所有消息（用户、AI、工具、系统）
 * - 处理流式响应的实时更新
 * - 展示工具调用过程和结果
 * - 显示权限请求并收集用户响应
 * - 提供会话控制操作（停止、重新生成）
 */

import { useMemo, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import {
  activeSessionIdAtom,
  artifactPanelOpenAtom,
  artifactActiveTabAtom,
  sessionMessagesFamily,
  sessionProcessingFamily,
} from '../../atoms/sessions';
import { groupMessagesByTurn, type Turn, type AssistantTurn } from './turn-utils';

/** Get unique key for a turn */
function getTurnKey(turn: Turn): string {
  if (turn.type === 'assistant') {
    return (turn as AssistantTurn).turnId;
  }
  return turn.message.id;
}
import { useAgentEvents } from '../../hooks/useAgentEvents';
import { InputToolbar } from '../input/InputToolbar';
import { UserMessageBubble } from './UserMessageBubble';
import { TurnCard } from './TurnCard';
import { ThinkingIndicator } from './ThinkingIndicator';

export function ChatArea() {
  const [activeSessionId] = useAtom(activeSessionIdAtom);
  const [artifactPanelOpen, setArtifactPanelOpen] = useAtom(artifactPanelOpenAtom);
  const [, setArtifactActiveTab] = useAtom(artifactActiveTabAtom);

  // 订阅 Agent 事件
  useAgentEvents({
    sessionId: activeSessionId ?? '',
    enabled: !!activeSessionId,
  });

  // 获取消息列表 - 使用固定的 atom key 避免 hooks 规则问题
  const messagesAtom = sessionMessagesFamily(activeSessionId ?? '__empty__');
  const [messages] = useAtom(messagesAtom);

  // 获取处理状态
  const processingAtom = sessionProcessingFamily(activeSessionId ?? '__empty__');
  const [isProcessing] = useAtom(processingAtom);

  // ============================================
  // 打开 Artifact 面板到指定 Tab
  // ============================================
  const openArtifactTab = (tab: 'files' | 'changes' | 'terminal' | 'preview') => {
    setArtifactPanelOpen(true);
    setArtifactActiveTab(tab);
  };

  // 将消息分组为 Turn
  const turns = useMemo(() => groupMessagesByTurn(messages), [messages]);
  const isEmpty = turns.length === 0;

  // 判断是否需要显示等待首个响应的 ThinkingIndicator
  // 条件：正在处理 + 最后一个 turn 不是 AssistantTurn
  // 如果已有 AssistantTurn，则由 TurnCard 内部处理 Thinking
  const lastTurn = turns[turns.length - 1];
  const showPendingThinking = isProcessing && lastTurn?.type !== 'assistant';

  // 自动滚动到底部
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)] relative">
      {/* ============================================
          区域：消息列表
          功能：渲染所有 Turn（用户消息 + AI 回复）
          数据：turns 数组（由 groupMessagesByTurn 生成）
          ============================================ */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          // 空状态
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-[var(--text-muted)] text-[var(--font-size-base)]">
              <p>Start a conversation...</p>
            </div>
          </div>
        ) : (
          // 消息列表
          <div className="max-w-3xl mx-auto py-6 px-4">
            {turns.map((turn) => (
              <TurnRenderer key={getTurnKey(turn)} turn={turn} />
            ))}
            {/* 等待首个响应时的 ThinkingIndicator */}
            {showPendingThinking && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="
                      w-6 h-6 rounded-full
                      bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]
                      flex items-center justify-center
                      text-white text-xs font-medium
                    "
                  >
                    AI
                  </div>
                  <span className="text-sm font-medium text-[var(--text-secondary)]">
                    Claude
                  </span>
                </div>
                <div className="pl-8">
                  <ThinkingIndicator />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================
          区域：右侧工具栏
          功能：快速打开 Artifact 面板的各个 Tab
          状态：Artifact 面板打开时隐藏
          ============================================ */}
      <div
        className={`
          absolute right-4 top-1/2 -translate-y-1/2
          flex flex-col gap-[1px]
          bg-[var(--bg-secondary)] rounded-[10px] p-1.5
          shadow-[0_2px_8px_rgba(0,0,0,0.08)]
          border border-[var(--border-light)]
          z-40
          transition-opacity duration-[var(--transition-fast)]
          ${artifactPanelOpen ? 'opacity-0 pointer-events-none' : ''}
        `}
      >
        {/* Files Tab */}
        <RightToolbarButton
          onClick={() => openArtifactTab('files')}
          title="Files"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </RightToolbarButton>

        {/* Changes Tab */}
        <RightToolbarButton
          onClick={() => openArtifactTab('changes')}
          title="Changes"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v18M3 12h18" />
          </svg>
        </RightToolbarButton>

        {/* Terminal Tab */}
        <RightToolbarButton
          onClick={() => openArtifactTab('terminal')}
          title="Terminal"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
        </RightToolbarButton>

        {/* Preview Tab */}
        <RightToolbarButton
          onClick={() => openArtifactTab('preview')}
          title="Preview"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </RightToolbarButton>
      </div>

      {/* ============================================
          区域：输入区域
          功能：消息输入、附件、发送
          组件：InputToolbar
          ============================================ */}
      <InputToolbar />
    </div>
  );
}

// ============================================
// TurnRenderer - 根据 Turn 类型渲染不同组件
// ============================================

interface TurnRendererProps {
  turn: Turn;
}

function TurnRenderer({ turn }: TurnRendererProps) {
  switch (turn.type) {
    case 'user':
      return (
        <div className="mb-4">
          <UserMessageBubble message={turn.message} />
        </div>
      );

    case 'assistant':
      return (
        <div className="mb-4">
          <TurnCard turn={turn} />
        </div>
      );

    case 'system':
      return (
        <div className="mb-4">
          <div className="text-center text-[var(--text-muted)] text-sm py-2">
            {turn.message.content}
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ============================================
// RightToolbarButton - 右侧工具栏按钮
// ============================================

interface RightToolbarButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}

function RightToolbarButton({ children, onClick, title }: RightToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="
        w-[36px] h-[36px]
        border-none bg-transparent
        rounded-[var(--radius-md)] cursor-pointer
        flex items-center justify-center
        text-[var(--text-secondary)]
        transition-colors duration-[var(--transition-fast)]
        hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]
      "
    >
      {children}
    </button>
  );
}
