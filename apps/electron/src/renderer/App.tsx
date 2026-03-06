import { useState, useEffect } from 'react';
import { Provider, useAtom, useSetAtom } from 'jotai';
import type { SetupNeeds } from '@deskhand/core';
import { generateSessionId } from '@deskhand/core';
import { TitleBar } from './components/app-shell/TitleBar';
import { SessionSidebar } from './components/app-shell/SessionSidebar';
import { ChatArea } from './components/chat/ChatArea';
import { ArtifactPanel } from './components/artifact/ArtifactPanel';
import { SettingsPage } from './pages/settings/SettingsPage';
import { useBackgroundSessionEvents } from './hooks/useBackgroundSessionEvents';
import {
  settingsOpenAtom,
  activeSessionIdAtom,
  workingDirectoryAtom,
  skillsAtom,
  sessionMetaMapAtom,
  sessionIdsAtom,
  memoryOnlySessionsAtom,
} from './atoms/sessions';

type AppState = 'loading' | 'onboarding' | 'ready';

function AppContent() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [setupNeeds, setSetupNeeds] = useState<SetupNeeds | null>(null);
  const [settingsOpen] = useAtom(settingsOpenAtom);
  const setActiveSessionId = useSetAtom(activeSessionIdAtom);
  const setWorkingDirectory = useSetAtom(workingDirectoryAtom);
  const setSkills = useSetAtom(skillsAtom);
  const setSessionMetaMap = useSetAtom(sessionMetaMapAtom);
  const setSessionIds = useSetAtom(sessionIdsAtom);
  const setMemoryOnlySessions = useSetAtom(memoryOnlySessionsAtom);

  useEffect(() => {
    const initialize = async () => {
      try {
        const metas = await window.electronAPI.listSessions();

        if (metas.length > 0) {
          const metaMap = new Map(metas.map((m) => [m.id, m]));
          const ids = metas.map((m) => m.id);
          setSessionMetaMap(metaMap);
          setSessionIds(ids);
          setActiveSessionId(ids[0]!);
        } else {
          const newId = generateSessionId();
          const now = Date.now();
          setSessionMetaMap(new Map([[newId, { id: newId, createdAt: now }]]));
          setSessionIds([newId]);
          setActiveSessionId(newId);
          setMemoryOnlySessions(new Set([newId]));
        }

        const config = await window.electronAPI.getConfig();
        if (config?.lastWorkingDirectory) {
          setWorkingDirectory(config.lastWorkingDirectory);
        }

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
        setAppState('ready');
      }
    };

    initialize();
  }, [setActiveSessionId, setWorkingDirectory, setSkills, setSessionMetaMap, setSessionIds, setMemoryOnlySessions]);

  useBackgroundSessionEvents();

  useEffect(() => {
    const unsubscribe = window.electronAPI.onSessionsRefresh(async () => {
      const metas = await window.electronAPI.listSessions();
      const metaMap = new Map(metas.map((m) => [m.id, m]));
      const ids = metas.map((m) => m.id);
      setSessionMetaMap(metaMap);
      setSessionIds(ids);
    });
    return unsubscribe;
  }, [setSessionMetaMap, setSessionIds]);

  if (appState === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-surface-canvas)] text-[var(--color-text-muted)]">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] px-10 py-8 text-center shadow-[var(--elevation-1)]">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-line-soft)] border-t-[var(--color-accent)]" />
          <p className="font-display text-[22px] text-[var(--color-text-primary)]">Loading Deskhand</p>
        </div>
      </div>
    );
  }

  if (appState === 'onboarding' && setupNeeds?.needsAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-surface-canvas)] px-6">
        <div className="w-full max-w-[520px] rounded-[var(--radius-card)] border border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] p-8 shadow-[var(--elevation-2)]">
          <p className="font-display text-[32px] text-[var(--color-text-primary)]">Welcome to Deskhand</p>
          <p className="mt-3 text-[var(--font-size-base)] text-[var(--color-text-secondary)]">
            Add your Anthropic API key to unlock the editorial command center.
          </p>
          <div className="mt-6 space-y-4">
            <input
              type="password"
              placeholder="sk-ant-..."
              className="w-full rounded-[var(--radius-control)] border border-[var(--color-line-soft)] bg-[var(--color-surface-panel)] px-4 py-2.5 text-[var(--font-size-base)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)]"
            />
            <button
              onClick={() => setAppState('ready')}
              className="w-full rounded-[var(--radius-pill)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-2.5 text-[var(--font-size-base)] font-medium text-[var(--color-surface-elevated)] transition-colors hover:bg-[var(--color-accent-strong)]"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-[var(--color-surface-canvas)]">
      <TitleBar />
      <div className="main-content relative z-10 flex flex-1 overflow-hidden">
        <SessionSidebar />
        <ChatArea />
        <ArtifactPanel />
      </div>
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
