import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';

import {
  buildPostCompactRestoreContext,
  createWorkspaceTask,
  getWorkspaceTask,
  getWorkspaceTasksPath,
  getWorkspaceUserPath,
  listWorkspaceTasks,
  updateUserPreference,
  updateWorkspaceTask,
} from './workspace-memory.ts';

function textResult(text: string, isError = false) {
  return {
    content: [{ type: 'text' as const, text }],
    ...(isError ? { isError: true } : {}),
  };
}

export function createWorkspaceMemoryServer(workspaceDir: string) {
  return createSdkMcpServer({
    name: 'deskhand-memory',
    version: '1.0.0',
    tools: [
      tool(
        'TaskCreate',
        `Create a new workspace task in .claude/tasks.jsonl.

Use this when:
- the user gives a complex, multi-step request
- a new non-trivial task appears mid-conversation
- tracking progress will help the agent stay coherent across compaction

Do not use this for one-step trivial requests or casual conversation.`,
        {
          subject: z.string().describe('Task title in imperative form, e.g. "Implement PostCompact Hook"'),
          description: z.string().describe('What this task needs to accomplish'),
          activeForm: z.string().optional().describe('Optional present-progressive label, e.g. "Implementing PostCompact Hook"'),
        },
        async (args) => {
          const task = await createWorkspaceTask(workspaceDir, args);
          return textResult(`Task created in ${getWorkspaceTasksPath(workspaceDir)}\n\n${JSON.stringify(task, null, 2)}`);
        },
      ),
      tool(
        'TaskUpdate',
        `Update an existing task in .claude/tasks.jsonl.

Use this when:
- starting a task (set status to in_progress)
- finishing a task (set status to completed only when truly done)
- establishing dependency links
- adjusting task wording after scope changes`,
        {
          taskId: z.string().describe('Existing task ID'),
          subject: z.string().optional(),
          description: z.string().optional(),
          activeForm: z.string().optional(),
          status: z.enum(['pending', 'in_progress', 'completed', 'deleted']).optional(),
          addBlocks: z.array(z.string()).optional(),
          addBlockedBy: z.array(z.string()).optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
        },
        async (args) => {
          try {
            const task = await updateWorkspaceTask(workspaceDir, args);
            return textResult(`Task updated in ${getWorkspaceTasksPath(workspaceDir)}\n\n${JSON.stringify(task, null, 2)}`);
          } catch (error) {
            return textResult(String(error), true);
          }
        },
      ),
      tool(
        'TaskList',
        `List all workspace tasks from .claude/tasks.jsonl.

Use this after completing a task to find the next one, or when you need the current task graph.`,
        {},
        async () => {
          const tasks = await listWorkspaceTasks(workspaceDir);
          const restoreContext = await buildPostCompactRestoreContext(workspaceDir);
          if (tasks.length === 0) {
            return textResult(`No tasks recorded yet in ${getWorkspaceTasksPath(workspaceDir)}.`);
          }
          return textResult(restoreContext || JSON.stringify(tasks, null, 2));
        },
        {
          annotations: {
            readOnlyHint: true,
            openWorldHint: false,
          },
        },
      ),
      tool(
        'TaskGet',
        `Get one workspace task by ID from .claude/tasks.jsonl.`,
        {
          taskId: z.string().describe('Existing task ID'),
        },
        async ({ taskId }) => {
          const task = await getWorkspaceTask(workspaceDir, taskId);
          if (!task) {
            return textResult(`Task not found: ${taskId}`, true);
          }
          return textResult(JSON.stringify(task, null, 2));
        },
        {
          annotations: {
            readOnlyHint: true,
            openWorldHint: false,
          },
        },
      ),
      tool(
        'UpdateUserPreference',
        `Record a stable user preference in .claude/user.md.

Use this only for long-lived information such as:
- user role or technical background
- recurring response style preferences
- durable constraints the agent should keep following

Do not use this for one-off task instructions.`,
        {
          category: z.enum(['role', 'preference', 'constraint']),
          content: z.string().describe('One durable preference statement'),
        },
        async (args) => {
          const userMemory = await updateUserPreference(workspaceDir, args);
          return textResult(`Updated ${getWorkspaceUserPath(workspaceDir)}\n\n${userMemory}`);
        },
      ),
    ],
  });
}
