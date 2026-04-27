/**
 * Tests for config search module
 * Uses absolute paths throughout to avoid process.chdir race conditions.
 */

import { findConfigSearchPath, resolveConfigPath } from '../search.js';
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import path from 'path';
import os from 'os';

const testDir = path.join(os.tmpdir(), 'covrr-search-test-' + Date.now());

beforeAll(() => {
  mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  try { rmdirSync(testDir, { recursive: true }); } catch {}
});

describe('findConfigSearchPath', () => {
  it('returns null when no config exists', () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);
    try {
      expect(findConfigSearchPath()).toBeNull();
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('returns ./covrr.yaml when it exists', () => {
    const testFile = path.join(testDir, 'covrr.yaml');
    writeFileSync(testFile, 'scripts: {}');
    const originalCwd = process.cwd();
    process.chdir(testDir);
    try {
      expect(findConfigSearchPath()).toBe('./covrr.yaml');
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe('resolveConfigPath', () => {
  it('returns explicit path when it exists', () => {
    const testFile = path.join(testDir, 'custom.yaml');
    writeFileSync(testFile, 'scripts: {}');
    const result = resolveConfigPath(testFile);
    expect(result).toBe(testFile);
    unlinkSync(testFile);
  });

  it('throws ConfigError when explicit path does not exist', () => {
    expect(() => resolveConfigPath(path.join(testDir, 'nonexistent.yaml'))).toThrow('Config file not found');
  });
});
