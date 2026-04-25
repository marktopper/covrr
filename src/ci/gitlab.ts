/**
 * GitLab CI integration: MR notes via GitLab API
 */

import type { CIContext, CommentResult, ValidationReport } from './types.js';

const STATE_FILE = '.covrr/state.json';

/**
 * Format validation report as GitLab MR note (markdown)
 */
export function formatMRComment(report: ValidationReport, artifactUrl?: string): string {
  const lines: string[] = [];

  lines.push('## Covrr — Validation Report');
  lines.push('');

  lines.push(`**v${report.version}**`);
  if (report.baselineVersion) {
    lines.push(` vs baseline **v${report.baselineVersion}**`);
  }
  if (artifactUrl) {
    lines.push(` | [Full Report](${artifactUrl})`);
  }
  lines.push('');

  // Scripts table
  lines.push('### Scripts');
  lines.push('| Script | Status | Duration | Tests |');
  lines.push('|--------|--------|----------|-------|');
  for (const script of report.scripts) {
    const icon = script.status === 'passed' ? '✓' : '✗';
    const statusLabel = script.status === 'passed' ? 'PASS' : 'FAIL';
    const duration = formatDuration(script.durationMs);
    lines.push(`| ${script.name} | ${icon} ${statusLabel} | ${duration} | ${script.testsPassed}/${script.testsTotal} |`);
  }
  lines.push('');

  // Coverage section
  if (report.coverage) {
    lines.push('### Coverage');
    lines.push('| | Before | After | Δ |');
    lines.push('|--|--------|-------|---|');

    const cov = report.coverage;
    const linesDelta = cov.linesDelta !== null ? (cov.linesDelta >= 0 ? `+${cov.linesDelta.toFixed(1)}%` : `${cov.linesDelta.toFixed(1)}%`) : 'N/A';
    const branchesDelta = cov.branchesDelta !== null ? (cov.branchesDelta >= 0 ? `+${cov.branchesDelta.toFixed(1)}%` : `${cov.branchesDelta.toFixed(1)}%`) : 'N/A';

    lines.push(`| Lines | ${cov.linesBefore?.toFixed(1) ?? 'N/A'}% | ${cov.linesAfter?.toFixed(1) ?? cov.linesPercent.toFixed(1)}% | **${linesDelta}** |`);
    lines.push(`| Branches | ${cov.branchesBefore?.toFixed(1) ?? 'N/A'}% | ${cov.branchesAfter?.toFixed(1) ?? cov.branchesPercent.toFixed(1)}% | **${branchesDelta}** |`);
    lines.push('');

    if (report.threshold !== null) {
      const statusText = report.overallStatus === 'passed' ? '**PASS**' : '**FAIL**';
      lines.push(`Threshold: ${report.threshold}% | Status: ${statusText}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('_Covrr validation_');

  return lines.join('\n');
}

/**
 * Format failure note for strict mode breach
 */
export function formatMRFailureComment(report: ValidationReport): string {
  const lines: string[] = [];

  lines.push('## ⚠️ Covrr — Coverage Gate Failed');
  lines.push('');
  lines.push(`**v${report.version}**`);
  if (report.threshold !== null) {
    lines.push(` | Threshold: ${report.threshold}%`);
  }
  if (report.coverage) {
    lines.push(` | Actual: ${report.coverage.linesPercent.toFixed(1)}%`);
  }
  lines.push('');

  if (report.coverage && report.coverage.linesDelta !== null) {
    const sign = report.coverage.linesDelta < 0 ? '' : '+';
    lines.push(`Coverage dropped **${sign}${report.coverage.linesDelta.toFixed(1)}%** below threshold. Merge blocked until fixed.`);
  } else {
    lines.push('Coverage dropped below threshold. Merge blocked until fixed.');
  }
  lines.push('');

  lines.push('---');
  lines.push('_Covrr validation_');

  return lines.join('\n');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}

/**
 * Get GitLab API base URL
 */
function getGitLabApiUrl(): string {
  // GitLab provides CI_SERVER_URL for the API endpoint
  return process.env.CI_SERVER_URL ?? 'https://gitlab.com';
}

/**
 * Post or update MR note using GitLab API
 */
export async function postMRComment(
  context: CIContext,
  body: string,
  existingNoteId?: number
): Promise<CommentResult> {
  if (!context.projectId || !context.prNumber) {
    return { success: false, error: 'Missing GitLab context (projectId or MR number)' };
  }

  const token = process.env.GITLAB_TOKEN;
  if (!token) {
    return { success: false, error: 'GITLAB_TOKEN not available' };
  }

  const apiUrl = getGitLabApiUrl();
  const projectIdEncoded = encodeURIComponent(context.projectId);

  try {
    if (existingNoteId) {
      // Update existing note via PUT
      const response = await fetch(
        `${apiUrl}/api/v4/projects/${projectIdEncoded}/merge_requests/${context.prNumber}/notes/${existingNoteId}`,
        {
          method: 'PUT',
          headers: {
            'PRIVATE-TOKEN': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `GitLab API error: ${response.status} ${errorText}` };
      }

      const data = await response.json();
      return { success: true, commentId: data.id };
    } else {
      // Create new note via POST
      const response = await fetch(
        `${apiUrl}/api/v4/projects/${projectIdEncoded}/merge_requests/${context.prNumber}/notes`,
        {
          method: 'POST',
          headers: {
            'PRIVATE-TOKEN': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `GitLab API error: ${response.status} ${errorText}` };
      }

      const data = await response.json();
      return { success: true, commentId: data.id };
    }
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Get existing MR note ID from state file
 */
export async function getStateNoteId(): Promise<number | null> {
  try {
    const { existsSync, readFileSync } = await import('fs');
    if (!existsSync(STATE_FILE)) {
      return null;
    }
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    return state.gitlab_note_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Save MR note ID to state file
 */
export async function saveStateNoteId(noteId: number): Promise<void> {
  try {
    const { existsSync, readFileSync, writeFileSync, mkdirSync } = await import('fs');

    const dir = '.covrr';
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let state: Record<string, unknown> = {};
    if (existsSync(STATE_FILE)) {
      try {
        state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
      } catch {
        // Start fresh
      }
    }

    state.gitlab_note_id = noteId;
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    console.warn('Failed to save state file');
  }
}
