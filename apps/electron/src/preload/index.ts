/**
 * Preload script - Context Bridge API
 *
 * Exposes a safe API from main process to renderer.
 * Uses contextBridge to prevent direct Node.js access in renderer.
 *
 * IPC Pattern:
 * - invoke: renderer -> main (request/response)
 * - on/send: main -> renderer (events, like agent streaming)
 *
 * Usage in renderer:
 *   const sessions = await window.electronAPI.listSessions();
 *   const unsubscribe = window.electronAPI.onAgentEvent((sessionId, event) => {
 *     console.log('Agent event:', event);
 *   });
 */

import { contextBridge, ipcRenderer, clipboard } from 'electron';
import type { AppConfig, SetupNeeds, SessionMeta, StoredSession, StoredMessage, Session, AgentEvent, ThinkingLevel, Skill } from '@deskhand/core';

// Re-export clipboard entry type for renderer usage
export interface ClipboardEntry {
  id: string;
  type: 'text' | 'image' | 'link';
  content: string;
  preview: string;
  timestamp: number;
  charCount?: number;
  fileSize?: number;
}

// ============ Chat Config ============

export interface ChatConfig {
  model?: string;
  thinkingLevel?: ThinkingLevel;
  workingDirectory?: string;
  permissionMode?: 'ask' | 'allow-all';
}

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
  appendMessage: (sessionId: string, message: StoredMessage) => Promise<void>;
  updateSessionMeta: (sessionId: string, updates: Partial<Pick<Session, 'name' | 'lastMessageAt' | 'preview' | 'messageCount' | 'hidden' | 'hasUnread' | 'artifacts'>>) => Promise<void>;

  // Agent
  chat: (sessionId: string, message: string, config?: ChatConfig) => Promise<void>;
  stopAgent: (sessionId: string) => Promise<void>;
  respondToPermission: (sessionId: string, requestId: string, response: 'allow' | 'deny') => Promise<void>;
  onAgentEvent: (callback: (sessionId: string, event: AgentEvent) => void) => () => void;

  // Directory
  selectDirectory: () => Promise<string | null>;

  // Skills
  loadSkills: () => Promise<Skill[]>;

  // Insight (dev-only)
  triggerInsight: () => Promise<{ created: boolean; sessionId?: string; error?: string }>;

  // Artifact
  readFile: (filePath: string) => Promise<{ content: string; exists: boolean; base64?: string }>;
  showInFolder: (filePath: string) => Promise<void>;

  // Clipboard
  getClipboardHistory: () => Promise<ClipboardEntry[]>;
  writeClipboard: (text: string) => void;

  // Events
  onSessionsRefresh: (callback: () => void) => () => void;
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
  APPEND_MESSAGE: 'sessions:append-message',
  UPDATE_SESSION_META: 'sessions:update-meta',
  AGENT_CHAT: 'agent:chat',
  AGENT_STOP: 'agent:stop',
  AGENT_PERMISSION_RESPONSE: 'agent:permission-response',
  AGENT_EVENT: 'agent:event',
  SELECT_DIRECTORY: 'directory:select',
  LOAD_SKILLS: 'skills:load',
  TRIGGER_INSIGHT: 'insight:trigger',
  READ_FILE: 'artifact:read-file',
  SHOW_IN_FOLDER: 'artifact:show-in-folder',
  GET_CLIPBOARD_HISTORY: 'clipboard:get-history',
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
  appendMessage: (sessionId, message) => ipcRenderer.invoke(IPC_CHANNELS.APPEND_MESSAGE, sessionId, message),
  updateSessionMeta: (sessionId, updates) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SESSION_META, sessionId, updates),

  // Agent
  chat: (sessionId, message, config) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_CHAT, sessionId, message, config),
  stopAgent: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_STOP, sessionId),
  respondToPermission: (sessionId, requestId, response) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PERMISSION_RESPONSE, sessionId, requestId, response),
  onAgentEvent: (callback) => {
    // 实现步骤：
    // 1. 创建 handler 函数，接收 sessionId 和 event
    // 2. 注册到 ipcRenderer.on
    // 3. 返回清理函数（用于组件卸载时取消监听）
    const handler = (_: unknown, sessionId: string, event: AgentEvent) => callback(sessionId, event);
    ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_EVENT, handler);
  },

  // Directory
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY),

  // Skills
  loadSkills: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_SKILLS),

  // Insight (dev-only)
  triggerInsight: () => ipcRenderer.invoke(IPC_CHANNELS.TRIGGER_INSIGHT),

  // Artifact
  readFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.READ_FILE, filePath),
  showInFolder: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.SHOW_IN_FOLDER, filePath),

  // Clipboard
  getClipboardHistory: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CLIPBOARD_HISTORY),
  writeClipboard: (text: string) => clipboard.writeText(text),

  // Events
  onSessionsRefresh: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('sessions:refresh', handler);
    return () => ipcRenderer.removeListener('sessions:refresh', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// ============ Type Declaration ============

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
