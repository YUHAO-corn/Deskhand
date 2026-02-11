/**
 * 设置页面
 *
 * 📐 SPEC: docs/SPEC_SettingsPage.md
 * 🎨 原型: deskhand-prototype/src/components/SettingsPage.tsx
 *
 * 职责：
 * - 提供设置页面的导航结构（侧边栏 + 内容区）
 * - 管理 API 连接配置
 * - 管理权限模式（Explore/Ask/Auto）
 * - 管理 Skills 启用/禁用
 * - 管理通知设置
 */

import { useState } from 'react';
import { useAtom } from 'jotai';
import { settingsOpenAtom } from '../../atoms/sessions';
import type { PermissionMode, Skill } from '@deskhand/core';

// 导航项类型
type NavItemId = 'general' | 'api' | 'permissions' | 'skills';

interface NavItem {
  id: NavItemId;
  label: string;
  icon: React.ReactNode;
}

export function SettingsPage() {
  const [, setSettingsOpen] = useAtom(settingsOpenAtom);
  const [activeSection, setActiveSection] = useState<NavItemId>('general');
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('ask');

  // TODO: 从配置加载
  const [toolModel, setToolModel] = useState('claude-haiku-4-5-20251001');
  const [language, setLanguage] = useState('English');
  const [autoStart, setAutoStart] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  const [apiProvider, setApiProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');

  // 导航菜单项
  const navItems: NavItem[] = [
    { id: 'general', label: 'General', icon: <SettingsIcon /> },
    { id: 'api', label: 'API Connection', icon: <KeyIcon /> },
    { id: 'permissions', label: 'Permissions', icon: <ShieldIcon /> },
    { id: 'skills', label: 'Skills', icon: <WrenchIcon /> },
  ];

  const currentNav = navItems.find((item) => item.id === activeSection);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => setSettingsOpen(false)}
      />

      {/* 设置面板 */}
      <div className="relative z-10 flex w-[800px] h-[560px] rounded-xl overflow-hidden shadow-xl bg-[var(--bg-primary)]">
        {/* ============================================
            区域：侧边栏
            功能：导航菜单
            ============================================ */}
        <div className="w-56 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col">
          {/* 标题 */}
          <div className="px-5 py-4">
            <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--text-primary)]">Settings</h2>
          </div>

        {/* 导航菜单 */}
        <nav className="flex-1 overflow-y-auto px-3 py-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`
                w-full flex items-center gap-3
                px-3 py-2.5 rounded-[var(--radius-md)]
                text-[var(--font-size-sm)]
                transition-colors duration-[var(--transition-fast)]
                border-none cursor-pointer
                ${activeSection === item.id
                  ? 'bg-[var(--hover-bg)] text-[var(--text-primary)]'
                  : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
                }
              `}
            >
              <span className="text-[var(--text-muted)]">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ============================================
          区域：主内容区
          ============================================ */}
      <div className="flex-1 flex flex-col">
        {/* 头部 */}
        <div className="flex items-center gap-2 px-8 py-6 bg-[var(--bg-sidebar)] border-b border-[var(--border-color)]">
          <span className="text-[var(--text-secondary)]">{currentNav?.icon}</span>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            {currentNav?.label}
          </h1>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {activeSection === 'general' && (
            <GeneralSection
              toolModel={toolModel}
              setToolModel={setToolModel}
              language={language}
              setLanguage={setLanguage}
              autoStart={autoStart}
              setAutoStart={setAutoStart}
              startMinimized={startMinimized}
              setStartMinimized={setStartMinimized}
            />
          )}

          {activeSection === 'api' && (
            <ApiSection
              apiProvider={apiProvider}
              setApiProvider={setApiProvider}
              apiKey={apiKey}
              setApiKey={setApiKey}
            />
          )}

          {activeSection === 'permissions' && (
            <PermissionsSection
              permissionMode={permissionMode}
              setPermissionMode={setPermissionMode}
            />
          )}

          {activeSection === 'skills' && <SkillsSection />}
        </div>
      </div>
      </div>
    </div>
  );
}

// ============================================
// GeneralSection - 通用设置
// ============================================

interface GeneralSectionProps {
  toolModel: string;
  setToolModel: (v: string) => void;
  language: string;
  setLanguage: (v: string) => void;
  autoStart: boolean;
  setAutoStart: (v: boolean) => void;
  startMinimized: boolean;
  setStartMinimized: (v: boolean) => void;
}

function GeneralSection({
  toolModel,
  setToolModel,
  language,
  setLanguage,
  autoStart,
  setAutoStart,
  startMinimized,
  setStartMinimized,
}: GeneralSectionProps) {
  return (
    <>
      {/* Tool Model */}
      <SettingsCard title="Tool Model" description="A fast model for thread title generation, memory operations, and other automated tasks.">
        <select
          value={toolModel}
          onChange={(e) => setToolModel(e.target.value)}
          className="
            w-full px-4 py-3 pr-10
            bg-[var(--bg-sidebar)] border border-[var(--border-color)]
            rounded-[var(--radius-md)]
            text-[var(--font-size-sm)] text-[var(--text-primary)]
            appearance-none cursor-pointer
            hover:border-[var(--text-muted)]
            focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent
          "
        >
          <option value="claude-haiku-4-5-20251001">claude-haiku-4-5-20251001</option>
          <option value="claude-sonnet-4-5-20250929">claude-sonnet-4-5-20250929</option>
          <option value="claude-opus-4-5-20251101">claude-opus-4-5-20251101</option>
        </select>
      </SettingsCard>

      {/* Language */}
      <SettingsCard title="Language">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="
            w-full px-4 py-3 pr-10
            bg-[var(--bg-sidebar)] border border-[var(--border-color)]
            rounded-[var(--radius-md)]
            text-[var(--font-size-sm)] text-[var(--text-primary)]
            appearance-none cursor-pointer
            hover:border-[var(--text-muted)]
            focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent
          "
        >
          <option value="English">English</option>
          <option value="中文">中文</option>
          <option value="日本語">日本語</option>
        </select>
      </SettingsCard>

      {/* Startup Settings */}
      <SettingsCard title="Startup Settings">
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent-color)] focus:ring-2 focus:ring-[var(--accent-color)] cursor-pointer"
            />
            <span className="text-[var(--font-size-sm)] text-[var(--text-primary)] group-hover:text-[var(--text-secondary)]">
              Auto Start
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={startMinimized}
              onChange={(e) => setStartMinimized(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent-color)] focus:ring-2 focus:ring-[var(--accent-color)] cursor-pointer"
            />
            <span className="text-[var(--font-size-sm)] text-[var(--text-primary)] group-hover:text-[var(--text-secondary)]">
              Start minimized to system tray
            </span>
          </label>
        </div>
      </SettingsCard>
    </>
  );
}

// ============================================
// ApiSection - API 连接设置
// ============================================

interface ApiSectionProps {
  apiProvider: string;
  setApiProvider: (v: string) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
}

function ApiSection({ apiProvider, setApiProvider, apiKey, setApiKey }: ApiSectionProps) {
  return (
    <>
      {/* Provider */}
      <SettingsCard title="Provider" description="Select your AI provider for API connections.">
        <select
          value={apiProvider}
          onChange={(e) => setApiProvider(e.target.value)}
          className="
            w-full px-4 py-3 pr-10
            bg-[var(--bg-sidebar)] border border-[var(--border-color)]
            rounded-[var(--radius-md)]
            text-[var(--font-size-sm)] text-[var(--text-primary)]
            appearance-none cursor-pointer
            hover:border-[var(--text-muted)]
            focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent
          "
        >
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="openrouter">OpenRouter</option>
        </select>
      </SettingsCard>

      {/* API Key */}
      <SettingsCard title="API Key" description="Your API key is stored locally and never sent to our servers.">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="
            w-full px-4 py-3
            bg-[var(--bg-sidebar)] border border-[var(--border-color)]
            rounded-[var(--radius-md)]
            text-[var(--font-size-sm)] text-[var(--text-primary)]
            placeholder-[var(--text-muted)]
            hover:border-[var(--text-muted)]
            focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent
          "
        />
      </SettingsCard>
    </>
  );
}

// ============================================
// PermissionsSection - 权限设置
// ============================================

interface PermissionsSectionProps {
  permissionMode: PermissionMode;
  setPermissionMode: (mode: PermissionMode) => void;
}

function PermissionsSection({ permissionMode, setPermissionMode }: PermissionsSectionProps) {
  const modes: { value: PermissionMode; label: string; description: string }[] = [
    {
      value: 'explore',
      label: 'Explore',
      description: 'Read-only mode. Agent can only view files, no modifications allowed.',
    },
    {
      value: 'ask',
      label: 'Ask',
      description: 'Prompt for confirmation before executing risky operations.',
    },
    {
      value: 'auto',
      label: 'Auto',
      description: 'Automatically approve all actions. Use with caution.',
    },
  ];

  return (
    <SettingsCard
      title="Permission Mode"
      description="Control how the agent requests permissions for potentially risky actions."
    >
      <div className="space-y-3">
        {modes.map((mode) => (
          <label
            key={mode.value}
            className={`
              flex items-start gap-3 p-4
              rounded-[var(--radius-md)] border cursor-pointer
              transition-colors duration-[var(--transition-fast)]
              ${permissionMode === mode.value
                ? 'border-[var(--accent-color)] bg-[var(--accent-bg)]'
                : 'border-[var(--border-color)] hover:border-[var(--text-muted)]'
              }
            `}
          >
            <input
              type="radio"
              name="permissionMode"
              checked={permissionMode === mode.value}
              onChange={() => setPermissionMode(mode.value)}
              className="mt-0.5 w-4 h-4 text-[var(--accent-color)] border-[var(--border-color)] focus:ring-[var(--accent-color)]"
            />
            <div>
              <div className="text-[var(--font-size-sm)] font-medium text-[var(--text-primary)]">
                {mode.label}
              </div>
              <div className="text-[var(--font-size-sm)] text-[var(--text-muted)]">
                {mode.description}
              </div>
            </div>
          </label>
        ))}
      </div>
    </SettingsCard>
  );
}

// ============================================
// SkillsSection - Skills 管理
// ============================================

function SkillsSection() {
  // TODO: 从 skillsAtom 加载
  const skills = [
    { name: 'File Operations', desc: 'Read, write, and manage files', enabled: true },
    { name: 'Terminal', desc: 'Execute shell commands', enabled: true },
    { name: 'Web Browser', desc: 'Browse and interact with web pages', enabled: false },
    { name: 'Code Analysis', desc: 'Analyze and refactor code', enabled: true },
  ];

  return (
    <SettingsCard
      title="Installed Skills"
      description="Skills extend the agent's capabilities with specialized tools."
    >
      <div className="space-y-3">
        {skills.map((skill) => (
          <div
            key={skill.name}
            className="flex items-center justify-between p-4 rounded-[var(--radius-md)] border border-[var(--border-color)]"
          >
            <div>
              <div className="text-[var(--font-size-sm)] font-medium text-[var(--text-primary)]">
                {skill.name}
              </div>
              <div className="text-[var(--font-size-sm)] text-[var(--text-muted)]">
                {skill.desc}
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={skill.enabled}
                className="sr-only peer"
                // TODO: onChange → setSkillEnabled(skill.id, enabled)
              />
              <div className="
                w-11 h-6 bg-[var(--border-color)]
                peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--accent-color)]/30
                rounded-full peer
                peer-checked:after:translate-x-full
                peer-checked:after:border-white
                after:content-[''] after:absolute after:top-[2px] after:start-[2px]
                after:bg-white after:border-[var(--border-color)] after:border
                after:rounded-full after:h-5 after:w-5 after:transition-all
                peer-checked:bg-[var(--accent-color)]
              " />
            </label>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}

// ============================================
// SettingsCard - 设置卡片容器
// ============================================

interface SettingsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function SettingsCard({ title, description, children }: SettingsCardProps) {
  return (
    <div className="bg-[var(--bg-sidebar)] rounded-[var(--radius-lg)] border border-[var(--border-color)] p-6 mb-6">
      <h2 className="text-base font-semibold text-[var(--text-primary)] mb-2">{title}</h2>
      {description && (
        <p className="text-[var(--font-size-sm)] text-[var(--text-secondary)] mb-4">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

// ============================================
// Icons
// ============================================

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
