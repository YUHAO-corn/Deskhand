import { buildPostCompactRestoreContext, loadWorkspaceCompactionPrompt } from './workspace-memory.ts';

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

export async function buildPostCompactHookOutput(workspaceDir: string): Promise<{
  continue: true;
  hookSpecificOutput?: {
    hookEventName: 'PostCompact';
    additionalContext: string;
  };
}> {
  const additionalContext = await buildPostCompactRestoreContext(workspaceDir);
  if (!additionalContext) {
    return { continue: true };
  }

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PostCompact',
      additionalContext,
    },
  };
}
