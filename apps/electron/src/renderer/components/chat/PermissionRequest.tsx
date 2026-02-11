/**
 * 权限请求弹窗
 *
 * 当 Agent 要执行危险操作（Bash/Edit/Write）时弹出，
 * 显示操作内容，让用户选择允许或拒绝。
 */

import { useAtom } from 'jotai';
import { permissionRequestAtom, activeSessionIdAtom } from '../../atoms/sessions';

export function PermissionRequest() {
  const [request, setRequest] = useAtom(permissionRequestAtom);
  const [activeSessionId] = useAtom(activeSessionIdAtom);

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

  // Tool name → display label
  const toolLabel: Record<string, string> = {
    Bash: 'Terminal',
    Edit: 'Edit File',
    Write: 'Write File',
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/35"
      onClick={handleDeny}
    >
      <div
        className="w-[480px] bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] shadow-[var(--shadow-popup)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
              Permission Required
            </h3>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--hover-bg)] text-[var(--text-muted)]">
            {toolLabel[request.toolName] || request.toolName}
          </span>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-[var(--font-size-sm)] mb-2 text-[var(--text-muted)]">
            {request.description}
          </p>
          <div className="font-mono text-[var(--font-size-xs)] overflow-x-auto px-4 py-3 bg-[#1e1e1e] text-[#d4d4d4] rounded-[var(--radius-md)]">
            <code>{request.toolName === 'Bash' ? '$ ' : ''}{request.command}</code>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border-color)] bg-[var(--hover-bg)]">
          <button
            onClick={handleDeny}
            className="
              px-4 py-2
              bg-transparent border border-red-200
              rounded-[var(--radius-md)] cursor-pointer
              text-[var(--font-size-sm)] font-medium text-red-600
              transition-all duration-[var(--transition-fast)]
              hover:bg-red-50
            "
          >
            Deny
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