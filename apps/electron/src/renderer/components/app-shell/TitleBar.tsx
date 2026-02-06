/**
 * 标题栏
 *
 * 📐 SPEC: docs/SPEC.md (全局设计部分)
 * 🎨 原型: deskhand-prototype/src/components/TitleBar.tsx
 *
 * 职责：
 * - 显示窗口控制按钮（macOS 红黄绿）
 * - 提供侧边栏切换按钮
 * - 提供搜索按钮
 * - 提供新建会话按钮
 * - 显示当前会话信息（标题、消息数、工作目录）
 */

import { useAtom } from 'jotai';
import {
  sidebarOpenAtom,
  activeSessionIdAtom,
  sessionMetaMapAtom,
} from '../../atoms/sessions';

export function TitleBar() {
  const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom);
  const [activeSessionId] = useAtom(activeSessionIdAtom);
  const [sessionMetaMap] = useAtom(sessionMetaMapAtom);

  // 获取当前会话元数据
  const currentSession = activeSessionId
    ? sessionMetaMap.get(activeSessionId)
    : null;

  const sessionTitle = currentSession?.name || currentSession?.preview || 'New Chat';
  const messageCount = currentSession?.messageCount ?? 0;
  const workingDirectory = currentSession?.workingDirectory || '';

  return (
    <header
      className="
        h-[var(--titlebar-height)]
        bg-[var(--bg-secondary)]
        border-b border-[var(--border-color)]
        flex items-center relative
        px-4
        drag-region
      "
    >
      {/* ============================================
          区域：窗口控制按钮（macOS 风格）
          功能：关闭/最小化/最大化窗口
          事件：由 Electron 主进程处理
          ============================================ */}
      <div className="flex gap-2 mr-4">
        <div className="w-3 h-3 rounded-full bg-[#ff5f57] cursor-pointer" />
        <div className="w-3 h-3 rounded-full bg-[#ffbd2e] cursor-pointer" />
        <div className="w-3 h-3 rounded-full bg-[#28c940] cursor-pointer" />
      </div>

      {/* ============================================
          区域：标题栏操作按钮
          ============================================ */}
      <div className="flex gap-[1px]">
        {/* 功能：切换侧边栏显示/隐藏
            状态：sidebarOpen 时高亮
            事件：onClick → 切换 sidebarOpenAtom */}
        <TitleBarButton
          isActive={sidebarOpen}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title="Toggle sidebar"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </TitleBarButton>

        {/* 功能：打开搜索
            事件：onClick → 激活搜索模式（聚焦侧边栏搜索框）
            TODO: 实现搜索功能 */}
        <TitleBarButton
          onClick={() => {
            // TODO: 激活搜索模式
          }}
          title="Search"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </TitleBarButton>

        {/* 功能：新建会话
            事件：onClick → 调用 window.electronAPI.createSession()
            TODO: 实现新建会话 */}
        <TitleBarButton
          onClick={() => {
            // TODO: 调用 window.electronAPI.createSession()
          }}
          title="New chat"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </TitleBarButton>
      </div>

      {/* ============================================
          区域：会话信息（居中）
          显示：会话标题、消息数、工作目录
          ============================================ */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
        <span className="text-[var(--font-size-sm)] font-semibold text-[var(--text-primary)]">
          {sessionTitle}
        </span>
        <span className="text-[var(--font-size-xs)] text-[var(--text-muted)] flex items-center gap-1">
          {messageCount} messages
          {workingDirectory && (
            <>
              {' · '}
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              {' '}
              {/* 显示工作目录的最后一部分 */}
              {workingDirectory.split('/').pop() || workingDirectory}
            </>
          )}
        </span>
      </div>
    </header>
  );
}

// ============================================
// TitleBarButton 子组件
// ============================================

interface TitleBarButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  isActive?: boolean;
  title?: string;
}

function TitleBarButton({ children, onClick, isActive, title }: TitleBarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        w-[32px] h-[32px]
        border-none bg-transparent
        rounded-[var(--radius-md)] cursor-pointer
        flex items-center justify-center
        text-[var(--text-secondary)]
        transition-colors duration-[var(--transition-fast)]
        hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]
        ${isActive ? 'bg-[var(--hover-bg)] text-[var(--text-primary)]' : ''}
      `}
    >
      {children}
    </button>
  );
}
