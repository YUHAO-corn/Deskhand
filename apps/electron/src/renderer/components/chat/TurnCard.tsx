import { useState, useMemo, useCallback } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { ChevronRight, FileText, ExternalLink } from 'lucide-react';
import type { AssistantTurn, TurnPhase } from './turn-utils';
import { deriveTurnPhase, shouldShowThinkingIndicator, getTurnIntent, extractArtifactsFromTurn } from './turn-utils';
import { ActivityTree } from './ActivityTree';
import { Markdown } from './markdown/Markdown';
import { ProcessingIndicator } from './ProcessingIndicator';
import { pendingActionMessageAtom, artifactPanelOpenAtom, selectedArtifactAtom, workingDirectoryAtom } from '../../atoms/sessions';

interface TurnCardProps {
  turn: AssistantTurn;
}

function getPreviewText(turn: AssistantTurn, isStreaming: boolean, hasResponse: boolean): string {
  const intent = getTurnIntent(turn);
  if (intent) return intent;

  if (isStreaming && hasResponse) return 'Responding...';

  const runningTools = turn.activities.filter((a) => a.status === 'running' && a.toolName);
  if (runningTools.length > 0) {
    const toolNames = runningTools.map((a) => a.toolName).slice(0, 3);
    return `${toolNames.join(', ')}...`;
  }

  const completedCount = turn.activities.filter((a) => a.status === 'completed').length;
  const errorCount = turn.activities.filter((a) => a.status === 'error').length;
  if (completedCount > 0 || errorCount > 0) {
    const errorSuffix = errorCount > 0 ? ` · ${errorCount} error${errorCount > 1 ? 's' : ''}` : '';
    return `Steps completed${errorSuffix}`;
  }

  return 'Processing...';
}

function getPhaseLabel(phase: TurnPhase): string {
  switch (phase) {
    case 'pending':
      return 'Thinking';
    case 'tool_active':
      return 'Running';
    case 'awaiting':
      return 'Awaiting';
    case 'streaming':
      return 'Responding';
    case 'complete':
      return 'Completed';
    default:
      return 'Running';
  }
}

function getPhaseChipClass(phase: TurnPhase): string {
  if (phase === 'tool_active' || phase === 'streaming') {
    return 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]';
  }
  if (phase === 'complete') {
    return 'border-[var(--color-line-strong)] bg-[var(--color-surface-panel)] text-[var(--color-text-secondary)]';
  }
  return 'border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]';
}

function getDisplayPath(filePath: string, workingDirectory: string | null): string {
  if (!workingDirectory) return filePath;
  if (filePath === workingDirectory) return '.';
  const prefix = workingDirectory.endsWith('/') ? workingDirectory : `${workingDirectory}/`;
  if (filePath.startsWith(prefix)) {
    return filePath.slice(prefix.length);
  }
  return filePath;
}

export function TurnCard({ turn }: TurnCardProps) {
  const { response, activities, timestamp } = turn;
  const phase = deriveTurnPhase(turn);
  const setPendingAction = useSetAtom(pendingActionMessageAtom);
  const setArtifactPanelOpen = useSetAtom(artifactPanelOpenAtom);
  const setSelectedArtifact = useSetAtom(selectedArtifactAtom);
  const workingDirectory = useAtomValue(workingDirectoryAtom);

  const [isExpanded, setIsExpanded] = useState(true);
  const toggleExpanded = useCallback(() => setIsExpanded((prev) => !prev), []);

  const showThinking = shouldShowThinkingIndicator(phase, false);
  const hasContent = response && response.text.length > 0;
  const hasActivities = activities && activities.length > 0;
  const isResponseStreaming = response?.isStreaming ?? false;

  const previewText = useMemo(() => getPreviewText(turn, turn.isStreaming, !!response), [turn, response]);
  const artifacts = useMemo(() => extractArtifactsFromTurn(turn), [turn]);
  const visibleArtifacts = artifacts.slice(0, 3);

  const openArtifact = useCallback((filePath: string) => {
    if (!filePath) return;
    setSelectedArtifact(filePath);
    setArtifactPanelOpen(true);
  }, [setArtifactPanelOpen, setSelectedArtifact]);

  return (
    <div className="group rounded-[var(--radius-card)] border border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] px-4 py-3 shadow-[var(--elevation-1)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={["inline-flex items-center rounded-[var(--radius-pill)] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]", getPhaseChipClass(phase)].join(' ')}>
          {getPhaseLabel(phase)}
        </span>
      </div>

      {showThinking && !hasContent && !hasActivities && <ProcessingIndicator startTime={timestamp} />}

      {hasActivities && (
        <div className="mb-2">
          <button
            onClick={toggleExpanded}
            className="flex w-full items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-line-soft)] bg-[var(--color-surface-panel)] px-2.5 py-1.5 text-left text-[var(--font-size-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--color-text-secondary)]"
          >
            <ChevronRight
              className={[
                'h-3.5 w-3.5 shrink-0 transition-transform duration-150',
                isExpanded ? 'rotate-90' : '',
              ].join(' ')}
            />

            <span className="shrink-0 text-[var(--font-size-xs)] tabular-nums">{activities.length}</span>
            <span className="flex-1 truncate">{previewText}</span>
          </button>

          {isExpanded && (
            <div className="mt-2 rounded-[var(--radius-control)] border border-[var(--color-line-soft)] bg-[var(--color-surface-panel)] px-2 py-2">
              <ActivityTree
                activities={activities}
                onActivityClick={(activity) => {
                  console.log('Activity clicked:', activity);
                }}
              />
              {showThinking && !hasContent && <ProcessingIndicator startTime={timestamp} />}
            </div>
          )}
        </div>
      )}

      {artifacts.length > 0 && (
        <div className="mb-2 rounded-[var(--radius-control)] border border-[var(--color-line-soft)] bg-[var(--color-surface-panel)] p-2.5">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-line-soft)] bg-[var(--color-surface-elevated)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
              Artifacts · {artifacts.length}
            </span>
          </div>

          <div className="space-y-1">
            {visibleArtifacts.map((artifact) => {
              const isPathAvailable = Boolean(artifact.path);
              return (
                <button
                  key={artifact.path}
                  disabled={!isPathAvailable}
                  onClick={() => openArtifact(artifact.path)}
                  className={[
                    'flex w-full items-center gap-2 rounded-[var(--radius-pill)] border border-transparent px-2 py-1.5 text-left transition-colors',
                    isPathAvailable
                      ? 'hover:border-[var(--color-line-soft)] hover:bg-[var(--hover-bg)]'
                      : 'cursor-not-allowed opacity-60',
                  ].join(' ')}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">
                      {artifact.fileName}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-[var(--color-text-muted)]">
                      {isPathAvailable ? getDisplayPath(artifact.path, workingDirectory) : 'Path unavailable'}
                    </span>
                  </span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-[var(--color-text-muted)]" />
                </button>
              );
            })}
          </div>

          {artifacts.length > visibleArtifacts.length && (
            <div className="mt-2 px-2 text-[11px] text-[var(--color-text-muted)]">
              +{artifacts.length - visibleArtifacts.length} more
            </div>
          )}
        </div>
      )}

      <div className="text-[var(--font-size-base)] leading-relaxed text-[var(--color-text-primary)]">
        {hasContent && (
          <div>
            <Markdown content={response.text} />
            {isResponseStreaming && (
              <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-current" />
            )}
          </div>
        )}

        {response?.actions && response.actions.length > 0 && !isResponseStreaming && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {response.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => setPendingAction(action.presetMessage)}
                className={[
                  'rounded-[var(--radius-pill)] px-4 py-2 text-[var(--font-size-sm)] font-medium transition-colors duration-150',
                  action.style === 'primary'
                    ? 'border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-surface-elevated)] hover:bg-[var(--color-accent-strong)]'
                    : 'border border-[var(--color-line-soft)] text-[var(--color-text-secondary)] hover:bg-[var(--hover-bg)]',
                ].join(' ')}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
