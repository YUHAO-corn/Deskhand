import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type WorkspaceTaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';
export type UserPreferenceCategory = 'role' | 'preference' | 'constraint';

export interface WorkspaceTask {
  id: string;
  subject: string;
  description: string;
  activeForm?: string;
  status: WorkspaceTaskStatus;
  blockedBy: string[];
  blocks: string[];
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface CreateWorkspaceTaskInput {
  subject: string;
  description: string;
  activeForm?: string;
}

export interface UpdateWorkspaceTaskInput {
  taskId: string;
  subject?: string;
  description?: string;
  activeForm?: string;
  status?: WorkspaceTaskStatus;
  addBlocks?: string[];
  addBlockedBy?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateUserPreferenceInput {
  category: UserPreferenceCategory;
  content: string;
}

const CLAUDE_DIR_NAME = '.claude';
const TASKS_FILE_NAME = 'tasks.jsonl';
const USER_FILE_NAME = 'user.md';
const COMPACT_PROMPT_FILE_NAME = 'compact.md';

const DEFAULT_USER_MEMORY = `# 用户信息

## 角色

## 偏好

## 约束
`;

const DEFAULT_COMPACTION_PROMPT = `请从非技术用户视角压缩当前对话，优先保留以下信息：

1. 当前正在进行的任务、已经完成的任务、下一步行动。
2. 用户的长期偏好、角色信息、约束条件。
3. 最近几轮对话中决定了什么，为什么这么决定。
4. 用产品语言和任务语言总结，不要过度保留实现细节。

如果某些信息已经过时，请明确标记为“已失效”而不是混在当前状态里。`;

const USER_SECTION_TITLES: Record<UserPreferenceCategory, string> = {
  role: '角色',
  preference: '偏好',
  constraint: '约束',
};

export function getWorkspaceClaudeDir(workspaceDir: string): string {
  return path.join(workspaceDir, CLAUDE_DIR_NAME);
}

export function getWorkspaceTasksPath(workspaceDir: string): string {
  return path.join(getWorkspaceClaudeDir(workspaceDir), TASKS_FILE_NAME);
}

export function getWorkspaceUserPath(workspaceDir: string): string {
  return path.join(getWorkspaceClaudeDir(workspaceDir), USER_FILE_NAME);
}

export function getWorkspaceCompactPromptPath(workspaceDir: string): string {
  return path.join(getWorkspaceClaudeDir(workspaceDir), COMPACT_PROMPT_FILE_NAME);
}

async function writeIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, content, 'utf-8');
  }
}

export async function ensureWorkspaceMemoryFiles(workspaceDir: string): Promise<void> {
  await fs.mkdir(getWorkspaceClaudeDir(workspaceDir), { recursive: true });
  await writeIfMissing(getWorkspaceTasksPath(workspaceDir), '');
  await writeIfMissing(getWorkspaceUserPath(workspaceDir), DEFAULT_USER_MEMORY);
  await writeIfMissing(getWorkspaceCompactPromptPath(workspaceDir), DEFAULT_COMPACTION_PROMPT);
}

async function readTextFileOrDefault(filePath: string, fallback: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return fallback;
  }
}

async function writeWorkspaceTasks(workspaceDir: string, tasks: WorkspaceTask[]): Promise<void> {
  const content = tasks.map(task => JSON.stringify(task)).join('\n');
  await fs.writeFile(
    getWorkspaceTasksPath(workspaceDir),
    content.length > 0 ? `${content}\n` : '',
    'utf-8',
  );
}

export async function listWorkspaceTasks(workspaceDir: string): Promise<WorkspaceTask[]> {
  await ensureWorkspaceMemoryFiles(workspaceDir);

  const raw = await readTextFileOrDefault(getWorkspaceTasksPath(workspaceDir), '');
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as WorkspaceTask)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function getWorkspaceTask(
  workspaceDir: string,
  taskId: string,
): Promise<WorkspaceTask | null> {
  const tasks = await listWorkspaceTasks(workspaceDir);
  return tasks.find(task => task.id === taskId) ?? null;
}

export async function createWorkspaceTask(
  workspaceDir: string,
  input: CreateWorkspaceTaskInput,
): Promise<WorkspaceTask> {
  const tasks = await listWorkspaceTasks(workspaceDir);
  const now = Date.now();

  const task: WorkspaceTask = {
    id: `task-${randomUUID().slice(0, 8)}`,
    subject: input.subject,
    description: input.description,
    activeForm: input.activeForm,
    status: 'pending',
    blockedBy: [],
    blocks: [],
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };

  tasks.push(task);
  await writeWorkspaceTasks(workspaceDir, tasks);
  return task;
}

export async function updateWorkspaceTask(
  workspaceDir: string,
  input: UpdateWorkspaceTaskInput,
): Promise<WorkspaceTask> {
  const tasks = await listWorkspaceTasks(workspaceDir);
  const index = tasks.findIndex(task => task.id === input.taskId);
  if (index === -1) {
    throw new Error(`Task not found: ${input.taskId}`);
  }

  const existing = tasks[index]!;
  const updated: WorkspaceTask = {
    id: existing.id,
    subject: input.subject ?? existing.subject,
    description: input.description ?? existing.description,
    activeForm: input.activeForm ?? existing.activeForm,
    status: input.status ?? existing.status,
    blockedBy: uniqueStrings([...(existing.blockedBy ?? []), ...(input.addBlockedBy ?? [])]),
    blocks: uniqueStrings([...(existing.blocks ?? []), ...(input.addBlocks ?? [])]),
    metadata: input.metadata ? { ...existing.metadata, ...input.metadata } : existing.metadata,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };

  tasks[index] = updated;
  await writeWorkspaceTasks(workspaceDir, tasks);
  return updated;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getSectionBounds(lines: string[], title: string): { start: number; end: number } {
  const heading = `## ${title}`;
  let start = lines.findIndex(line => line.trim() === heading);
  if (start === -1) {
    if (lines.length > 0 && lines[lines.length - 1]?.trim() !== '') {
      lines.push('');
    }
    lines.push(heading, '');
    start = lines.length - 2;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index]?.startsWith('## ')) {
      end = index;
      break;
    }
  }

  return { start, end };
}

export async function updateUserPreference(
  workspaceDir: string,
  input: UpdateUserPreferenceInput,
): Promise<string> {
  await ensureWorkspaceMemoryFiles(workspaceDir);

  const filePath = getWorkspaceUserPath(workspaceDir);
  const current = await readTextFileOrDefault(filePath, DEFAULT_USER_MEMORY);
  const lines = current.split('\n');
  const title = USER_SECTION_TITLES[input.category];
  const { start, end } = getSectionBounds(lines, title);
  const bullet = `- ${input.content.trim()}`;

  const existingSectionLines = lines.slice(start + 1, end).map(line => line.trim().toLowerCase());
  if (!existingSectionLines.includes(bullet.toLowerCase())) {
    let insertAt = end;
    while (insertAt > start + 1 && lines[insertAt - 1]?.trim() === '') {
      insertAt -= 1;
    }
    lines.splice(insertAt, 0, bullet);
    if (insertAt === lines.length - 1 || lines[insertAt + 1]?.trim() !== '') {
      lines.splice(insertAt + 1, 0, '');
    }
  }

  const nextContent = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  await fs.writeFile(filePath, nextContent, 'utf-8');
  return nextContent;
}

function parseUserSections(content: string): Array<{ title: string; items: string[] }> {
  const lines = content.split('\n');
  const sections: Array<{ title: string; items: string[] }> = [];
  let currentTitle: string | null = null;
  let currentItems: string[] = [];

  const flush = () => {
    if (currentTitle) {
      sections.push({
        title: currentTitle,
        items: currentItems.filter(item => item.trim().length > 0),
      });
    }
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      currentTitle = line.replace(/^##\s+/, '').trim();
      currentItems = [];
      continue;
    }

    if (!currentTitle) continue;

    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      currentItems.push(trimmed);
    }
  }

  flush();
  return sections.filter(section => section.items.length > 0);
}

function formatTaskLine(task: WorkspaceTask): string {
  const suffix = task.blockedBy.length > 0 ? ` (blocked by ${task.blockedBy.join(', ')})` : '';
  return `- #${task.id}: ${task.subject}${suffix}`;
}

export function formatWorkspaceTasksForContext(tasks: WorkspaceTask[]): string {
  const visibleTasks = tasks.filter(task => task.status !== 'deleted');
  if (visibleTasks.length === 0) {
    return '';
  }

  const groups: Array<{ title: string; status: WorkspaceTaskStatus }> = [
    { title: '进行中', status: 'in_progress' },
    { title: '待处理', status: 'pending' },
    { title: '已完成', status: 'completed' },
  ];

  const sections = groups
    .map(({ title, status }) => {
      const groupTasks = visibleTasks.filter(task => task.status === status);
      if (groupTasks.length === 0) {
        return '';
      }

      return `${title}：\n${groupTasks.map(formatTaskLine).join('\n')}`;
    })
    .filter(Boolean);

  return sections.join('\n\n');
}

export async function loadWorkspaceCompactionPrompt(workspaceDir: string): Promise<string> {
  await ensureWorkspaceMemoryFiles(workspaceDir);
  return readTextFileOrDefault(getWorkspaceCompactPromptPath(workspaceDir), DEFAULT_COMPACTION_PROMPT);
}

export async function buildPostCompactRestoreContext(workspaceDir: string): Promise<string> {
  await ensureWorkspaceMemoryFiles(workspaceDir);

  const tasks = await listWorkspaceTasks(workspaceDir);
  const userContent = await readTextFileOrDefault(getWorkspaceUserPath(workspaceDir), DEFAULT_USER_MEMORY);

  const sections: string[] = [];
  const taskSummary = formatWorkspaceTasksForContext(tasks);
  if (taskSummary) {
    sections.push(`当前任务状态：\n\n${taskSummary}`);
  }

  const userSections = parseUserSections(userContent);
  if (userSections.length > 0) {
    const formattedUserSections = userSections
      .map(section => `### ${section.title}\n${section.items.join('\n')}`)
      .join('\n\n');
    sections.push(`用户偏好：\n\n${formattedUserSections}`);
  }

  return sections.join('\n\n');
}
