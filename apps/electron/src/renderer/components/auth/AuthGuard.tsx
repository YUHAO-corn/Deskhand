/**
 * 认证守卫
 *
 * 📐 SPEC: docs/SPEC_AuthGuard.md
 *
 * 职责：
 * - 检查应用配置中是否存在有效的 API Key
 * - 阻塞主应用渲染直到认证通过
 * - 管理认证状态（loading → authenticated / unauthenticated）
 */

import { useState, useEffect } from 'react';
import { AuthForm } from './AuthForm';
import type { SetupNeeds, ApiKeySubmitData, AuthStatus } from '@deskhand/core';

interface AuthGuardProps {
  children: React.ReactNode; // 认证通过后渲染的内容
}

export function AuthGuard({ children }: AuthGuardProps) {
  // ============================================
  // 状态管理（使用 useState 而非 Jotai，参考 craft-agent App.tsx）
  // ============================================
  const [appState, setAppState] = useState<'loading' | 'onboarding' | 'ready'>('loading');
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [authError, setAuthError] = useState<string | undefined>();

  // ============================================
  // 初始化：检查配置需求
  // ============================================
  useEffect(() => {
    const initialize = async () => {
      try {
        // TODO: 调用 window.electronAPI.getSetupNeeds()
        const needs: SetupNeeds = await window.electronAPI.getSetupNeeds();

        if (needs.isFullyConfigured) {
          setAppState('ready');
        } else {
          setAppState('onboarding');
        }
      } catch (error) {
        console.error('Failed to check setup needs:', error);
        // 出错时也进入 onboarding，让用户手动配置
        setAppState('onboarding');
      }
    };

    initialize();
  }, []);

  // ============================================
  // API Key 提交处理
  // ============================================
  const handleSubmit = async (data: ApiKeySubmitData) => {
    setAuthStatus('validating');
    setAuthError(undefined);

    try {
      // TODO: 调用 window.electronAPI.validateApiKey(data)
      const result = await window.electronAPI.validateApiKey(data);

      if (result.success) {
        setAuthStatus('success');
        // 保存配置
        await window.electronAPI.saveConfig({
          apiKey: data.apiKey,
          baseUrl: data.baseUrl,
        });
        // 进入主应用
        setAppState('ready');
      } else {
        setAuthStatus('error');
        setAuthError(result.error || 'Validation failed');
      }
    } catch (error) {
      setAuthStatus('error');
      setAuthError(error instanceof Error ? error.message : 'Connection failed');
    }
  };

  // ============================================
  // 条件渲染
  // ============================================

  // Loading 状态
  if (appState === 'loading') {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          {/* TODO: 添加 loading spinner */}
          <div className="w-8 h-8 border-2 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--text-muted)] text-[var(--font-size-sm)]">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  // Onboarding 状态：显示 AuthForm
  if (appState === 'onboarding') {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[var(--bg-primary)]">
        <AuthForm
          status={authStatus}
          errorMessage={authError}
          onSubmit={handleSubmit}
        />
      </div>
    );
  }

  // Ready 状态：渲染主应用
  return <>{children}</>;
}
