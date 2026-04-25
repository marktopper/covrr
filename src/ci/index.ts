/**
 * CI/CD Integration module for Covrr
 *
 * Provides:
 * - CI environment detection
 * - GitHub PR comments and status checks
 * - GitLab MR notes
 * - Exit code mapping
 */

export * from './types.js';
export * from './exit-codes.js';
export * from './detector.js';
export * from './github.js';
export * from './gitlab.js';

import type { CIOptions, ValidationReport } from './types.js';
import { detectCIContext, isCIEnvironment } from './detector.js';
import { postPRComment, formatPRComment, formatFailureComment, getStateCommentId, saveStateCommentId, setStatusCheck } from './github.js';
import { postMRComment, formatMRComment, formatMRFailureComment, getStateNoteId, saveStateNoteId } from './gitlab.js';
import { determineExitCode, ExitCode } from './exit-codes.js';

/**
 * Integration result combining comment posting and status check
 */
export interface IntegrationResult {
  exitCode: ExitCode;
  commentPosted: boolean;
  statusCheckSet: boolean | null;
  errors: string[];
}

/**
 * Run CI integration: post comment and set status check based on validation report
 */
export async function runCIIntegration(
  report: ValidationReport,
  options: CIOptions = {}
): Promise<IntegrationResult> {
  const context = detectCIContext(options);
  const errors: string[] = [];

  // If not in CI environment, exit early with PASS
  if (!isCIEnvironment(context.platform)) {
    return {
      exitCode: ExitCode.PASS,
      commentPosted: false,
      statusCheckSet: null,
      errors: [],
    };
  }

  // If --no-comment flag is set, skip commenting but still set status
  if (options.noComment) {
    if (context.platform === 'github' && context.owner && context.commitSha) {
      const state = report.overallStatus === 'passed' ? 'success' : 'failure';
      const desc = report.overallStatus === 'passed' ? 'Covrr: All checks passed' : 'Covrr: Coverage threshold breached';
      const result = await setStatusCheck(context, state, desc);
      if (!result.success) {
        errors.push(result.error ?? 'Unknown status check error');
      }
    }
    return {
      exitCode: determineExitCode(
        report.overallStatus !== 'failed',
        report.overallStatus !== 'failed',
        report.strict
      ),
      commentPosted: false,
      statusCheckSet: context.platform === 'github' ? true : null,
      errors,
    };
  }

  // Post PR/MR comment
  if (context.platform === 'github') {
    const existingCommentId = options.prCommentId ?? await getStateCommentId();
    const isFailure = report.overallStatus === 'failed' && report.strict;
    const body = isFailure ? formatFailureComment(report) : formatPRComment(report);

    if (context.isExternalFork) {
      errors.push('External fork detected — skip guard-rail enforcement');
    } else {
      const result = await postPRComment(context, body, existingCommentId ?? undefined);
      if (result.success && result.commentId) {
        await saveStateCommentId(result.commentId);
      } else if (result.error) {
        errors.push(result.error);
      }
    }

    // Set status check for GitHub (if not external fork)
    if (context.owner && context.commitSha && !context.isExternalFork) {
      const state = report.overallStatus === 'passed' ? 'success' : 'failure';
      const desc = report.overallStatus === 'passed'
        ? 'Covrr: All checks passed'
        : 'Covrr: Coverage threshold breached';
      const statusResult = await setStatusCheck(context, state, desc);
      if (!statusResult.success) {
        errors.push(statusResult.error ?? 'Unknown status check error');
      }
    }

    return {
      exitCode: determineExitCode(
        report.overallStatus !== 'failed',
        report.overallStatus !== 'failed',
        report.strict
      ),
      commentPosted: !context.isExternalFork,
      statusCheckSet: context.isExternalFork ? null : true,
      errors,
    };
  }

  if (context.platform === 'gitlab') {
    const existingNoteId = options.prCommentId ?? await getStateNoteId();
    const isFailure = report.overallStatus === 'failed' && report.strict;
    const body = isFailure ? formatMRFailureComment(report) : formatMRComment(report);

    const result = await postMRComment(context, body, existingNoteId ?? undefined);
    if (result.success && result.commentId) {
      await saveStateNoteId(result.commentId);
    } else if (result.error) {
      errors.push(result.error);
    }

    return {
      exitCode: determineExitCode(
        report.overallStatus !== 'failed',
        report.overallStatus !== 'failed',
        report.strict
      ),
      commentPosted: true,
      statusCheckSet: null,
      errors,
    };
  }

  return {
    exitCode: ExitCode.PASS,
    commentPosted: false,
    statusCheckSet: null,
    errors: [],
  };
}
