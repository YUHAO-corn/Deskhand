/**
 * AI Turn 卡片
 *
 * 显示 AI 的回复，包括：
 * - 响应文本（支持 Markdown）
 * - 工具调用活动列表
 * - Thinking indicator
 */

import type { AssistantTurn } from './turn-utils';
import { deriveTurnPhase, shouldShowThinkingIndicator } from './turn-utils';
import { ToolActivityRow } from './ToolActivityRow';
import { Markdown } from './markdown/Markdown';
import { ThinkingIndicator } from './ThinkingIndicator';

interface TurnCardProps {
  turn: AssistantTurn;
}

export function TurnCard({ turn }: TurnCardProps) {
  const { response, activities } = turn;
  const phase = deriveTurnPhase(turn);

  // 是否显示思考指示器（pending/awaiting 阶段）
  // 暂不实现智能缓冲，isBuffering = false
  const showThinking = shouldShowThinkingIndicator(phase, false);
  const hasContent = response && response.text.length > 0;
  const hasActivities = activities && activities.length > 0;
  const isResponseStreaming = response?.isStreaming ?? false;

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
      </div>

      {/* Thinking 指示器 - 在没有内容时显示 */}
      {showThinking && !hasContent && !hasActivities && (
        <div className="pl-8">
          <ThinkingIndicator />
        </div>
      )}

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
          {/* 工具完成后等待下一步时显示 Thinking */}
          {showThinking && !hasContent && (
            <ThinkingIndicator />
          )}
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
        {hasContent && (
          <div>
            <Markdown content={response.text} />
            {isResponseStreaming && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
