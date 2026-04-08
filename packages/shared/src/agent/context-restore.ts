/**
 * Context Restore - Enhanced context recovery after compaction
 *
 * Slice 5: 上下文恢复增强
 * - 压缩后自动读取最近编辑过的 3 个文件（不超过 5000 tokens）
 * - 如果最近 5 轮对话内有 Skill 调用，则恢复该 Skill 的上下文
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const MAX_RECENT_FILES = 3;
const MAX_RESTORE_TOKENS = 5000;
const RECENT_TURNS_THRESHOLD = 5;

interface TranscriptMessage {
  role: string;
  content: Array<{
    type: string;
    tool_use_id?: string;
    name?: string;
    input?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
}

interface RecentFileEdit {
  filePath: string;
  turnIndex: number;
}

interface RecentSkillCall {
  skillName: string;
  turnIndex: number;
}

/**
 * Parse transcript JSONL and extract recent file edits
 */
async function extractRecentFileEdits(transcriptPath: string): Promise<RecentFileEdit[]> {
  try {
    const content = await fs.readFile(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    const edits: RecentFileEdit[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      try {
        const message: TranscriptMessage = JSON.parse(line);

        if (message.role !== 'assistant' || !message.content) continue;

        for (const block of message.content) {
          if (block.type !== 'tool_use' || !block.name) continue;

          const toolName = block.name;
          const toolInput = block.input || {};

          // Track Edit and Write tools
          if (toolName === 'Edit' || toolName === 'Write') {
            const filePath = toolInput.file_path;
            if (filePath && typeof filePath === 'string') {
              edits.push({ filePath, turnIndex: i });
            }
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    // Return most recent edits (deduplicated by file path)
    const seen = new Set<string>();
    const recent: RecentFileEdit[] = [];

    for (let i = edits.length - 1; i >= 0 && recent.length < MAX_RECENT_FILES; i--) {
      const edit = edits[i];
      if (edit && !seen.has(edit.filePath)) {
        seen.add(edit.filePath);
        recent.push(edit);
      }
    }

    return recent.reverse(); // Oldest to newest
  } catch {
    return [];
  }
}

/**
 * Parse transcript JSONL and extract recent Skill calls
 */
async function extractRecentSkillCalls(transcriptPath: string): Promise<RecentSkillCall[]> {
  try {
    const content = await fs.readFile(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    const skills: RecentSkillCall[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      try {
        const message: TranscriptMessage = JSON.parse(line);

        if (message.role !== 'assistant' || !message.content) continue;

        for (const block of message.content) {
          if (block.type !== 'tool_use' || !block.name) continue;

          const toolName = block.name;
          const toolInput = block.input || {};

          // Track Skill tool
          if (toolName === 'Skill') {
            const skillName = toolInput.skill;
            if (skillName && typeof skillName === 'string') {
              skills.push({ skillName, turnIndex: i });
            }
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    // Check if most recent skill call is within threshold
    if (skills.length === 0) return [];

    const lastSkill = skills[skills.length - 1];
    if (!lastSkill) return [];

    const totalTurns = lines.length;
    const turnsAgo = totalTurns - lastSkill.turnIndex;

    if (turnsAgo <= RECENT_TURNS_THRESHOLD) {
      return [lastSkill];
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Read file content with token limit
 */
async function readFileWithLimit(
  filePath: string,
  maxTokens: number,
): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    // Rough token estimation: 1 token ≈ 4 characters
    const estimatedTokens = Math.ceil(content.length / 4);

    if (estimatedTokens <= maxTokens) {
      return content;
    }

    // Truncate if too long
    const maxChars = maxTokens * 4;
    return content.slice(0, maxChars) + '\n\n[... truncated ...]';
  } catch {
    return null;
  }
}

/**
 * Build enhanced restore context with recent files and skills
 */
export async function buildEnhancedRestoreContext(
  workspaceDir: string,
  transcriptPath: string,
): Promise<string> {
  const sections: string[] = [];

  // Extract recent file edits
  const recentEdits = await extractRecentFileEdits(transcriptPath);

  if (recentEdits.length > 0) {
    const fileContents: string[] = [];
    let totalTokens = 0;

    for (const edit of recentEdits) {
      const fullPath = path.isAbsolute(edit.filePath)
        ? edit.filePath
        : path.join(workspaceDir, edit.filePath);

      const remainingTokens = MAX_RESTORE_TOKENS - totalTokens;
      if (remainingTokens <= 0) break;

      const content = await readFileWithLimit(fullPath, remainingTokens);

      if (content) {
        const estimatedTokens = Math.ceil(content.length / 4);
        totalTokens += estimatedTokens;

        fileContents.push(`### ${edit.filePath}\n\`\`\`\n${content}\n\`\`\``);
      }
    }

    if (fileContents.length > 0) {
      sections.push(`最近编辑的文件：\n\n${fileContents.join('\n\n')}`);
    }
  }

  // Extract recent Skill calls
  const recentSkills = await extractRecentSkillCalls(transcriptPath);

  if (recentSkills.length > 0) {
    const skillNames = recentSkills.map(s => s.skillName).join(', ');
    sections.push(`最近使用的技能：${skillNames}`);
  }

  return sections.join('\n\n');
}
