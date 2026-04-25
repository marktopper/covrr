/**
 * Report history commands - list and show historical reports
 */

import { listReports, loadReport } from './storage.js';
import { format } from './formatters.js';
import type { OutputFormat } from './types.js';

export function listHistoricalReports(limit = 10): Array<{
  version: string;
  timestamp: string;
  status: string;
  path: string;
}> {
  const reports = listReports(limit);

  return reports.map((r) => ({
    version: r.version,
    timestamp: r.timestamp.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ''),
    status: r.status,
    path: r.filename,
  }));
}

export function showReport(ref: string, outputFormat: OutputFormat = 'text'): string | null {
  const report = loadReport(ref);

  if (!report) {
    return null;
  }

  return format(report, outputFormat);
}

export function formatReportList(reports: Array<{ version: string; timestamp: string; status: string; path: string }>): string {
  const lines: string[] = [];

  for (const r of reports) {
    const statusIcon = r.status === 'passed' ? 'PASS' : r.status === 'failed' ? 'FAIL' : r.status.toUpperCase();
    lines.push(`${r.version.padEnd(10)} ${r.timestamp.padEnd(20)} ${statusIcon}`);
  }

  return lines.join('\n');
}