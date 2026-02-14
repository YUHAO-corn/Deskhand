/**
 * Skill Searcher — Stage 3 of the Insight Pipeline
 *
 * Searches skills.sh ecosystem for matching skills using `npx skills find`.
 * Only returns the top result if it's a high-confidence match.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { SkillSearchResult } from './types.ts';

const execAsync = promisify(exec);

/**
 * Parse the output of `npx skills find` to extract skill results.
 * Output format per result:
 *   owner/repo@skill-name  N installs
 *   └ https://skills.sh/owner/repo/skill-name
 */
function parseSkillsOutput(stdout: string): Array<{ name: string; installs: number; url: string; installId: string }> {
  const results: Array<{ name: string; installs: number; url: string; installId: string }> = [];
  const lines = stdout.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Strip ANSI escape codes
    const clean = line.replace(/\x1B\[[0-9;]*m/g, '').trim();

    // Match: owner/repo@skill-name  N installs
    const match = clean.match(/^([\w-]+\/[\w-]+@[\w-]+(?:\s[\w-]+)*)\s+(\d+)\s+installs?$/);
    if (match) {
      const installId = match[1]!;
      const installs = parseInt(match[2]!, 10);

      // Next line should be the URL
      const nextLine = lines[i + 1];
      const urlClean = nextLine ? nextLine.replace(/\x1B\[[0-9;]*m/g, '').trim() : '';
      const urlMatch = urlClean.match(/└\s+(https:\/\/skills\.sh\/.+)/);
      const url = urlMatch ? urlMatch[1]! : '';

      // Extract readable name from installId (e.g., "ab300819/skills@work-report" → "work-report")
      const namePart = installId.split('@')[1] || installId;

      results.push({ name: namePart, installs, url, installId });
    }
  }

  return results;
}

/**
 * Search skills.sh for a skill matching the given query.
 * Returns the top result if found, with install command.
 */
export async function searchSkills(query: string): Promise<SkillSearchResult> {
  try {
    console.log(`[SkillSearcher] Searching for: "${query}"`);
    const { stdout } = await execAsync(`npx skills find "${query}"`, {
      timeout: 30000,
      env: { ...process.env, NO_COLOR: '1' },
    });

    const results = parseSkillsOutput(stdout);
    console.log(`[SkillSearcher] Found ${results.length} results`);

    if (results.length === 0) {
      return { found: false };
    }

    // Return the top result (highest installs, already sorted by skills.sh)
    const top = results[0]!;
    return {
      found: true,
      skillName: top.name,
      skillDescription: `${top.name} (${top.installs} installs)`,
      installCommand: `npx skills add ${top.installId}`,
    };
  } catch (error) {
    console.error('[SkillSearcher] Search failed:', error);
    return { found: false };
  }
}
