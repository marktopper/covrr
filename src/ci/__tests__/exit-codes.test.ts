/**
 * Tests for exit codes
 */

import { describe, it, expect } from '@jest/globals';
import { ExitCode, determineExitCode, exitCodeDescription } from '../exit-codes.js';

describe('determineExitCode', () => {
  it('returns PASS when all scripts pass and coverage passes', () => {
    expect(determineExitCode(true, true, false)).toBe(ExitCode.PASS);
    expect(determineExitCode(true, true, true)).toBe(ExitCode.PASS);
  });

  it('returns FAIL when scripts fail', () => {
    expect(determineExitCode(false, true, false)).toBe(ExitCode.FAIL);
    expect(determineExitCode(false, true, true)).toBe(ExitCode.FAIL);
    expect(determineExitCode(false, false, false)).toBe(ExitCode.FAIL);
    expect(determineExitCode(false, false, true)).toBe(ExitCode.FAIL);
  });

  it('returns PASS when coverage fails in non-strict mode', () => {
    expect(determineExitCode(true, false, false)).toBe(ExitCode.PASS);
  });

  it('returns FAIL when coverage fails in strict mode', () => {
    expect(determineExitCode(true, false, true)).toBe(ExitCode.FAIL);
  });
});

describe('exitCodeDescription', () => {
  it('describes PASS exit code', () => {
    expect(exitCodeDescription(ExitCode.PASS)).toContain('passed');
  });

  it('describes FAIL exit code', () => {
    expect(exitCodeDescription(ExitCode.FAIL)).toContain('failed');
  });

  it('describes ERROR exit code', () => {
    expect(exitCodeDescription(ExitCode.ERROR)).toContain('Configuration');
  });
});
