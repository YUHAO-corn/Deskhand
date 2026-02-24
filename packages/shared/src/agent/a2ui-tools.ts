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
    `Render an interactive playground in the Artifact panel.
Use this when the user needs to visually explore design options, configurations, or parameters.
You provide a JSON configuration with controls and preview template — the frontend renders it.
The user adjusts controls and copies the generated prompt back to chat.`,
    {
      title: z.string().describe('Playground title'),
      description: z.string().optional().describe('Brief description shown below title'),
      controls: z.array(Control).describe('Interactive controls (sliders, selects, colors, toggles)'),
      presets: z.array(Preset).optional().describe('Named presets that snap all controls to preset values'),
      previewTemplate: z.string().describe(
        'HTML template for the live preview area. Use {{controlId}} placeholders that get replaced with current values.'
      ),
      promptTemplate: z.string().describe(
        'Template for the copyable prompt output. Use {{controlId}} placeholders. Write as natural language instruction.'
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

// ─── MCP Server ───

export function createA2UIServer(templateDir: string) {
  return createSdkMcpServer({
    name: 'deskhand-a2ui',
    version: '1.0.0',
    tools: [createRenderPlaygroundTool(templateDir)],
  });
}
