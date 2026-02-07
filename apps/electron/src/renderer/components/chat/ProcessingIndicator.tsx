/**
 * Processing Indicator 组件
 *
 * 显示 AI 正在处理的状态指示器：
 * - Spinner 动画
 * - 随机循环的等待消息（每 10 秒切换）
 * - 已消耗时间（读秒）
 *
 * 显示时机（由 shouldShowThinkingIndicator 决定）：
 * - pending: 等待首个活动
 * - awaiting: 工具完成后等待下一步
 * - streaming + buffering: 响应开始但内容还在缓冲
 */

import { useState, useEffect } from 'react';

// 随机循环的等待消息列表
const PROCESSING_MESSAGES = [
  'Thinking...',
  'Pondering...',
  'Contemplating...',
  'Reasoning...',
  'Processing...',
  'Computing...',
  'Considering...',
  'Reflecting...',
  'Deliberating...',
  'Cogitating...',
  'Working on it...',
  'On it...',
  'Crunching...',
  'Brewing...',
  'Connecting dots...',
  'Deep in thought...',
  'Hmm...',
  'Let me see...',
  'One moment...',
  'Hold on...',
  'Bear with me...',
  'Just a sec...',
  'Hang tight...',
  'Getting there...',
  'Working...',
  'Busy busy...',
  'Whirring...',
  'Churning...',
  'Percolating...',
  'Simmering...',
  'Cooking...',
  'Spinning up...',
  'Warming up...',
  'Buzzing...',
  'Humming...',
];

/**
 * 格式化已消耗时间
 * - 60 秒以内: "45s"
 * - 1 分钟以上: "1:02"
 */
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

interface ProcessingIndicatorProps {
  /** 开始时间戳（用于计算已消耗时间） */
  startTime?: number;
  /** 覆盖循环消息的固定状态消息（如 "Compacting..."） */
  statusMessage?: string;
}

export function ProcessingIndicator({ startTime, statusMessage }: ProcessingIndicatorProps) {
  // 已消耗时间（秒）
  const [elapsed, setElapsed] = useState(0);
  // 当前消息索引
  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * PROCESSING_MESSAGES.length)
  );
  // 消息淡入淡出状态
  const [isMessageFading, setIsMessageFading] = useState(false);

  // 更新已消耗时间（每秒）
  useEffect(() => {
    const start = startTime || Date.now();
    // 立即设置初始值
    setElapsed(Math.floor((Date.now() - start) / 1000));

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  // 每 10 秒切换消息（仅在没有 statusMessage 时）
  useEffect(() => {
    if (statusMessage) return;

    const interval = setInterval(() => {
      // 触发淡出
      setIsMessageFading(true);

      // 300ms 后切换消息并淡入
      setTimeout(() => {
        setMessageIndex(prev => {
          let next = Math.floor(Math.random() * PROCESSING_MESSAGES.length);
          // 确保选择不同的消息
          while (next === prev && PROCESSING_MESSAGES.length > 1) {
            next = Math.floor(Math.random() * PROCESSING_MESSAGES.length);
          }
          return next;
        });
        setIsMessageFading(false);
      }, 300);
    }, 10000);

    return () => clearInterval(interval);
  }, [statusMessage]);

  // 使用固定状态消息或循环消息
  const displayMessage = statusMessage || PROCESSING_MESSAGES[messageIndex];

  return (
    <div className="flex items-center gap-2 text-[var(--text-muted)] py-2 px-2">
      {/* Spinner */}
      <div
        className="
          w-4 h-4 rounded-full shrink-0
          border-2 border-[var(--accent-color)] border-t-transparent
          animate-spin
        "
      />

      {/* 消息文本（带淡入淡出） */}
      <span
        className={`
          text-sm transition-opacity duration-300
          ${isMessageFading ? 'opacity-0' : 'opacity-100'}
        `}
      >
        {displayMessage}
      </span>

      {/* 读秒（1 秒后显示） */}
      {elapsed >= 1 && (
        <span className="text-sm text-[var(--text-muted)] opacity-60 tabular-nums">
          {formatElapsed(elapsed)}
        </span>
      )}
    </div>
  );
}
