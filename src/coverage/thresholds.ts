/**
 * Coverage threshold checking with strict mode
 */

import { CoverageThresholds, CoverageThresholdResult, CoverageData } from './types.js';

export interface ThresholdOptions {
  thresholds: CoverageThresholds;
  strict: boolean;
}

/**
 * Check coverage against thresholds
 */
export function checkThresholds(
  coverage: CoverageData,
  options: ThresholdOptions
): CoverageThresholdResult {
  const result: CoverageThresholdResult = {
    passed: true,
  };

  // Check lines_percent
  if (options.thresholds.lines_percent !== undefined) {
    result.lines_percent = coverage.lines_percent;
    result.lines_threshold = options.thresholds.lines_percent;
    if (coverage.lines_percent < options.thresholds.lines_percent) {
      result.passed = false;
    }
  }

  // Check branches_percent
  if (options.thresholds.branches_percent !== undefined) {
    result.branches_percent = coverage.branches_percent;
    result.branches_threshold = options.thresholds.branches_percent;
    if (coverage.branches_percent < options.thresholds.branches_percent) {
      result.passed = false;
    }
  }

  // Check functions_percent
  if (options.thresholds.functions_percent !== undefined && coverage.functions_percent !== undefined) {
    result.functions_percent = coverage.functions_percent;
    result.functions_threshold = options.thresholds.functions_percent;
    if (coverage.functions_percent < options.thresholds.functions_percent) {
      result.passed = false;
    }
  }

  return result;
}

/**
 * Format threshold result for output
 */
export function formatThresholdResult(
  result: CoverageThresholdResult,
  scriptName: string
): string {
  if (result.passed) {
    const parts: string[] = [];
    if (result.lines_percent !== undefined) {
      parts.push(`lines ${result.lines_percent}%`);
    }
    if (result.branches_percent !== undefined) {
      parts.push(`branches ${result.branches_percent}%`);
    }
    if (result.functions_percent !== undefined) {
      parts.push(`functions ${result.functions_percent}%`);
    }
    return `${scriptName}: PASS (${parts.join(', ')})`;
  } else {
    const failures: string[] = [];
    if (
      result.lines_percent !== undefined &&
      result.lines_threshold !== undefined &&
      result.lines_percent < result.lines_threshold
    ) {
      failures.push(`lines ${result.lines_percent}% < threshold ${result.lines_threshold}%`);
    }
    if (
      result.branches_percent !== undefined &&
      result.branches_threshold !== undefined &&
      result.branches_percent < result.branches_threshold
    ) {
      failures.push(`branches ${result.branches_percent}% < threshold ${result.branches_threshold}%`);
    }
    if (
      result.functions_percent !== undefined &&
      result.functions_threshold !== undefined &&
      result.functions_percent < result.functions_threshold
    ) {
      failures.push(`functions ${result.functions_percent}% < threshold ${result.functions_threshold}%`);
    }
    return `${scriptName}: FAIL (${failures.join(', ')})`;
  }
}

/**
 * Get exit code based on threshold result and strict mode
 */
export function getThresholdExitCode(result: CoverageThresholdResult, strict: boolean): number {
  if (result.passed) {
    return 0;
  }
  return strict ? 1 : 0;
}

/**
 * Warning message for threshold breach
 */
export function getThresholdWarning(result: CoverageThresholdResult): string | null {
  if (result.passed) {
    return null;
  }

  const parts: string[] = [];
  if (
    result.lines_percent !== undefined &&
    result.lines_threshold !== undefined &&
    result.lines_percent < result.lines_threshold
  ) {
    parts.push(`lines ${result.lines_percent}% < ${result.lines_threshold}%`);
  }
  if (
    result.branches_percent !== undefined &&
    result.branches_threshold !== undefined &&
    result.branches_percent < result.branches_threshold
  ) {
    parts.push(`branches ${result.branches_percent}% < ${result.branches_threshold}%`);
  }

  return `Coverage below threshold: ${parts.join(', ')}`;
}