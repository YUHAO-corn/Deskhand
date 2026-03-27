/**
 * 权限请求弹窗
 *
 * 当 Agent 要执行危险操作（Bash/Edit/Write）时弹出，
 * 显示操作内容，让用户选择允许或拒绝。
 */

import { useAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import { permissionRequestAtom, activeSessionIdAtom } from '../../atoms/sessions';

export function PermissionRequest() {
  const [request, setRequest] = useAtom(permissionRequestAtom);
  const [activeSessionId] = useAtom(activeSessionIdAtom);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Auto-focus Allow button when dialog opens
  useEffect(() => {
    if (!request?.isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const allowBtn = dialog.querySelector<HTMLButtonElement>('[data-autofocus]');
    allowBtn?.focus();
  }, [request?.isOpen]);

  if (!request?.isOpen) return null;

  const handleAllow = () => {
    if (activeSessionId && request.requestId) {
      window.electronAPI.respondToPermission(activeSessionId, request.requestId, 'allow');
    }
    setRequest(null);
  };

  const handleDeny = () => {
    if (activeSessionId && request.requestId) {
      window.electronAPI.respondToPermission(activeSessionId, request.requestId, 'deny');
    }
    setRequest(null);
  };

  // Trap focus within dialog
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleDeny();
      return;
    }
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Tool name → display label
  const toolLabel: Record<string, string> = {
    Bash: 'Terminal',
    Edit: 'Edit File',
    Write: 'Write File',
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/30"
      onClick={handleDeny}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Permission Required"
        className="w-[500px] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line-soft)] bg-[var(--color-surface-panel)] shadow-[var(--elevation-3)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line-soft)]">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-[var(--color-danger)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
              Permission Required
            </h3>
          </div>
          <span className="rounded-[var(--radius-pill)] border border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
            {toolLabel[request.toolName] || request.toolName}
          </span>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-[var(--font-size-sm)] mb-2 text-[var(--color-text-muted)]">
            {request.description}
          </p>
          <div className="overflow-x-auto rounded-[var(--radius-control)] border border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] px-4 py-3 font-mono text-[var(--font-size-xs)] text-[var(--color-text-primary)]">
            <code>{request.toolName === 'Bash' ? '$ ' : ''}{request.command}</code>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] px-5 py-4">
          <button
            onClick={handleDeny}
            className="
              cursor-pointer rounded-[var(--radius-pill)] border border-[var(--color-danger-line)] bg-[var(--color-surface-elevated)] px-4 py-2
              text-[var(--font-size-sm)] font-medium text-[var(--color-danger)] transition-colors duration-200 hover:bg-[var(--color-danger-soft)]
            "
          >
            Deny
          </button>
          <button
            data-autofocus
            onClick={handleAllow}
            className="
              cursor-pointer rounded-[var(--radius-pill)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-2
              text-[var(--font-size-sm)] font-medium text-[var(--color-surface-elevated)] transition-colors duration-200 hover:bg-[var(--color-accent-strong)]
            "
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
