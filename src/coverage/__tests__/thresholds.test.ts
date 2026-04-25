/**
 * Tests for coverage thresholds
 */

import { describe, it, expect } from '@jest/globals';
import { checkThresholds, formatThresholdResult, getThresholdExitCode, getThresholdWarning } from '../thresholds.js';
import { CoverageThresholds, CoverageData } from '../types.js';

describe('checkThresholds', () => {
  const passingCoverage: CoverageData = {
    lines_total: 1000,
    lines_covered: 850,
    lines_percent: 85,
    branches_total: 200,
    branches_covered: 180,
    branches_percent: 90,
  };

  const failingCoverage: CoverageData = {
    lines_total: 1000,
    lines_covered: 650,
    lines_percent: 65,
    branches_total: 200,
    branches_covered: 140,
    branches_percent: 70,
  };

  it('passes when coverage meets thresholds', () => {
    const thresholds: CoverageThresholds = {
      lines_percent: 80,
      branches_percent: 75,
    };

    const result = checkThresholds(passingCoverage, { thresholds, strict: false });
    expect(result.passed).toBe(true);
    expect(result.lines_percent).toBe(85);
    expect(result.lines_threshold).toBe(80);
  });

  it('fails when coverage is below lines threshold', () => {
    const thresholds: CoverageThresholds = {
      lines_percent: 80,
    };

    const result = checkThresholds(failingCoverage, { thresholds, strict: false });
    expect(result.passed).toBe(false);
    expect(result.lines_percent).toBe(65);
    expect(result.lines_threshold).toBe(80);
  });

  it('fails when coverage is below branches threshold', () => {
    const thresholds: CoverageThresholds = {
      branches_percent: 80,
    };

    const result = checkThresholds(failingCoverage, { thresholds, strict: false });
    expect(result.passed).toBe(false);
    expect(result.branches_percent).toBe(70);
    expect(result.branches_threshold).toBe(80);
  });

  it('passes when coverage equals threshold', () => {
    const thresholds: CoverageThresholds = {
      lines_percent: 85,
    };

    const result = checkThresholds(passingCoverage, { thresholds, strict: false });
    expect(result.passed).toBe(true);
  });

  it('checks functions_percent when available', () => {
    const coverageWithFunctions: CoverageData = {
      ...passingCoverage,
      functions_total: 100,
      functions_covered: 95,
      functions_percent: 95,
    };

    const thresholds: CoverageThresholds = {
      functions_percent: 90,
    };

    const result = checkThresholds(coverageWithFunctions, { thresholds, strict: false });
    expect(result.passed).toBe(true);
  });

  it('skips functions check when coverage has no functions data', () => {
    const thresholds: CoverageThresholds = {
      functions_percent: 90,
    };

    const result = checkThresholds(passingCoverage, { thresholds, strict: false });
    expect(result.passed).toBe(true);
    expect(result.functions_percent).toBeUndefined();
  });
});

describe('formatThresholdResult', () => {
  it('formats passing result correctly', () => {
    const result = {
      passed: true,
      lines_percent: 85,
      lines_threshold: 80,
    };

    const output = formatThresholdResult(result, 'smoke');
    expect(output).toContain('smoke: PASS');
    expect(output).toContain('lines 85%');
  });

  it('formats failing result correctly', () => {
    const result = {
      passed: false,
      lines_percent: 65,
      lines_threshold: 80,
      branches_percent: 70,
      branches_threshold: 75,
    };

    const output = formatThresholdResult(result, 'e2e');
    expect(output).toContain('e2e: FAIL');
    expect(output).toContain('lines 65% < threshold 80%');
  });
});

describe('getThresholdExitCode', () => {
  it('returns 0 for passing result', () => {
    const result = { passed: true };
    expect(getThresholdExitCode(result, true)).toBe(0);
    expect(getThresholdExitCode(result, false)).toBe(0);
  });

  it('returns 0 for failing result in non-strict mode', () => {
    const result = { passed: false };
    expect(getThresholdExitCode(result, false)).toBe(0);
  });

  it('returns 1 for failing result in strict mode', () => {
    const result = { passed: false };
    expect(getThresholdExitCode(result, true)).toBe(1);
  });
});

describe('getThresholdWarning', () => {
  it('returns null for passing result', () => {
    const result = { passed: true };
    expect(getThresholdWarning(result)).toBeNull();
  });

  it('returns warning message for failing result', () => {
    const result = {
      passed: false,
      lines_percent: 65,
      lines_threshold: 80,
      branches_percent: 70,
      branches_threshold: 75,
    };

    const warning = getThresholdWarning(result);
    expect(warning).not.toBeNull();
    expect(warning).toContain('lines 65% < 80%');
  });
});