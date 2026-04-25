/**
 * Tests for validation report formatters
 */

import { describe, it, expect } from '@jest/globals';
import { format, formatText, formatJson, formatMarkdown, formatHtml, formatGitHubAnnotation } from '../formatters.js';
import { ValidationReport } from '../types.js';

const createMockReport = (overrides?: Partial<ValidationReport>): ValidationReport => ({
  id: 'test-123',
  generated_at: '2026-04-24T10:00:00Z',
  version: 'v1.0.0',
  baseline_version: 'v0.9.0',
  tool_version: '0.1.0',
  overall_status: 'passed',
  overall_message: 'All scripts passed.',
  scripts: [
    { name: 'smoke', status: 'passed', duration_ms: 45230, tests_passed: 12, tests_failed: 0, exit_code: 0 },
    { name: 'e2e', status: 'passed', duration_ms: 182340, tests_passed: 48, tests_failed: 0, exit_code: 0 },
  ],
  triggers: ['cli'],
  ...overrides,
});

describe('formatters', () => {
  describe('formatText', () => {
    it('formats script results with icons and durations', () => {
      const report = createMockReport();
      const output = formatText(report);

      expect(output).toContain('✓ smoke');
      expect(output).toContain('passed');
      expect(output).toContain('45.2s');
      expect(output).toContain('3m2s');
    });

    it('includes coverage information when present', () => {
      const report = createMockReport({
        coverage: {
          overall_percent: 85.2,
          threshold_percent: 80,
          passed_threshold: true,
          by_script: [],
        },
      });
      const output = formatText(report);

      expect(output).toContain('Coverage: 85.2%');
      expect(output).toContain('threshold: 80%');
    });

    it('shows overall status', () => {
      const report = createMockReport();
      const output = formatText(report);

      expect(output).toContain('Overall: PASSED');
    });

    it('handles failed scripts', () => {
      const report = createMockReport({
        scripts: [{ name: 'smoke', status: 'failed', duration_ms: 1000, tests_passed: 10, tests_failed: 2, exit_code: 1 }],
        overall_status: 'failed',
      });
      const output = formatText(report);

      expect(output).toContain('✗ smoke');
      expect(output).toContain('Overall: FAILED');
    });
  });

  describe('formatJson', () => {
    it('returns valid JSON with all fields', () => {
      const report = createMockReport();
      const output = formatJson(report);

      const parsed = JSON.parse(output);
      expect(parsed.id).toBe('test-123');
      expect(parsed.version).toBe('v1.0.0');
      expect(parsed.scripts).toHaveLength(2);
    });
  });

  describe('formatMarkdown', () => {
    it('creates a table of script results', () => {
      const report = createMockReport();
      const output = formatMarkdown(report);

      expect(output).toContain('| Script | Status | Duration | Tests |');
      expect(output).toContain('| smoke |');
    });

    it('includes coverage summary', () => {
      const report = createMockReport({
        coverage: { overall_percent: 85.2, threshold_percent: 80, passed_threshold: true, by_script: [] },
      });
      const output = formatMarkdown(report);

      expect(output).toContain('**Coverage:** 85.2%');
    });
  });

  describe('formatHtml', () => {
    it('creates a valid HTML document', () => {
      const report = createMockReport();
      const output = formatHtml(report);

      expect(output).toContain('<!DOCTYPE html>');
      expect(output).toContain('</html>');
    });

    it('uses pass class for passed overall status', () => {
      const report = createMockReport();
      const output = formatHtml(report);

      expect(output).toContain('class="status pass"');
    });
  });

  describe('formatGitHubAnnotation', () => {
    it('outputs error annotations for failed scripts', () => {
      const report = createMockReport({
        scripts: [{ name: 'smoke', status: 'failed', duration_ms: 1000, tests_passed: 10, tests_failed: 2, exit_code: 1 }],
        overall_status: 'failed',
      });
      const output = formatGitHubAnnotation(report);

      expect(output).toContain('::error');
    });

    it('outputs warning for coverage below threshold', () => {
      const report = createMockReport({
        coverage: { overall_percent: 70, threshold_percent: 80, passed_threshold: false, by_script: [] },
      });
      const output = formatGitHubAnnotation(report);

      expect(output).toContain('::warning');
    });
  });

  describe('format (dispatcher)', () => {
    it('dispatches to text format', () => {
      const report = createMockReport();
      const output = format(report, 'text');

      expect(output).toContain('✓ smoke');
    });

    it('dispatches to json format', () => {
      const report = createMockReport();
      const output = format(report, 'json');

      expect(JSON.parse(output)).toBeDefined();
    });
  });
});