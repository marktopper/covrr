/**
 * Tests for config env module
 * Note: does not use process.chdir to avoid race conditions with parallel test suites.
 */

import { applyEnvOverrides, getEnvVarMap } from '../env.js';
import { CovrrConfig } from '../schema.js';

describe('applyEnvOverrides', () => {
  it('returns original config when no env vars set', () => {
    const config: CovrrConfig = { scripts: {} };
    const result = applyEnvOverrides(config, {});
    expect(result).toEqual(config);
  });

  it('applies COVRR_BASELINE to version.baseline', () => {
    const config: CovrrConfig = { scripts: {} };
    const result = applyEnvOverrides(config, { COVRR_BASELINE: 'v1.2.0' });
    expect(result.version?.baseline).toBe('v1.2.0');
  });

  it('applies COVRR_VERSION to version.baseline', () => {
    const config: CovrrConfig = { scripts: {} };
    const result = applyEnvOverrides(config, { COVRR_VERSION: 'v2.0.0' });
    expect(result.version?.baseline).toBe('v2.0.0');
  });

  it('applies COVRR_BROWSER to defaults.browser', () => {
    const config: CovrrConfig = { scripts: {} };
    const result = applyEnvOverrides(config, { COVRR_BROWSER: 'firefox' });
    expect(result.defaults?.browser).toBe('firefox');
  });

  it('applies COVRR_WORKERS to defaults.workers', () => {
    const config: CovrrConfig = { scripts: {} };
    const result = applyEnvOverrides(config, { COVRR_WORKERS: '8' });
    expect(result.defaults?.workers).toBe(8);
  });

  it('applies COVRR_TIMEOUT_MS to defaults.timeout_ms', () => {
    const config: CovrrConfig = { scripts: {} };
    const result = applyEnvOverrides(config, { COVRR_TIMEOUT_MS: '30000' });
    expect(result.defaults?.timeout_ms).toBe(30000);
  });

  it('applies COVRR_THRESHOLD_LINES to coverage.thresholds.lines_percent', () => {
    const config: CovrrConfig = { scripts: {} };
    const result = applyEnvOverrides(config, { COVRR_THRESHOLD_LINES: '85.5' });
    expect(result.coverage?.thresholds?.lines_percent).toBe(85.5);
  });

  it('applies COVRR_THRESHOLD_BRANCHES to coverage.thresholds.branches_percent', () => {
    const config: CovrrConfig = { scripts: {} };
    const result = applyEnvOverrides(config, { COVRR_THRESHOLD_BRANCHES: '80' });
    expect(result.coverage?.thresholds?.branches_percent).toBe(80);
  });

  it('ignores invalid numeric env values', () => {
    const config: CovrrConfig = { scripts: {} };
    const result = applyEnvOverrides(config, { COVRR_WORKERS: 'not-a-number' });
    expect(result.defaults?.workers).toBeUndefined();
  });

  it('merges with existing version config', () => {
    const config: CovrrConfig = {
      scripts: {},
      version: { detect_from: 'git' },
    };
    const result = applyEnvOverrides(config, { COVRR_BASELINE: 'v1.2.0' });
    expect(result.version?.baseline).toBe('v1.2.0');
    expect(result.version?.detect_from).toBe('git');
  });
});

describe('getEnvVarMap', () => {
  it('returns all supported env var mappings', () => {
    const map = getEnvVarMap();
    expect(map.COVRR_CONFIG).toBe('config path');
    expect(map.COVRR_VERSION).toBe('version override');
    expect(map.COVRR_BASELINE).toBe('version.baseline');
    expect(map.COVRR_BROWSER).toBe('defaults.browser');
    expect(map.COVRR_WORKERS).toBe('defaults.workers');
    expect(map.COVRR_THRESHOLD_LINES).toBe('coverage.thresholds.lines_percent');
    expect(map.COVRR_THRESHOLD_BRANCHES).toBe('coverage.thresholds.branches_percent');
    expect(map.COVRR_THRESHOLD_FUNCTIONS).toBe('coverage.thresholds.functions_percent');
    expect(map.COVRR_TIMEOUT_MS).toBe('defaults.timeout_ms');
  });
});
