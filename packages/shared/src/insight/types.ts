/**
 * Types for the Skill Insight pipeline
 *
 * Pipeline: sessions → facet extraction (Haiku) → pattern analysis (Sonnet) → insight report
 */

/** Facet extracted from a single session */
export interface SessionFacet {
  sessionId: string;
  /** What the user was trying to accomplish */
  userGoal: string;
  /** Task category (e.g., "writing", "coding", "design", "data analysis") */
  taskType: string;
  /** Specific workflow steps the user followed */
  workflowSteps: string[];
  /** Friction points or repeated corrections */
  frictionPoints: string[];
  /** Key phrases or instructions the user repeated */
  keyPhrases: string[];
  /** Timestamp of extraction */
  extractedAt: number;
}

/** A repeated pattern found across sessions */
export interface RepeatedPattern {
  /** Human-readable description of the pattern */
  description: string;
  /** How many sessions exhibited this pattern */
  sessionCount: number;
  /** Session IDs that match */
  sessionIds: string[];
  /** Suggested skill description (what a skill could automate) */
  skillOpportunity: string;
}

/** Result of cross-session pattern analysis */
export interface InsightResult {
  /** Whether valuable patterns were found (quality gate) */
  hasValueablePatterns: boolean;
  /** Discovered repeated patterns, sorted by frequency */
  patterns: RepeatedPattern[];
  /** Human-readable summary report (markdown) */
  report: string;
}
