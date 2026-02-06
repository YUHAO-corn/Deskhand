/**
 * 权限请求弹窗
 *
 * 📐 SPEC: docs/SPEC_ChatArea.md (权限请求部分)
 * 🎨 原型: deskhand-prototype/src/components/PermissionRequest.tsx
 *
 * 职责：
 * - 显示 Agent 请求执行的命令/操作
 * - 提供允许/拒绝选项
 * - 显示并允许切换权限模式
 */

import { useAtom } from 'jotai';
import { permissionRequestAtom, permissionModeAtom } from '../../atoms/sessions';
import type { PermissionMode } from '@deskhand/core';

export function PermissionRequest() {
  const [request, setRequest] = useAtom(permissionRequestAtom);
  const [permissionMode, setPermissionMode] = useAtom(permissionModeAtom);

  if (!request?.isOpen) return null;

  const handleClose = () => {
    setRequest(null);
  };

  const handleReject = () => {
    // TODO: 调用 IPC 发送 reject 响应给 Agent
    handleClose();
  };

  const handleAllowOnce = () => {
    // TODO: 调用 IPC 发送 allow-once 响应给 Agent
    handleClose();
  };

  const handleAllow = () => {
    // TODO: 调用 IPC 发送 allow 响应给 Agent
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/35"
      onClick={handleClose}
    >
      <div
        className="w-[480px] bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] shadow-[var(--shadow-popup)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================
            区域：Header
            ============================================ */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
            Permission Required
          </h3>
          <button
            onClick={handleClose}
            className="
              w-7 h-7 border-none bg-transparent
              rounded-[var(--radius-md)] cursor-pointer
              flex items-center justify-center
              text-[var(--text-muted)]
              transition-all duration-[var(--transition-fast)]
              hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]
            "
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ============================================
            区域：Content
            ============================================ */}
        <div className="p-5">
          <p className="text-[var(--font-size-sm)] mb-3 text-[var(--text-muted)]">
            Agent wants to execute:
          </p>
          <div className="font-mono text-[var(--font-size-xs)] overflow-x-auto px-4 py-3 bg-[#1e1e1e] text-[#d4d4d4] rounded-[var(--radius-md)] mb-5">
            <code>$ {request.command}</code>
          </div>

          {/* 模式选择器 - Claude.ai 风格 */}
          <div className="p-4 bg-[var(--hover-bg)] rounded-[var(--radius-md)]">
            <p className="text-[var(--font-size-xs)] font-medium mb-3 text-[var(--text-secondary)]">
              Current Mode:
            </p>
            <div className="flex items-center bg-white rounded-[var(--radius-md)] p-[3px] shadow-sm">
              <ModeButton
                label="Explore"
                isActive={permissionMode === 'explore'}
                onClick={() => setPermissionMode('explore')}
              />
              <ModeButton
                label="Ask"
                isActive={permissionMode === 'ask'}
                onClick={() => setPermissionMode('ask')}
              />
              <ModeButton
                label="Auto"
                isActive={permissionMode === 'auto'}
                onClick={() => setPermissionMode('auto')}
              />
            </div>
          </div>
        </div>

        {/* ============================================
            区域：Actions
            ============================================ */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border-color)] bg-[var(--hover-bg)]">
          <button
            onClick={handleReject}
            className="
              px-4 py-2
              bg-transparent border border-red-200
              rounded-[var(--radius-md)] cursor-pointer
              text-[var(--font-size-sm)] font-medium text-red-600
              transition-all duration-[var(--transition-fast)]
              hover:bg-red-50
            "
          >
            Reject
          </button>
          <button
            onClick={handleAllowOnce}
            className="
              px-4 py-2
              bg-white border border-[var(--border-color)]
              rounded-[var(--radius-md)] cursor-pointer
              text-[var(--font-size-sm)] font-medium text-[var(--text-secondary)]
              transition-all duration-[var(--transition-fast)]
              hover:bg-[var(--bg-secondary)]
            "
          >
            Allow Once
          </button>
          <button
            onClick={handleAllow}
            className="
              px-4 py-2
              border-none bg-[var(--accent-color)]
              rounded-[var(--radius-md)] cursor-pointer
              text-[var(--font-size-sm)] font-medium text-white
              transition-all duration-[var(--transition-fast)]
              hover:opacity-90
            "
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ModeButton - 模式切换按钮
// ============================================

interface ModeButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function ModeButton({ label, isActive, onClick }: ModeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 px-3 py-2
        border-none rounded-[var(--radius-sm)]
        text-[var(--font-size-xs)] font-medium cursor-pointer
        transition-all duration-[var(--transition-fast)]
        ${isActive
          ? 'bg-[var(--accent-bg)] text-[var(--accent-color)]'
          : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
        }
      `}
    >
      {label}
    </button>
  );
}
