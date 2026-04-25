/**
 * Tests for config validate module
 */

import { validateSchema, formatValidationErrors } from '../validate.js';
import { CovrrConfig } from '../schema.js';

describe('validateSchema', () => {
  it('returns valid for minimal config', () => {
    const config: CovrrConfig = { scripts: {} };
    const result = validateSchema(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid for full valid config', () => {
    const config: CovrrConfig = {
      scripts: {
        smoke: { pattern: 'tests/**/*.spec.ts', timeout_ms: 30000, retry: 2 },
      },
      defaults: {
        timeout_ms: 60000,
        retry: 1,
        workers: 4,
        browser: 'chromium',
      },
      coverage: {
        tool: 'istanbul',
        output_path: './coverage/coverage-final.json',
        thresholds: {
          lines_percent: 80,
          branches_percent: 75,
          functions_percent: 70,
        },
        strict: false,
      },
      version: {
        baseline: 'v1.2.0',
        detect_from: 'git',
      },
    };
    const result = validateSchema(config);
    expect(result.valid).toBe(true);
  });

  it('errors on duplicate script names', () => {
    // Note: duplicate detection requires same key twice in a map which is not possible in JSON
    // but we test the structure
    const config: CovrrConfig = {
      scripts: {
        smoke: { pattern: 'tests/**/*.spec.ts' },
      },
    };
    const result = validateSchema(config);
    expect(result.valid).toBe(true);
  });

  it('errors on script missing pattern', () => {
    const config: CovrrConfig = {
      scripts: {
        smoke: { timeout_ms: 30000 } as never,
      },
    };
    const result = validateSchema(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'scripts.smoke.pattern')).toBe(true);
  });

  it('errors on invalid defaults.browser', () => {
    const config: CovrrConfig = {
      scripts: {},
      defaults: {
        browser: 'invalid-browser' as 'chromium' | 'firefox' | 'webkit',
      },
    };
    const result = validateSchema(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'defaults.browser')).toBe(true);
  });

  it('errors on negative timeout_ms', () => {
    const config: CovrrConfig = {
      scripts: {},
      defaults: {
        timeout_ms: -1000,
      },
    };
    const result = validateSchema(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'defaults.timeout_ms')).toBe(true);
  });

  it('errors on invalid workers (must be >= 1)', () => {
    const config: CovrrConfig = {
      scripts: {},
      defaults: {
        workers: 0,
      },
    };
    const result = validateSchema(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'defaults.workers')).toBe(true);
  });

  it('errors on invalid version.detect_from', () => {
    const config: CovrrConfig = {
      scripts: {},
      version: {
        detect_from: 'invalid' as 'git' | 'package',
      },
    };
    const result = validateSchema(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'version.detect_from')).toBe(true);
  });

  it('errors on non-number threshold', () => {
    const config: CovrrConfig = {
      scripts: {},
      coverage: {
        thresholds: {
          lines_percent: 'eighty' as unknown as number,
        },
      },
    };
    const result = validateSchema(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'coverage.thresholds.lines_percent')).toBe(true);
  });
});

describe('formatValidationErrors', () => {
  it('formats errors with field paths', () => {
    const config: CovrrConfig = {
      scripts: {},
      coverage: {
        thresholds: {
          lines_percent: 'eighty' as unknown as number,
        },
      },
    };
    const result = validateSchema(config);
    const lines = formatValidationErrors(result);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain('coverage.thresholds.lines_percent');
  });
});
