/**
 * Tests for state module
 * Uses absolute paths throughout to avoid process.chdir race conditions.
 */

import { readState, writeState, updateState, ensureCovrrDir, covrrDirExists, StateData } from '../state.js';
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import path from 'path';
import os from 'os';
import { ConfigError } from '../../config/loader.js';

const testDir = path.join(os.tmpdir(), 'covrr-state-test-' + Date.now());

beforeAll(() => {
  mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  try { rmdirSync(testDir, { recursive: true }); } catch {}
});

describe('readState / writeState', () => {
  it('returns empty object when state.json does not exist', () => {
    expect(readState(testDir)).toEqual({});
  });

  it('writes and reads state correctly', () => {
    const state: StateData = {
      last_version: 'v1.2.0',
      last_version_at: '2026-04-24T10:00:00Z',
      baseline_version: 'v1.0.0',
      last_run_duration_ms: 274592,
      last_run_scripts: ['smoke', 'e2e'],
      last_run_status: 'passed',
    };
    writeState(state, testDir);
    expect(readState(testDir)).toEqual(state);
    unlinkSync(path.join(testDir, '.covrr/state.json'));
  });

  it('creates .covrr directory if it does not exist', () => {
    const state: StateData = { last_version: 'v1.0.0' };
    writeState(state, testDir);
    expect(covrrDirExists(testDir)).toBe(true);
    unlinkSync(path.join(testDir, '.covrr/state.json'));
  });
});

describe('updateState', () => {
  it('merges updates into existing state', () => {
    const initial: StateData = {
      last_version: 'v1.0.0',
      last_version_at: '2026-04-24T10:00:00Z',
    };
    writeState(initial, testDir);

    const updated = updateState({ last_version: 'v1.1.0', last_run_status: 'passed' }, testDir);
    expect(updated.last_version).toBe('v1.1.0');
    expect(updated.last_version_at).toBe('2026-04-24T10:00:00Z'); // preserved
    expect(updated.last_run_status).toBe('passed');

    unlinkSync(path.join(testDir, '.covrr/state.json'));
  });
});

describe('ensureCovrrDir', () => {
  it('creates .covrr directory', () => {
    // Clean first
    try { rmdirSync(path.join(testDir, '.covrr'), { recursive: true }); } catch {}
    ensureCovrrDir(testDir);
    expect(covrrDirExists(testDir)).toBe(true);
  });

  it('throws if .covrr exists as a file', () => {
    // Clean up any existing .covrr directory first
    try { rmdirSync(path.join(testDir, '.covrr'), { recursive: true }); } catch {}
    try { unlinkSync(path.join(testDir, '.covrr')); } catch {}
    writeFileSync(path.join(testDir, '.covrr'), 'not a directory');
    expect(() => ensureCovrrDir(testDir)).toThrow(ConfigError);
    unlinkSync(path.join(testDir, '.covrr'));
  });
});

describe('covrrDirExists', () => {
  it('returns false when .covrr does not exist', () => {
    try { rmdirSync(path.join(testDir, '.covrr'), { recursive: true }); } catch {}
    expect(covrrDirExists(testDir)).toBe(false);
  });
});
