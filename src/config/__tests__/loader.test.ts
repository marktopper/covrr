/**
 * Tests for config loader
 */

import { loadConfig, parseConfig, ConfigError, ConfigNotFoundError } from '../loader.js';
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import path from 'path';
import os from 'os';

// Simple mock fs for testing
const testDir = path.join(os.tmpdir(), 'covrr-test-' + Date.now());

beforeAll(() => {
  mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  try { rmdirSync(testDir, { recursive: true }); } catch {}
});

describe('parseConfig', () => {
  it('parses minimal config', () => {
    const config = parseConfig('scripts: {}', 'covrr.yaml');
    expect(config.scripts).toEqual({});
  });

  it('parses full script definition', () => {
    const yaml = `
scripts:
  smoke:
    pattern: "tests/smoke/**/*.spec.ts"
    timeout_ms: 30000
    retry: 2
    env:
      BASE_URL: "http://localhost:3000"
`;
    const config = parseConfig(yaml, 'covrr.yaml');
    expect(config.scripts!.smoke.pattern).toBe('tests/smoke/**/*.spec.ts');
    expect(config.scripts!.smoke.timeout_ms).toBe(30000);
    expect(config.scripts!.smoke.retry).toBe(2);
    expect(config.scripts!.smoke.env).toEqual({ BASE_URL: 'http://localhost:3000' });
  });

  it('applies defaults to scripts', () => {
    const yaml = `
defaults:
  timeout_ms: 30000
  retry: 2
  workers: 8
  browser: firefox
scripts:
  smoke:
    pattern: "tests/**/*.ts"
`;
    const config = parseConfig(yaml, 'covrr.yaml');
    expect(config.defaults!.timeout_ms).toBe(30000);
    expect(config.defaults!.workers).toBe(8);
    expect(config.defaults!.browser).toBe('firefox');
  });

  it('throws on invalid YAML', () => {
    expect(() => parseConfig('not: valid: yaml: [', 'covrr.yaml')).toThrow(ConfigError);
  });

  it('throws on missing required pattern field', () => {
    const yaml = `
scripts:
  smoke:
    timeout_ms: 30000
`;
    expect(() => parseConfig(yaml, 'covrr.yaml')).toThrow(ConfigError);
  });

  it('throws on unknown script field', () => {
    const yaml = `
scripts:
  smoke:
    pattern: "tests/**/*.ts"
    unknown_field: "value"
`;
    // Unknown fields are allowed (warning only)
    const config = parseConfig(yaml, 'covrr.yaml');
    expect(config.scripts!.smoke).toBeDefined();
  });
});

describe('loadConfig', () => {
  it('throws ConfigNotFoundError when no config exists', () => {
    const originalCwd = process.cwd();
    process.chdir(testDir);
    try {
      // No config written — should fail
      expect(() => loadConfig()).toThrow(ConfigNotFoundError);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('loads covrr.yaml from current directory', () => {
    const testFile = path.join(testDir, 'covrr.yaml');
    writeFileSync(testFile, 'scripts: { smoke: { pattern: "tests/**/*.ts" } }');
    const originalCwd = process.cwd();
    process.chdir(testDir);
    try {
      const config = loadConfig();
      expect(config.scripts!.smoke.pattern).toBe('tests/**/*.ts');
    } finally {
      process.chdir(originalCwd);
    }
    unlinkSync(testFile);
  });

  it('loads from explicit --config path', () => {
    const testFile = path.join(testDir, 'custom.yaml');
    writeFileSync(testFile, 'scripts: { custom: { pattern: "custom/**/*.ts" } }');
    const config = loadConfig(testFile);
    expect(config.scripts!.custom.pattern).toBe('custom/**/*.ts');
    unlinkSync(testFile);
  });

  it('throws ConfigError for invalid config path', () => {
    expect(() => loadConfig(path.join(testDir, 'nonexistent.yaml'))).toThrow(ConfigError);
  });
});