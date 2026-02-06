/**
 * Artifact Tab 切换组件
 *
 * 📐 SPEC: docs/SPEC_ArtifactPanel.md
 */

import type { ArtifactTab } from '@deskhand/core';

const tabs: { id: ArtifactTab; label: string; icon: string }[] = [
  { id: 'files', label: 'Files', icon: 'file' },
  { id: 'changes', label: 'Changes', icon: 'diff' },
  { id: 'terminal', label: 'Terminal', icon: 'terminal' },
  { id: 'browser', label: 'Browser', icon: 'globe' },
];

interface ArtifactTabsProps {
  activeTab: ArtifactTab;
  onTabChange: (tab: ArtifactTab) => void;
  onClose: () => void;
}

export function ArtifactTabs({ activeTab, onTabChange, onClose }: ArtifactTabsProps) {
  return (
    <div className="h-12 border-b border-[var(--border-color)] flex items-center px-3 pr-2">
      {/* Tab 按钮组 */}
      <div className="flex gap-[2px] flex-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              border-none bg-transparent
              rounded-[var(--radius-md)] cursor-pointer
              text-[var(--font-size-sm)] font-medium text-[var(--text-secondary)]
              flex items-center whitespace-nowrap
              px-3 py-2 gap-1.5
              transition-colors duration-[var(--transition-fast)]
              hover:bg-[var(--hover-bg)]
              ${activeTab === tab.id ? 'bg-[var(--hover-bg)] text-[var(--text-primary)]' : ''}
            `}
          >
            <TabIcon type={tab.icon} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="
          w-8 h-8
          border-none bg-transparent
          rounded-[var(--radius-md)] cursor-pointer
          flex items-center justify-center
          text-[var(--text-secondary)]
          transition-colors duration-[var(--transition-fast)]
          hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]
        "
      >
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ============================================
// TabIcon - Tab 图标
// ============================================

function TabIcon({ type }: { type: string }) {
  switch (type) {
    case 'file':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case 'diff':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M12 3v18M3 12h18" />
        </svg>
      );
    case 'terminal':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      );
    case 'globe':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    default:
      return null;
  }
}
