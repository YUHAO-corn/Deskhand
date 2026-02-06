/**
 * 会话侧边栏
 *
 * 📐 SPEC: docs/SPEC_SessionSidebar.md
 * 🎨 原型: deskhand-prototype/src/components/SessionSidebar.tsx
 *
 * 职责：
 * - 显示会话列表（按时间排序）
 * - 切换当前会话
 * - 提供设置入口
 * - 提供更新检查入口
 */

import { useAtom } from 'jotai';
import {
  sidebarOpenAtom,
  settingsOpenAtom,
  activeSessionIdAtom,
  sessionMetaMapAtom,
  sessionIdsAtom,
} from '../../atoms/sessions';
import type { SessionMeta } from '@deskhand/core';

export function SessionSidebar() {
  const [isOpen] = useAtom(sidebarOpenAtom);
  const [, setSettingsOpen] = useAtom(settingsOpenAtom);
  const [activeSessionId, setActiveSessionId] = useAtom(activeSessionIdAtom);
  const [sessionMetaMap] = useAtom(sessionMetaMapAtom);
  const [sessionIds] = useAtom(sessionIdsAtom);

  // TODO: 从 sessionMetaMap 和 sessionIds 获取排序后的会话列表
  // TODO: 按日期分组（Today / Yesterday / Dec 19）
  const sessions: SessionMeta[] = sessionIds
    .map((id) => sessionMetaMap.get(id))
    .filter((s): s is SessionMeta => s != null && !s.hidden);

  return (
    <aside
      className={`
        bg-[var(--bg-sidebar)]
        border-r border-[var(--border-color)]
        flex flex-col overflow-hidden
        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isOpen ? 'w-[var(--sidebar-width)] min-w-[var(--sidebar-width)]' : 'w-0 min-w-0'}
      `}
    >
      {/* 内容固定宽度，避免收起动画时内容变形 */}
      <div className="w-[var(--sidebar-width)] h-full flex flex-col pt-2">
        {/* ============================================
            区域：会话列表
            功能：显示所有会话，点击切换
            数据：sessionMetaMapAtom + sessionIdsAtom
            事件：onClick → 更新 activeSessionIdAtom
            ============================================ */}
        <div className="flex-1 overflow-y-auto px-2">
          {sessions.length === 0 ? (
            // 空状态
            <div className="flex flex-col items-center justify-center h-full px-4 text-center">
              <p className="text-[var(--font-size-sm)] text-[var(--text-muted)]">
                No conversations yet
              </p>
              <p className="text-[var(--font-size-xs)] text-[var(--text-muted)] mt-1 opacity-60">
                Start a new conversation to get going
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onClick={() => setActiveSessionId(session.id)}
              />
            ))
          )}
        </div>

        {/* ============================================
            区域：底部操作栏
            ============================================ */}
        <div className="border-t border-[var(--border-color)] px-3 py-2.5 flex items-center justify-between">
          {/* 功能：打开设置页
              事件：onClick → 更新 settingsOpenAtom = true */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="
              text-[16px] text-[var(--text-muted)]
              px-2 py-1 rounded-[var(--radius-sm)]
              tracking-[1.5px]
              hover:bg-[var(--hover-bg)] hover:text-[var(--text-secondary)]
              transition-colors duration-[var(--transition-fast)]
              border-none bg-transparent cursor-pointer
            "
          >
            ···
          </button>

          {/* 功能：检查更新
              事件：onClick → 调用 window.electronAPI.checkForUpdates() */}
          <button
            onClick={() => {
              // TODO: 调用 window.electronAPI.checkForUpdates()
            }}
            className="
              text-[var(--font-size-xs)] text-[var(--text-secondary)]
              px-3 py-1.5 rounded-[var(--radius-md)]
              hover:bg-[var(--hover-bg)]
              transition-colors duration-[var(--transition-fast)]
              border-none bg-transparent cursor-pointer
              font-medium flex items-center gap-1
            "
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="16 12 12 8 8 12" />
              <line x1="12" y1="16" x2="12" y2="8" />
            </svg>
            Update
          </button>
        </div>
      </div>
    </aside>
  );
}

// ============================================
// SessionItem 子组件
// ============================================

interface SessionItemProps {
  session: SessionMeta;
  isActive: boolean;
  onClick: () => void;
}

function SessionItem({ session, isActive, onClick }: SessionItemProps) {
  // 获取显示名称：优先用户自定义名称 > 首条消息预览 > 默认
  const displayName = session.name || session.preview || 'New Chat';

  return (
    <div
      onClick={onClick}
      className={`
        rounded-[var(--radius-md)] cursor-pointer
        text-[var(--font-size-sm)] font-medium
        px-[14px] py-[10px] mb-1
        transition-colors duration-[var(--transition-fast)]
        whitespace-nowrap overflow-hidden text-ellipsis
        ${isActive
          ? 'bg-[var(--selected-bg)] text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
        }
      `}
    >
      {/* TODO: 处理中时左侧显示 Spinner */}
      {/* TODO: 有未读消息时显示未读标记 */}
      {displayName}
    </div>
  );
}
