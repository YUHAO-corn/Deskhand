/**
 * Root App component
 *
 * Handles:
 * - App state (loading → onboarding → ready)
 * - AuthGuard for authentication
 * - Layout with SessionSidebar, ChatArea, ArtifactPanel
 */

import { useState, useEffect } from 'react';
import type { SetupNeeds } from '@deskhand/core';
// import { AuthGuard } from './components/auth/AuthGuard.tsx';
// import { AppShell } from './components/app-shell/AppShell.tsx';

type AppState = 'loading' | 'onboarding' | 'ready';

export function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [setupNeeds, setSetupNeeds] = useState<SetupNeeds | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        const needs = await window.electronAPI.getSetupNeeds();
        setSetupNeeds(needs);

        if (needs.isFullyConfigured) {
          setAppState('ready');
        } else {
          setAppState('onboarding');
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
        setAppState('onboarding');
      }
    };

    initialize();
  }, []);

  // Loading state
  if (appState === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900 text-zinc-400">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-zinc-600 border-t-zinc-400 rounded-full mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Onboarding state (needs API key)
  if (appState === 'onboarding' || setupNeeds?.needsAuth) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900 text-zinc-100">
        <div className="w-full max-w-md p-8">
          <h1 className="text-2xl font-bold mb-6">Welcome to Deskhand</h1>
          <p className="text-zinc-400 mb-6">
            Enter your Anthropic API key to get started.
          </p>
          {/* TODO: AuthForm component */}
          <div className="space-y-4">
            <input
              type="password"
              placeholder="sk-ant-..."
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={() => setAppState('ready')}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ready state - main app
  return (
    <div className="flex h-screen bg-zinc-900 text-zinc-100">
      {/* Sidebar placeholder */}
      <aside className="w-64 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800 drag-region">
          <h1 className="text-lg font-semibold">Deskhand</h1>
        </div>
        <div className="flex-1 p-2">
          {/* Session list placeholder */}
          <div className="text-zinc-500 text-sm p-2">No sessions yet</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 p-4">
          {/* Chat area placeholder */}
          <div className="text-zinc-500 text-center mt-20">
            <p className="text-2xl mb-2">👋</p>
            <p>Start a new conversation</p>
          </div>
        </div>

        {/* Input area placeholder */}
        <div className="p-4 border-t border-zinc-800">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ask anything..."
              className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
