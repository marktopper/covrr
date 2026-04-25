# Spec S006: CI/CD Integration

**Task:** MAR-117
**Parent:** MAR-111 (Plan Covrr)
**Status:** Draft
**Created:** 2026-04-24

---

## Summary

Covrr integrates with CI/CD pipelines to enforce quality gates on pull requests. It posts validation results as PR comments (delta summary, pass/fail, coverage change) and can block PR merge if coverage drops below threshold (`strict` mode from S002).

---

## 1. Overview

### What CI integration means

When Covrr runs in a CI environment (GitHub Actions, GitLab CI), it should:
1. Detect the CI context (git branch, PR number, commit hash)
2. Run validation against the current version
3. Comment on the PR with a delta summary vs baseline
4. Optionally block the PR if thresholds are breached

### Goals

- **Transparency**: PR comment shows exactly what changed validation-wise
- **Quality gates**: Coverage drops can block PR merge
- **Context injection**: CI run knows which version/PR it's testing
- **Zero config**: CI environment variables (`GITHUB_TOKEN`, `GIT_BRANCH`) are used automatically

---

## 2. GitHub Actions

### Action setup

```yaml
# .github/workflows/covrr.yml
name: Covrr Validation

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  covrr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # needed for git diff against baseline tag

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run Covrr
        run: npx covrr run --format markdown
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          COVRR_CI: github
```

### Action input: `covrr-action.yml`

For a proper GitHub Action marketplace distribution:

```yaml
name: Covrr
description: Run Playwright validation with coverage tracking
author: Covrr

inputs:
  version:
    description: 'Covrr version to use (e.g. 0.1.0)'
    required: false
    default: 'latest'
  baseline:
    description: 'Baseline version to compare against (default: auto-detect)'
    required: false
  format:
    description: 'Output format (text, json, markdown)'
    required: false
    default: 'markdown'
  threshold:
    description: 'Minimum coverage percentage required'
    required: false

runs:
  using: 'node20'
  main: 'dist/index.js'
```

### GitHub token & permissions

- `GITHUB_TOKEN` must be passed to the step (provided automatically by Actions for most events)
- Required permission: `pull-requests: write` (to post comments)

---

## 3. GitLab CI

### Template

```yaml
# .gitlab-ci.yml
covrr:
  stage: test
  image: node:20-alpine
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
  script:
    - npm ci
    - npx playwright install --with-deps
    - npx covrr run --format json
  artifacts:
    paths:
      - .covrr/reports/latest.json
    expire_in: 7 days
  variables:
    COVRR_CI: gitlab
    GITLAB_TOKEN: $GITLAB_TOKEN  # CI_JOB_TOKEN or custom variable
```

### GitLab API

GitLab uses `GITLAB_TOKEN` (CI job token) or a project access token. The MR note API endpoint:

```
POST /projects/:id/merge_requests/:mr_iid/notes
```

With body `{"body": "<markdown>"}`.

---

## 4. PR Comment Format

### When to comment

- On every `push` to a PR branch (new comment or update existing)
- On PR open event

### Comment structure

```markdown
## Covrr — Validation Report

**v1.3.0** vs baseline **v1.2.3** | [Full Report](link-to-artifact)

### Scripts
| Script | Status | Duration | Tests |
|--------|--------|----------|-------|
| smoke | ✓ PASS | 45s | 12/12 |
| e2e | ✓ PASS | 3m02s | 48/48 |

### Coverage
| | Before | After | Δ |
|--|--------|-------|---|
| Lines | 83.4% | 85.2% | **+1.8%** ✓ |
| Branches | 78.5% | 78.0% | **-0.5%** |

Threshold: 80% | Status: **PASS**

### Changes
14 files changed across 23 commits | Packages: lodash `4.17.20 → 4.17.21`

---
_Covrr validation — [configure](https://docs.covrr.dev/config) · [view logs](link-to-ci-run)_
```

### Comment update strategy

- Each PR gets one Covrr comment (pinned to top)
- On new run, edit existing comment instead of creating new one
- This avoids comment spam in active PRs
- Implementation: store comment ID in `.covrr/state.json` (`github_comment_id`)

### When CI run fails hard (strict mode)

If `strict: true` in coverage config and threshold is breached, the CI run exits non-zero. The PR comment still posts, with a clear FAIL banner:

```markdown
## ⚠️ Covrr — Coverage Gate Failed

**v1.3.0** | Threshold: 80% | Actual: 71%

Coverage dropped **-9%** below threshold. Merge blocked until fixed.

[View failing report](link)
```

---

## 5. Guard-Rail Enforcement

### What "enforcement" means

In `strict` mode (from S002 config), a coverage breach causes:
1. Non-zero exit code from `covrr run`
2. PR comment flags the failure
3. If using GitHub branch protection: PR cannot be merged (status check fails)

### Branch protection setup

```yaml
# In GitHub branch protection rules for `main`:
# Require status checks to pass before merging:
required_status_checks:
  - context: covrr/coverage  # must match the status check name
  - strict: true
```

### Status check name

The GitHub Actions step should set the status check name to `covrr/coverage` (configurable). This appears in the PR's "All checks must pass" section.

### Graceful degradation

- If `GITHUB_TOKEN` is not available (e.g. fork PR from external contributor):
  - Warn but don't fail
  - Post comment without blocking status
  - Log: "External fork detected — skip guard-rail enforcement"

---

## 6. Context Injection

### Environment variables Covrr reads from CI

| Variable | Source | Used for |
|---------|--------|---------|
| `GITHUB_TOKEN` | GitHub Actions | PR comment API |
| `GITHUB_REF` | GitHub Actions | PR number detection |
| `GITHUB_SHA` | GitHub Actions | Version / commit correlation |
| `GITLAB_TOKEN` | GitLab CI | MR comment API |
| `CI_MERGE_REQUEST_IID` | GitLab CI | MR number detection |
| `CI_COMMIT_SHA` | GitLab CI | Version / commit correlation |
| `COVRR_CI` | Manual | Force CI mode detection |

### Auto-detection

On startup, Covrr checks:
1. Is `GITHUB_TOKEN` set? → GitHub Actions mode
2. Is `GITLAB_TOKEN` set? → GitLab CI mode
3. Is `COVRR_CI` set? → Use that explicitly
4. Otherwise → non-CI mode (no PR commenting)

---

## 7. Exit Codes

| Scenario | Exit code | Status check |
|---------|-----------|--------------|
| All scripts pass, coverage above threshold | 0 | ✓ PASS |
| All scripts pass, coverage below threshold, strict=false | 0 | ✓ PASS (warning) |
| Scripts failed | 1 | ✗ FAIL |
| Coverage below threshold, strict=true | 1 | ✗ FAIL |
| Config error, missing dependencies | 2 | ✗ FAIL |
| External fork (no token) | 0 | ✓ SKIPPED (guard-rail off) |

---

## 8. CI-Specific CLI Flags

| Flag | Description |
|------|-------------|
| `--ci github` | Force GitHub Actions mode |
| `--ci gitlab` | Force GitLab CI mode |
| `--pr-comment-id <id>` | Update existing PR comment (for idempotent edits) |
| `--status-check <name>` | Set GitHub status check name |
| `--no-comment` | Run without posting PR comment (useful for debugging) |

---

## 9. Implementation Notes

### GitHub API calls

```typescript
// Post or update PR comment
async function postPrComment(pr: number, body: string, commentId?: number) {
  if (commentId) {
    // Update existing comment
    await octokit.issues.updateComment({ ..., body, comment_id: commentId })
  } else {
    // Create new comment
    await octokit.issues.createComment({ ..., body })
  }
}
```

### GitHub status checks

```typescript
// Set commit status (for branch protection)
async function setStatus(sha: string, state: 'success' | 'failure', description: string) {
  await octokit.repos.createCommitStatus({
    owner, repo, sha, state, description,
    context: 'covrr/coverage'
  })
}
```

---

## 10. Edge Cases

| Situation | Behaviour |
|-----------|-----------|
| Fork PR from external contributor | Warn: "External fork — skip guard-rail enforcement". Don't fail. |
| Token has no PR comment permission | Warn: "Token missing `pull-requests: write`". Skip commenting. |
| PR already closed/merged | Don't comment; warn and exit 0 |
| Multiple runs in same commit | Only post once; update existing comment |
| Git diff fails (no baseline) | Warn: "Cannot diff — no baseline" → comment without delta section |
| GitHub API rate limit | Warn and skip; don't fail the CI run |

---

## 11. Acceptance Criteria

- [ ] GitHub Actions workflow example provided and tested
- [ ] GitLab CI template provided
- [ ] PR comment posted on push to PR branch (markdown format)
- [ ] PR comment updated (not duplicated) on subsequent runs
- [ ] Coverage delta shown in comment (lines before/after/Δ)
- [ ] Guard-rail: strict mode causes non-zero exit code
- [ ] GitHub status check set correctly (for branch protection)
- [ ] External fork scenario: warn and skip enforcement, don't fail
- [ ] `COVRR_CI` env var forces specific CI mode
- [ ] `GITHUB_TOKEN` / `GITLAB_TOKEN` auto-detected
- [ ] All CLI flags for CI control documented
- [ ] Unit tests for comment posting, status check, and context detection

---

## 12. Deliverables

| File | Description |
|------|-------------|
| `action.yml` | GitHub Action definition (for marketplace distribution) |
| `.github/workflows/covrr.yml` | Full workflow example |
| `.gitlab-ci.yml` (partial) | Covrr job definition |
| `src/ci/` module | CI detection, comment posting, status check code |

---

## 13. Dependencies

- `@octokit/rest` for GitHub API (PR comments + status checks)
- `@gitbeaker/rest` for GitLab API (optional, can use native `fetch`)
- Built with Node.js (TypeScript)

---

## 14. Future Considerations (out of scope for v1)

- GitHub App installation (vs PAT/HMAC) for better token permissions
- GitLab merge request widget (inline annotation)
- Buildkite, CircleCI, TravisCI integrations
- Slack notification on guard-rail breach
- Audit log of all CI enforcement events