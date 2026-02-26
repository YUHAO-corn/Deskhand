/**
 * 输入工具栏
 *
 * 📐 SPEC: docs/SPEC_InputToolbar.md
 * 🎨 设计: docs/plans/2026-02-24-a2ui-design.md Q20
 *
 * 布局：
 * - 左侧（图标按钮）：附件 · 工具 · 工作目录 — context/输入
 * - 右侧（文字按钮）：模型 · 权限 · 发送/停止 — agent 配置
 */

import { useState, useCallback, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import type { Message, Session } from '@deskhand/core';
import { generateMessageId, messageToStored } from '@deskhand/core';
import {
  activeSessionIdAtom,
  sessionInputFamily,
  sessionMessagesFamily,
  sessionProcessingFamily,
  sessionMetaMapAtom,
  sessionIdsAtom,
  memoryOnlySessionsAtom,
  selectedModelAtom,
  workingDirectoryAtom,
  permissionModeAtom,
  pendingActionMessageAtom,
  pendingA2UIPromptAtom,
} from '../../atoms/sessions';
import {
  WorkspacePopup,
  InteractPopup,
  ToolsPopup,
  ModelSelectorPopup,
  ClipboardPopup,
} from './popups';

export function InputToolbar() {
  const [activeSessionId] = useAtom(activeSessionIdAtom);

  // 使用固定的 atom key 避免 hooks 规则问题
  const sessionKey = activeSessionId ?? '__empty__';

  // 输入内容（per-session 隔离）
  const [inputValue, setInputValue] = useAtom(sessionInputFamily(sessionKey));

  // 消息和处理状态
  const setMessages = useSetAtom(sessionMessagesFamily(sessionKey));
  const [isProcessing, setProcessing] = useAtom(sessionProcessingFamily(sessionKey));

  // Session persistence state
  const [sessionMetaMap, setSessionMetaMap] = useAtom(sessionMetaMapAtom);
  const [sessionIds, setSessionIds] = useAtom(sessionIdsAtom);
  const [memoryOnlySessions, setMemoryOnlySessions] = useAtom(memoryOnlySessionsAtom);

  // 模型配置
  const [selectedModel] = useAtom(selectedModelAtom);

  // 工作目录
  const [workingDirectory] = useAtom(workingDirectoryAtom);

  // 权限模式
  const [permissionMode, setPermissionMode] = useAtom(permissionModeAtom);

  // A2UI prompt attachment
  const [a2uiPrompt, setA2UIPrompt] = useAtom(pendingA2UIPromptAtom);

  // 弹窗状态
  const [activePopup, setActivePopup] = useState<string | null>(null);

  // 剪贴板附件
  const [clipboardAttachments, setClipboardAttachments] = useState<Array<{
    id: string;
    type: 'text' | 'image' | 'link';
    content: string;
    preview: string;
    charCount?: number;
    fileSize?: number;
  }>>([]);

  const handleClipboardConfirm = (entries: Array<{
    id: string;
    type: 'text' | 'image' | 'link';
    content: string;
    preview: string;
    charCount?: number;
    fileSize?: number;
  }>) => {
    setClipboardAttachments((prev) => {
      const existingIds = new Set(prev.map((a) => a.id));
      const newEntries = entries.filter((e) => !existingIds.has(e.id));
      return [...prev, ...newEntries];
    });
    setActivePopup(null);
  };

  const removeAttachment = (id: string) => {
    setClipboardAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const togglePopup = (popup: string) => {
    setActivePopup(activePopup === popup ? null : popup);
  };

  // 获取模型显示名称
  const getModelDisplayName = (modelId: string) => {
    const modelNames: Record<string, string> = {
      'claude-opus-4-5-20251101': 'Opus 4.5',
      'claude-sonnet-4-5-20250929': 'Sonnet 4.5',
      'claude-sonnet-4-20250514': 'Sonnet 4',
      'claude-haiku-4-5-20251001': 'Haiku 4.5',
      'claude-haiku-3-5-20241022': 'Haiku 3.5',
    };
    return modelNames[modelId] || modelId;
  };

  // ============================================
  // 发送消息
  // ============================================
  const handleSend = useCallback(async (overrideMessage?: string) => {
    const trimmedInput = (overrideMessage ?? inputValue).trim();
    if (!trimmedInput || !activeSessionId) return;

    // Build message with clipboard attachments inlined
    let fullMessage = trimmedInput;
    if (!overrideMessage && clipboardAttachments.length > 0) {
      const attachmentParts = clipboardAttachments.map((att) => {
        if (att.type === 'image') {
          return `[Clipboard image: ${att.content}]`;
        }
        const MAX_INLINE = 500;
        if (att.content.length <= MAX_INLINE) {
          return `---\n${att.content}\n---`;
        }
        return `---\n${att.content.slice(0, MAX_INLINE)}…\n(truncated, ${att.charCount?.toLocaleString()} chars total)\n---`;
      });
      fullMessage = attachmentParts.join('\n\n') + '\n\n' + trimmedInput;
      setClipboardAttachments([]);
    }

    // Include A2UI prompt attachment if present
    if (!overrideMessage && a2uiPrompt) {
      fullMessage = `---\n${a2uiPrompt}\n---\n\n` + fullMessage;
      setA2UIPrompt(null);
    }

    // 1. 添加用户消息到 atoms
    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: fullMessage,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // 2. 设置处理状态
    setProcessing(true);

    // 3. 清空输入框（only when sending from input, not from action buttons）
    if (!overrideMessage) {
      setInputValue('');
    }

    // 4. 持久化：如果是 memory-only session，先创建到磁盘
    const isMemoryOnly = memoryOnlySessions.has(activeSessionId);
    const now = Date.now();
    const preview = trimmedInput.slice(0, 50);

    try {
      if (isMemoryOnly) {
        const session: Session = {
          id: activeSessionId,
          createdAt: sessionMetaMap.get(activeSessionId)?.createdAt ?? now,
          messageCount: 1,
          lastMessageAt: now,
          preview,
        };
        await window.electronAPI?.createSession(session);
        // Remove from memory-only set
        setMemoryOnlySessions((prev) => {
          const next = new Set(prev);
          next.delete(activeSessionId);
          return next;
        });
      }

      // Persist user message to disk
      await window.electronAPI?.appendMessage(activeSessionId, messageToStored(userMessage));

      // Update session metadata in atoms
      setSessionMetaMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(activeSessionId);
        next.set(activeSessionId, {
          ...existing,
          id: activeSessionId,
          lastMessageAt: now,
          preview: existing?.preview ?? preview,
          messageCount: (existing?.messageCount ?? 0) + 1,
        });
        return next;
      });

      // Move session to top of list
      setSessionIds((prev) => {
        const filtered = prev.filter((id) => id !== activeSessionId);
        return [activeSessionId, ...filtered];
      });
    } catch (error) {
      console.error('[InputToolbar] persistence error:', error);
    }

    // 5. 调用 IPC 发送消息
    try {
      await window.electronAPI?.chat(activeSessionId, fullMessage, {
        model: selectedModel,
        workingDirectory: workingDirectory ?? undefined,
        permissionMode,
      });
    } catch (error) {
      console.error('[InputToolbar] chat error:', error);
    }
  }, [inputValue, activeSessionId, setMessages, setProcessing, setInputValue, selectedModel, workingDirectory, permissionMode, memoryOnlySessions, setMemoryOnlySessions, sessionMetaMap, setSessionMetaMap, setSessionIds, clipboardAttachments]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Watch for pending action messages (from insight report action buttons)
  const [pendingAction, setPendingAction] = useAtom(pendingActionMessageAtom);
  useEffect(() => {
    if (pendingAction) {
      setPendingAction(null);
      handleSend(pendingAction);
    }
  }, [pendingAction, setPendingAction, handleSend]);

  // ============================================
  // 停止生成
  // ============================================
  const handleStop = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      await window.electronAPI?.stopAgent(activeSessionId);
      setProcessing(false);
    } catch (error) {
      console.error('[InputToolbar] stop error:', error);
    }
  }, [activeSessionId, setProcessing]);

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
        shadow-[0_2px_16px_rgba(0,0,0,0.08)]
        relative
      ">
        {/* ============================================
            区域：弹窗容器
            ============================================ */}
        <WorkspacePopup isOpen={activePopup === 'workspace'} />
        <InteractPopup
          isOpen={activePopup === 'interact'}
          onSelect={(tag) => {
            const marker = `[${tag}] `;
            setInputValue((prev) => marker + (prev as string));
            setActivePopup(null);
          }}
        />
        <ToolsPopup isOpen={activePopup === 'tools'} />
        <ModelSelectorPopup isOpen={activePopup === 'model'} onClose={() => setActivePopup(null)} />
        <ClipboardPopup isOpen={activePopup === 'clipboard'} onConfirm={handleClipboardConfirm} />

        {/* ============================================
            区域：剪贴板附件预览
            ============================================ */}
        {(clipboardAttachments.length > 0 || a2uiPrompt) && (
          <div className="flex flex-wrap gap-2 px-[22px] pt-[14px]">
            {a2uiPrompt && (
              <div
                className="
                  flex items-center gap-2 px-3 py-1.5
                  bg-[var(--accent-bg)] rounded-[var(--radius-md)]
                  text-[var(--font-size-sm)] text-[var(--accent)]
                  max-w-[240px] border border-[var(--accent)]/20
                "
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <span className="truncate">
                  {a2uiPrompt.slice(0, 30)}{a2uiPrompt.length > 30 ? '…' : ''}
                </span>
                <button
                  onClick={() => setA2UIPrompt(null)}
                  className="
                    shrink-0 w-4 h-4 flex items-center justify-center
                    bg-transparent border-none cursor-pointer
                    text-[var(--text-muted)] hover:text-[var(--text-primary)]
                  "
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}
            {clipboardAttachments.map((att) => (
              <div
                key={att.id}
                className="
                  flex items-center gap-2 px-3 py-1.5
                  bg-[var(--accent-bg)] rounded-[var(--radius-md)]
                  text-[var(--font-size-sm)] text-[var(--text-primary)]
                  max-w-[240px]
                "
              >
                <span className="truncate">
                  {att.type === 'image' ? 'Image' : att.preview.slice(0, 30)}
                  {att.preview.length > 30 && att.type !== 'image' ? '…' : ''}
                </span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="
                    shrink-0 w-4 h-4 flex items-center justify-center
                    bg-transparent border-none cursor-pointer
                    text-[var(--text-muted)] hover:text-[var(--text-primary)]
                  "
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

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
            区域：工具栏 — 左(context) / 右(agent config)
            ============================================ */}
        <div className="flex items-center justify-between px-3 py-2">
          {/* 左侧：图标按钮组 — context/输入 */}
          <div className="flex items-center gap-0.5">
            {/* 附件（文件/剪贴板） */}
            <ToolbarIconButton
              title="Attach"
              active={activePopup === 'clipboard'}
              onClick={() => togglePopup('clipboard')}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </ToolbarIconButton>

            {/* 交互方式（Interact 菜单） */}
            <ToolbarIconButton
              title="Interact"
              active={activePopup === 'interact'}
              onClick={() => togglePopup('interact')}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l2 2 4-4" />
              </svg>
            </ToolbarIconButton>

            {/* 工具（Skills + MCP Tools 合并） */}
            <ToolbarIconButton
              title="Tools"
              active={activePopup === 'tools'}
              onClick={() => togglePopup('tools')}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </ToolbarIconButton>

            {/* 工作目录 */}
            <ToolbarIconButton
              title={workingDirectory ? `Workspace: ${workingDirectory}` : 'Select workspace'}
              active={activePopup === 'workspace'}
              onClick={() => togglePopup('workspace')}
              badge={workingDirectory ? workingDirectory.split('/').pop() : undefined}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </ToolbarIconButton>
          </div>

          {/* 右侧：文字按钮组 — agent 配置 */}
          <div className="flex items-center gap-1">
            {/* 模型选择器 */}
            <ToolbarTextButton
              active={activePopup === 'model'}
              onClick={() => togglePopup('model')}
            >
              {getModelDisplayName(selectedModel)}
            </ToolbarTextButton>

            {/* 分隔点 */}
            <span className="text-[var(--border-color)] text-[10px] select-none">·</span>

            {/* 权限模式 */}
            <ToolbarTextButton
              onClick={() => setPermissionMode(permissionMode === 'ask' ? 'allow-all' : 'ask')}
              title={permissionMode === 'ask' ? 'Ask mode: confirms dangerous operations' : 'Auto mode: only confirms delete commands'}
              highlight={permissionMode === 'allow-all'}
            >
              {permissionMode === 'ask' ? 'Ask' : 'Auto'}
            </ToolbarTextButton>

            {/* 分隔点 */}
            <span className="text-[var(--border-color)] text-[10px] select-none">·</span>

            {/* 发送 / 停止 */}
            {isProcessing ? (
              <button
                onClick={handleStop}
                title="Stop generating"
                className="
                  w-[30px] h-[30px]
                  border-none bg-red-500 rounded-lg
                  cursor-pointer
                  flex items-center justify-center
                  text-white
                  transition-colors duration-[var(--transition-fast)]
                  hover:bg-red-600
                "
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!inputValue?.trim()}
                title="Send message"
                className="
                  w-[30px] h-[30px]
                  border-none bg-transparent rounded-lg
                  cursor-pointer
                  flex items-center justify-center
                  text-[var(--text-muted)]
                  transition-colors duration-[var(--transition-fast)]
                  hover:bg-[var(--hover-bg)] hover:text-[var(--accent-color)]
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--text-muted)]
                "
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ToolbarIconButton - 左侧图标按钮（统一 30x30）
// ============================================

interface ToolbarIconButtonProps {
  children: React.ReactNode;
  badge?: string;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}

function ToolbarIconButton({ children, badge, active, onClick, title }: ToolbarIconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        w-[30px] h-[30px]
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
          absolute -top-0.5 -right-0.5
          min-w-[14px] h-[14px] px-0.5
          bg-[#c5d9d2] text-[#4a7c6f]
          text-[8px] font-semibold
          rounded-full
          flex items-center justify-center
          leading-none
        ">
          {badge}
        </span>
      )}
    </button>
  );
}

// ============================================
// ToolbarTextButton - 右侧文字按钮
// ============================================

interface ToolbarTextButtonProps {
  children: React.ReactNode;
  active?: boolean;
  highlight?: boolean;
  onClick?: () => void;
  title?: string;
}

function ToolbarTextButton({ children, active, highlight, onClick, title }: ToolbarTextButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        px-2 py-1
        bg-transparent border-none rounded-[var(--radius-sm)]
        cursor-pointer
        text-[11px] font-medium
        transition-colors duration-[var(--transition-fast)]
        hover:bg-[var(--hover-bg)]
        ${highlight
          ? 'text-amber-600'
          : active
            ? 'text-[var(--text-primary)]'
            : 'text-[var(--text-secondary)]'
        }
      `}
    >
      {children}
    </button>
  );
}
