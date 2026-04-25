/**
 * State file (.covrr/state.json) management.
 */

import fs from 'fs';
import path from 'path';
import { ConfigError } from '../config/loader.js';

export interface StateData {
  last_version?: string;
  last_version_at?: string;
  baseline_version?: string;
  last_run_duration_ms?: number;
  last_run_scripts?: string[];
  last_run_status?: 'passed' | 'failed';
  project_id?: string;
}

const STATE_FILENAME = 'state.json';

/**
 * Get the .covrr/ directory path relative to project root.
 * Uses CWD by default, or an explicit project root.
 */
export function getStateDir(projectRoot: string = process.cwd()): string {
  return path.join(projectRoot, '.covrr');
}

function getStatePath(projectRoot: string = process.cwd()): string {
  return path.join(getStateDir(projectRoot), STATE_FILENAME);
}

/**
 * Read and parse the state.json file.
 * Returns an empty object if the file doesn't exist.
 */
export function readState(projectRoot: string = process.cwd()): StateData {
  const statePath = getStatePath(projectRoot);

  if (!fs.existsSync(statePath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(statePath, 'utf-8');
    return JSON.parse(content) as StateData;
  } catch (e) {
    throw new ConfigError(`Failed to read state.json: ${(e as Error).message}`);
  }
}

/**
 * Write state data to .covrr/state.json.
 * Creates .covrr/ directory if it doesn't exist.
 */
export function writeState(state: StateData, projectRoot: string = process.cwd()): void {
  const stateDir = getStateDir(projectRoot);

  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }

  // Check if .covrr exists as a file (not directory)
  const stat = fs.existsSync(stateDir) ? fs.statSync(stateDir) : null;
  if (stat && !stat.isDirectory()) {
    throw new ConfigError('.covrr exists as a file — remove it first');
  }

  const statePath = path.join(stateDir, STATE_FILENAME);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Update specific fields in state, preserving others.
 */
export function updateState(updates: Partial<StateData>, projectRoot: string = process.cwd()): StateData {
  const current = readState(projectRoot);
  const updated = { ...current, ...updates };
  writeState(updated, projectRoot);
  return updated;
}

/**
 * Ensure the .covrr directory exists.
 * Throws if .covrr exists as a file instead of a directory.
 */
export function ensureCovrrDir(projectRoot: string = process.cwd()): void {
  const stateDir = getStateDir(projectRoot);

  if (fs.existsSync(stateDir)) {
    const stat = fs.statSync(stateDir);
    if (!stat.isDirectory()) {
      throw new ConfigError('.covrr exists as a file — remove it first');
    }
  } else {
    fs.mkdirSync(stateDir, { recursive: true });
  }
}

/**
 * Check if .covrr directory exists.
 */
export function covrrDirExists(projectRoot: string = process.cwd()): boolean {
  const stateDir = getStateDir(projectRoot);
  return fs.existsSync(stateDir) && fs.statSync(stateDir).isDirectory();
}
