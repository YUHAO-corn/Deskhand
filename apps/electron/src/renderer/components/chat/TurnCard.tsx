/**
 * AI Turn 卡片
 *
 * 显示 AI 的回复，包括：
 * - 响应文本（支持 Markdown）
 * - 工具调用（V2）
 * - Thinking indicator（V3）
 *
 * V1 简化版：只显示响应文本
 */

import type { AssistantTurn } from './turn-utils';
import { deriveTurnPhase } from './turn-utils';

interface TurnCardProps {
  turn: AssistantTurn;
}

export function TurnCard({ turn }: TurnCardProps) {
  const { response, activities } = turn;
  const phase = deriveTurnPhase(turn);

  // V1: 简化版只显示响应文本
  const isStreaming = phase === 'streaming' || phase === 'pending' || phase === 'awaiting';
  const hasContent = response && response.text.length > 0;

  return (
    <div className="group">
      {/* AI 头像和名称 */}
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
        {isStreaming && (
          <span className="text-xs text-[var(--text-muted)] animate-pulse">
            typing...
          </span>
        )}
      </div>

      {/* 响应内容 */}
      <div
        className="
          pl-8
          text-[var(--font-size-base)] leading-relaxed
          text-[var(--text-primary)]
        "
      >
        {hasContent ? (
          <div className="whitespace-pre-wrap break-words">
            {response.text}
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse" />
            )}
          </div>
        ) : isStreaming ? (
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
