/**
 * AI Turn 卡片
 *
 * 显示 AI 的回复，包括：
 * - 响应文本（支持 Markdown）
 * - 工具调用活动列表
 * - Thinking indicator
 */

import type { AssistantTurn } from './turn-utils';
import { deriveTurnPhase } from './turn-utils';
import { ToolActivityRow } from './ToolActivityRow';
import { Markdown } from './markdown/Markdown';

interface TurnCardProps {
  turn: AssistantTurn;
}

export function TurnCard({ turn }: TurnCardProps) {
  const { response, activities } = turn;
  const phase = deriveTurnPhase(turn);

  const isStreaming = phase === 'streaming' || phase === 'pending' || phase === 'awaiting';
  const hasContent = response && response.text.length > 0;
  const hasActivities = activities && activities.length > 0;

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

      {/* 工具调用活动列表 */}
      {hasActivities && (
        <div className="pl-8 mb-2">
          <div className="
            bg-[var(--bg-secondary)] rounded-lg
            border border-[var(--border-light)]
            overflow-hidden
          ">
            {activities.map((activity) => (
              <ToolActivityRow
                key={activity.id}
                activity={activity}
                onClick={() => {
                  // TODO: 打开 activity 详情（Overlay）
                  console.log('Activity clicked:', activity);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 响应内容 */}
      <div
        className="
          pl-8
          text-[var(--font-size-base)] leading-relaxed
          text-[var(--text-primary)]
        "
      >
        {hasContent ? (
          <div>
            <Markdown content={response.text} />
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
