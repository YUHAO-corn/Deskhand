/**
 * 工具调用行组件
 *
 * 显示单个工具调用的状态和信息：
 * - 状态图标（pending/running/completed/error）
 * - 工具图标和名称
 * - 简短描述（文件路径、命令等）
 * - 附加信息（执行时长、diff 统计等）
 * - 展开/折叠按钮（用于 Task 子代理）
 */

import type { ActivityItem, ActivityStatus } from './turn-types';
import type { TaskOutputData } from './turn-utils';
import { formatDuration, formatTokens } from './turn-utils';

interface ToolActivityRowProps {
  activity: ActivityItem;
  onClick?: () => void;
  // Task 子代理展开/折叠支持
  onToggle?: () => void;
  isExpanded?: boolean;
  hasChildren?: boolean;
  taskOutputData?: TaskOutputData;
}

export function ToolActivityRow({
  activity,
  onClick,
  onToggle,
  isExpanded,
  hasChildren,
  taskOutputData,
}: ToolActivityRowProps) {
  const { status, toolName, content, intent, displayName, error } = activity;

  // 获取工具显示名称
  const toolDisplayName = displayName || toolName || 'Tool';

  // 获取工具描述（从 input 中提取关键信息）
  const description = getToolDescription(activity);

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        w-full flex items-center gap-2 py-1.5 px-2
        rounded-md cursor-pointer
        text-left text-sm
        hover:bg-[var(--hover-bg)]
        transition-colors duration-[var(--transition-fast)]
        group
      "
    >
      {/* 状态图标 */}
      <StatusIcon status={status} />

      {/* 工具图标 */}
      <ToolIcon toolName={toolName} />

      {/* 工具名称和描述 */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="font-medium text-[var(--text-primary)] truncate">
          {toolDisplayName}
        </span>
        {description && (
          <span className="text-[var(--text-muted)] truncate">
            {description}
          </span>
        )}
      </div>

      {/* 错误徽章 */}
      {status === 'error' && error && (
        <span className="
          px-1.5 py-0.5 rounded text-xs
          bg-red-100 text-red-700
          dark:bg-red-900/30 dark:text-red-400
        ">
          Error
        </span>
      )}

      {/* 后台任务徽章 */}
      {activity.isBackground && (
        <span className="
          px-1.5 py-0.5 rounded text-xs
          bg-purple-100 text-purple-700
          dark:bg-purple-900/30 dark:text-purple-400
        ">
          Background
        </span>
      )}

      {/* Task 输出数据（时长、tokens） */}
      {taskOutputData && (
        <TaskOutputBadge data={taskOutputData} />
      )}

      {/* 展开/折叠按钮（仅 Task 有子活动时显示） */}
      {hasChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          className="
            w-5 h-5 flex items-center justify-center
            rounded hover:bg-[var(--hover-bg)]
            text-[var(--text-muted)]
            transition-transform duration-200
          "
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </button>
  );
}

// ============================================
// StatusIcon - 状态图标
// ============================================

function StatusIcon({ status }: { status: ActivityStatus }) {
  switch (status) {
    case 'pending':
      return (
        <div className="w-4 h-4 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full border border-[var(--text-muted)]" />
        </div>
      );

    case 'running':
      return (
        <div className="w-4 h-4 flex items-center justify-center">
          <div className="
            w-3 h-3 rounded-full
            border-2 border-[var(--accent-color)] border-t-transparent
            animate-spin
          " />
        </div>
      );

    case 'completed':
      return (
        <svg
          className="w-4 h-4 text-green-600 dark:text-green-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );

    case 'error':
      return (
        <svg
          className="w-4 h-4 text-red-600 dark:text-red-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );

    case 'backgrounded':
      return (
        <svg
          className="w-4 h-4 text-purple-600 dark:text-purple-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" />
        </svg>
      );

    default:
      return <div className="w-4 h-4" />;
  }
}

// ============================================
// ToolIcon - 工具图标
// ============================================

function ToolIcon({ toolName }: { toolName?: string }) {
  const iconClass = 'w-4 h-4 text-[var(--text-secondary)]';

  switch (toolName) {
    case 'Read':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );

    case 'Write':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );

    case 'Edit':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      );

    case 'Bash':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      );

    case 'Grep':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );

    case 'Glob':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );

    case 'Task':
      // 机器人图标 - 代表 subagent
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="12" cy="5" r="4" />
          <circle cx="9" cy="15" r="1" fill="currentColor" />
          <circle cx="15" cy="15" r="1" fill="currentColor" />
          <line x1="9" y1="18" x2="15" y2="18" />
        </svg>
      );

    case 'Skill':
      // 扳手图标 - 代表技能激活
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );

    default:
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="9" x2="15" y2="15" />
          <line x1="15" y1="9" x2="9" y2="15" />
        </svg>
      );
  }
}

// ============================================
// Helper: 获取工具描述
// ============================================

function getToolDescription(activity: ActivityItem): string | null {
  const { toolName, toolInput, intent } = activity;

  // 优先使用 intent（LLM 生成的描述）
  if (intent) return intent;

  // 根据工具类型提取关键信息
  if (!toolInput) return null;

  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit': {
      const filePath = toolInput.file_path as string | undefined;
      if (filePath) {
        // 只显示文件名
        return filePath.split('/').pop() || filePath;
      }
      return null;
    }

    case 'Bash': {
      const command = toolInput.command as string | undefined;
      if (command) {
        // 截断过长的命令
        return command.length > 40 ? command.slice(0, 40) + '...' : command;
      }
      return null;
    }

    case 'Grep': {
      const pattern = toolInput.pattern as string | undefined;
      return pattern ? `"${pattern}"` : null;
    }

    case 'Glob': {
      const pattern = toolInput.pattern as string | undefined;
      return pattern || null;
    }

    case 'Task': {
      const description = toolInput.description as string | undefined;
      return description || null;
    }

    case 'Skill': {
      const skill = toolInput.skill as string | undefined;
      return skill || null;
    }

    default:
      return null;
  }
}

// ============================================
// TaskOutputBadge - Task 输出数据徽章
// ============================================

interface TaskOutputBadgeProps {
  data: TaskOutputData;
}

function TaskOutputBadge({ data }: TaskOutputBadgeProps) {
  const { durationMs, inputTokens, outputTokens } = data;

  // 构建显示内容
  const parts: string[] = [];

  if (durationMs !== undefined) {
    parts.push(formatDuration(durationMs));
  }

  if (inputTokens !== undefined || outputTokens !== undefined) {
    const tokensStr = `${formatTokens(inputTokens ?? 0)} / ${formatTokens(outputTokens ?? 0)}`;
    parts.push(tokensStr);
  }

  if (parts.length === 0) return null;

  return (
    <span className="
      px-1.5 py-0.5 rounded text-xs
      bg-[var(--bg-tertiary)] text-[var(--text-muted)]
    ">
      {parts.join(' · ')}
    </span>
  );
}
