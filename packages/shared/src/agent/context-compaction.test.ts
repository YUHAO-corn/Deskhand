import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  buildCompactionRuntimeOptions,
  DEFAULT_AUTO_COMPACT_WINDOW,
} from './context-compaction.ts';
import {
  buildPostCompactRestoreContext,
  createWorkspaceTask,
  ensureWorkspaceMemoryFiles,
  getWorkspaceCompactPromptPath,
  getWorkspaceTasksPath,
  getWorkspaceUserPath,
  listWorkspaceTasks,
  updateUserPreference,
  updateWorkspaceTask,
} from './workspace-memory.ts';

const tempDirs: string[] = [];

function makeTempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deskhand-context-compact-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('workspace memory files', () => {
  test('initializes .claude memory files for a workspace', async () => {
    const workspaceDir = makeTempWorkspace();

    await ensureWorkspaceMemoryFiles(workspaceDir);

    expect(fs.existsSync(getWorkspaceUserPath(workspaceDir))).toBe(true);
    expect(fs.existsSync(getWorkspaceTasksPath(workspaceDir))).toBe(true);
    expect(fs.existsSync(getWorkspaceCompactPromptPath(workspaceDir))).toBe(true);
  });

  test('builds post-compact restore context from tasks and user preferences', async () => {
    const workspaceDir = makeTempWorkspace();

    await ensureWorkspaceMemoryFiles(workspaceDir);

    const task = await createWorkspaceTask(workspaceDir, {
      subject: 'Implement PostCompact Hook',
      description: 'Restore user and task memory after compaction',
      activeForm: 'Implementing PostCompact Hook',
    });

    await updateWorkspaceTask(workspaceDir, {
      taskId: task.id,
      status: 'in_progress',
    });

    await updateUserPreference(workspaceDir, {
      category: 'preference',
      content: 'Use product language, not code-heavy explanations',
    });

    const restoreContext = await buildPostCompactRestoreContext(workspaceDir);

    expect(restoreContext).toContain('Implement PostCompact Hook');
    expect(restoreContext).toContain('Use product language, not code-heavy explanations');
    expect(restoreContext).toContain('当前任务状态');
    expect(restoreContext).toContain('用户偏好');
  });

  test('persists task updates in tasks.jsonl', async () => {
    const workspaceDir = makeTempWorkspace();

    await ensureWorkspaceMemoryFiles(workspaceDir);

    const first = await createWorkspaceTask(workspaceDir, {
      subject: 'Create task tools',
      description: 'Add TaskCreate and TaskUpdate tools',
    });

    const second = await createWorkspaceTask(workspaceDir, {
      subject: 'Restore user memory',
      description: 'Inject user.md after compaction',
    });

    await updateWorkspaceTask(workspaceDir, {
      taskId: first.id,
      status: 'completed',
      addBlocks: [second.id],
    });

    const tasks = await listWorkspaceTasks(workspaceDir);

    expect(tasks).toHaveLength(2);
    expect(tasks.find((task) => task.id === first.id)?.status).toBe('completed');
    expect(tasks.find((task) => task.id === first.id)?.blocks).toContain(second.id);
  });
});

describe('compaction runtime options', () => {
  test('enables compaction config for 4.6-class models', async () => {
    const workspaceDir = makeTempWorkspace();

    await ensureWorkspaceMemoryFiles(workspaceDir);

    const options = await buildCompactionRuntimeOptions('claude-sonnet-4-6', workspaceDir);
    if (!('autoCompactWindow' in options)) {
      throw new Error('Expected compaction runtime options for claude-sonnet-4-6');
    }

    expect(options.autoCompactWindow).toBe(DEFAULT_AUTO_COMPACT_WINDOW);
    expect(options.betas).toContain('compact-2026-01-12');
    expect(options.context_management.edits).toHaveLength(1);
    expect(options.context_management.edits[0]!.type).toBe('compact_20260112');
  });

  test('skips compaction config for unsupported models', async () => {
    const workspaceDir = makeTempWorkspace();

    await ensureWorkspaceMemoryFiles(workspaceDir);

    const options = await buildCompactionRuntimeOptions('claude-sonnet-4-5-20250929', workspaceDir);

    expect(options).toEqual({});
  });
});
