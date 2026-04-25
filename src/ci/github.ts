/**
 * GitHub Actions integration: PR comments and status checks
 */

import { Octokit } from '@octokit/rest';
import type { CIContext, CommentResult, StatusCheckResult, ValidationReport } from './types.js';

const STATE_FILE = '.covrr/state.json';

function getOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

/**
 * Format validation report as markdown comment
 */
export function formatPRComment(report: ValidationReport, artifactUrl?: string): string {
  const lines: string[] = [];

  // Header with version info
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

  // Changes summary (placeholder)
  lines.push('---');
  lines.push('_Covrr validation_');

  return lines.join('\n');
}

/**
 * Format failure comment for strict mode breach
 */
export function formatFailureComment(report: ValidationReport): string {
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
 * Post or update PR comment
 */
export async function postPRComment(
  context: CIContext,
  body: string,
  existingCommentId?: number
): Promise<CommentResult> {
  if (!context.owner || !context.repo || !context.prNumber) {
    return { success: false, error: 'Missing GitHub context (owner, repo, or PR number)' };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { success: false, error: 'GITHUB_TOKEN not available' };
  }

  // External forks may have GITHUB_TOKEN but with limited permissions
  if (context.isExternalFork) {
    return { success: false, error: 'External fork detected — skip guard-rail enforcement' };
  }

  const octokit = getOctokit(token);

  try {
    if (existingCommentId) {
      // Update existing comment
      await octokit.issues.updateComment({
        owner: context.owner,
        repo: context.repo,
        comment_id: existingCommentId,
        body,
      });
      return { success: true, commentId: existingCommentId };
    } else {
      // Create new comment
      const response = await octokit.issues.createComment({
        owner: context.owner,
        repo: context.repo,
        issue_number: context.prNumber,
        body,
      });
      return { success: true, commentId: response.data.id };
    }
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('pull-requests: write')) {
      return { success: false, error: 'Token missing `pull-requests: write` permission' };
    }
    if (error.message.includes('rate limit')) {
      return { success: false, error: 'GitHub API rate limit exceeded' };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Set commit status check for branch protection
 */
export async function setStatusCheck(
  context: CIContext,
  state: 'success' | 'failure' | 'error',
  description: string,
  targetUrl?: string
): Promise<StatusCheckResult> {
  if (!context.owner || !context.repo || !context.commitSha) {
    return { success: false, error: 'Missing GitHub context (owner, repo, or commit SHA)' };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { success: false, error: 'GITHUB_TOKEN not available' };
  }

  // External forks skip status check
  if (context.isExternalFork) {
    return { success: false, error: 'External fork detected — skip guard-rail enforcement' };
  }

  const octokit = getOctokit(token);

  try {
    await octokit.repos.createCommitStatus({
      owner: context.owner,
      repo: context.repo,
      sha: context.commitSha,
      state,
      description: description.substring(0, 140), // GitHub limit
      context: context.statusCheckName,
      target_url: targetUrl,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Get existing PR comment ID from state file
 */
export async function getStateCommentId(): Promise<number | null> {
  try {
    const { existsSync, readFileSync } = await import('fs');
    if (!existsSync(STATE_FILE)) {
      return null;
    }
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    return state.github_comment_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Save PR comment ID to state file
 */
export async function saveStateCommentId(commentId: number): Promise<void> {
  try {
    const { existsSync, readFileSync, writeFileSync, mkdirSync } = await import('fs');

    // Ensure .covrr directory exists
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

    state.github_comment_id = commentId;
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    // Non-fatal: log warning
    console.warn('Failed to save state file');
  }
}
