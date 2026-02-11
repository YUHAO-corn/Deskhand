/**
 * Root App component
 *
 * Handles:
 * - App state (loading → onboarding → ready)
 * - AuthGuard for authentication
 * - Layout with TitleBar, SessionSidebar, ChatArea, ArtifactPanel
 */

import { useState, useEffect } from 'react';
import { Provider, useAtom, useSetAtom } from 'jotai';
import type { SetupNeeds } from '@deskhand/core';
import { TitleBar } from './components/app-shell/TitleBar';
import { SessionSidebar } from './components/app-shell/SessionSidebar';
import { ChatArea } from './components/chat/ChatArea';
import { ArtifactPanel } from './components/artifact/ArtifactPanel';
import { SettingsPage } from './pages/settings/SettingsPage';
import { settingsOpenAtom, activeSessionIdAtom, workingDirectoryAtom, skillsAtom, disabledSkillIdsAtom } from './atoms/sessions';

type AppState = 'loading' | 'onboarding' | 'ready';

function AppContent() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [setupNeeds, setSetupNeeds] = useState<SetupNeeds | null>(null);
  const [settingsOpen] = useAtom(settingsOpenAtom);
  const setActiveSessionId = useSetAtom(activeSessionIdAtom);
  const setWorkingDirectory = useSetAtom(workingDirectoryAtom);
  const setSkills = useSetAtom(skillsAtom);
  const setDisabledSkillIds = useSetAtom(disabledSkillIdsAtom);

  useEffect(() => {
    const initialize = async () => {
      // Create default session for Phase 2 testing
      const defaultSessionId = crypto.randomUUID();
      setActiveSessionId(defaultSessionId);

      try {
        // Restore last working directory from config
        const config = await window.electronAPI.getConfig();
        if (config?.lastWorkingDirectory) {
          setWorkingDirectory(config.lastWorkingDirectory);
        }
        if (config?.disabledSkillIds) {
          setDisabledSkillIds(config.disabledSkillIds);
        }

        // Load skills from disk
        const skills = await window.electronAPI.loadSkills();
        setSkills(skills);

        const needs = await window.electronAPI.getSetupNeeds();
        setSetupNeeds(needs);

        if (needs.isFullyConfigured) {
          setAppState('ready');
        } else {
          setAppState('onboarding');
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
        // For Phase 0.5: Skip to ready state to test UI
        setAppState('ready');
      }
    };

    initialize();
  }, [setActiveSessionId, setWorkingDirectory, setSkills, setDisabledSkillIds]);

  // Loading state
  if (appState === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)] text-[var(--text-muted)]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--border-color)] border-t-[var(--accent-color)] rounded-full mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Onboarding state (needs API key)
  if (appState === 'onboarding' && setupNeeds?.needsAuth) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="w-full max-w-md p-8">
          <h1 className="text-2xl font-bold mb-6">Welcome to Deskhand</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            Enter your Anthropic API key to get started.
          </p>
          <div className="space-y-4">
            <input
              type="password"
              placeholder="sk-ant-..."
              className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)]"
            />
            <button
              onClick={() => setAppState('ready')}
              className="w-full px-4 py-2 bg-[var(--accent-color)] hover:opacity-90 rounded-lg font-medium text-white transition-opacity"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ready state - main app with full layout
  return (
    <div className="w-full h-screen bg-[var(--bg-primary)] flex flex-col overflow-hidden">
      <TitleBar />
      <div className="main-content flex-1 flex overflow-hidden relative">
        <SessionSidebar />
        <ChatArea />
        <ArtifactPanel />
      </div>
      {/* Settings overlay */}
      {settingsOpen && <SettingsPage />}
    </div>
  );
}

export function App() {
  return (
    <Provider>
      <AppContent />
    </Provider>
  );
}
