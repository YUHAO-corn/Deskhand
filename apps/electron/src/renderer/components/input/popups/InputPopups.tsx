/**
 * InputToolbar 弹窗组件集合
 *
 * 📐 SPEC: docs/SPEC_InputToolbar.md
 * 🎨 原型: deskhand-prototype/src/components/Popups.tsx
 *
 * 包含：
 * - WorkspacePopup: 工作目录选择
 * - ToolsPopup: MCP 工具选择
 * - SkillsPopup: Skills 选择
 * - ReasoningPopup: 思考级别选择
 * - ModelSelectorPopup: 模型选择
 */

import { useState } from 'react';
import { useAtom } from 'jotai';
import {
  thinkingLevelAtom,
  selectedModelAtom,
  workingDirectoryAtom,
  skillsAtom,
} from '../../../atoms/sessions';
import type { ThinkingLevel } from '@deskhand/core';

// ============================================
// WorkspacePopup - 工作目录选择
// ============================================

interface WorkspacePopupProps {
  isOpen: boolean;
}

export function WorkspacePopup({ isOpen }: WorkspacePopupProps) {
  const [workingDirectory, setWorkingDirectory] = useAtom(workingDirectoryAtom);

  const handleSelectDirectory = async () => {
    const path = await window.electronAPI?.selectDirectory();
    if (path) {
      setWorkingDirectory(path);
      // Persist to config
      window.electronAPI?.saveConfig({ lastWorkingDirectory: path });
    }
  };

  const dirName = workingDirectory ? workingDirectory.split('/').pop() : null;

  return (
    <PopupContainer isOpen={isOpen} position="left-[14px]">
      {/* Header */}
      <PopupHeader
        title="Workspace"
        description="All tool operations will use this directory as working directory"
      />

      <div className="p-2">
        {/* Current directory */}
        {workingDirectory && (
          <div className="flex items-start gap-3 p-2.5 rounded-[var(--radius-md)] bg-[var(--accent-bg)]">
            <FolderIcon />
            <div className="flex-1 min-w-0">
              <div className="text-[var(--font-size-sm)] font-medium text-[var(--text-primary)] mb-0.5">
                {dirName}
              </div>
              <div className="text-[var(--font-size-xs)] text-[var(--text-muted)] leading-tight truncate">
                {workingDirectory}
              </div>
            </div>
          </div>
        )}

        {/* Select directory button */}
        <button
          className="
            flex items-center gap-2 w-full p-2.5
            border-none bg-transparent
            rounded-[var(--radius-md)] cursor-pointer
            text-[var(--font-size-sm)] text-[var(--text-secondary)]
            hover:bg-[var(--hover-bg)]
          "
          onClick={handleSelectDirectory}
        >
          <PlusIcon />
          {workingDirectory ? 'Change Directory...' : 'Select Directory...'}
        </button>
      </div>
    </PopupContainer>
  );
}

// ============================================
// ToolsPopup - MCP 工具选择
// ============================================

interface ToolsPopupProps {
  isOpen: boolean;
}

export function ToolsPopup({ isOpen }: ToolsPopupProps) {
  // TODO: 从 MCP 配置加载工具列表
  const tools = [
    { title: 'Web fetch', desc: 'Fetch the raw contents of a URL.' },
    { title: 'Web search', desc: 'Search the web for fresh information.' },
  ];

  return (
    <PopupContainer isOpen={isOpen} position="left-[50px]" minWidth={300}>
      <PopupHeader
        title="Tools"
        description="Allow Alma to use the selected tools for the next response."
      />

      <div className="p-2 max-h-80 overflow-y-auto">
        {/* 快捷操作 */}
        <div className="flex gap-1 mb-3">
          <button className="px-4 py-2 border-none bg-[var(--accent-bg)] rounded-[var(--radius-md)] cursor-pointer text-[var(--font-size-sm)] font-medium text-[var(--accent-color)] flex items-center gap-1.5">
            <StarIcon />
            Auto
          </button>
          <button className="px-4 py-2 border-none bg-transparent rounded-[var(--radius-md)] cursor-pointer text-[var(--font-size-sm)] font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]">
            Select all
          </button>
          <button className="px-4 py-2 border-none bg-transparent rounded-[var(--radius-md)] cursor-pointer text-[var(--font-size-sm)] font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]">
            Clear all
          </button>
        </div>

        {/* 工具列表 */}
        {tools.map((tool) => (
          <CheckboxItem key={tool.title} title={tool.title} desc={tool.desc} />
        ))}
      </div>
    </PopupContainer>
  );
}

// ============================================
// SkillsPopup - Skills 选择
// ============================================

interface SkillsPopupProps {
  isOpen: boolean;
}

export function SkillsPopup({ isOpen }: SkillsPopupProps) {
  const [skills, setSkills] = useAtom(skillsAtom);

  // Refresh skills from disk when popup opens
  const [lastOpen, setLastOpen] = useState(false);
  if (isOpen && !lastOpen) {
    window.electronAPI?.loadSkills().then(setSkills);
  }
  if (isOpen !== lastOpen) setLastOpen(isOpen);

  return (
    <PopupContainer isOpen={isOpen} position="left-[80px]" minWidth={300}>
      <PopupHeader
        title="Skills"
        icon={<WrenchIcon />}
        description="Skills are activated automatically when your request matches."
      />

      <div className="p-2 max-h-80 overflow-y-auto">
        {skills.length === 0 ? (
          <div className="p-4 text-center text-[var(--font-size-sm)] text-[var(--text-muted)]">
            No skills found. Add skills to ~/.deskhand/skills/
          </div>
        ) : (
          skills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-start gap-3 p-2.5 rounded-[var(--radius-md)]"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[var(--font-size-sm)] font-medium text-[var(--text-primary)] mb-0.5">
                  {skill.name}
                </div>
                <div className="text-[var(--font-size-xs)] text-[var(--text-muted)] leading-tight">
                  {skill.description}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </PopupContainer>
  );
}

// ============================================
// ReasoningPopup - 思考级别选择
// ============================================

interface ReasoningPopupProps {
  isOpen: boolean;
}

export function ReasoningPopup({ isOpen }: ReasoningPopupProps) {
  const [thinkingLevel, setThinkingLevel] = useAtom(thinkingLevelAtom);

  const levels: { value: ThinkingLevel; title: string; desc: string }[] = [
    { value: 'off', title: 'Off', desc: 'Disable extended thinking' },
    { value: 'think', title: 'Think', desc: 'Standard thinking (5,000-10,000 tokens)' },
    { value: 'max', title: 'Max', desc: 'Maximum thinking depth (20,000 tokens)' },
  ];

  return (
    <PopupContainer isOpen={isOpen} position="left-[118px]" minWidth={280}>
      <PopupHeader
        title="Reasoning"
        description="Adjust the reasoning effort for models that support extended thinking."
      />

      <div className="p-2 max-h-80 overflow-y-auto">
        {levels.map((level) => (
          <RadioItem
            key={level.value}
            title={level.title}
            desc={level.desc}
            active={thinkingLevel === level.value}
            onClick={() => setThinkingLevel(level.value)}
          />
        ))}
      </div>
    </PopupContainer>
  );
}

// ============================================
// ModelSelectorPopup - 模型选择
// ============================================

interface ModelSelectorPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ModelSelectorPopup({ isOpen, onClose }: ModelSelectorPopupProps) {
  const [selectedModel, setSelectedModel] = useAtom(selectedModelAtom);

  const models = [
    { id: 'claude-opus-4-5-20251101', name: 'Opus 4.5' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5' },
    { id: 'claude-sonnet-4-20250514', name: 'Sonnet 4' },
    { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' },
  ];

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    onClose();
  };

  return (
    <PopupContainer isOpen={isOpen} position="left-[200px]" minWidth={320}>
      {/* 搜索框 */}
      <div className="px-4 py-3 border-b border-[var(--border-light)]">
        <input
          type="text"
          placeholder="Search models..."
          className="
            w-full px-3 py-2
            border border-[var(--border-color)]
            rounded-[var(--radius-md)]
            text-[var(--font-size-sm)]
            outline-none
            focus:border-[var(--accent-color)]
          "
        />
      </div>

      {/* 模型列表 */}
      <div className="p-2 max-h-80 overflow-y-auto">
        {models.map((model) => (
          <div
            key={model.id}
            onClick={() => handleSelectModel(model.id)}
            className={`
              flex items-start gap-3 p-2.5
              rounded-[var(--radius-md)] cursor-pointer
              transition-colors duration-[var(--transition-fast)]
              hover:bg-[var(--hover-bg)]
              ${selectedModel === model.id ? 'bg-[var(--accent-bg)]' : ''}
            `}
          >
            {selectedModel === model.id && (
              <CheckIcon className="text-[var(--accent-color)] mt-0.5" />
            )}
            <div
              className="flex-1 min-w-0"
              style={{ marginLeft: selectedModel === model.id ? '0' : '24px' }}
            >
              <div className="text-[var(--font-size-sm)] font-medium text-[var(--text-primary)] mb-0.5">
                {model.name}
              </div>
              <div className="text-[var(--font-size-xs)] text-[var(--text-muted)] leading-tight">
                {model.id}
              </div>
            </div>
          </div>
        ))}
      </div>
    </PopupContainer>
  );
}

// ============================================
// 共享组件
// ============================================

interface PopupContainerProps {
  isOpen: boolean;
  position: string;
  minWidth?: number;
  children: React.ReactNode;
}

function PopupContainer({ isOpen, position, minWidth = 240, children }: PopupContainerProps) {
  return (
    <div
      className={`
        absolute bottom-[calc(100%+8px)] ${position}
        bg-[var(--bg-secondary)]
        rounded-[var(--radius-lg)]
        shadow-[var(--shadow-popup)]
        border border-[var(--border-light)]
        z-[200]
        transition-all duration-[250ms]
        ${isOpen
          ? 'opacity-100 visible translate-y-0'
          : 'opacity-0 invisible translate-y-2'
        }
      `}
      style={{ minWidth }}
    >
      {children}
    </div>
  );
}

interface PopupHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

function PopupHeader({ title, description, icon }: PopupHeaderProps) {
  return (
    <div className="px-4 py-3 pb-2.5 border-b border-[var(--border-light)]">
      <h3 className="text-[14px] font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-1">
        {icon}
        {title}
      </h3>
      {description && (
        <p className="text-[var(--font-size-xs)] text-[var(--text-muted)] leading-snug">
          {description}
        </p>
      )}
    </div>
  );
}

interface CheckboxItemProps {
  title: string;
  desc: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

function CheckboxItem({ title, desc, checked, onChange }: CheckboxItemProps) {
  return (
    <div
      className="
        flex items-start gap-3 p-2.5
        rounded-[var(--radius-md)] cursor-pointer
        transition-colors duration-[var(--transition-fast)]
        hover:bg-[var(--hover-bg)]
      "
      onClick={() => onChange?.(!checked)}
    >
      <div
        className={`
          w-[18px] h-[18px]
          border-2 rounded
          flex items-center justify-center
          ${checked
            ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
            : 'border-[var(--border-color)]'
          }
        `}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className={`w-3 h-3 text-white ${checked ? 'opacity-100' : 'opacity-0'}`}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[var(--font-size-sm)] font-medium text-[var(--text-primary)] mb-0.5">
          {title}
        </div>
        <div className="text-[var(--font-size-xs)] text-[var(--text-muted)] leading-tight">
          {desc}
        </div>
      </div>
    </div>
  );
}

interface RadioItemProps {
  title: string;
  desc: string;
  active?: boolean;
  onClick?: () => void;
}

function RadioItem({ title, desc, active, onClick }: RadioItemProps) {
  return (
    <div
      onClick={onClick}
      className={`
        flex items-start gap-3 p-2.5
        rounded-[var(--radius-md)] cursor-pointer
        transition-colors duration-[var(--transition-fast)]
        hover:bg-[var(--hover-bg)]
        ${active ? 'bg-[var(--accent-bg)]' : ''}
      `}
    >
      <div
        className={`
          w-[18px] h-[18px]
          border-2 rounded
          flex items-center justify-center
          ${active
            ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
            : 'border-[var(--border-color)]'
          }
        `}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className={`w-3 h-3 text-white ${active ? 'opacity-100' : 'opacity-0'}`}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[var(--font-size-sm)] font-medium text-[var(--text-primary)] mb-0.5">
          {title}
        </div>
        <div className="text-[var(--font-size-xs)] text-[var(--text-muted)] leading-tight">
          {desc}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function FolderIcon() {
  return (
    <div className="w-5 h-5 flex items-center justify-center text-[var(--text-muted)]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3L14.5 8.5L20 9L16 13L17 19L12 16L7 19L8 13L4 9L9.5 8.5L12 3Z" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
