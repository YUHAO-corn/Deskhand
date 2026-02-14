/**
 * TurnCard Types - Turn 卡片相关类型定义
 *
 * 这些类型用于 turn-utils.ts 和未来的 TurnCard 组件
 */

import type { ToolDisplayMeta } from '@deskhand/core';

// ─────────────────────────────────────────────────────────────────────────────
// Activity 类型
// ─────────────────────────────────────────────────────────────────────────────

/** Activity 状态 */
export type ActivityStatus = 'pending' | 'running' | 'completed' | 'error' | 'backgrounded';

/** Activity 类型 */
export type ActivityType = 'tool' | 'thinking' | 'intermediate' | 'status';

// ─────────────────────────────────────────────────────────────────────────────
// Todo 类型（用于 TodoWrite 工具可视化）
// ─────────────────────────────────────────────────────────────────────────────

/** Todo 状态 */
export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'interrupted';

/** Todo 条目 */
export interface TodoItem {
  /** 任务内容/描述 */
  content: string;
  /** 当前状态 */
  status: TodoStatus;
  /** 进行中时显示的现在进行时形式（如 "Running tests"） */
  activeForm?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity 条目
// ─────────────────────────────────────────────────────────────────────────────

/** Activity 条目 - Turn 内的单个操作 */
export interface ActivityItem {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  toolName?: string;
  toolUseId?: string;                    // 用于匹配父子关系
  toolInput?: Record<string, unknown>;
  content?: string;
  intent?: string;
  displayName?: string;                  // LLM 生成的人类友好工具名（用于 MCP 工具）
  toolDisplayMeta?: ToolDisplayMeta;     // 嵌入的元数据，包含 base64 图标
  timestamp: number;
  error?: string;

  // 父子嵌套（用于 Task 子代理）
  parentId?: string;                     // 父 activity 的 toolUseId
  depth?: number;                        // 嵌套层级（0 = 根，1 = 子，等）

  // Status activities（如 compacting）
  statusType?: string;

  // 后台任务字段
  taskId?: string;                       // 后台 Task 工具
  shellId?: string;                      // 后台 Bash shell
  elapsedSeconds?: number;               // 实时进度更新
  isBackground?: boolean;                // UI 区分标志
}

// ─────────────────────────────────────────────────────────────────────────────
// Response 内容
// ─────────────────────────────────────────────────────────────────────────────

/** 响应内容 */
export interface ResponseContent {
  text: string;
  isStreaming: boolean;
  streamStartTime?: number;
  /** 是否为计划（使用计划变体渲染） */
  isPlan?: boolean;
  /** Action buttons embedded in the message (e.g., insight recommendations) */
  actions?: import('@deskhand/core').MessageAction[];
}
