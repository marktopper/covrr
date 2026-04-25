/**
 * Tests for version manifest module
 * Uses absolute paths to avoid process.chdir race conditions.
 */

import {
  sanitizeVersionDir,
  writeVersionManifest,
  readVersionManifest,
  listVersionDirs,
} from '../manifest.js';
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import path from 'path';
import os from 'os';

const testDir = path.join(os.tmpdir(), 'covrr-manifest-test-' + Date.now());

beforeAll(() => {
  mkdirSync(testDir, { recursive: true });
  // Ensure .covrr/versions exists
  const versionsDir = path.join(testDir, '.covrr/versions');
  try { rmdirSync(versionsDir); } catch {}
  mkdirSync(versionsDir, { recursive: true });
});

afterAll(() => {
  try { rmdirSync(testDir, { recursive: true }); } catch {}
});

describe('sanitizeVersionDir', () => {
  it('leaves semver unchanged', () => {
    expect(sanitizeVersionDir('v1.2.3')).toBe('v1.2.3');
  });

  it('replaces + with underscore', () => {
    expect(sanitizeVersionDir('v1.2.3+build')).toBe('v1.2.3_build');
  });

  it('replaces non-alphanumeric chars except . and - with underscore', () => {
    expect(sanitizeVersionDir('v1.2.3-beta.1')).toBe('v1.2.3-beta_1');
  });
});

describe('writeVersionManifest / readVersionManifest', () => {
  it('creates manifest.json for a version', () => {
    writeVersionManifest('v1.2.3', { baseline: 'v1.0.0', scripts: ['smoke'] }, testDir);
    const manifest = readVersionManifest('v1.2.3', testDir);
    expect(manifest).not.toBeNull();
    expect(manifest!.version).toBe('v1.2.3');
    expect(manifest!.baseline).toBe('v1.0.0');
    expect(manifest!.scripts).toEqual(['smoke']);
    expect(manifest!.created_at).toBeDefined();
  });

  it('returns null when manifest does not exist', () => {
    expect(readVersionManifest('nonexistent-version', testDir)).toBeNull();
  });
});

describe('listVersionDirs', () => {
  it('lists version directories', () => {
    writeVersionManifest('v1.0.0', {}, testDir);
    writeVersionManifest('v2.0.0', {}, testDir);
    const dirs = listVersionDirs(testDir);
    expect(dirs).toContain('v1.0.0');
    expect(dirs).toContain('v2.0.0');
  });
});
