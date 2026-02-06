/**
 * Preload script - Context Bridge API
 *
 * Exposes a safe API from main process to renderer.
 * Uses contextBridge to prevent direct Node.js access in renderer.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig, SetupNeeds, SessionMeta, StoredSession, Session, AgentEvent } from '@deskhand/core';

// ============ API Definition ============

export interface ElectronAPI {
  // Config
  getSetupNeeds: () => Promise<SetupNeeds>;
  getConfig: () => Promise<AppConfig | null>;
  saveConfig: (config: AppConfig) => Promise<void>;
  validateApiKey: (apiKey: string, baseUrl?: string) => Promise<{ valid: boolean; error?: string }>;

  // Sessions
  listSessions: () => Promise<SessionMeta[]>;
  getSession: (sessionId: string) => Promise<StoredSession | null>;
  createSession: (session: Session) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;

  // Agent
  chat: (sessionId: string, message: string) => Promise<void>;
  stopAgent: (sessionId: string) => Promise<void>;
  respondToPermission: (sessionId: string, requestId: string, response: 'allow' | 'deny') => Promise<void>;
  onAgentEvent: (callback: (event: AgentEvent) => void) => () => void;
}

// ============ IPC Channels ============

const IPC_CHANNELS = {
  GET_SETUP_NEEDS: 'config:get-setup-needs',
  GET_CONFIG: 'config:get',
  SAVE_CONFIG: 'config:save',
  VALIDATE_API_KEY: 'config:validate-api-key',
  LIST_SESSIONS: 'sessions:list',
  GET_SESSION: 'sessions:get',
  CREATE_SESSION: 'sessions:create',
  DELETE_SESSION: 'sessions:delete',
  AGENT_CHAT: 'agent:chat',
  AGENT_STOP: 'agent:stop',
  AGENT_PERMISSION_RESPONSE: 'agent:permission-response',
  AGENT_EVENT: 'agent:event',
} as const;

// ============ Expose API ============

const electronAPI: ElectronAPI = {
  // Config
  getSetupNeeds: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETUP_NEEDS),
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),
  saveConfig: (config) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_CONFIG, config),
  validateApiKey: (apiKey, baseUrl) => ipcRenderer.invoke(IPC_CHANNELS.VALIDATE_API_KEY, apiKey, baseUrl),

  // Sessions
  listSessions: () => ipcRenderer.invoke(IPC_CHANNELS.LIST_SESSIONS),
  getSession: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.GET_SESSION, sessionId),
  createSession: (session) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_SESSION, session),
  deleteSession: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_SESSION, sessionId),

  // Agent
  chat: (sessionId, message) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_CHAT, sessionId, message),
  stopAgent: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_STOP, sessionId),
  respondToPermission: (sessionId, requestId, response) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PERMISSION_RESPONSE, sessionId, requestId, response),
  onAgentEvent: (callback) => {
    const handler = (_: unknown, event: AgentEvent) => callback(event);
    ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_EVENT, handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// ============ Type Declaration ============

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
