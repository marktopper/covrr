# Spec S004: Validation Reporting

**Task:** MAR-115
**Parent:** MAR-111 (Plan Covrr)
**Status:** Draft
**Created:** 2026-04-24

---

## Summary

Covrr produces structured validation reports after each run — combining script results, coverage data, and version diffs into a unified output. Reports are available as JSON, markdown, or stdout text, and can be posted as PR comments or saved as CI artifacts.

---

## 1. Overview

### What makes a "validation report"

A validation report is the complete output of a `covrr run` session, containing:
- Which scripts ran and their pass/fail status
- Coverage data vs thresholds (from S002)
- Version diff vs baseline (from S003)
- Overall pass/fail verdict

### Report generation flow

```
covrr run → [S001 executes scripts] → [S002 collects coverage] → [S003 detects version]
     ↓
Report assembled → [format output] → [deliver via configured channel]
```

---

## 2. Report Schema

### Full report JSON schema

```typescript
interface ValidationReport {
  id: string;                    // UUID for this run
  generated_at: string;          // ISO 8601 timestamp
  version: string;               // Version detected (S003)
  baseline_version: string | null; // null if no baseline
  tool_version: string;          // Covrr CLI version

  overall_status: 'passed' | 'failed' | 'warning' | 'error';
  overall_message: string;       // Human-readable summary

  scripts: ScriptResult[];       // Per-script results (from S001)
  coverage?: CoverageSummary;   // Coverage vs thresholds (from S002)
  version_diff?: VersionDiff;    // Files/packages changed (from S003)

  triggers: string[];           // What caused this run (CLI, webhook, CI)
}

interface ScriptResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'timed_out' | 'error';
  duration_ms: number;
  tests_passed: number;
  tests_failed: number;
  exit_code: number;
}

interface CoverageSummary {
  overall_percent: number;
  threshold_percent: number | null;
  passed_threshold: boolean;
  by_script: {
    name: string;
    lines_percent: number;
    branches_percent: number;
  }[];
}

interface VersionDiff {
  files_changed: number;
  files_added: number;
  files_modified: number;
  files_deleted: number;
  commits_between: number;
  packages_bumped: string[];
}
```

### Example JSON output

```json
{
  "id": "7b3e4a1c-2d5f-4e6a-9b8c-1d2e3f4a5b6c",
  "generated_at": "2026-04-24T10:00:00Z",
  "version": "v1.3.0",
  "baseline_version": "v1.2.3",
  "tool_version": "0.1.0",
  "overall_status": "passed",
  "overall_message": "All scripts passed. Coverage above threshold.",
  "scripts": [
    {
      "name": "smoke",
      "status": "passed",
      "duration_ms": 45230,
      "tests_passed": 12,
      "tests_failed": 0,
      "exit_code": 0
    },
    {
      "name": "e2e",
      "status": "passed",
      "duration_ms": 182340,
      "tests_passed": 48,
      "tests_failed": 0,
      "exit_code": 0
    }
  ],
  "coverage": {
    "overall_percent": 85.2,
    "threshold_percent": 80,
    "passed_threshold": true,
    "by_script": [
      { "name": "smoke", "lines_percent": 87.3, "branches_percent": 78.1 },
      { "name": "e2e", "lines_percent": 83.1, "branches_percent": 81.5 }
    ]
  },
  "version_diff": {
    "files_changed": 14,
    "files_added": 3,
    "files_modified": 10,
    "files_deleted": 1,
    "commits_between": 23,
    "packages_bumped": ["lodash@4.17.20→4.17.21"]
  }
}
```

---

## 3. Output Formats

### `covrr run --format <format>`

Supported formats:

| Format | Description |
|--------|-------------|
| `json` | Full machine-readable report (default for stdout in CI) |
| `markdown` | Human-readable markdown (used for PR comments) |
| `text` | Compact stdout summary (default for terminal) |
| `html` | Standalone HTML report with pass/fail colouring |
| `github-annotation` | GitHub Actions annotation format (`::error::`, `::warning::`) |

### Text format (terminal default)

```
✓ smoke       PASS  45s   (12 tests, 0 failed)
✓ e2e         PASS  3m02s (48 tests, 0 failed)
✓ coverage    PASS  1m18s (94 tests, 0 failed)

Coverage: 85.2% (threshold: 80%) ✓
Version: v1.3.0 vs v1.2.3 (14 files changed, 23 commits)

Overall: PASS
```

### Markdown format (PR comments)

```markdown
## Covrr Validation — v1.3.0 vs v1.2.3

| Script | Status | Duration | Tests |
|--------|--------|----------|-------|
| smoke | ✓ PASS | 45s | 12/12 |
| e2e | ✓ PASS | 3m02s | 48/48 |
| coverage | ✓ PASS | 1m18s | 94/94 |

**Coverage:** 85.2% (threshold 80%) ✓
**Changes:** 14 files across 23 commits | Packages bumped: lodash

Overall: **PASS** — [Full Report](link-to-json-artifact)
```

---

## 4. Report Delivery

### Output destinations

Reports can be delivered to multiple destinations simultaneously:

```yaml
# covrr.yaml
report:
  outputs:
    - type: file
      path: .covrr/reports/latest.json
    - type: artifact
      name: covrr-report
    - type: github_pr_comment
      # See S006 for GitHub token/auth setup
    - type: webhook
      url: https://ci.example.com/webhook
      method: POST
      headers:
        Authorization: "Bearer <token>"
```

### File output

Always saved as `.covrr/reports/<timestamp>.json` (or `.covrr/reports/latest.json` if configured).

### GitHub PR comment

When running in CI with a GitHub context:
1. Detect PR number from `GITHUB_REF` or `GITHUB_EVENT_PATH`
2. Post comment on PR (create new or update existing)
3. Comment includes: markdown summary + link to full JSON artifact
4. Edits previous Covrr comment instead of creating new ones (to avoid spam)

### Webhook

POST the full JSON report to the configured URL. Auth via Bearer token or custom headers.

### Exit code mapping

| overall_status | Exit code |
|---------------|-----------|
| `passed` | 0 |
| `failed` | 1 |
| `warning` | 0 (warning doesn't fail CI) |
| `error` | 2 |

---

## 5. Historical Reports

### Storage

```
.covrr/
└── reports/
    ├── 2026-04-24T10-00-00Z_v1.3.0.json
    ├── 2026-04-23T14-30-00Z_v1.2.3.json
    └── latest -> symlink to most recent
```

### `covrr report list [--limit <n>]`

Lists historical reports with version and timestamp.

```bash
covrr report list --limit 5
# v1.3.0  2026-04-24 10:00  PASS
# v1.2.3  2026-04-23 14:30  PASS
# v1.2.2  2026-04-22 09:15  FAIL  (coverage 71% < threshold 80%)
# v1.2.1  2026-04-21 16:45  PASS
# v1.2.0  2026-04-20 11:00  PASS
```

### `covrr report show <timestamp-or-version>`

Shows full details of a specific report.

---

## 6. CI Artefact Handling

### GitHub Actions

```yaml
- name: Run Covrr
  run: npx covrr run --format json --output .covrr/report.json
  artifacts:
    - path: .covrr/report.json
      name: covrr-report-${{ github.sha }}
```

### GitLab CI

```yaml
covrr:
  script:
    - npx covrr run --format json --output covrr-report.json
  artifacts:
    paths:
      - covrr-report.json
    expire_in: 30 days
```

---

## 7. Integration Points

### With S001 (Script Management)
- Script results (`ScriptResult[]`) come from Playwright runner output

### With S002 (Coverage Tracking)
- `CoverageSummary` embedded in report if coverage data exists

### With S003 (Version Change Detection)
- `VersionDiff` embedded if a baseline comparison was possible

---

## 8. Edge Cases

| Situation | Behaviour |
|-----------|-----------|
| No scripts run (empty config) | Report with `overall_status: warning` and message "No scripts defined" |
| Some scripts fail, some pass | `overall_status: failed`, all script results included |
| Coverage not available | `coverage` field omitted from report (not an error) |
| Version diff not available | `version_diff` field omitted, `baseline_version: null` |
| All scripts skipped | `overall_status: warning` — no actual validation ran |
| Report file write fails | Warning to stderr; attempt stdout output; don't fail the run |
| PR comment creation fails | Warning to stderr; JSON still saved to file; CI continues |

---

## 9. Acceptance Criteria

- [ ] Full report schema implemented with all `ValidationReport` fields
- [ ] JSON, markdown, text, and HTML output formats working
- [ ] File output to `.covrr/reports/<timestamp>.json`
- [ ] GitHub PR comment: create new, edit existing (idempotent)
- [ ] Webhook delivery with configurable URL/method/headers
- [ ] `covrr report list` shows historical reports
- [ ] `covrr report show <ref>` displays full report
- [ ] Exit codes correctly reflect overall_status
- [ ] CI artefact configuration documented for GitHub Actions and GitLab CI
- [ ] Unit tests for all formatters and delivery mechanisms

---

## 10. CLI Summary

| Command | Description |
|---------|-------------|
| `covrr run --format json` | Run with JSON output to stdout |
| `covrr run --format markdown` | Run with markdown output to stdout |
| `covrr run --output <path>` | Save full JSON report to file |
| `covrr report list` | List historical reports |
| `covrr report show <ref>` | Show specific report |

---

## 11. Dependencies

- `js-yaml` for config
- `@octokit/rest` for GitHub API (PR comments) — optional, only loaded when `github_pr_comment` output configured
- Built with Node.js (TypeScript)

---

## 12. Future Considerations (out of scope for v1)

- Interactive HTML dashboard (serve report via local web server)
- Email delivery of reports
- Slack webhook integration
- Remote report storage (S3, GCS)
- Report diff view (compare two reports side-by-side)