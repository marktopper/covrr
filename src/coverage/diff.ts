/**
 * Coverage delta calculation between versions
 */

import { CoverageReport, CoverageDiff, CoverageFileDiff } from './types.js';

const DEGRADATION_THRESHOLD_PERCENT = 5;

/**
 * Calculate delta between two coverage reports
 */
export function calculateDiff(
  fromReport: CoverageReport | null,
  toReport: CoverageReport
): CoverageDiff {
  const files: CoverageFileDiff[] = [];
  const degradedFiles: string[] = [];

  if (!fromReport) {
    // All files in the new version are "new" with delta equal to their coverage
    if (toReport.files) {
      for (const file of toReport.files) {
        files.push({
          path: file.path,
          lines_percent_from: 0,
          lines_percent_to: file.lines_percent,
          delta: file.lines_percent,
        });
      }
    }
  } else {
    // Build map of old files
    const oldFilesMap = new Map<string, { lines_percent: number }>();
    if (fromReport.files) {
      for (const file of fromReport.files) {
        oldFilesMap.set(file.path, { lines_percent: file.lines_percent });
      }
    }

    // Calculate delta for each file in new version
    if (toReport.files) {
      for (const file of toReport.files) {
        const oldFile = oldFilesMap.get(file.path);
        const fromPercent = oldFile ? oldFile.lines_percent : 0;
        const delta = file.lines_percent - fromPercent;

        files.push({
          path: file.path,
          lines_percent_from: fromPercent,
          lines_percent_to: file.lines_percent,
          delta,
        });

        if (delta < -DEGRADATION_THRESHOLD_PERCENT) {
          degradedFiles.push(file.path);
        }
      }
    }
  }

  const fromLines = fromReport?.summary.lines_percent ?? 0;
  const toLines = toReport.summary.lines_percent;
  const fromBranches = fromReport?.summary.branches_percent ?? 0;
  const toBranches = toReport.summary.branches_percent;

  return {
    version_from: fromReport?.version ?? 'unknown',
    version_to: toReport.version,
    lines_percent_delta: toLines - fromLines,
    branches_percent_delta: toBranches - fromBranches,
    files,
    degraded_files: degradedFiles,
  };
}

/**
 * Format diff for human-readable output
 */
export function formatDiff(diff: CoverageDiff): string {
  const linesSign = diff.lines_percent_delta >= 0 ? '+' : '';
  const branchesSign = diff.branches_percent_delta >= 0 ? '+' : '';

  let result = `Lines: ${linesSign}${diff.lines_percent_delta.toFixed(1)}% | Branches: ${branchesSign}${diff.branches_percent_delta.toFixed(1)}%`;

  if (diff.degraded_files.length > 0) {
    result += '\nDegraded files:';
    for (const file of diff.degraded_files) {
      const fileDiff = diff.files.find((f) => f.path === file);
      if (fileDiff) {
        const sign = fileDiff.delta >= 0 ? '+' : '';
        result += `\n  ${file} (${sign}${fileDiff.delta.toFixed(1)}%)`;
      }
    }
  }

  return result;
}

/**
 * Format diff compactly for CLI output
 */
export function formatDiffCompact(diff: CoverageDiff): string {
  const linesSign = diff.lines_percent_delta >= 0 ? '+' : '';
  const branchesSign = diff.branches_percent_delta >= 0 ? '+' : '';

  let result = `Lines: ${linesSign}${diff.lines_percent_delta.toFixed(1)}% | Branches: ${branchesSign}${diff.branches_percent_delta.toFixed(1)}%`;

  if (diff.degraded_files.length > 0) {
    result += '\nDegraded files: ';
    result += diff.degraded_files.map((f) => {
      const fd = diff.files.find((fd) => fd.path === f);
      const sign = (fd?.delta ?? 0) >= 0 ? '+' : '';
      return `${f} (${sign}${fd?.delta.toFixed(1) ?? 0}%)`;
    }).join(', ');
  }

  return result;
}

/**
 * Check if diff has any degradation
 */
export function hasDegradation(diff: CoverageDiff): boolean {
  return diff.degraded_files.length > 0;
}