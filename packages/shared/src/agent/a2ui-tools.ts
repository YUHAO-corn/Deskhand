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
  emoji: z.string().optional().describe('Emoji icon shown on the card'),
  previewHtml: z.string().optional().describe(
    'Optional HTML snippet for visual preview on the card. Uses ONLY inline styles.'
  ),
});

// ─── Template Injection ───

/** Inject JSON config into the HTML template by replacing the placeholder script */
function injectConfig(templateHtml: string, config: Record<string, unknown>): string {
  // Replace `window.__A2UI_CONFIG__ || {}` with the actual config
  return templateHtml.replace(
    'window.__A2UI_CONFIG__ || {}',
    JSON.stringify(config),
  );
}

// ─── Tool Definition ───

/** Create the render_playground tool with access to the template directory */
function createRenderPlaygroundTool(templateDir: string) {
  return tool(
    'render_playground',
    `Render an interactive playground in the Artifact panel. Two modes:

**Controls mode** (pass "controls"): Parameter tuning with sliders, selects, color pickers, toggles. User adjusts parameters and the prompt is auto-generated from control values.
**Options mode** (pass "options"): Gallery of complete options for the user to pick from. Each option is a card with label, description, and optional emoji/preview. User selects one and the prompt is auto-generated.

You only need to provide structured data (title, options, controls). The frontend auto-generates the preview and prompt output — do NOT include previewTemplate or promptTemplate.
Do NOT use this for complex visualizations that need custom HTML/JS (use the playground skill instead).`,
    {
      title: z.string().describe('Playground title'),
      description: z.string().optional().describe('Brief description shown below title'),
      options: z.array(PlaygroundOption).optional().describe(
        'Gallery options for "Pick a Style" mode. Each option is a selectable card. ' +
        'When provided, the playground renders as a gallery instead of a controls panel. ' +
        'The selected option ID is available as {{selected}} in templates.'
      ),
      controls: z.array(Control).optional().describe('Interactive controls (sliders, selects, colors, toggles). Optional when using options mode.'),
      presets: z.array(Preset).optional().describe('Named presets that snap all controls to preset values. Only used in controls mode.'),
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
        const fileName = `playground-${Date.now()}.html`;
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
        const fileName = `guided-form-${Date.now()}.html`;
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

// ─── MCP Server ───

export function createA2UIServer(templateDir: string) {
  return createSdkMcpServer({
    name: 'deskhand-a2ui',
    version: '1.0.0',
    tools: [createRenderPlaygroundTool(templateDir), createRenderGuidedFormTool(templateDir)],
  });
}
