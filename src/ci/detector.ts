/**
 * Auto-detect CI environment (GitHub Actions, GitLab CI, manual COVRR_CI)
 */

import type { CIContext, CIOptions, CIPlatform } from './types.js';

/**
 * Detect CI platform from environment variables
 */
export function detectCIPlatform(override?: CIPlatform): CIPlatform {
  if (override) {
    return override;
  }

  // GitHub Actions
  if (process.env.GITHUB_ACTIONS === 'true' || process.env.GITHUB_TOKEN) {
    return 'github';
  }

  // GitLab CI
  if (process.env.GITLAB_CI === 'true' || process.env.GITLAB_TOKEN) {
    return 'gitlab';
  }

  // Manual override via COVRR_CI
  if (process.env.COVRR_CI) {
    const ci = process.env.COVRR_CI.toLowerCase();
    if (ci === 'github' || ci === 'gitlab' || ci === 'manual') {
      return ci as CIPlatform;
    }
  }

  return 'none';
}

/**
 * Detect if running in an external fork (no write permissions)
 * External forks don't have GITHUB_TOKEN access by default
 */
export function isExternalFork(): boolean {
  // GitHub Actions: external forks have GITHUB_ACTOR set but GITHUB_TOKEN is empty
  // Also, GITHUB_EVENT_NAME is 'pull_request' for PRs from forks but permissions differ
  if (process.env.GITHUB_ACTIONS === 'true') {
    // If GITHUB_TOKEN is empty/undefined, likely external fork or no permissions
    if (!process.env.GITHUB_TOKEN) {
      return true;
    }
  }
  return false;
}

/**
 * Extract PR number from GitHub Actions environment
 */
export function getGitHubPRNumber(): number | null {
  // GitHub Actions provides GITHUB_REF like refs/pull/12/merge
  const ref = process.env.GITHUB_REF;
  if (ref) {
    const match = ref.match(/^refs\/pull\/(\d+)\/merge$/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  // Also check GITHUB_EVENT_NAME and related fields in pull_request events
  const event = process.env.GITHUB_EVENT_NAME;
  if (event === 'pull_request' && process.env.GITHUB_REF) {
    const prFromRef = process.env.GITHUB_REF.match(/^refs\/pull\/(\d+)\/head$/);
    if (prFromRef) {
      return parseInt(prFromRef[1], 10);
    }
  }

  return null;
}

/**
 * Extract GitHub owner and repo from environment
 */
export function getGitHubOwnerRepo(): { owner: string; repo: string } | null {
  const repoLink = process.env.GITHUB_REPOSITORY;
  if (repoLink) {
    const [owner, repo] = repoLink.split('/');
    if (owner && repo) {
      return { owner, repo };
    }
  }
  return null;
}

/**
 * Extract current commit SHA
 */
export function getCommitSha(): string | null {
  return process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || null;
}

/**
 * Extract branch name
 */
export function getBranchName(): string | null {
  return process.env.GITHUB_REF_NAME || process.env.CI_COMMIT_REF_NAME || process.env.GITHUB_REF || null;
}

/**
 * Extract base branch for comparison
 */
export function getBaseBranch(): string | null {
  // GitHub Actions provides GITHUB_BASE_REF for PRs
  return process.env.GITHUB_BASE_REF || null;
}

/**
 * Extract GitLab project ID
 */
export function getGitLabProjectId(): string | null {
  return process.env.CI_PROJECT_ID || null;
}

/**
 * Extract GitLab merge request IID
 */
export function getGitLabMRNumber(): number | null {
  const iid = process.env.CI_MERGE_REQUEST_IID;
  if (iid) {
    return parseInt(iid, 10);
  }
  return null;
}

/**
 * Build complete CI context from environment
 */
export function detectCIContext(options: CIOptions = {}): CIContext {
  const platform = detectCIPlatform(options.ci);

  const isExternal = isExternalFork();

  let prNumber: number | null = null;
  let owner: string | null = null;
  let repo: string | null = null;
  let projectId: string | null = null;

  if (platform === 'github') {
    prNumber = getGitHubPRNumber();
    const ownerRepo = getGitHubOwnerRepo();
    if (ownerRepo) {
      owner = ownerRepo.owner;
      repo = ownerRepo.repo;
    }
  } else if (platform === 'gitlab') {
    prNumber = getGitLabMRNumber();
    projectId = getGitLabProjectId();
  }

  return {
    platform,
    prNumber,
    commitSha: getCommitSha(),
    branch: getBranchName(),
    baseBranch: getBaseBranch(),
    owner,
    repo,
    projectId,
    isExternalFork: isExternal,
    prCommentId: options.prCommentId ?? null,
    statusCheckName: options.statusCheck ?? 'covrr/coverage',
  };
}

/**
 * Check if CI environment is available (not 'none')
 */
export function isCIEnvironment(platform: CIPlatform): boolean {
  return platform !== 'none';
}
