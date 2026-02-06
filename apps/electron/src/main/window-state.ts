/**
 * Window state persistence
 *
 * Saves and restores window position and size.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getConfigDir } from '@deskhand/shared/config';

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

const WINDOW_STATE_FILE = 'window-state.json';

function getWindowStatePath(): string {
  return path.join(getConfigDir(), WINDOW_STATE_FILE);
}

export function loadWindowState(): WindowState | null {
  try {
    const filePath = getWindowStatePath();
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as WindowState;
  } catch {
    return null;
  }
}

export function saveWindowState(state: WindowState): void {
  try {
    const configDir = getConfigDir();
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const filePath = getWindowStatePath();
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  } catch {
    // Ignore errors
  }
}
