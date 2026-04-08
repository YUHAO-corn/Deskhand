import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { buildPostCompactRestoreContext, loadWorkspaceCompactionPrompt } from './workspace-memory.ts';
import { buildEnhancedRestoreContext } from './context-restore.ts';

export const DEFAULT_AUTO_COMPACT_WINDOW = 140000;
const COMPACTION_BETA = 'compact-2026-01-12';

const SUPPORTED_COMPACTION_MODEL_PATTERNS = [
  /claude-sonnet-4-6(?:$|[-@])/i,
  /claude-opus-4-6(?:$|[-@])/i,
];

export interface DeskhandCompactionRuntimeOptions {
  autoCompactWindow: number;
  betas: string[];
  context_management: {
    edits: Array<{
      type: 'compact_20260112';
      instructions?: string;
      pause_after_compaction: false;
    }>;
  };
}

export interface ArchiveTranscriptSnapshotInput {
  workspaceDir: string;
  sessionId: string;
  transcriptPath: string;
  trigger: 'auto' | 'manual';
  timestamp?: number;
}

export function supportsDeskhandCompaction(model: string): boolean {
  return SUPPORTED_COMPACTION_MODEL_PATTERNS.some(pattern => pattern.test(model));
}

export async function buildCompactionRuntimeOptions(
  model: string,
  workspaceDir: string,
): Promise<DeskhandCompactionRuntimeOptions | {}> {
  if (!supportsDeskhandCompaction(model)) {
    return {};
  }

  const instructions = (await loadWorkspaceCompactionPrompt(workspaceDir)).trim();
  return {
    autoCompactWindow: DEFAULT_AUTO_COMPACT_WINDOW,
    betas: [COMPACTION_BETA],
    context_management: {
      edits: [{
        type: 'compact_20260112',
        ...(instructions ? { instructions } : {}),
        pause_after_compaction: false,
      }],
    },
  };
}

export async function buildPostCompactHookOutput(
  workspaceDir: string,
  transcriptPath?: string,
): Promise<{
  continue: true;
  hookSpecificOutput?: {
    hookEventName: 'PostCompact';
    additionalContext: string;
  };
}> {
  const sections: string[] = [];

  // Base context: tasks and user preferences
  const baseContext = await buildPostCompactRestoreContext(workspaceDir);
  if (baseContext) {
    sections.push(baseContext);
  }

  // Enhanced context: recent files and skills (if transcript available)
  if (transcriptPath) {
    const enhancedContext = await buildEnhancedRestoreContext(workspaceDir, transcriptPath);
    if (enhancedContext) {
      sections.push(enhancedContext);
    }
  }

  if (sections.length === 0) {
    return { continue: true };
  }

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PostCompact',
      additionalContext: sections.join('\n\n'),
    },
  };
}

function formatSnapshotTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

export async function archiveTranscriptSnapshot(
  input: ArchiveTranscriptSnapshotInput,
): Promise<string | null> {
  try {
    const transcriptContent = await fs.readFile(input.transcriptPath, 'utf-8');
    const archiveDir = path.join(input.workspaceDir, '.transcripts');
    await fs.mkdir(archiveDir, { recursive: true });

    const timestamp = formatSnapshotTimestamp(input.timestamp ?? Date.now());
    const safeSessionId = input.sessionId.replace(/[^a-zA-Z0-9_-]/g, '-');
    const filePath = path.join(
      archiveDir,
      `${timestamp}-${input.trigger}-${safeSessionId}.jsonl`,
    );

    await fs.writeFile(filePath, transcriptContent, 'utf-8');
    return filePath;
  } catch {
    return null;
  }
}
