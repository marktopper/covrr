/**
 * Report storage - saves reports to .covrr/reports/
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import type { ValidationReport } from './types.js';

const REPORTS_DIR = '.covrr/reports';

function ensureReportsDir(): void {
  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

function timestampFilename(report: ValidationReport): string {
  const date = new Date(report.generated_at);
  const timestamp = date.toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const version = report.version.replace(/^v/, '');
  return `${timestamp}_v${version}.json`;
}

export function saveReport(report: ValidationReport): string {
  ensureReportsDir();
  const filename = timestampFilename(report);
  const filepath = join(REPORTS_DIR, filename);
  writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
  return filepath;
}

export function saveLatestReport(report: ValidationReport): string {
  ensureReportsDir();
  const filepath = join(REPORTS_DIR, 'latest.json');
  writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
  return filepath;
}

export function listReports(limit = 10): Array<{ filename: string; path: string; timestamp: Date; version: string; status: string }> {
  ensureReportsDir();

  const files = readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'latest.json')
    .map((filename) => {
      const filepath = join(REPORTS_DIR, filename);
      const stats = statSync(filepath);
      let version = 'unknown';
      let status = 'unknown';
      let timestamp = stats.mtime;

      try {
        const content = readFileSync(filepath, 'utf-8');
        const report = JSON.parse(content) as ValidationReport;
        version = report.version;
        status = report.overall_status;
        timestamp = new Date(report.generated_at);
      } catch {
        // Use defaults if parsing fails
      }

      return { filename, path: filepath, timestamp, version, status };
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);

  return files;
}

export function loadReport(ref: string): ValidationReport | null {
  ensureReportsDir();

  const byFilename = join(REPORTS_DIR, ref);
  if (existsSync(byFilename)) {
    const content = readFileSync(byFilename, 'utf-8');
    return JSON.parse(content) as ValidationReport;
  }

  const reports = listReports(100);
  const matched = reports.find((r) => r.version === ref || r.filename.includes(ref));
  if (matched) {
    const content = readFileSync(matched.path, 'utf-8');
    return JSON.parse(content) as ValidationReport;
  }

  return null;
}

export function findReport(ref: string): ValidationReport | null {
  return loadReport(ref);
}