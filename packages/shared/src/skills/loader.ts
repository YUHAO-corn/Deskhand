/**
 * Skill loader for Deskhand
 *
 * Skills are loaded from:
 * - ~/.claude/skills/ (Claude Code compatible)
 * - ~/.deskhand/skills/ (Deskhand custom)
 *
 * Each skill is a directory with:
 * - SKILL.md: YAML frontmatter + Markdown content
 * - icon.svg/png/jpg: Optional icon
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import matter from 'gray-matter';
import type { Skill } from '@deskhand/core';

// ============ Paths ============

/** Get skill directories to scan */
export function getSkillDirs(): string[] {
  return [
    path.join(os.homedir(), '.claude', 'skills'),   // Claude Code compatible
    path.join(os.homedir(), '.deskhand', 'skills'), // Deskhand custom
  ];
}

// ============ Skill Loading ============

/**
 * Load all skills from disk
 */
export async function loadSkills(): Promise<Skill[]> {
  const skills: Skill[] = [];
  const dirs = getSkillDirs();

  for (const baseDir of dirs) {
    if (!fs.existsSync(baseDir)) continue;

    const skillDirs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(baseDir, d.name));

    for (const skillDir of skillDirs) {
      const skill = await loadSkillFromDir(skillDir);
      if (skill) {
        skills.push(skill);
      }
    }
  }

  return skills;
}

/**
 * Load a single skill from directory
 */
async function loadSkillFromDir(dir: string): Promise<Skill | null> {
  const skillMdPath = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const { data, content: mdContent } = matter(content);

    const id = path.basename(dir);
    const name = (data.name as string) ?? id;
    const description = (data.description as string) ?? '';

    // Find icon
    let icon: string | undefined;
    for (const ext of ['svg', 'png', 'jpg']) {
      const iconPath = path.join(dir, `icon.${ext}`);
      if (fs.existsSync(iconPath)) {
        icon = iconPath;
        break;
      }
    }

    return {
      id,
      name,
      description,
      content: mdContent.trim(),
      enabled: true,
      icon,
    };
  } catch {
    return null;
  }
}

/**
 * Get skill content for injection into system prompt
 */
export function getSkillContent(skill: Skill): string {
  return `<skill name="${skill.name}">
${skill.content}
</skill>`;
}
