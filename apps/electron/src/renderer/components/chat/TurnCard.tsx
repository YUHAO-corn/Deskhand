/**
 * AI Turn 卡片
 *
 * 显示 AI 的回复，包括：
 * - Activity Header（可折叠/展开）
 * - 工具调用活动列表
 * - 响应文本（支持 Markdown）
 * - Thinking/Processing indicator
 */

import { useState, useMemo, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { ChevronRight } from 'lucide-react';
import type { AssistantTurn } from './turn-utils';
import { deriveTurnPhase, shouldShowThinkingIndicator, getTurnIntent } from './turn-utils';
import { ActivityTree } from './ActivityTree';
import { Markdown } from './markdown/Markdown';
import { ProcessingIndicator } from './ProcessingIndicator';
import { pendingActionMessageAtom } from '../../atoms/sessions';

interface TurnCardProps {
  turn: AssistantTurn;
}

/**
 * 获取 Activity Header 的预览文本
 * 优先级：intent > 第一个工具名称 > 默认文本
 */
function getPreviewText(
  turn: AssistantTurn,
  isStreaming: boolean,
  hasResponse: boolean
): string {
  // 优先使用 intent
  const intent = getTurnIntent(turn);
  if (intent) return intent;

  // 如果正在响应
  if (isStreaming && hasResponse) return 'Responding...';

  // 查找运行中的工具
  const runningTools = turn.activities.filter(a => a.status === 'running' && a.toolName);
  if (runningTools.length > 0) {
    const toolNames = runningTools.map(a => a.toolName).slice(0, 3);
    return `${toolNames.join(', ')}...`;
  }

  // 已完成
  const completedCount = turn.activities.filter(a => a.status === 'completed').length;
  const errorCount = turn.activities.filter(a => a.status === 'error').length;
  if (completedCount > 0 || errorCount > 0) {
    const errorSuffix = errorCount > 0 ? ` · ${errorCount} error${errorCount > 1 ? 's' : ''}` : '';
    return `Steps completed${errorSuffix}`;
  }

  return 'Processing...';
}

export function TurnCard({ turn }: TurnCardProps) {
  const { response, activities, timestamp } = turn;
  const phase = deriveTurnPhase(turn);
  const setPendingAction = useSetAtom(pendingActionMessageAtom);

  // Activity Header 展开/折叠状态（默认展开）
  const [isExpanded, setIsExpanded] = useState(true);
  const toggleExpanded = useCallback(() => setIsExpanded(prev => !prev), []);

  // 是否显示思考指示器（pending/awaiting 阶段）
  const showThinking = shouldShowThinkingIndicator(phase, false);
  const hasContent = response && response.text.length > 0;
  const hasActivities = activities && activities.length > 0;
  const isResponseStreaming = response?.isStreaming ?? false;

  // 计算预览文本
  const previewText = useMemo(
    () => getPreviewText(turn, turn.isStreaming, !!response),
    [turn, response]
  );

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

      {/* Processing 指示器 - 在没有内容时显示 */}
      {showThinking && !hasContent && !hasActivities && (
        <div className="pl-8">
          <ProcessingIndicator startTime={timestamp} />
        </div>
      )}

      {/* Activity Section：Header + 可折叠的活动列表 */}
      {hasActivities && (
        <div className="pl-8 mb-2">
          {/* Activity Header - 可点击折叠/展开 */}
          <button
            onClick={toggleExpanded}
            className="
              flex items-center gap-2 w-full
              px-2 py-1.5 rounded-t-lg
              bg-[var(--bg-secondary)]
              border border-b-0 border-[var(--border-light)]
              text-left text-sm text-[var(--text-secondary)]
              hover:bg-[var(--bg-tertiary)] transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]
            "
          >
            {/* Chevron 箭头 */}
            <ChevronRight
              className={`
                w-4 h-4 shrink-0
                transition-transform duration-150
                ${isExpanded ? 'rotate-90' : ''}
              `}
            />

            {/* 步骤数量 Badge */}
            <span className="
              shrink-0 px-1.5 py-0.5
              rounded
              bg-[var(--bg-tertiary)]
              border border-[var(--border-light)]
              text-xs font-medium tabular-nums
            ">
              {activities.length}
            </span>

            {/* 预览文本 */}
            <span className="truncate flex-1">
              {previewText}
            </span>
          </button>

          {/* 可折叠的活动列表 */}
          {isExpanded && (
            <div className="
              bg-[var(--bg-secondary)]
              border border-t-0 border-[var(--border-light)]
              rounded-b-lg
              overflow-hidden
              py-1 px-1
            ">
              <ActivityTree
                activities={activities}
                onActivityClick={(activity) => {
                  // TODO: 打开 activity 详情（Overlay）
                  console.log('Activity clicked:', activity);
                }}
              />
              {/* 工具完成后等待下一步时显示 Processing */}
              {showThinking && !hasContent && (
                <ProcessingIndicator startTime={timestamp} />
              )}
            </div>
          )}

          {/* 折叠时的底部边框 */}
          {!isExpanded && (
            <div className="
              h-1 rounded-b-lg
              bg-[var(--bg-secondary)]
              border border-t-0 border-[var(--border-light)]
            " />
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

        {/* Action buttons (e.g., insight report recommendations) */}
        {response?.actions && response.actions.length > 0 && !isResponseStreaming && (
          <div className="flex items-center gap-2 mt-4">
            {response.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => setPendingAction(action.presetMessage)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${action.style === 'primary'
                    ? 'bg-[var(--accent-color)] text-white hover:opacity-90'
                    : 'border border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }
                `}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
