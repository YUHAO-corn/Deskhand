/**
 * Thinking Indicator 组件
 *
 * 显示 AI 正在思考的状态指示器：
 * - Spinner 动画
 * - "Thinking..." 文本
 *
 * 显示时机（由 shouldShowThinkingIndicator 决定）：
 * - pending: 等待首个活动
 * - awaiting: 工具完成后等待下一步
 * - streaming + buffering: 响应开始但内容还在缓冲
 */

export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-[var(--text-muted)] py-2">
      {/* Spinner */}
      <div
        className="
          w-4 h-4 rounded-full
          border-2 border-[var(--accent-color)] border-t-transparent
          animate-spin
        "
      />
      {/* Text */}
      <span className="text-sm">Thinking...</span>
    </div>
  );
}
