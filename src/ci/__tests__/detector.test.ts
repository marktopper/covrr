/**
 * Tests for CI detector
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { detectCIPlatform, detectCIContext, isExternalFork, getGitHubPRNumber, getGitHubOwnerRepo } from '../detector.js';

const originalEnv = { ...process.env };

beforeEach(() => {
  // Reset environment before each test
  process.env = { ...originalEnv };
  // Delete all CI-related env vars to ensure clean state
  delete process.env.GITHUB_ACTIONS;
  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_REF;
  delete process.env.GITHUB_REPOSITORY;
  delete process.env.GITHUB_SHA;
  delete process.env.GITHUB_BASE_REF;
  delete process.env.GITHUB_REF_NAME;
  delete process.env.GITLAB_CI;
  delete process.env.GITLAB_TOKEN;
  delete process.env.CI_MERGE_REQUEST_IID;
  delete process.env.CI_PROJECT_ID;
  delete process.env.COVRR_CI;
});

afterEach(() => {
  process.env = originalEnv;
});

describe('detectCIPlatform', () => {
  it('detects github when GITHUB_ACTIONS is true', () => {
    process.env.GITHUB_ACTIONS = 'true';
    expect(detectCIPlatform()).toBe('github');
  });

  it('detects gitlab when GITLAB_CI is true', () => {
    process.env.GITLAB_CI = 'true';
    expect(detectCIPlatform()).toBe('gitlab');
  });

  it('respects COVRR_CI override', () => {
    process.env.COVRR_CI = 'github';
    expect(detectCIPlatform()).toBe('github');
  });

  it('respects COVRR_CI override to gitlab', () => {
    process.env.COVRR_CI = 'gitlab';
    expect(detectCIPlatform()).toBe('gitlab');
  });

  it('returns none when no CI env vars set', () => {
    expect(detectCIPlatform()).toBe('none');
  });

  it('accepts platform override parameter', () => {
    process.env.COVRR_CI = 'gitlab';
    expect(detectCIPlatform('github')).toBe('github');
  });
});

describe('isExternalFork', () => {
  it('returns false when GITHUB_TOKEN is present in GitHub Actions', () => {
    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_TOKEN = 'fake-token';
    expect(isExternalFork()).toBe(false);
  });

  it('returns true when GITHUB_TOKEN is missing in GitHub Actions', () => {
    process.env.GITHUB_ACTIONS = 'true';
    expect(isExternalFork()).toBe(true);
  });

  it('returns false outside GitHub Actions', () => {
    expect(isExternalFork()).toBe(false);
  });
});

describe('getGitHubPRNumber', () => {
  it('extracts PR number from GITHUB_REF', () => {
    process.env.GITHUB_REF = 'refs/pull/42/merge';
    expect(getGitHubPRNumber()).toBe(42);
  });

  it('returns null when GITHUB_REF is not a PR ref', () => {
    process.env.GITHUB_REF = 'refs/heads/main';
    expect(getGitHubPRNumber()).toBeNull();
  });
});

describe('getGitHubOwnerRepo', () => {
  it('parses GITHUB_REPOSITORY', () => {
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    expect(getGitHubOwnerRepo()).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('returns null when GITHUB_REPOSITORY is not set', () => {
    expect(getGitHubOwnerRepo()).toBeNull();
  });
});

describe('detectCIContext', () => {
  it('builds complete context for GitHub Actions', () => {
    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_TOKEN = 'fake-token';
    process.env.GITHUB_REF = 'refs/pull/12/merge';
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_SHA = 'abc123';
    process.env.GITHUB_BASE_REF = 'main';
    const ctx = detectCIContext();
    expect(ctx.platform).toBe('github');
    expect(ctx.prNumber).toBe(12);
    expect(ctx.owner).toBe('owner');
    expect(ctx.repo).toBe('repo');
    expect(ctx.commitSha).toBe('abc123');
    expect(ctx.baseBranch).toBe('main');
    expect(ctx.isExternalFork).toBe(false);
  });

  it('detects external fork when token is missing', () => {
    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    const ctx = detectCIContext();
    expect(ctx.isExternalFork).toBe(true);
  });

  it('respects CI override option', () => {
    const ctx = detectCIContext({ ci: 'gitlab' });
    expect(ctx.platform).toBe('gitlab');
  });

  it('uses prCommentId from options', () => {
    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_TOKEN = 'fake-token';
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    const ctx = detectCIContext({ prCommentId: 123 });
    expect(ctx.prCommentId).toBe(123);
  });

  it('uses statusCheck name from options', () => {
    const ctx = detectCIContext({ statusCheck: 'custom/check' });
    expect(ctx.statusCheckName).toBe('custom/check');
  });
});
