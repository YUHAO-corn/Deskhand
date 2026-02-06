/**
 * IPC handlers for main process
 *
 * Handles communication between renderer and main process:
 * - Config management
 * - Session operations
 * - Agent chat
 */

import { ipcMain } from 'electron';
import type { AppConfig, SetupNeeds, SessionMeta, StoredSession, Session } from '@deskhand/core';
import {
  loadConfig,
  saveConfig,
  encryptCredential,
  decryptCredential,
} from '@deskhand/shared/config';
import {
  listSessions,
  loadSession,
  createSession,
  deleteSession,
} from '@deskhand/shared/sessions';

// ============ IPC Channel Names ============

export const IPC_CHANNELS = {
  // Config
  GET_SETUP_NEEDS: 'config:get-setup-needs',
  GET_CONFIG: 'config:get',
  SAVE_CONFIG: 'config:save',
  VALIDATE_API_KEY: 'config:validate-api-key',

  // Sessions
  LIST_SESSIONS: 'sessions:list',
  GET_SESSION: 'sessions:get',
  CREATE_SESSION: 'sessions:create',
  DELETE_SESSION: 'sessions:delete',

  // Agent
  AGENT_CHAT: 'agent:chat',
  AGENT_STOP: 'agent:stop',
  AGENT_PERMISSION_RESPONSE: 'agent:permission-response',
} as const;

// ============ Register Handlers ============

export function registerIpcHandlers(): void {
  // ===== Config =====

  ipcMain.handle(IPC_CHANNELS.GET_SETUP_NEEDS, async (): Promise<SetupNeeds> => {
    const config = await loadConfig();
    return {
      isFullyConfigured: !!config?.apiKey,
      needsAuth: !config?.apiKey,
    };
  });

  ipcMain.handle(IPC_CHANNELS.GET_CONFIG, async (): Promise<AppConfig | null> => {
    return loadConfig();
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_CONFIG, async (_, config: AppConfig): Promise<void> => {
    // Encrypt API key before saving
    if (config.apiKey) {
      config.apiKey = encryptCredential(config.apiKey);
    }
    await saveConfig(config);
  });

  ipcMain.handle(IPC_CHANNELS.VALIDATE_API_KEY, async (_, apiKey: string, baseUrl?: string): Promise<{ valid: boolean; error?: string }> => {
    // TODO: Call Anthropic API to validate key
    // For now, just check format
    if (!apiKey.startsWith('sk-')) {
      return { valid: false, error: 'Invalid API key format' };
    }
    return { valid: true };
  });

  // ===== Sessions =====

  ipcMain.handle(IPC_CHANNELS.LIST_SESSIONS, async (): Promise<SessionMeta[]> => {
    return listSessions();
  });

  ipcMain.handle(IPC_CHANNELS.GET_SESSION, async (_, sessionId: string): Promise<StoredSession | null> => {
    return loadSession(sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_SESSION, async (_, session: Session): Promise<void> => {
    await createSession(session);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_SESSION, async (_, sessionId: string): Promise<void> => {
    await deleteSession(sessionId);
  });

  // ===== Agent =====

  // TODO: Implement agent handlers
  ipcMain.handle(IPC_CHANNELS.AGENT_CHAT, async (_, sessionId: string, message: string) => {
    // TODO: Create/get agent instance, call chat()
    console.log('[IPC] agent:chat', sessionId, message);
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_STOP, async (_, sessionId: string) => {
    // TODO: Stop agent
    console.log('[IPC] agent:stop', sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_PERMISSION_RESPONSE, async (_, sessionId: string, requestId: string, response: 'allow' | 'deny') => {
    // TODO: Forward permission response to agent
    console.log('[IPC] agent:permission-response', sessionId, requestId, response);
  });
}
