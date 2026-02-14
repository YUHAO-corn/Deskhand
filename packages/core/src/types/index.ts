/**
 * @deskhand/core - Type definitions
 *
 * Re-exports all types for convenient importing:
 * import type { Session, Message, Artifact } from '@deskhand/core/types';
 */

// Session types
export type {
  PermissionMode,
  ThinkingLevel,
  Session,
  StoredSession,
  SessionMeta,
} from './session.ts';

// Message types
export type {
  MessageRole,
  ToolStatus,
  AuthRequestType,
  AuthStatus,
  CredentialInputMode,
  AttachmentType,
  TokenUsage,
  ToolDisplayMeta,
  StoredAttachment,
  Message,
  StoredMessage,
  MessageAction,
} from './message.ts';
export { generateMessageId } from './message.ts';

// Artifact types
export type {
  ArtifactType,
  FileOperation,
  ArtifactBase,
  FileArtifact,
  TerminalArtifact,
  PreviewArtifact,
  Artifact,
} from './artifact.ts';

// Config types
export type {
  AppConfig,
  AuthState,
  SetupNeeds,
} from './config.ts';

// Event types
export type {
  PermissionRequest,
  TypedError,
  AgentEvent,
} from './event.ts';

// Skill types
export type {
  Skill,
  McpConfig,
  Source,
} from './skill.ts';
