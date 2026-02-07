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

import { ipcMain, BrowserWindow, app } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import type { AppConfig, SetupNeeds, SessionMeta, StoredSession, Session, AgentEvent, ThinkingLevel } from '@deskhand/core';
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
  generateSessionId,
} from '@deskhand/shared/sessions';
import { DeskhandAgent } from '@deskhand/shared/agent';

// ============ Agent Instance Management ============

// Map of sessionId -> agent instance
const agents = new Map<string, DeskhandAgent>();

// Map of sessionId -> SDK session ID (for conversation continuity)
const sdkSessionIds = new Map<string, string>();

// Get or create agent for a session
async function getOrCreateAgent(sessionId: string): Promise<DeskhandAgent | null> {
  if (agents.has(sessionId)) {
    return agents.get(sessionId)!;
  }

  // Try env var first (dev mode), then encrypted storage
  const apiKey = process.env.ANTHROPIC_API_KEY || await getApiKey();
  if (!apiKey) return null;

  // Resolve the path to the SDK's cli.js
  // In development: use process.cwd() (project root)
  // In packaged app: use app.getAppPath()
  const basePath = app.isPackaged ? app.getAppPath() : process.cwd();
  const sdkRelativePath = join('node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js');
  let cliPath = join(basePath, sdkRelativePath);

  // For monorepos, try root level if not found locally
  if (!existsSync(cliPath) && !app.isPackaged) {
    // We're already at project root in dev mode, so this should work
    console.log('[ipc] SDK cli.js not found at:', cliPath);
  }

  console.log('[ipc] Using pathToClaudeCodeExecutable:', cliPath);

  const agent = new DeskhandAgent({
    apiKey,
    pathToClaudeCodeExecutable: cliPath,
    // Callback to persist SDK session ID when captured
    onSdkSessionIdUpdate: (sdkSessionId: string) => {
      console.log('[ipc] SDK session ID captured for', sessionId, ':', sdkSessionId);
      sdkSessionIds.set(sessionId, sdkSessionId);
    },
  });

  // Restore SDK session ID if we have one from previous conversation
  const existingSdkSessionId = sdkSessionIds.get(sessionId);
  if (existingSdkSessionId) {
    console.log('[ipc] Resuming SDK session:', existingSdkSessionId);
    agent.setSessionId(existingSdkSessionId);
  }

  agents.set(sessionId, agent);
  return agent;
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

  // Agent
  AGENT_CHAT: 'agent:chat',
  AGENT_STOP: 'agent:stop',
  AGENT_PERMISSION_RESPONSE: 'agent:permission-response',
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
      const { apiKey, ...rest } = config;
      await saveConfig(rest as AppConfig);
    } else {
      await saveConfig(config);
    }
  });

  ipcMain.handle(IPC_CHANNELS.VALIDATE_API_KEY, async (_, apiKey: string, baseUrl?: string): Promise<{ valid: boolean; error?: string }> => {
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

  // ===== Agent =====

  ipcMain.handle(IPC_CHANNELS.AGENT_CHAT, async (
    event,
    sessionId: string,
    message: string,
    config?: { model?: string; thinkingLevel?: ThinkingLevel }
  ) => {
    // 实现步骤：
    // 1. 获取或创建该 session 的 agent 实例
    // 2. 设置 onEvent 回调，将事件通过 IPC 发送到 renderer
    //    event.sender.send('agent:event', sessionId, agentEvent)
    // 3. 调用 agent.chat(message, { onEvent, ...config })
    // 4. 聊天完成后，更新 session 的 lastMessageAt
    console.log('[IPC] agent:chat', sessionId, message, config);

    const agent = await getOrCreateAgent(sessionId);
    if (!agent) {
      event.sender.send('agent:event', sessionId, {
        type: 'error',
        error: 'No API key configured',
      } as AgentEvent);
      return;
    }

    await agent.chat(message, {
      model: config?.model,
      thinkingLevel: config?.thinkingLevel,
      onEvent: (agentEvent: AgentEvent) => {
        // Forward event to renderer
        event.sender.send('agent:event', sessionId, agentEvent);
      },
    });
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_STOP, async (_, sessionId: string) => {
    // 实现步骤：
    // 1. 从 agents Map 获取该 session 的 agent
    // 2. 如果存在，调用 agent.stop()
    console.log('[IPC] agent:stop', sessionId);

    const agent = agents.get(sessionId);
    if (agent) {
      await agent.stop();
    }
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_PERMISSION_RESPONSE, async (_, sessionId: string, requestId: string, response: 'allow' | 'deny') => {
    // 实现步骤：
    // 1. 从 agents Map 获取该 session 的 agent
    // 2. 调用 agent.respondToPermission(requestId, response)
    console.log('[IPC] agent:permission-response', sessionId, requestId, response);

    const agent = agents.get(sessionId);
    if (agent) {
      await agent.respondToPermission(requestId, response);
    }
  });
}
