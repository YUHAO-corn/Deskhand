/**
 * 输入工具栏
 *
 * 📐 SPEC: docs/SPEC_InputToolbar.md
 * 🎨 原型: deskhand-prototype/src/components/InputToolbar.tsx
 *
 * 职责：
 * - 提供消息输入框
 * - 提供附件上传按钮
 * - 提供 Skills 选择器
 * - 提供模型选择器
 * - 提供发送按钮
 */

import { useState } from 'react';
import { useAtom } from 'jotai';
import { activeSessionIdAtom, sessionInputFamily } from '../../atoms/sessions';

export function InputToolbar() {
  const [activeSessionId] = useAtom(activeSessionIdAtom);

  // 输入内容（per-session 隔离）
  const inputAtom = activeSessionId ? sessionInputFamily(activeSessionId) : null;
  const [inputValue, setInputValue] = inputAtom ? useAtom(inputAtom) : ['', () => {}];

  // 弹窗状态
  const [activePopup, setActivePopup] = useState<string | null>(null);

  // 选中的模型
  const [selectedModel] = useState('Sonnet 4'); // TODO: 从配置读取

  const togglePopup = (popup: string) => {
    setActivePopup(activePopup === popup ? null : popup);
  };

  // ============================================
  // 发送消息
  // ============================================
  const handleSend = () => {
    if (!inputValue.trim() || !activeSessionId) return;
    // TODO: 调用 onSendMessage(inputValue, attachments)
    // TODO: 清空输入框
    console.log('Send:', inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative px-6 pt-4 pb-7">
      {/* ============================================
          区域：弹窗背景遮罩
          功能：点击关闭弹窗
          ============================================ */}
      {activePopup && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setActivePopup(null)}
        />
      )}

      {/* 主容器 */}
      <div className="
        bg-white rounded-[20px]
        border border-[var(--border-light)]
        shadow-[0_2px_8px_rgba(0,0,0,0.04)]
        relative
      ">
        {/* ============================================
            区域：弹窗容器
            功能：各种选择器弹窗（Workspace、Tools、Skills、Reasoning、Model）
            TODO: 实现各个弹窗组件
            ============================================ */}
        {/* <WorkspacePopup /> */}
        {/* <ToolsPopup /> */}
        {/* <SkillsPopup /> */}
        {/* <ReasoningPopup /> */}
        {/* <ModelSelectorPopup /> */}

        {/* ============================================
            区域：输入框
            功能：消息输入，支持多行
            事件：Enter 发送，Shift+Enter 换行
            ============================================ */}
        <textarea
          value={inputValue as string}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="
            w-full border-none outline-none resize-none
            text-[15px] text-[var(--text-primary)]
            bg-transparent
            placeholder:text-[var(--text-muted)]
            px-[22px] pt-[18px] pb-[14px]
          "
        />

        {/* ============================================
            区域：工具栏
            ============================================ */}
        <div className="flex items-center justify-between px-3.5 py-2.5">
          {/* 左侧按钮组 */}
          <div className="flex items-center gap-[1px]">
            {/* 功能：附件上传
                事件：onClick → 打开文件选择器 */}
            <ToolbarButton title="Attach file">
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </ToolbarButton>

            {/* 功能：工作目录选择
                TODO: 实现 WorkspacePopup */}
            <ToolbarButton
              badge="7"
              active={activePopup === 'workspace'}
              onClick={() => togglePopup('workspace')}
              title="Working directory"
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </ToolbarButton>

            {/* 功能：MCP 工具选择
                TODO: 实现 ToolsPopup */}
            <ToolbarButton
              badge="4"
              active={activePopup === 'tools'}
              onClick={() => togglePopup('tools')}
              title="Tools"
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3L14.5 8.5L20 9L16 13L17 19L12 16L7 19L8 13L4 9L9.5 8.5L12 3Z" />
              </svg>
            </ToolbarButton>

            {/* 功能：Skills 选择
                TODO: 实现 SkillsPopup */}
            <ToolbarButton
              badge="4"
              active={activePopup === 'skills'}
              onClick={() => togglePopup('skills')}
              title="Skills"
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </ToolbarButton>

            {/* 功能：思考级别选择
                TODO: 实现 ReasoningPopup */}
            <ToolbarButton
              badge="6"
              active={activePopup === 'reasoning'}
              onClick={() => togglePopup('reasoning')}
              title="Reasoning level"
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
              </svg>
            </ToolbarButton>

            {/* 功能：模型选择器
                TODO: 实现 ModelSelectorPopup */}
            <button
              onClick={() => togglePopup('model')}
              className={`
                flex items-center gap-1.5
                px-2.5 py-1.5 ml-1
                bg-transparent border-none rounded-[var(--radius-md)]
                cursor-pointer
                text-[var(--font-size-xs)] font-medium text-[var(--text-secondary)]
                transition-colors duration-[var(--transition-fast)]
                hover:bg-[var(--hover-bg)]
                ${activePopup === 'model' ? 'bg-[var(--hover-bg)]' : ''}
              `}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              {selectedModel}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>

          {/* 右侧按钮组 */}
          <div className="flex items-center gap-1.5">
            {/* 功能：预览模式切换（可选）
                TODO: 实现预览功能 */}
            <ToolbarButton title="Preview">
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </ToolbarButton>

            {/* 功能：发送消息
                状态：无内容时禁用
                事件：onClick → 发送消息 */}
            <button
              onClick={handleSend}
              disabled={!inputValue?.trim()}
              className="
                w-[34px] h-[34px]
                border-none bg-transparent rounded-lg
                cursor-pointer
                flex items-center justify-center
                text-[var(--text-muted)]
                transition-colors duration-[var(--transition-fast)]
                hover:bg-[var(--hover-bg)] hover:text-[var(--accent-color)]
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ToolbarButton - 工具栏按钮
// ============================================

interface ToolbarButtonProps {
  children: React.ReactNode;
  badge?: string;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}

function ToolbarButton({ children, badge, active, onClick, title }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        w-[34px] h-[34px]
        border-none bg-transparent rounded-lg
        cursor-pointer
        flex items-center justify-center
        text-[var(--text-muted)]
        transition-colors duration-[var(--transition-fast)]
        relative
        hover:bg-[var(--hover-bg)] hover:text-[var(--text-secondary)]
        ${active ? 'bg-[var(--hover-bg)] text-[var(--text-primary)]' : ''}
      `}
    >
      {children}
      {badge && (
        <span className="
          absolute top-[3px] right-[3px]
          min-w-[15px] h-[15px] px-1
          bg-[#c5d9d2] text-[#4a7c6f]
          text-[9px] font-semibold
          rounded-[var(--radius-md)]
          flex items-center justify-center
        ">
          {badge}
        </span>
      )}
    </button>
  );
}
