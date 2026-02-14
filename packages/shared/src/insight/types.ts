/**
 * Types for the Skill Insight pipeline
 *
 * Pipeline: sessions → facet extraction (Haiku) → insight agent (DeskhandAgent)
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
