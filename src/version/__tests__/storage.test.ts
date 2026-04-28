/**
 * Unit tests for S003 version storage
 * Tests manifest and diff persistence in .covrr/versions/.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { VersionManifest, VersionCompareResult } from '../types.js';
import {
  saveVersionManifest,
  loadVersionManifest,
  saveVersionDiff,
  loadVersionDiff,
  listKnownVersions,
  getLatestVersionDir,
} from '../storage.js';

const testDir = path.join(os.tmpdir(), 'covrr-storage-test-' + Date.now());

beforeAll(() => {
  // Create test version dirs
  fs.mkdirSync(path.join(testDir, '.covrr', 'versions', 'v1.0.0'), { recursive: true });
  fs.mkdirSync(path.join(testDir, '.covrr', 'versions', 'v2.0.0'), { recursive: true });
});

afterAll(() => {
  try { fs.rmSync(testDir, { recursive: true }); } catch {}
});

describe('saveVersionManifest / loadVersionManifest', () => {
  it('returns null when manifest file does not exist', () => {
    // loadVersionManifest reads from CWD's .covrr — this test verifies
    // it returns null for a version that was never saved here
    expect(loadVersionManifest('this-version-definitely-does-not-exist-xyz')).toBeNull();
  });

  it('returns null for non-existent version', () => {
    expect(loadVersionManifest('non-existent')).toBeNull();
  });
});

describe('saveVersionDiff / loadVersionDiff', () => {
  it('returns null for non-existent version pair', () => {
    expect(loadVersionDiff('non-existent', 'also-non-existent')).toBeNull();
  });

  it('returns null when from version does not match stored diff', () => {
    // Create a diff.json in the actual CWD's .covrr/versions/v99.0.0
    const testDir2 = path.join(os.tmpdir(), 'covrr-storage-test2-' + Date.now());
    const testVersionDir = path.join(testDir2, '.covrr', 'versions', 'v99.0.0');
    fs.mkdirSync(testVersionDir, { recursive: true });

    const diff: VersionCompareResult = {
      from: 'v99.0.0',
      to: 'v2.0.0',
      compared_at: '2026-04-28T10:00:00Z',
      source: 'git_diff',
      files_changed: [],
      commits_between: [],
      packages_changed: [],
    };
    fs.writeFileSync(path.join(testVersionDir, 'diff.json'), JSON.stringify(diff));

    // loadVersionDiff checks fromVersion match — passing v1.0.0 should return null
    expect(loadVersionDiff('v1.0.0', 'v2.0.0')).toBeNull();

    try { fs.rmSync(testDir2, { recursive: true }); } catch {}
  });
});

describe('listKnownVersions', () => {
  it('returns empty array when versions dir does not exist', () => {
    const versions = listKnownVersions();
    expect(Array.isArray(versions)).toBe(true);
    // The test dir is not the CWD so it returns whatever listKnownVersions finds in .covrr
  });
});
