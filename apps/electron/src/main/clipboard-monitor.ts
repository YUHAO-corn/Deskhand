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
let lastTextHash = '';
let lastImageHash = '';

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

function hashBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
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
    // Check text first (text takes priority over image)
    const text = clipboard.readText();
    if (text && text.trim().length > 0) {
      const textHash = hashContent(text);
      if (textHash !== lastTextHash) {
        lastTextHash = textHash;
        const type = detectType(text);
        appendEntry({
          id: generateId(),
          type,
          content: text,
          preview: makePreview(text),
          timestamp: Date.now(),
          charCount: text.length,
        });
        enforceLimit();
        return;
      }
    }

    // Check image if text didn't change
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      const pngBuffer = image.toPNG();
      const imageHash = hashBuffer(pngBuffer);
      if (imageHash !== lastImageHash) {
        lastImageHash = imageHash;
        const id = generateId();
        const size = image.getSize();

        // Save image to disk
        ensureDirs();
        const imagePath = path.join(getClipboardImagesDir(), `${id}.png`);
        fs.writeFileSync(imagePath, pngBuffer);

        appendEntry({
          id,
          type: 'image',
          content: imagePath,
          preview: `Image (${size.width}×${size.height})`,
          timestamp: Date.now(),
          fileSize: pngBuffer.length,
        });
        enforceLimit();
      }
    }
  } catch {
    // Silently ignore clipboard read errors
  }
}

// ============ Public API ============

export function startClipboardMonitor(): void {
  if (timer) return;

  // Initialize hashes with current clipboard content to avoid recording
  // whatever is already on the clipboard when the app starts
  try {
    const current = clipboard.readText();
    if (current) {
      lastTextHash = hashContent(current);
    }
    const currentImage = clipboard.readImage();
    if (!currentImage.isEmpty()) {
      lastImageHash = hashBuffer(currentImage.toPNG());
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
