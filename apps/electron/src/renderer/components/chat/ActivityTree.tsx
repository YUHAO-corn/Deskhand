/**
 * ActivityTree - 树形活动列表组件
 *
 * 将 Task 子代理的工具调用渲染为树形结构：
 * - 使用 groupActivitiesByParent() 分组
 * - 支持展开/折叠 Task 子活动
 * - 渲染树形连接线（├─ └─）
 */

import { useState, useCallback } from 'react';
import { useAtom } from 'jotai';
import type { ActivityItem } from './turn-utils';
import {
  groupActivitiesByParent,
  isActivityGroup,
  type ActivityGroup,
} from './turn-utils';
import { ToolActivityRow } from './ToolActivityRow';
import { permissionRequestAtom, activeSessionIdAtom } from '../../atoms/sessions';

interface ActivityTreeProps {
  activities: ActivityItem[];
  onActivityClick?: (activity: ActivityItem) => void;
}

export function ActivityTree({ activities, onActivityClick }: ActivityTreeProps) {
  // 分组：将扁平列表转换为树形结构
  const groupedActivities = groupActivitiesByParent(activities);

  // 管理每个 Task 的展开/折叠状态
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => {
    // 默认全部展开
    const expanded = new Set<string>();
    for (const item of groupedActivities) {
      if (isActivityGroup(item)) {
        expanded.add(item.parent.id);
      }
    }
    return expanded;
  });

  const toggleExpand = useCallback((taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-0">
      {groupedActivities.map((item, index) => {
        const isLast = index === groupedActivities.length - 1;

        if (isActivityGroup(item)) {
          return (
            <TaskActivityGroup
              key={item.parent.id}
              group={item}
              isExpanded={expandedTasks.has(item.parent.id)}
              onToggle={() => toggleExpand(item.parent.id)}
              onActivityClick={onActivityClick}
              isLast={isLast}
            />
          );
        }

        // 普通活动项
        return (
          <ActivityTreeRow
            key={item.id}
            activity={item}
            depth={0}
            isLastChild={isLast}
            onClick={() => onActivityClick?.(item)}
          />
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskActivityGroup - Task 工具及其子活动
// ─────────────────────────────────────────────────────────────────────────────

interface TaskActivityGroupProps {
  group: ActivityGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onActivityClick?: (activity: ActivityItem) => void;
  isLast: boolean;
}

function TaskActivityGroup({
  group,
  isExpanded,
  onToggle,
  onActivityClick,
  isLast,
}: TaskActivityGroupProps) {
  const { parent, children, taskOutputData } = group;
  const hasChildren = children.length > 0;

  return (
    <div>
      {/* Task 父行（可展开/折叠） */}
      <ActivityTreeRow
        activity={parent}
        depth={0}
        isLastChild={isLast && !isExpanded}
        onClick={() => onActivityClick?.(parent)}
        onToggle={hasChildren ? onToggle : undefined}
        isExpanded={isExpanded}
        hasChildren={hasChildren}
        taskOutputData={taskOutputData}
      />

      {/* 子活动（展开时显示） */}
      {isExpanded && hasChildren && (
        <div>
          {children.map((child, childIndex) => (
            <ActivityTreeRow
              key={child.id}
              activity={child}
              depth={1}
              isLastChild={childIndex === children.length - 1}
              onClick={() => onActivityClick?.(child)}
              showConnector={!isLast || childIndex < children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActivityTreeRow - 单个活动行（带树形连接线）
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityTreeRowProps {
  activity: ActivityItem;
  depth: number;
  isLastChild: boolean;
  onClick?: () => void;
  onToggle?: () => void;
  isExpanded?: boolean;
  hasChildren?: boolean;
  showConnector?: boolean;
  taskOutputData?: {
    durationMs?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
}

function ActivityTreeRow({
  activity,
  depth,
  isLastChild,
  onClick,
  onToggle,
  isExpanded,
  hasChildren,
  showConnector,
  taskOutputData,
}: ActivityTreeRowProps) {
  // Check if this activity has a pending permission request
  const [permissionRequest, setPermissionRequest] = useAtom(permissionRequestAtom);
  const [activeSessionId] = useAtom(activeSessionIdAtom);

  const hasPendingPermission =
    permissionRequest?.isOpen &&
    activity.toolUseId &&
    permissionRequest.requestId === `perm-${activity.toolUseId}`;

  const handleAllow = () => {
    if (activeSessionId && permissionRequest?.requestId) {
      window.electronAPI.respondToPermission(activeSessionId, permissionRequest.requestId, 'allow');
    }
    setPermissionRequest(null);
  };

  const handleDeny = () => {
    if (activeSessionId && permissionRequest?.requestId) {
      window.electronAPI.respondToPermission(activeSessionId, permissionRequest.requestId, 'deny');
    }
    setPermissionRequest(null);
  };

  // 缩进样式
  const paddingLeft = depth * 24;

  return (
    <div
      className="relative"
      style={{ paddingLeft: depth > 0 ? paddingLeft : 0 }}
    >
      {/* 树形连接线 */}
      {depth > 0 && (
        <TreeConnector isLastChild={isLastChild} showExtender={showConnector} />
      )}

      {/* 活动行内容 */}
      <div className="relative">
        <ToolActivityRow
          activity={activity}
          onClick={onClick}
          onToggle={onToggle}
          isExpanded={isExpanded}
          hasChildren={hasChildren}
          taskOutputData={taskOutputData}
        />

        {/* 内联权限确认 */}
        {hasPendingPermission && (
          <div className="mx-2 mb-1 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span className="text-xs text-amber-700 dark:text-amber-400">
                {permissionRequest.description}
              </span>
            </div>
            <div className="font-mono text-xs px-2.5 py-1.5 bg-[#1e1e1e] text-[#d4d4d4] rounded mb-2.5 overflow-x-auto">
              <code>{permissionRequest.toolName === 'Bash' ? '$ ' : ''}{permissionRequest.command}</code>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleDeny}
                className="
                  px-3 py-1 rounded-md text-xs font-medium
                  border border-red-200 text-red-600 bg-transparent
                  hover:bg-red-50 cursor-pointer
                  transition-colors
                "
              >
                Deny
              </button>
              <button
                onClick={handleAllow}
                className="
                  px-3 py-1 rounded-md text-xs font-medium
                  border-none text-white bg-[var(--accent-color)]
                  hover:opacity-90 cursor-pointer
                  transition-colors
                "
              >
                Allow
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TreeConnector - 树形连接线
// ─────────────────────────────────────────────────────────────────────────────

interface TreeConnectorProps {
  isLastChild: boolean;
  showExtender?: boolean;
}

function TreeConnector({ isLastChild, showExtender }: TreeConnectorProps) {
  return (
    <>
      {/* 垂直线 + 水平线 → ├ 或 └ */}
      <div
        className="absolute left-0 top-0 h-1/2 border-l border-[var(--border-light)]"
        style={{ left: 8 }}
      />
      <div
        className={`absolute left-0 border-b border-[var(--border-light)] ${
          isLastChild ? 'rounded-bl' : ''
        }`}
        style={{ left: 8, top: '50%', width: 12 }}
      />

      {/* 非最后子项：延伸到下一行的垂直线 */}
      {!isLastChild && (
        <div
          className="absolute left-0 top-1/2 h-1/2 border-l border-[var(--border-light)]"
          style={{ left: 8 }}
        />
      )}

      {/* 额外的垂直延伸线（用于父级 Task 还有更多兄弟） */}
      {showExtender && (
        <div
          className="absolute left-0 top-full h-4 border-l border-[var(--border-light)]"
          style={{ left: -16 }}
        />
      )}
    </>
  );
}
