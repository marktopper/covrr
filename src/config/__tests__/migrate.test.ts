/**
 * Tests for config migrate module
 */

import { readFormatVersion, migrateConfig, backupConfig, migrateConfigWithBackup } from '../migrate.js';
import { writeFileSync, unlinkSync, readFileSync, mkdirSync, rmdirSync } from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';

const testDir = path.join(os.tmpdir(), 'covrr-migrate-test-' + Date.now());

beforeAll(() => {
  mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  try { rmdirSync(testDir, { recursive: true }); } catch {}
});

describe('readFormatVersion', () => {
  it('returns null for config without version marker', () => {
    const content = yaml.dump({ scripts: {} });
    expect(readFormatVersion(content)).toBeNull();
  });

  it('returns version string when marker present', () => {
    const content = yaml.dump({ scripts: {}, covrr_format_version: '1' });
    expect(readFormatVersion(content)).toBe('1');
  });
});

describe('migrateConfig', () => {
  it('returns unchanged when already at current version', () => {
    const content = yaml.dump({ scripts: {}, covrr_format_version: '1' });
    const result = migrateConfig(content);
    expect(result.migrated).toBe(false);
    expect(result.content).toBe(content);
  });

  it('adds version marker when missing', () => {
    const content = yaml.dump({ scripts: {} });
    const result = migrateConfig(content);
    expect(result.migrated).toBe(true);
    expect(result.content).toContain('covrr_format_version');
  });
});

describe('backupConfig', () => {
  it('creates backup file with timestamp', () => {
    const testFile = path.join(testDir, 'covrr.yaml');
    writeFileSync(testFile, 'scripts: {}');
    const backupPath = backupConfig(testFile);
    expect(backupPath).toMatch(/covrr\.yaml\.backup\.\d{4}-\d{2}-\d{2}T/);
    expect(readFileSync(backupPath, 'utf-8')).toBe('scripts: {}');
    unlinkSync(testFile);
    try { unlinkSync(backupPath); } catch {}
  });
});

describe('migrateConfigWithBackup', () => {
  it('returns migrated false when no migration needed', () => {
    const testFile = path.join(testDir, 'covrr.yaml');
    writeFileSync(testFile, yaml.dump({ scripts: {}, covrr_format_version: '1' }));
    const result = migrateConfigWithBackup(testFile);
    expect(result.migrated).toBe(false);
    unlinkSync(testFile);
  });

  it('backups original when migration occurs', () => {
    const testFile = path.join(testDir, 'covrr.yaml');
    writeFileSync(testFile, yaml.dump({ scripts: {} }));
    const result = migrateConfigWithBackup(testFile);
    expect(result.migrated).toBe(true);
    expect(result.backupPath).toMatch(/covrr\.yaml\.backup\./);
    expect(readFileSync(testFile, 'utf-8')).toContain('covrr_format_version');
    unlinkSync(testFile);
    try { unlinkSync(result.backupPath!); } catch {}
  });
});