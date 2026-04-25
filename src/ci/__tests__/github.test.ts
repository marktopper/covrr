/**
 * Tests for GitHub integration
 */

import { describe, it, expect } from '@jest/globals';
import { formatPRComment, formatFailureComment } from '../github.js';
import type { ValidationReport } from '../types.js';

describe('formatPRComment', () => {
  it('formats a basic validation report', () => {
    const report: ValidationReport = {
      version: '1.0.0',
      baselineVersion: '0.9.0',
      generatedAt: '2024-01-01T00:00:00Z',
      scripts: [
        { name: 'smoke', status: 'passed', durationMs: 45000, testsPassed: 10, testsTotal: 10 },
      ],
      coverage: {
        linesPercent: 85.2,
        branchesPercent: 78.0,
        linesBefore: 83.4,
        linesAfter: 85.2,
        linesDelta: 1.8,
        branchesBefore: 78.5,
        branchesAfter: 78.0,
        branchesDelta: -0.5,
      },
      overallStatus: 'passed',
      threshold: 80,
      strict: true,
    };

    const comment = formatPRComment(report);
    expect(comment).toContain('## Covrr — Validation Report');
    expect(comment).toContain('**v1.0.0**');
    expect(comment).toContain('vs baseline **v0.9.0**');
    expect(comment).toContain('smoke');
    expect(comment).toContain('✓');
    expect(comment).toContain('85.2%');
  });

  it('handles report without baseline', () => {
    const report: ValidationReport = {
      version: '1.0.0',
      baselineVersion: null,
      generatedAt: '2024-01-01T00:00:00Z',
      scripts: [
        { name: 'smoke', status: 'passed', durationMs: 45000, testsPassed: 10, testsTotal: 10 },
      ],
      coverage: {
        linesPercent: 85.2,
        branchesPercent: 78.0,
        linesBefore: null,
        linesAfter: 85.2,
        linesDelta: null,
        branchesBefore: null,
        branchesAfter: 78.0,
        branchesDelta: null,
      },
      overallStatus: 'passed',
      threshold: null,
      strict: false,
    };

    const comment = formatPRComment(report);
    expect(comment).toContain('**v1.0.0**');
    expect(comment).not.toContain('vs baseline');
  });

  it('formats coverage delta correctly', () => {
    const report: ValidationReport = {
      version: '1.0.0',
      baselineVersion: '0.9.0',
      generatedAt: '2024-01-01T00:00:00Z',
      scripts: [],
      coverage: {
        linesPercent: 90.0,
        branchesPercent: 85.0,
        linesBefore: 85.0,
        linesAfter: 90.0,
        linesDelta: 5.0,
        branchesBefore: 80.0,
        branchesAfter: 85.0,
        branchesDelta: 5.0,
      },
      overallStatus: 'passed',
      threshold: 80,
      strict: false,
    };

    const comment = formatPRComment(report);
    expect(comment).toContain('**+5.0%**');
    expect(comment).toContain('**PASS**');
  });

  it('formats negative delta correctly', () => {
    const report: ValidationReport = {
      version: '1.0.0',
      baselineVersion: '0.9.0',
      generatedAt: '2024-01-01T00:00:00Z',
      scripts: [],
      coverage: {
        linesPercent: 75.0,
        branchesPercent: 70.0,
        linesBefore: 80.0,
        linesAfter: 75.0,
        linesDelta: -5.0,
        branchesBefore: 75.0,
        branchesAfter: 70.0,
        branchesDelta: -5.0,
      },
      overallStatus: 'failed',
      threshold: 80,
      strict: true,
    };

    const comment = formatPRComment(report);
    expect(comment).toContain('**-5.0%**');
    expect(comment).toContain('**FAIL**');
  });
});

describe('formatFailureComment', () => {
  it('formats coverage gate failure', () => {
    const report: ValidationReport = {
      version: '1.0.0',
      baselineVersion: null,
      generatedAt: '2024-01-01T00:00:00Z',
      scripts: [],
      coverage: {
        linesPercent: 71.0,
        branchesPercent: 65.0,
        linesBefore: 80.0,
        linesAfter: 71.0,
        linesDelta: -9.0,
        branchesBefore: 75.0,
        branchesAfter: 65.0,
        branchesDelta: -10.0,
      },
      overallStatus: 'failed',
      threshold: 80,
      strict: true,
    };

    const comment = formatFailureComment(report);
    expect(comment).toContain('## ⚠️ Covrr — Coverage Gate Failed');
    expect(comment).toContain('**v1.0.0**');
    expect(comment).toContain('Threshold: 80%');
    expect(comment).toContain('Actual: 71.0%');
    expect(comment).toContain('Coverage dropped **-9.0%** below threshold');
  });
});
