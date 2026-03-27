/**
 * IPC handlers for main process
 *
 * Handles communication between renderer and main process:
 * - Config management (API key, preferences)
 * - Session operations (CRUD)
 * - Agent chat (message streaming, permissions)
 *
 * Pattern:
 * - Renderer calls: window.electronAPI.xxx()
 * - Preload bridges to: ipcRenderer.invoke('channel', args)
 * - Main handles via: ipcMain.handle('channel', handler)
 */

import { ipcMain, BrowserWindow, app, dialog, shell } from 'electron';
import { join } from 'path';
import { existsSync, promises as fs } from 'fs';
import type { AppConfig, SetupNeeds, SessionMeta, StoredSession, StoredMessage, Session, AgentEvent, ThinkingLevel } from '@deskhand/core';
import {
  loadConfig,
  saveConfig,
  saveApiKey,
  getApiKey,
  hasApiKey,
} from '@deskhand/shared/config';
import {
  listSessions,
  loadSession,
  createSession,
  deleteSession,
  appendMessage,
  updateSessionMeta,
} from '@deskhand/shared/sessions';
import { DeskhandAgent } from '@deskhand/shared/agent';
import { loadSkills } from '@deskhand/shared/skills';
import { runInsightPipeline, type InsightPipelineConfig } from '@deskhand/shared/insight';
import { loadHistory, getClipboardPaths, markSelfWrite, type ClipboardEntry } from './clipboard-monitor.ts';

// ============ Agent Instance Management ============

// Map of sessionId -> agent instance
const agents = new Map<string, DeskhandAgent>();

// Map of sessionId -> SDK session ID (for conversation continuity)
const sdkSessionIds = new Map<string, string>();

// Insight pipeline lock (prevent concurrent runs)
let insightRunning = false;

/** Resolve path to the Claude Agent SDK cli.js */
function getCliPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'claude-sdk', 'cli.js');
  }
  return join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js');
}

/** Resolve path to A2UI HTML templates */
function getA2UITemplateDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'a2ui-templates');
  }
  return join(process.cwd(), 'apps', 'electron', 'resources', 'a2ui-templates');
}

// Get or create agent for a session
async function getOrCreateAgent(sessionId: string, workingDirectory?: string): Promise<DeskhandAgent | null> {
  if (agents.has(sessionId)) {
    return agents.get(sessionId)!;
  }

  // Try env var first (dev mode), then encrypted storage
  const apiKey = process.env.ANTHROPIC_API_KEY || await getApiKey();
  if (!apiKey) return null;

  const cliPath = getCliPath();

  // For monorepos, try root level if not found locally
  if (!existsSync(cliPath) && !app.isPackaged) {
    // SDK cli.js not found — will fail at runtime
  }

  const agent = new DeskhandAgent({
    apiKey,
    pathToClaudeCodeExecutable: cliPath,
    workingDirectory: workingDirectory || undefined,
    a2uiTemplateDir: getA2UITemplateDir(),
    clipboardPaths: getClipboardPaths(),
    // Callback to persist SDK session ID when captured
    onSdkSessionIdUpdate: (sdkSessionId: string) => {
      sdkSessionIds.set(sessionId, sdkSessionId);
    },
  });

  // Restore SDK session ID if we have one from previous conversation
  const existingSdkSessionId = sdkSessionIds.get(sessionId);
  if (existingSdkSessionId) {
    agent.setSessionId(existingSdkSessionId);
  }

  agents.set(sessionId, agent);
  return agent;
}

// ============ Insight Auto-Trigger ============

const INSIGHT_THRESHOLD = 20; // Trigger after N new conversations

/**
 * Check if insight pipeline should run, and run it if conditions are met.
 * Called asynchronously after each agent.chat() completes.
 * Does not block the caller.
 */
async function maybeRunInsight(sender: Electron.WebContents): Promise<void> {
  if (insightRunning) return;

  try {
    const config = await loadConfig();
    const lastInsightAt = config?.lastInsightAt ?? 0;

    // Count user sessions created after last insight (exclude Skill Insight sessions)
    const sessions = await listSessions();
    const newSessionCount = sessions.filter(
      (s) => s.name !== 'Skill Insight' && s.createdAt && s.createdAt > lastInsightAt,
    ).length;

    if (newSessionCount < INSIGHT_THRESHOLD) return;

    const apiKey = process.env.ANTHROPIC_API_KEY || await getApiKey();
    if (!apiKey) return;

    insightRunning = true;

    const result = await runInsightPipeline({
      apiKey,
      pathToClaudeCodeExecutable: getCliPath(),
      sinceTimestamp: lastInsightAt,
    });

    // Store SDK session ID for conversation continuity
    if (result.created && result.sessionId && result.sdkSessionId) {
      sdkSessionIds.set(result.sessionId, result.sdkSessionId);
    }

    // Update lastInsightAt in config
    await saveConfig({ ...config, lastInsightAt: Date.now() });

    // Notify renderer
    if (result.created) {
      sender.send('sessions:refresh');
    }
  } catch (error) {
    console.error('[Insight] Auto-trigger failed:', error);
  } finally {
    insightRunning = false;
  }
}

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
  APPEND_MESSAGE: 'sessions:append-message',
  UPDATE_SESSION_META: 'sessions:update-meta',

  // Agent
  AGENT_CHAT: 'agent:chat',
  AGENT_STOP: 'agent:stop',
  AGENT_PERMISSION_RESPONSE: 'agent:permission-response',

  // Directory
  SELECT_DIRECTORY: 'directory:select',
  SELECT_FILES: 'directory:select-files',

  // Skills
  LOAD_SKILLS: 'skills:load',

  // Insight (dev-only)
  TRIGGER_INSIGHT: 'insight:trigger',

  // Artifact
  READ_FILE: 'artifact:read-file',
  SHOW_IN_FOLDER: 'artifact:show-in-folder',

  // Clipboard
  GET_CLIPBOARD_HISTORY: 'clipboard:get-history',
  COPY_TO_CLIPBOARD: 'clipboard:copy',
} as const;

// ============ Register Handlers ============

export function registerIpcHandlers(): void {
  // ===== Config =====

  ipcMain.handle(IPC_CHANNELS.GET_SETUP_NEEDS, async (): Promise<SetupNeeds> => {
    // 实现步骤：
    // 1. 检查是否存在 API key (env var or encrypted storage)
    // 2. 返回 SetupNeeds 对象
    const hasKey = !!process.env.ANTHROPIC_API_KEY || await hasApiKey();
    return {
      isFullyConfigured: hasKey,
      needsAuth: !hasKey,
    };
  });

  ipcMain.handle(IPC_CHANNELS.GET_CONFIG, async (): Promise<AppConfig | null> => {
    return loadConfig();
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_CONFIG, async (_, config: AppConfig): Promise<void> => {
    // 实现步骤：
    // 1. 如果包含 API key，单独保存到加密文件
    // 2. 保存其他配置到 config.json（不含 API key）
    if (config.apiKey) {
      await saveApiKey(config.apiKey);
      // Don't save API key in config.json
      const { apiKey: _apiKey, ...rest } = config;
      await saveConfig(rest as AppConfig);
    } else {
      await saveConfig(config);
    }
  });

  ipcMain.handle(IPC_CHANNELS.VALIDATE_API_KEY, async (_, apiKey: string, _baseUrl?: string): Promise<{ valid: boolean; error?: string }> => {
    // 实现步骤：
    // 1. 验证 API key 格式（以 sk-ant- 开头）
    // 2. 调用 Anthropic API 验证 key 有效性
    //    const anthropic = new Anthropic({ apiKey, baseUrl });
    //    await anthropic.messages.create({ model: 'claude-3-haiku', messages: [], max_tokens: 1 });
    // 3. 返回验证结果
    if (!apiKey.startsWith('sk-ant-')) {
      return { valid: false, error: 'API key should start with sk-ant-' };
    }
    // TODO: Actually call Anthropic API to validate
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

  ipcMain.handle(IPC_CHANNELS.APPEND_MESSAGE, async (_, sessionId: string, message: StoredMessage): Promise<void> => {
    await appendMessage(sessionId, message);
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_SESSION_META, async (_, sessionId: string, updates: Partial<Pick<Session, 'name' | 'lastMessageAt' | 'preview' | 'messageCount' | 'hidden' | 'hasUnread' | 'artifacts'>>): Promise<void> => {
    await updateSessionMeta(sessionId, updates);
  });

  // ===== Agent =====

  ipcMain.handle(IPC_CHANNELS.AGENT_CHAT, async (
    event,
    sessionId: string,
    message: string,
    config?: { model?: string; thinkingLevel?: ThinkingLevel; workingDirectory?: string; permissionMode?: 'ask' | 'allow-all' }
  ) => {
    // 实现步骤：
    // 1. 获取或创建该 session 的 agent 实例
    // 2. 设置 onEvent 回调，将事件通过 IPC 发送到 renderer
    //    event.sender.send('agent:event', sessionId, agentEvent)
    // 3. 调用 agent.chat(message, { onEvent, ...config })
    // 4. 聊天完成后，更新 session 的 lastMessageAt

    const agent = await getOrCreateAgent(sessionId, config?.workingDirectory);
    if (!agent) {
      event.sender.send('agent:event', sessionId, {
        type: 'error',
        message: 'No API key configured',
      } as AgentEvent);
      return;
    }

    await agent.chat(message, {
      model: config?.model,
      thinkingLevel: config?.thinkingLevel,
      permissionMode: config?.permissionMode,
      onEvent: (agentEvent: AgentEvent) => {
        // Forward event to renderer
        event.sender.send('agent:event', sessionId, agentEvent);
      },
    }).catch((err: unknown) => {
      console.error('[IPC] agent.chat error:', err);
      event.sender.send('agent:event', sessionId, {
        type: 'error',
        message: String(err),
      } as AgentEvent);
    });

    // Auto-trigger insight check (async, non-blocking)
    maybeRunInsight(event.sender).catch(() => {});
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_STOP, async (_, sessionId: string) => {
    // 实现步骤：
    // 1. 从 agents Map 获取该 session 的 agent
    // 2. 如果存在，调用 agent.stop()

    const agent = agents.get(sessionId);
    if (agent) {
      await agent.stop();
    }
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_PERMISSION_RESPONSE, async (_, sessionId: string, requestId: string, response: 'allow' | 'deny') => {
    // 实现步骤：
    // 1. 从 agents Map 获取该 session 的 agent
    // 2. 调用 agent.respondToPermission(requestId, response)

    const agent = agents.get(sessionId);
    if (agent) {
      await agent.respondToPermission(requestId, response);
    }
  });

  // ===== Directory =====

  ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, async (): Promise<string | null> => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Working Directory',
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.SELECT_FILES, async (): Promise<string[]> => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return [];

    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      title: 'Select Files',
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return [];
    return result.filePaths;
  });

  // ===== Skills =====

  ipcMain.handle(IPC_CHANNELS.LOAD_SKILLS, async () => {
    return loadSkills();
  });

  // ===== Insight (dev-only) =====

  ipcMain.handle(IPC_CHANNELS.TRIGGER_INSIGHT, async (event) => {
    const apiKey = process.env.ANTHROPIC_API_KEY || await getApiKey();
    if (!apiKey) {
      return { created: false, error: 'No API key configured' };
    }

    const pipelineConfig: InsightPipelineConfig = {
      apiKey,
      pathToClaudeCodeExecutable: getCliPath(),
    };

    const result = await runInsightPipeline(pipelineConfig);

    // Store SDK session ID for conversation continuity
    if (result.created && result.sessionId && result.sdkSessionId) {
      sdkSessionIds.set(result.sessionId, result.sdkSessionId);
    }

    // Notify renderer to refresh session list
    if (result.created) {
      event.sender.send('sessions:refresh');
    }
    return result;
  });

  // ===== Artifact =====

  ipcMain.handle(IPC_CHANNELS.READ_FILE, async (_, filePath: string): Promise<{ content: string; exists: boolean; base64?: string }> => {
    try {
      // Check if it's an image file — return base64 for rendering
      const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
      const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
      const binaryDocExts = ['xlsx', 'xls', 'docx'];
      if (imageExts.includes(ext)) {
        const buffer = await fs.readFile(filePath);
        const mimeMap: Record<string, string> = {
          png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
          gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
          ico: 'image/x-icon', bmp: 'image/bmp',
        };
        const mime = mimeMap[ext] ?? 'application/octet-stream';
        return { content: '', exists: true, base64: `data:${mime};base64,${buffer.toString('base64')}` };
      }
      // Office binary files — return raw base64 for client-side parsing
      if (binaryDocExts.includes(ext)) {
        const buffer = await fs.readFile(filePath);
        return { content: '', exists: true, base64: buffer.toString('base64') };
      }
      const content = await fs.readFile(filePath, 'utf-8');
      return { content, exists: true };
    } catch {
      return { content: '', exists: false };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SHOW_IN_FOLDER, async (_, filePath: string): Promise<void> => {
    shell.showItemInFolder(filePath);
  });

  // ============ Clipboard ============

  ipcMain.handle(IPC_CHANNELS.GET_CLIPBOARD_HISTORY, async (): Promise<ClipboardEntry[]> => {
    return loadHistory();
  });

  ipcMain.handle(IPC_CHANNELS.COPY_TO_CLIPBOARD, async (_event, text: string): Promise<void> => {
    const { clipboard } = await import('electron');
    markSelfWrite();
    clipboard.writeText(text);
  });
}
