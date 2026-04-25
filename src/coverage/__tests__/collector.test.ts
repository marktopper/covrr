/**
 * Tests for coverage collector
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { collectFromFile, collectFromStdout, parseCoverageJson, CoverageParseError, extractCoverageData } from '../collector.js';

const testDir = path.join(os.tmpdir(), 'covrr-coverage-collector-test-' + Date.now());

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  try { fs.rmSync(testDir, { recursive: true }); } catch {}
});

describe('collectFromFile', () => {
  it('returns null when file does not exist', () => {
    const result = collectFromFile(path.join(testDir, 'nonexistent.json'));
    expect(result).toBeNull();
  });

  it('parses valid coverage JSON file', () => {
    const coverageData = {
      version: '1.0.0',
      script_name: 'smoke',
      generated_at: '2026-04-24T10:00:00Z',
      tool: 'istanbul',
      summary: {
        lines_total: 1000,
        lines_covered: 850,
        lines_percent: 85,
        branches_total: 200,
        branches_covered: 180,
        branches_percent: 90,
      },
    };

    const filePath = path.join(testDir, 'coverage.json');
    fs.writeFileSync(filePath, JSON.stringify(coverageData));

    const result = collectFromFile(filePath);
    expect(result).not.toBeNull();
    expect(result!.version).toBe('1.0.0');
    expect(result!.script_name).toBe('smoke');
    expect(result!.summary.lines_percent).toBe(85);
  });

  it('throws CoverageParseError for invalid JSON', () => {
    const filePath = path.join(testDir, 'invalid.json');
    fs.writeFileSync(filePath, 'not valid json');

    expect(() => collectFromFile(filePath)).toThrow(CoverageParseError);
  });

  it('throws CoverageParseError for invalid schema', () => {
    const filePath = path.join(testDir, 'invalid-schema.json');
    fs.writeFileSync(filePath, JSON.stringify({ version: 123 }));

    expect(() => collectFromFile(filePath)).toThrow(CoverageParseError);
  });
});

describe('collectFromStdout', () => {
  it('returns null when no COVERAGE line found', () => {
    const result = collectFromStdout('Some output\nNo coverage here\n');
    expect(result).toBeNull();
  });

  it('parses COVERAGE: base64 encoded JSON', () => {
    const coverageData = {
      version: '1.0.0',
      script_name: 'e2e',
      generated_at: '2026-04-24T10:00:00Z',
      tool: 'nyc',
      summary: {
        lines_total: 2000,
        lines_covered: 1900,
        lines_percent: 95,
        branches_total: 400,
        branches_covered: 380,
        branches_percent: 95,
      },
    };

    const encoded = Buffer.from(JSON.stringify(coverageData)).toString('base64');
    const stdout = `Running tests...\nCOVERAGE:${encoded}\nTests passed!`;

    const result = collectFromStdout(stdout);
    expect(result).not.toBeNull();
    expect(result!.script_name).toBe('e2e');
    expect(result!.summary.lines_percent).toBe(95);
  });

  it('returns null for invalid base64', () => {
    const stdout = 'COVERAGE:not-valid-base64!!!';
    const result = collectFromStdout(stdout);
    expect(result).toBeNull();
  });
});

describe('parseCoverageJson', () => {
  it('parses valid coverage JSON', () => {
    const validJson = JSON.stringify({
      version: '1.0.0',
      script_name: 'smoke',
      generated_at: '2026-04-24T10:00:00Z',
      tool: 'istanbul',
      summary: {
        lines_total: 1000,
        lines_covered: 800,
        lines_percent: 80,
        branches_total: 200,
        branches_covered: 150,
        branches_percent: 75,
      },
    });

    const result = parseCoverageJson(validJson);
    expect(result.version).toBe('1.0.0');
    expect(result.summary.lines_percent).toBe(80);
  });

  it('throws CoverageParseError for invalid JSON', () => {
    expect(() => parseCoverageJson('not json')).toThrow(CoverageParseError);
  });

  it('throws CoverageParseError for missing required fields', () => {
    const invalid = JSON.stringify({
      version: '1.0.0',
      // missing script_name, generated_at, tool, summary
    });

    expect(() => parseCoverageJson(invalid)).toThrow(CoverageParseError);
  });
});

describe('extractCoverageData', () => {
  it('extracts summary from coverage report', () => {
    const report = {
      version: '1.0.0',
      script_name: 'smoke',
      generated_at: '2026-04-24T10:00:00Z',
      tool: 'istanbul',
      summary: {
        lines_total: 1000,
        lines_covered: 850,
        lines_percent: 85,
        branches_total: 200,
        branches_covered: 180,
        branches_percent: 90,
      },
    };

    const data = extractCoverageData(report);
    expect(data.lines_percent).toBe(85);
    expect(data.lines_total).toBe(1000);
    expect(data.branches_percent).toBe(90);
  });
});