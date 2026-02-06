/**
 * API Key 输入表单
 *
 * 📐 SPEC: docs/SPEC_AuthGuard.md#6-ui-规格
 *
 * 职责：
 * - 提供 API Key 输入（密码模式，可切换显示）
 * - 提供 Base URL 输入（支持预设选择）
 * - 显示验证状态和错误信息
 */

import { useState } from 'react';
import type { ApiKeySubmitData, AuthStatus } from '@deskhand/core';

// ============================================
// 预设选项
// ============================================
const PRESETS = [
  { key: 'anthropic', label: 'Anthropic', url: 'https://api.anthropic.com' },
  { key: 'openrouter', label: 'OpenRouter', url: 'https://openrouter.ai/api' },
  { key: 'custom', label: 'Custom', url: '' },
] as const;

interface AuthFormProps {
  status: AuthStatus;
  errorMessage?: string;
  onSubmit: (data: ApiKeySubmitData) => void;
}

export function AuthForm({ status, errorMessage, onSubmit }: AuthFormProps) {
  // ============================================
  // 表单状态
  // ============================================
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('anthropic');
  const [customUrl, setCustomUrl] = useState('');

  const isValidating = status === 'validating';

  // 获取当前 Base URL
  const currentPreset = PRESETS.find((p) => p.key === selectedPreset);
  const baseUrl = selectedPreset === 'custom' ? customUrl : currentPreset?.url;

  // ============================================
  // 提交处理
  // ============================================
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    onSubmit({
      apiKey: apiKey.trim(),
      baseUrl: baseUrl || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-[400px] p-6 bg-[var(--bg-sidebar)] rounded-[var(--radius-lg)] shadow-[var(--shadow-popup)]"
    >
      {/* ============================================
          区域：标题
          ============================================ */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          🔑 Deskhand
        </h1>
        <p className="text-[var(--font-size-sm)] text-[var(--text-secondary)]">
          Enter your API key to get started
        </p>
      </div>

      {/* ============================================
          区域：API Key 输入
          功能：密码模式输入，可切换显示
          ============================================ */}
      <div className="mb-4">
        <label className="block text-[var(--font-size-sm)] font-medium text-[var(--text-primary)] mb-1.5">
          API Key
        </label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            disabled={isValidating}
            className="
              w-full px-3 py-2.5
              bg-[var(--bg-primary)] border border-[var(--border-color)]
              rounded-[var(--radius-md)]
              text-[var(--font-size-sm)] text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)]
              focus:outline-none focus:border-[var(--accent-color)] focus:bg-[var(--bg-sidebar)]
              transition-colors duration-[var(--transition-fast)]
              disabled:opacity-50 disabled:cursor-not-allowed
              pr-10
            "
          />
          {/* 显示/隐藏切换按钮 */}
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="
              absolute right-3 top-1/2 -translate-y-1/2
              text-[var(--text-muted)] hover:text-[var(--text-secondary)]
              transition-colors duration-[var(--transition-fast)]
            "
          >
            {showApiKey ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ============================================
          区域：Base URL 选择
          功能：预设下拉 + 自定义输入
          ============================================ */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[var(--font-size-sm)] font-medium text-[var(--text-primary)]">
            Base URL
          </label>
          <select
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
            disabled={isValidating}
            className="
              text-[var(--font-size-xs)] text-[var(--text-secondary)]
              bg-transparent border-none
              cursor-pointer
              focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {PRESETS.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
        <input
          type="url"
          value={selectedPreset === 'custom' ? customUrl : currentPreset?.url || ''}
          onChange={(e) => setCustomUrl(e.target.value)}
          placeholder="https://api.example.com"
          disabled={isValidating || selectedPreset !== 'custom'}
          className="
            w-full px-3 py-2.5
            bg-[var(--bg-primary)] border border-[var(--border-color)]
            rounded-[var(--radius-md)]
            text-[var(--font-size-sm)] text-[var(--text-primary)]
            placeholder:text-[var(--text-muted)]
            focus:outline-none focus:border-[var(--accent-color)] focus:bg-[var(--bg-sidebar)]
            transition-colors duration-[var(--transition-fast)]
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        />
      </div>

      {/* ============================================
          区域：错误信息
          ============================================ */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-[var(--radius-md)]">
          <p className="text-[var(--font-size-sm)] text-red-600">
            ❌ {errorMessage}
          </p>
        </div>
      )}

      {/* ============================================
          区域：提交按钮
          状态：正常 / Loading
          ============================================ */}
      <button
        type="submit"
        disabled={!apiKey.trim() || isValidating}
        className="
          w-full py-2.5
          bg-[var(--accent-color)] text-white
          rounded-[var(--radius-md)]
          text-[var(--font-size-sm)] font-medium
          hover:opacity-90
          transition-opacity duration-[var(--transition-fast)]
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2
        "
      >
        {isValidating ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Validating...
          </>
        ) : (
          <>Continue →</>
        )}
      </button>
    </form>
  );
}
