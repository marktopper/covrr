/**
 * Tests for coverage diff calculation
 */

import { describe, it, expect } from '@jest/globals';
import { calculateDiff, formatDiff, hasDegradation } from '../diff.js';
import { CoverageReport } from '../types.js';

describe('calculateDiff', () => {
  const baseReport: CoverageReport = {
    version: '1.0.0',
    script_name: 'smoke',
    generated_at: '2026-04-24T10:00:00Z',
    tool: 'istanbul',
    summary: {
      lines_total: 1000,
      lines_covered: 800,
      lines_percent: 80,
      branches_total: 200,
      branches_covered: 160,
      branches_percent: 80,
    },
    files: [
      { path: 'src/a.ts', lines_total: 100, lines_covered: 90, lines_percent: 90 },
      { path: 'src/b.ts', lines_total: 100, lines_covered: 70, lines_percent: 70 },
    ],
  };

  it('calculates positive delta when coverage improves', () => {
    const improvedReport: CoverageReport = {
      ...baseReport,
      version: '1.1.0',
      summary: {
        ...baseReport.summary,
        lines_covered: 850,
        lines_percent: 85,
      },
    };

    const diff = calculateDiff(baseReport, improvedReport);

    expect(diff.version_from).toBe('1.0.0');
    expect(diff.version_to).toBe('1.1.0');
    expect(diff.lines_percent_delta).toBe(5);
    expect(diff.branches_percent_delta).toBe(0);
  });

  it('calculates negative delta when coverage degrades', () => {
    const degradedReport: CoverageReport = {
      ...baseReport,
      version: '1.1.0',
      summary: {
        ...baseReport.summary,
        lines_covered: 750,
        lines_percent: 75,
      },
    };

    const diff = calculateDiff(baseReport, degradedReport);

    expect(diff.lines_percent_delta).toBe(-5);
  });

  it('marks degraded files when delta is below -5%', () => {
    const degradedReport: CoverageReport = {
      ...baseReport,
      version: '1.1.0',
      summary: {
        ...baseReport.summary,
        lines_covered: 730,
        lines_percent: 73,
      },
      files: [
        { path: 'src/a.ts', lines_total: 100, lines_covered: 50, lines_percent: 50 },
      ],
    };

    const diff = calculateDiff(baseReport, degradedReport);

    expect(diff.degraded_files).toContain('src/a.ts');
  });

  it('handles new files not in old version', () => {
    const newFileReport: CoverageReport = {
      ...baseReport,
      version: '1.1.0',
      files: [
        ...baseReport.files!,
        { path: 'src/c.ts', lines_total: 100, lines_covered: 80, lines_percent: 80 },
      ],
    };

    const diff = calculateDiff(baseReport, newFileReport);

    const cFile = diff.files.find((f) => f.path === 'src/c.ts');
    expect(cFile).toBeDefined();
    expect(cFile!.delta).toBe(80);
  });

  it('handles null fromReport (first version)', () => {
    const newReport: CoverageReport = {
      ...baseReport,
      version: '1.0.0',
    };

    const diff = calculateDiff(null, newReport);

    expect(diff.version_from).toBe('unknown');
    expect(diff.version_to).toBe('1.0.0');
    expect(diff.files.length).toBeGreaterThan(0);
  });
});

describe('formatDiff', () => {
  it('formats diff with positive delta', () => {
    const diff = {
      version_from: '1.0.0',
      version_to: '1.1.0',
      lines_percent_delta: 5,
      branches_percent_delta: 0,
      files: [],
      degraded_files: [],
    };

    const output = formatDiff(diff);
    expect(output).toContain('+5');
  });

  it('formats diff with negative delta', () => {
    const diff = {
      version_from: '1.0.0',
      version_to: '1.1.0',
      lines_percent_delta: -5,
      branches_percent_delta: -2,
      files: [
        { path: 'src/a.ts', lines_percent_from: 90, lines_percent_to: 85, delta: -5 },
      ],
      degraded_files: ['src/a.ts'],
    };

    const output = formatDiff(diff);
    expect(output).toContain('-5');
    expect(output).toContain('Degraded files');
    expect(output).toContain('src/a.ts');
  });
});

describe('hasDegradation', () => {
  it('returns false when no degraded files', () => {
    const diff = {
      version_from: '1.0.0',
      version_to: '1.1.0',
      lines_percent_delta: 5,
      branches_percent_delta: 0,
      files: [],
      degraded_files: [],
    };

    expect(hasDegradation(diff)).toBe(false);
  });

  it('returns true when degraded files exist', () => {
    const diff = {
      version_from: '1.0.0',
      version_to: '1.1.0',
      lines_percent_delta: -10,
      branches_percent_delta: 0,
      files: [],
      degraded_files: ['src/a.ts'],
    };

    expect(hasDegradation(diff)).toBe(true);
  });
});