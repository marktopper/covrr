/**
 * CI/CD integration types for Covrr
 */

export type CIPlatform = 'github' | 'gitlab' | 'manual' | 'none';

export interface CIContext {
  platform: CIPlatform;
  /** PR/MR number for commenting */
  prNumber: number | null;
  /** Commit SHA being tested */
  commitSha: string | null;
  /** Branch name */
  branch: string | null;
  /** Base branch for comparison */
  baseBranch: string | null;
  /** Owner/repo for GitHub */
  owner: string | null;
  /** Repository name for GitHub */
  repo: string | null;
  /** GitLab project ID */
  projectId: string | null;
  /** Whether this is an external fork (no write permissions) */
  isExternalFork: boolean;
  /** Existing PR comment ID for updates */
  prCommentId: number | null;
  /** GitHub status check name */
  statusCheckName: string;
}

export interface CIOptions {
  /** Override CI platform detection */
  ci?: CIPlatform;
  /** Existing PR comment ID for idempotent updates */
  prCommentId?: number;
  /** Custom GitHub status check name */
  statusCheck?: string;
  /** Skip posting PR comments */
  noComment?: boolean;
}

export interface ValidationReport {
  version: string;
  baselineVersion: string | null;
  generatedAt: string;
  scripts: ScriptSummary[];
  coverage: CoverageSummary | null;
  overallStatus: 'passed' | 'failed' | 'warning';
  threshold: number | null;
  strict: boolean;
}

export interface ScriptSummary {
  name: string;
  status: 'passed' | 'failed' | 'timed_out' | 'error' | 'skipped';
  durationMs: number;
  testsPassed: number;
  testsTotal: number;
}

export interface CoverageSummary {
  linesPercent: number;
  branchesPercent: number;
  linesBefore: number | null;
  linesAfter: number | null;
  linesDelta: number | null;
  branchesBefore: number | null;
  branchesAfter: number | null;
  branchesDelta: number | null;
}

export interface CommentResult {
  success: boolean;
  commentId?: number;
  error?: string;
}

export interface StatusCheckResult {
  success: boolean;
  error?: string;
}

export interface StateFile {
  github_comment_id?: number;
  gitlab_note_id?: number;
  last_commit_sha?: string;
}
