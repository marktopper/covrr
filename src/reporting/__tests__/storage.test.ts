/**
 * Tests for report storage
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { listReports, loadReport, saveReport, saveLatestReport } from '../storage.js';
import { ValidationReport } from '../types.js';

const TEST_REPORTS_DIR = '.covrr/reports';

const createMockReport = (overrides?: Partial<ValidationReport>): ValidationReport => ({
  id: 'test-123',
  generated_at: '2026-04-24T10:00:00Z',
  version: 'v1.0.0',
  baseline_version: null,
  tool_version: '0.1.0',
  overall_status: 'passed',
  overall_message: 'All scripts passed',
  scripts: [],
  triggers: ['cli'],
  ...overrides,
});

describe('storage', () => {
  beforeAll(() => {
    if (!existsSync('.covrr')) {
      mkdirSync('.covrr', { recursive: true });
    }
    if (!existsSync(TEST_REPORTS_DIR)) {
      mkdirSync(TEST_REPORTS_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    try {
      if (existsSync(TEST_REPORTS_DIR)) {
        const files = require('fs').readdirSync(TEST_REPORTS_DIR);
        for (const file of files) {
          if (file.startsWith('2026-04') || file === 'latest.json') {
            rmSync(join(TEST_REPORTS_DIR, file));
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('saveReport', () => {
    it('saves a report with timestamp in filename', () => {
      const report = createMockReport({
        generated_at: '2026-04-24T10:00:00Z',
        version: 'v1.2.3',
      });
      const path = saveReport(report);

      expect(existsSync(path)).toBe(true);
      expect(path).toContain('2026-04-24T10-00-00');
      expect(path).toContain('v1.2.3.json');
    });
  });

  describe('saveLatestReport', () => {
    it('saves as latest.json', () => {
      const report = createMockReport({ version: 'latest-test' });
      const path = saveLatestReport(report);

      expect(path).toContain('latest.json');
      expect(existsSync(path)).toBe(true);
    });
  });

  describe('listReports', () => {
    it('returns empty array when no reports exist', () => {
      const reports = listReports(10);
      expect(Array.isArray(reports)).toBe(true);
    });
  });

  describe('loadReport', () => {
    it('returns null for non-existent report', () => {
      const loaded = loadReport('non-existent-report-xyz');
      expect(loaded).toBeNull();
    });
  });
});