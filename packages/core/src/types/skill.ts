/**
 * Skill types for Deskhand
 *
 * Skills are AI capability extensions defined via SKILL.md files.
 * Compatible with Claude Code skill format.
 */

// ============ Skill ============

/** Skill definition */
export interface Skill {
  id: string;                        // Unique identifier (slug)
  name: string;                      // Display name
  description: string;               // Short description
  content: string;                   // SKILL.md content
  enabled: boolean;                  // Whether enabled
  icon?: string;                     // Icon path or URL
}

// ============ Source (MCP) ============

/** MCP configuration */
export interface McpConfig {
  url: string;                       // MCP server URL
  authType?: 'bearer' | 'oauth';     // Auth type
}

/** Data source (MCP server) */
export interface Source {
  slug: string;                      // Unique identifier
  name: string;                      // Display name
  type: 'mcp';                       // Type (only MCP for now)
  config: McpConfig;                 // MCP config
  enabled: boolean;                  // Whether enabled
}
