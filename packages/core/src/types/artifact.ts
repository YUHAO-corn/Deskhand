/**
 * Artifact types for Deskhand
 *
 * Artifacts are output products from Agent execution:
 * - Files: created/modified files with content
 * - Terminal: command execution output
 * - Preview: web preview URLs
 *
 * This is a Deskhand-specific feature not present in craft-agent.
 */

// ============ Enums ============

/** Artifact type */
export type ArtifactType = 'file' | 'terminal' | 'preview';

/** File operation type */
export type FileOperation = 'create' | 'update' | 'delete';

// ============ Base Artifact ============

/** Base artifact interface */
export interface ArtifactBase {
  id: string;
  type: ArtifactType;
  messageId: string;                 // Associated message ID
  createdAt: number;
}

// ============ File Artifact ============

/** File artifact - created/modified file */
export interface FileArtifact extends ArtifactBase {
  type: 'file';
  path: string;                      // File path
  content: string;                   // File content
  language?: string;                 // Language for syntax highlighting
  operation: FileOperation;          // create/update/delete
}

// ============ Terminal Artifact ============

/** Terminal artifact - command execution output */
export interface TerminalArtifact extends ArtifactBase {
  type: 'terminal';
  command: string;                   // Executed command
  output: string;                    // Command output
  exitCode?: number;                 // Exit code
}

// ============ Preview Artifact ============

/** Preview artifact - web preview */
export interface PreviewArtifact extends ArtifactBase {
  type: 'preview';
  url: string;                       // Preview URL
}

// ============ Union Type ============

/** Artifact union type */
export type Artifact = FileArtifact | TerminalArtifact | PreviewArtifact;
