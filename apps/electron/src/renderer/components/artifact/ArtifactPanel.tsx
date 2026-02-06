/**
 * Artifact 面板
 *
 * 📐 SPEC: docs/SPEC_ArtifactPanel.md
 * 🎨 原型: deskhand-prototype/src/components/ArtifactPanel.tsx
 *
 * 职责：
 * - 展示 Agent 执行过程中产生的文件、终端输出、网页预览
 * - 提供文件树导航和文件内容预览
 * - 支持代码语法高亮和 HTML/Markdown 渲染预览
 * - 管理面板的展开/收起和宽度调整
 */

import { useRef, useEffect } from 'react';
import { useAtom } from 'jotai';
import {
  artifactPanelOpenAtom,
  artifactPanelWidthAtom,
  artifactActiveTabAtom,
} from '../../atoms/sessions';
import { ArtifactTabs } from './ArtifactTabs';
import { FilesTabContent } from './files/FilesTabContent';
import { ChangesTab } from './changes/ChangesTab';
import { TerminalTab } from './terminal/TerminalTab';
import { BrowserTab } from './browser/BrowserTab';

export function ArtifactPanel() {
  const [isOpen, setIsOpen] = useAtom(artifactPanelOpenAtom);
  const [width, setWidth] = useAtom(artifactPanelWidthAtom);
  const [activeTab, setActiveTab] = useAtom(artifactActiveTabAtom);
  const isDragging = useRef(false);

  // ============================================
  // 拖拽调整宽度
  // ============================================
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const mainContent = document.querySelector('.main-content') as HTMLElement;
      if (!mainContent) return;
      const rect = mainContent.getBoundingClientRect();
      const newWidth = Math.max(320, Math.min(800, rect.right - e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.classList.remove('select-none');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setWidth]);

  const handleResizeStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    document.body.classList.add('select-none');
    e.preventDefault();
  };

  return (
    <>
      {/* ============================================
          区域：拖拽手柄
          功能：拖拽调整面板宽度
          ============================================ */}
      {isOpen && (
        <div
          onMouseDown={handleResizeStart}
          className="w-1.5 bg-transparent cursor-col-resize relative hover:bg-[var(--hover-bg)]"
        />
      )}

      {/* ============================================
          区域：面板主体
          ============================================ */}
      <div
        style={{
          width: isOpen ? width : 0,
          minWidth: isOpen ? 320 : 0,
        }}
        className="
          bg-[var(--bg-secondary)]
          border-l border-[var(--border-color)]
          flex flex-col overflow-hidden
          transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        "
      >
        <div
          style={{ minWidth: 320, width }}
          className="h-full flex flex-col"
        >
          {/* Header - Tab 切换 */}
          <ArtifactTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onClose={() => setIsOpen(false)}
          />

          {/* Content - 根据 Tab 渲染内容 */}
          <div className="flex-1 flex overflow-hidden">
            {activeTab === 'files' && <FilesTabContent />}
            {activeTab === 'changes' && <ChangesTab />}
            {activeTab === 'terminal' && <TerminalTab />}
            {activeTab === 'browser' && <BrowserTab />}
          </div>
        </div>
      </div>
    </>
  );
}
