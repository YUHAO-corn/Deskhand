/**
 * Clipboard Monitor
 *
 * Polls the system clipboard every 500ms, detects changes via content hashing,
 * and persists history to ~/.deskhand/clipboard-history.jsonl
 */

import { clipboard } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { getConfigDir } from '@deskhand/shared/config';

// ============ Types ============

export interface ClipboardEntry {
  id: string;
  type: 'text' | 'image' | 'link';
  content: string; // text content or image file path
  preview: string; // truncated preview for display
  timestamp: number;
  charCount?: number;
  fileSize?: number; // for images, in bytes
}

// ============ Constants ============

const POLL_INTERVAL = 500; // ms
const MAX_ENTRIES = 500;
const HISTORY_FILE = 'clipboard-history.jsonl';
const PREVIEW_LENGTH = 100;

// ============ State ============

let timer: ReturnType<typeof setInterval> | null = null;
let lastContentHash = '';

// ============ Paths ============

function getHistoryPath(): string {
  return path.join(getConfigDir(), HISTORY_FILE);
}

function getClipboardImagesDir(): string {
  return path.join(getConfigDir(), 'clipboard-images');
}

// ============ Helpers ============

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function detectType(text: string): 'text' | 'link' {
  const trimmed = text.trim();
  if (/^https?:\/\/\S+$/.test(trimmed)) return 'link';
  return 'text';
}

function makePreview(text: string): string {
  const oneLine = text.replace(/\n/g, ' ').trim();
  if (oneLine.length <= PREVIEW_LENGTH) return oneLine;
  return oneLine.slice(0, PREVIEW_LENGTH) + '…';
}

function generateId(): string {
  return crypto.randomUUID();
}

// ============ Storage ============

function ensureDirs(): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  const imagesDir = getClipboardImagesDir();
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
}

function appendEntry(entry: ClipboardEntry): void {
  ensureDirs();
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(getHistoryPath(), line, 'utf-8');
}

/** Load all entries from JSONL file */
export function loadHistory(): ClipboardEntry[] {
  const filePath = getHistoryPath();
  if (!fs.existsSync(filePath)) return [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.map((line) => JSON.parse(line) as ClipboardEntry);
  } catch {
    return [];
  }
}

/** Enforce max entries limit by rewriting file */
function enforceLimit(): void {
  const entries = loadHistory();
  if (entries.length <= MAX_ENTRIES) return;

  const trimmed = entries.slice(entries.length - MAX_ENTRIES);
  const content = trimmed.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(getHistoryPath(), content, 'utf-8');
}

// ============ Polling ============

function checkClipboard(): void {
  try {
    const text = clipboard.readText();
    if (!text || text.trim().length === 0) return;

    const hash = hashContent(text);
    if (hash === lastContentHash) return;

    lastContentHash = hash;

    const type = detectType(text);
    const entry: ClipboardEntry = {
      id: generateId(),
      type,
      content: text,
      preview: makePreview(text),
      timestamp: Date.now(),
      charCount: text.length,
    };

    appendEntry(entry);
    enforceLimit();
  } catch {
    // Silently ignore clipboard read errors
  }
}

// ============ Public API ============

export function startClipboardMonitor(): void {
  if (timer) return;

  // Initialize hash with current clipboard content to avoid recording
  // whatever is already on the clipboard when the app starts
  try {
    const current = clipboard.readText();
    if (current) {
      lastContentHash = hashContent(current);
    }
  } catch {
    // ignore
  }

  timer = setInterval(checkClipboard, POLL_INTERVAL);
}

export function stopClipboardMonitor(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
