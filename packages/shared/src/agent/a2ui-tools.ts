/**
 * A2UI Tools - Agent-to-UI interactive component tools
 *
 * Registers custom MCP tools that let the Agent render
 * pre-built UI components by outputting JSON configuration.
 * The tool handler injects config into an HTML template and
 * writes a temp file. The frontend opens it in the Artifact panel.
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─── Guided Form Step Schema ───

const ChoiceOption = z.object({
  value: z.string(),
  label: z.string(),
});

const BaseStep = z.object({
  id: z.string().describe('Unique step ID, used in promptTemplate as {{id}}'),
  question: z.string().describe('The question text shown to the user'),
  hint: z.string().optional().describe('Optional hint text below the question'),
});

const ChoiceStep = BaseStep.extend({
  type: z.literal('choice'),
  options: z.array(ChoiceOption).describe('Single-select options'),
});

const MultiChoiceStep = BaseStep.extend({
  type: z.literal('multi-choice'),
  options: z.array(ChoiceOption).describe('Multi-select options'),
});

const TextStep = BaseStep.extend({
  type: z.literal('text'),
  placeholder: z.string().optional(),
});

const TextareaStep = BaseStep.extend({
  type: z.literal('textarea'),
  placeholder: z.string().optional(),
});

const SliderStep = BaseStep.extend({
  type: z.literal('slider'),
  min: z.number(),
  max: z.number(),
  step: z.number().optional(),
  defaultValue: z.number(),
  unit: z.string().optional(),
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
});

const FormStep = z.discriminatedUnion('type', [ChoiceStep, MultiChoiceStep, TextStep, TextareaStep, SliderStep]);

// ─── Tournament Schema ───

const TournamentCard = z.object({
  emoji: z.string().describe('Emoji representing this option'),
  title: z.string().describe('Short title'),
  description: z.string().describe('One-sentence description'),
});

const TournamentRound = z.object({
  left: TournamentCard,
  right: TournamentCard,
});

// ─── Control Schema ───

const SliderControl = z.object({
  type: z.literal('slider'),
  id: z.string().describe('Unique control ID'),
  label: z.string(),
  min: z.number(),
  max: z.number(),
  step: z.number().optional(),
  defaultValue: z.number(),
  unit: z.string().optional().describe('Display unit, e.g. "px", "%"'),
});

const SelectControl = z.object({
  type: z.literal('select'),
  id: z.string().describe('Unique control ID'),
  label: z.string(),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })),
  defaultValue: z.string(),
});

const ColorControl = z.object({
  type: z.literal('color'),
  id: z.string().describe('Unique control ID'),
  label: z.string(),
  defaultValue: z.string().describe('Hex color, e.g. "#3b82f6"'),
});

const ToggleControl = z.object({
  type: z.literal('toggle'),
  id: z.string().describe('Unique control ID'),
  label: z.string(),
  defaultValue: z.boolean(),
});

const Control = z.discriminatedUnion('type', [SliderControl, SelectControl, ColorControl, ToggleControl]);

// ─── Preset Schema ───

const Preset = z.object({
  name: z.string(),
  description: z.string().optional(),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

// ─── Option Schema (for gallery/options mode) ───

const PlaygroundOption = z.object({
  id: z.string().describe('Unique option ID'),
  label: z.string().describe('Display name'),
  description: z.string().optional().describe('Short description'),
  previewHtml: z.string().optional().describe(
    'HTML snippet for visual preview. Use ONLY inline styles (no <style> or <script> tags). Use CSS variables var(--controlId) for dynamic parts.'
  ),
});

// ─── Template Injection ───

/** Inject JSON config into the HTML template by replacing the placeholder script */
function injectConfig(templateHtml: string, config: Record<string, unknown>): string {
  // Escape </script> and </style> inside JSON to prevent breaking the outer <script> tag
  const json = JSON.stringify(config).replace(/<\/(script|style)/gi, '<\\/$1');
  return templateHtml.replace(
    'window.__A2UI_CONFIG__ || {}',
    json,
  );
}

// ─── Tool Definition ───

/** Create the render_playground tool with access to the template directory */
function createRenderPlaygroundTool(templateDir: string) {
  return tool(
    'render_playground',
    `Render an interactive playground in the Artifact panel. The template provides the layout (left controls, right preview, bottom prompt bar), interaction logic, and styling. You provide the content.

**Controls mode** (pass "controls"): Parameter tuning with sliders, selects, color pickers, toggles.
**Options mode** (pass "options"): Gallery of options for the user to pick from. Each option should include previewHtml showing what it looks like visually.
**Mixed mode** (pass both): User picks an option, then fine-tunes with controls.

For visual preview: write previewHtml as standard HTML/CSS. Use CSS variables var(--controlId) to reference control values — the template auto-binds each control's id as a CSS variable. For example, a control with id "spacing" becomes var(--spacing) in your HTML.

The prompt output is auto-generated from the user's selections. Do NOT write promptTemplate.
Do NOT use this for complex visualizations that need custom JS logic (use the playground skill instead).`,
    {
      title: z.string().describe('Playground title'),
      description: z.string().optional().describe('Brief description shown below title'),
      options: z.array(PlaygroundOption).optional().describe(
        'Gallery options. Each option should have previewHtml with a visual preview (HTML/CSS). ' +
        'Use CSS variables var(--controlId) in previewHtml to let controls affect the preview dynamically.'
      ),
      controls: z.array(Control).optional().describe('Interactive controls (sliders, selects, colors, toggles). Each control id becomes a CSS variable var(--id) usable in previewHtml.'),
      presets: z.array(Preset).optional().describe('Named presets that snap all controls to preset values. Only used in controls mode.'),
      previewHtml: z.string().optional().describe(
        'HTML/CSS for the preview area. Use ONLY inline styles (no <style> or <script> tags). ' +
        'Reference control values with CSS variables: var(--controlId). ' +
        'In options mode, each option\'s previewHtml is used instead; this field serves as fallback.'
      ),
    },
    async (args) => {
      try {
        // Read the HTML template
        const templatePath = path.join(templateDir, 'playground.html');
        const templateHtml = fs.readFileSync(templatePath, 'utf-8');

        // Inject the config
        const html = injectConfig(templateHtml, args as Record<string, unknown>);

        // Write to temp file
        const tmpDir = path.join(os.tmpdir(), 'deskhand-a2ui');
        fs.mkdirSync(tmpDir, { recursive: true });
        const slug = args.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
        const fileName = `${slug || 'playground'}.html`;
        const filePath = path.join(tmpDir, fileName);
        fs.writeFileSync(filePath, html, 'utf-8');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ a2ui: true, filePath, title: args.title }),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error rendering playground: ${err}`,
          }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
  );
}

/** Create the render_guided_form tool with access to the template directory */
function createRenderGuidedFormTool(templateDir: string) {
  return tool(
    'render_guided_form',
    `Render a guided form in the Artifact panel to collect structured information from the user.
Use this when you need to gather multiple pieces of information (tone, audience, length, topic, etc.) before performing a task.
Instead of asking questions one by one in chat, present them as an interactive step-by-step form.
The user fills in answers, reviews a summary, and copies the generated prompt back to chat.`,
    {
      title: z.string().describe('Form title, e.g. "Let me understand your needs"'),
      description: z.string().optional().describe('Brief description shown below title'),
      steps: z.array(FormStep).describe('Ordered list of questions. Each step is shown one at a time.'),
      promptTemplate: z.string().describe(
        'Template for the copyable prompt output. Use {{stepId}} placeholders that get replaced with user answers.'
      ),
    },
    async (args) => {
      try {
        const templatePath = path.join(templateDir, 'guided-form.html');
        const templateHtml = fs.readFileSync(templatePath, 'utf-8');
        const html = injectConfig(templateHtml, args as Record<string, unknown>);

        const tmpDir = path.join(os.tmpdir(), 'deskhand-a2ui');
        fs.mkdirSync(tmpDir, { recursive: true });
        const formSlug = args.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
        const fileName = `${formSlug || 'guided-form'}.html`;
        const filePath = path.join(tmpDir, fileName);
        fs.writeFileSync(filePath, html, 'utf-8');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ a2ui: true, filePath, title: args.title }),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error rendering guided form: ${err}`,
          }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
  );
}

/** Create the render_tournament tool with access to the template directory */
function createRenderTournamentTool(templateDir: string) {
  return tool(
    'render_tournament',
    `Render a tournament (two-by-two comparison) in the Artifact panel. Users make quick binary choices across multiple rounds to discover their preferences.

Use this when the user doesn't know what they want and needs to discover preferences through comparison. Each round shows two cards (emoji + title + description), user picks one, advances to next round.

The result is a selection log showing what the user chose in each round. You can use this for:
- Elimination tournament: same-category options (8 foods → 4 rounds of 1v1 → 2 semifinals → 1 final = 7 rounds total)
- Preference discovery: cross-dimension comparisons (beach vs mountain, budget vs comfort, food vs outdoor = 3 rounds)

The template doesn't distinguish between these modes — you decide how to structure the rounds based on context. For elimination tournaments, design the bracket yourself (pair up all options, then pair up winners, etc.).`,
    {
      title: z.string().describe('Tournament title, e.g. "五一去哪玩" or "今晚吃什么"'),
      description: z.string().optional().describe('Brief description shown below title'),
      rounds: z.array(TournamentRound).describe('Ordered list of rounds. Each round presents two options for the user to choose between.'),
    },
    async (args) => {
      try {
        const templatePath = path.join(templateDir, 'tournament.html');
        const templateHtml = fs.readFileSync(templatePath, 'utf-8');
        const html = injectConfig(templateHtml, args as Record<string, unknown>);

        const tmpDir = path.join(os.tmpdir(), 'deskhand-a2ui');
        fs.mkdirSync(tmpDir, { recursive: true });
        const slug = args.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
        const fileName = `${slug || 'tournament'}.html`;
        const filePath = path.join(tmpDir, fileName);
        fs.writeFileSync(filePath, html, 'utf-8');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ a2ui: true, filePath, title: args.title }),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error rendering tournament: ${err}`,
          }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
  );
}

// ─── MCP Server ───

export function createA2UIServer(templateDir: string) {
  return createSdkMcpServer({
    name: 'deskhand-a2ui',
    version: '1.0.0',
    tools: [
      createRenderPlaygroundTool(templateDir),
      createRenderGuidedFormTool(templateDir),
      createRenderTournamentTool(templateDir),
    ],
  });
}
