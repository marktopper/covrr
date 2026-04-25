/**
 * Output formatters for validation reports
 */

import type { ValidationReport, OutputFormat } from './types.js';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m${secs}s`;
}

function statusIcon(status: string): string {
  switch (status) {
    case 'passed': return '✓';
    case 'failed': return '✗';
    case 'skipped': return '○';
    case 'timed_out': return '⏱';
    case 'error': return '⚠';
    default: return '?';
  }
}

export function formatText(report: ValidationReport): string {
  const lines: string[] = [];

  for (const script of report.scripts) {
    const icon = statusIcon(script.status);
    const duration = formatDuration(script.duration_ms);
    lines.push(
      `${icon} ${script.name.padEnd(12)} ${script.status.padEnd(8)} ${duration.padEnd(8)} (${script.tests_passed} tests, ${script.tests_failed} failed)`
    );
  }

  if (report.coverage) {
    const cov = report.coverage;
    const threshold = cov.threshold_percent !== null ? ` (threshold: ${cov.threshold_percent}%)` : '';
    const passed = cov.passed_threshold ? '✓' : '✗';
    lines.push(`\nCoverage: ${cov.overall_percent}%${threshold} ${passed}`);
  }

  if (report.version_diff && report.baseline_version) {
    const vd = report.version_diff;
    lines.push(
      `Version: ${report.version} vs ${report.baseline_version} (${vd.files_changed} files changed, ${vd.commits_between} commits)`
    );
  }

  lines.push(`\nOverall: ${report.overall_status.toUpperCase()}`);

  return lines.join('\n');
}

export function formatJson(report: ValidationReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatMarkdown(report: ValidationReport): string {
  const lines: string[] = [];

  lines.push(`## Covrr Validation — ${report.version}`);
  if (report.baseline_version) {
    lines.push(`vs ${report.baseline_version}`);
  }
  lines.push('');

  lines.push('| Script | Status | Duration | Tests |');
  lines.push('|--------|--------|----------|-------|');
  for (const script of report.scripts) {
    const icon = statusIcon(script.status);
    const duration = formatDuration(script.duration_ms);
    const testRatio = `${script.tests_passed}/${script.tests_passed + script.tests_failed}`;
    lines.push(`| ${script.name} | ${icon} ${script.status} | ${duration} | ${testRatio} |`);
  }
  lines.push('');

  if (report.coverage) {
    const cov = report.coverage;
    const threshold = cov.threshold_percent !== null ? ` (threshold ${cov.threshold_percent}%)` : '';
    const passed = cov.passed_threshold ? '✓' : '✗';
    lines.push(`**Coverage:** ${cov.overall_percent}%${threshold} ${passed}`);
  }

  if (report.version_diff) {
    const vd = report.version_diff;
    lines.push(`**Changes:** ${vd.files_changed} files across ${vd.commits_between} commits`);
    if (vd.packages_bumped.length > 0) {
      lines.push(`Packages bumped: ${vd.packages_bumped.join(', ')}`);
    }
  }

  const statusBadge = report.overall_status === 'passed' ? '**PASS**' : '**FAIL**';
  lines.push(`\nOverall: ${statusBadge}`);

  return lines.join('\n');
}

export function formatHtml(report: ValidationReport): string {
  const statusClass = report.overall_status === 'passed' ? 'pass' : 'fail';

  const scriptRows = report.scripts.map((s) => {
    const icon = statusIcon(s.status);
    const duration = formatDuration(s.duration_ms);
    return `<tr class="${s.status}">
      <td>${icon}</td>
      <td>${s.name}</td>
      <td>${s.status}</td>
      <td>${duration}</td>
      <td>${s.tests_passed}/${s.tests_passed + s.tests_failed}</td>
    </tr>`;
  }).join('\n');

  let coverageHtml = '';
  if (report.coverage) {
    const cov = report.coverage;
    const threshold = cov.threshold_percent !== null ? ` (threshold: ${cov.threshold_percent}%)` : '';
    const passed = cov.passed_threshold ? '✓' : '✗';
    coverageHtml = `<div class="coverage">
      <h3>Coverage</h3>
      <p>${cov.overall_percent}%${threshold} ${passed}</p>
    </div>`;
  }

  let versionDiffHtml = '';
  if (report.version_diff) {
    const vd = report.version_diff;
    versionDiffHtml = `<div class="version-diff">
      <h3>Version Diff</h3>
      <p>${vd.files_changed} files, ${vd.commits_between} commits</p>
    </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Covrr Report — ${report.version}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
    .status { padding: 10px 20px; border-radius: 4px; display: inline-block; }
    .pass { background: #d4edda; color: #155724; }
    .fail { background: #f8d7da; color: #721c24; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f8f9fa; }
    tr.passed { background: #d4edda; }
    tr.failed { background: #f8d7da; }
    .coverage, .version-diff { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Covrr Report</h1>
  <p>Generated: ${report.generated_at}</p>
  <p>Tool version: ${report.tool_version}</p>
  <div class="status ${statusClass}">Overall: ${report.overall_status.toUpperCase()}</div>

  <h2>Scripts</h2>
  <table>
    <thead>
      <tr><th>Status</th><th>Name</th><th>Result</th><th>Duration</th><th>Tests</th></tr>
    </thead>
    <tbody>
      ${scriptRows}
    </tbody>
  </table>

  ${coverageHtml}
  ${versionDiffHtml}
</body>
</html>`;
}

export function formatGitHubAnnotation(report: ValidationReport): string {
  const lines: string[] = [];

  for (const script of report.scripts) {
    if (script.status === 'failed') {
      lines.push(`::error file=scripts/${script.name}::${script.name} failed (${script.tests_failed} tests failed)`);
    } else if (script.status === 'passed') {
      lines.push(`::notice file=scripts/${script.name}::${script.name} passed`);
    }
  }

  if (report.coverage && !report.coverage.passed_threshold) {
    lines.push(`::warning file=coverage::Coverage ${report.coverage.overall_percent}% below threshold ${report.coverage.threshold_percent}%`);
  }

  return lines.join('\n');
}

export function format(report: ValidationReport, outputFormat: OutputFormat): string {
  switch (outputFormat) {
    case 'text': return formatText(report);
    case 'json': return formatJson(report);
    case 'markdown': return formatMarkdown(report);
    case 'html': return formatHtml(report);
    case 'github-annotation': return formatGitHubAnnotation(report);
    default: return formatText(report);
  }
}