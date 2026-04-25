/**
 * Tests for report history commands
 */

import { describe, it, expect } from '@jest/globals';
import { listHistoricalReports, showReport, formatReportList } from '../history.js';

describe('history', () => {
  describe('listHistoricalReports', () => {
    it('returns array of report summaries', () => {
      const reports = listHistoricalReports(5);

      expect(Array.isArray(reports)).toBe(true);
    });
  });

  describe('showReport', () => {
    it('returns null for non-existent report', () => {
      const result = showReport('non-existent-ref-xyz');
      expect(result).toBeNull();
    });
  });

  describe('formatReportList', () => {
    it('formats reports for console output', () => {
      const reports = [
        { version: 'v1.0.0', timestamp: '2026-04-24 10:00', status: 'passed', path: 'report1.json' },
        { version: 'v1.1.0', timestamp: '2026-04-25 11:00', status: 'failed', path: 'report2.json' },
      ];

      const output = formatReportList(reports);

      expect(output).toContain('v1.0.0');
      expect(output).toContain('PASS');
      expect(output).toContain('v1.1.0');
      expect(output).toContain('FAIL');
    });
  });
});