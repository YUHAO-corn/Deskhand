/**
 * 对话区域
 *
 * 📐 SPEC: docs/SPEC_ChatArea.md
 * 🎨 原型: deskhand-prototype/src/components/ChatArea.tsx
 *
 * 职责：
 * - 渲染会话中的所有消息（用户、AI、工具、系统）
 * - 处理流式响应的实时更新
 * - 展示工具调用过程和结果
 * - 显示权限请求并收集用户响应
 * - 提供会话控制操作（停止、重新生成）
 */

import { useAtom } from 'jotai';
import {
  activeSessionIdAtom,
  artifactPanelOpenAtom,
  artifactActiveTabAtom,
} from '../../atoms/sessions';
import { InputToolbar } from '../input/InputToolbar';

export function ChatArea() {
  const [activeSessionId] = useAtom(activeSessionIdAtom);
  const [artifactPanelOpen, setArtifactPanelOpen] = useAtom(artifactPanelOpenAtom);
  const [, setArtifactActiveTab] = useAtom(artifactActiveTabAtom);

  // ============================================
  // 打开 Artifact 面板到指定 Tab
  // ============================================
  const openArtifactTab = (tab: 'files' | 'changes' | 'terminal' | 'preview') => {
    setArtifactPanelOpen(true);
    setArtifactActiveTab(tab);
  };

  // TODO: 从 sessionMessagesFamily(activeSessionId) 获取消息列表
  // TODO: 使用 turn-utils.ts 的 buildTurnsFromMessages 转换为 Turn 数组
  const turns: any[] = []; // TODO: 替换为实际数据
  const isEmpty = turns.length === 0;

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)] relative">
      {/* ============================================
          区域：消息列表
          功能：渲染所有 Turn（用户消息 + AI 回复）
          数据：turns 数组（由 buildTurnsFromMessages 生成）
          ============================================ */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          // 空状态
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-[var(--text-muted)] text-[var(--font-size-base)]">
              <p>Start a conversation...</p>
            </div>
          </div>
        ) : (
          // 消息列表
          <div className="max-w-3xl mx-auto py-6 px-4">
            {turns.map((turn) => (
              <TurnRenderer key={turn.id} turn={turn} />
            ))}
          </div>
        )}
      </div>

      {/* ============================================
          区域：右侧工具栏
          功能：快速打开 Artifact 面板的各个 Tab
          状态：Artifact 面板打开时隐藏
          ============================================ */}
      <div
        className={`
          absolute right-4 top-1/2 -translate-y-1/2
          flex flex-col gap-[1px]
          bg-[var(--bg-secondary)] rounded-[10px] p-1.5
          shadow-[0_2px_8px_rgba(0,0,0,0.08)]
          border border-[var(--border-light)]
          z-40
          transition-opacity duration-[var(--transition-fast)]
          ${artifactPanelOpen ? 'opacity-0 pointer-events-none' : ''}
        `}
      >
        {/* Files Tab */}
        <RightToolbarButton
          onClick={() => openArtifactTab('files')}
          title="Files"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </RightToolbarButton>

        {/* Changes Tab */}
        <RightToolbarButton
          onClick={() => openArtifactTab('changes')}
          title="Changes"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v18M3 12h18" />
          </svg>
        </RightToolbarButton>

        {/* Terminal Tab */}
        <RightToolbarButton
          onClick={() => openArtifactTab('terminal')}
          title="Terminal"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
        </RightToolbarButton>

        {/* Preview Tab */}
        <RightToolbarButton
          onClick={() => openArtifactTab('preview')}
          title="Preview"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </RightToolbarButton>
      </div>

      {/* ============================================
          区域：输入区域
          功能：消息输入、附件、发送
          组件：InputToolbar
          ============================================ */}
      <InputToolbar />
    </div>
  );
}

// ============================================
// TurnRenderer - 根据 Turn 类型渲染不同组件
// ============================================

interface TurnRendererProps {
  turn: any; // TODO: 使用 Turn 类型
}

function TurnRenderer({ turn }: TurnRendererProps) {
  // TODO: 根据 turn.type 渲染不同组件
  // - user → UserMessageBubble
  // - assistant → TurnCard
  // - system → SystemMessage
  // - auth-request → AuthRequestCard

  return (
    <div className="mb-4">
      {/* TODO: 实现 Turn 渲染逻辑 */}
      <div className="p-4 bg-[var(--bg-secondary)] rounded-[var(--radius-md)]">
        Turn: {turn.type}
      </div>
    </div>
  );
}

// ============================================
// RightToolbarButton - 右侧工具栏按钮
// ============================================

interface RightToolbarButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}

function RightToolbarButton({ children, onClick, title }: RightToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="
        w-[36px] h-[36px]
        border-none bg-transparent
        rounded-[var(--radius-md)] cursor-pointer
        flex items-center justify-center
        text-[var(--text-secondary)]
        transition-colors duration-[var(--transition-fast)]
        hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]
      "
    >
      {children}
    </button>
  );
}
