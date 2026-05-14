# Modules

## Config Module (`src/config/`)

Handles configuration loading, validation, and environment overrides.

### Key Classes

**`ConfigError`** — Generic configuration error with optional field reference
```typescript
class ConfigError extends Error {
  constructor(message: string, public field?: string)
}
```

**`ConfigNotFoundError`** — Thrown when no config file is found
```typescript
class ConfigNotFoundError extends Error {
  constructor(paths: string[])
}
```

### Key Functions

**`loadConfig(explicitPath?)`** → `CovrrConfig`

Loads and validates configuration from file system:
1. Finds config file (explicit or search paths)
2. Parses YAML
3. Applies environment overrides
4. Migrates if needed
5. Validates schema

**`findConfig(explicitPath?)`** → `string | null`

Locates config file without loading it.

### Search Paths

```typescript
SEARCH_PATHS = [
  './covrr.yaml',
  './covrr.yml',
  './.covrr/covrr.yaml',
  '~/.config/covrr/covrr.yaml'
]
```

### Schema Types

See [Configuration Reference](./configuration.md) for full schema.

## Script Module (`src/script/`)

Manages Playwright script discovery and execution.

### Discovery (`src/script/discovery.ts`)

**`discoverScripts(scripts, configDir)`** → `Record<string, string[]>`

Resolves glob patterns to sorted file lists.

**`checkPlaywright()`** → `{ installed: boolean; version?: string; error?: string }`

Verifies Playwright is installed and accessible.

### Runner (`src/script/runner.ts`)

**`runScript(name, definition, files, playwrightConfig?)`** → `Promise<ScriptResult>`

Spawns Playwright process with:
- `--config` (if playwrightConfig provided)
- `--timeout` (from definition or defaults)
- `--retries` (from definition or defaults)
- Test file paths

**`runScripts(scriptList, playwrightConfig?)`** → `Promise<ScriptResult[]>`

Runs multiple scripts sequentially.

### ScriptResult

```typescript
interface ScriptResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'timed_out' | 'error';
  duration_ms: number;
  tests_passed: number;
  tests_failed: number;
  exit_code: number;
}
```

## Coverage Module (`src/coverage/`)

Collects, validates, and stores coverage data.

### Collector (`src/coverage/collector.ts`)

**`collectFromFile(outputPath)`** → `CoverageReport | null`

Reads coverage from a JSON file.

**`collectFromStdout(stdout)`** → `CoverageReport | null`

Parses `COVERAGE:<base64>` lines from stdout.

**`parseCoverageJson(content)`** → `CoverageReport`

Validates and parses coverage JSON.

### Thresholds (`src/coverage/thresholds.ts`)

**`checkThresholds(report, thresholds)`** → `CoverageThresholdResult`

Checks coverage against configured thresholds.

### Storage (`src/coverage/storage.ts`)

**`saveCoverageReport(version, scriptName, report)`** → `Promise<void>`

Saves coverage to `.covrr/versions/{version}/{scriptName}.json`.

**`loadCoverageReport(version, scriptName)`** → `CoverageReport | null`

Loads coverage from storage.

### CoverageReport

```typescript
interface CoverageReport {
  version: string;
  script_name: string;
  generated_at: string;
  tool: string;
  summary: CoverageData;
  files?: CoverageFile[];
}
```

## Version Module (`src/version/`)

Detects and compares software versions.

### Detection (`src/version/detect.ts`)

**`detectVersion(options)`** → `DetectedVersion`

Detects version using priority order:
1. CLI override
2. Git tag (semver, highest if multiple)
3. Package files (package.json, pyproject.toml, Cargo.toml)
4. Git commit hash

**`findBaseline(options)`** → `string | null`

Finds baseline version for comparison.

**`sanitizeVersionForDir(version)`** → `string`

Sanitizes version string for filesystem use.

### Comparison (`src/version/compare.ts`)

**`compareVersions(from, to, options)`** → `VersionCompareResult`

Generates diff between two versions:
- Git-based diff (if both are git refs)
- Package-file-based diff (fallback)

Returns file changes, commits, and package version changes.

### Storage (`src/version/storage.ts`)

**`saveVersionManifest(version, manifest)`** → `void`

Saves version metadata to `.covrr/versions/{version}/manifest.json`.

**`loadVersionManifest(version)`** → `VersionManifest | null`

Loads version metadata.

## Reporting Module (`src/reporting/`)

Formats, stores, and delivers validation reports.

### Formatters (`src/reporting/formatters.ts`)

**`format(report, format)`** → `string`

Formats validation report as:
- `text` — Human-readable with status icons
- `json` — Pretty-printed JSON
- `markdown` — Markdown table with coverage badge
- `html` — HTML document
- `github-annotation` — GitHub Actions annotation format

### Storage (`src/reporting/storage.ts`)

**`saveReport(report)`** → `void`

Saves report to `.covrr/reports/{timestamp}.json`.

**`saveLatestReport(report)`** → `void`

Saves report to `.covrr/reports/latest.json`.

**`loadReport(ref)`** → `ValidationReport | null`

Loads report by reference.

### Delivery (`src/reporting/delivery.ts`)

**`deliverReport(report, outputs, githubContext)`** → `Promise<ReportDeliveryResult[]>`

Delivers report to configured outputs:
- File
- CI artifact
- GitHub PR comment
- Webhook

### ValidationReport

```typescript
interface ValidationReport {
  id: string;
  generated_at: string;
  version: string;
  baseline_version: string | null;
  tool_version: string;
  overall_status: 'passed' | 'failed' | 'warning' | 'error';
  overall_message: string;
  scripts: ScriptResult[];
  coverage?: CoverageSummary;
  version_diff?: VersionDiff;
  triggers: string[];
}
```

## CI Module (`src/ci/`)

Integrates with CI/CD platforms.

### Detector (`src/ci/detector.ts`)

**`detectCIContext(options)`** → `CIContext`

Detects CI environment from environment variables:
- GitHub Actions: `GITHUB_ACTIONS`, `GITHUB_REF`, etc.
- GitLab CI: `GITLAB_CI`, `CI_MERGE_REQUEST_IID`, etc.

**`isCIEnvironment(platform)`** → `boolean`

Checks if running in a CI environment.

### GitHub (`src/ci/github.ts`)

**`postPRComment(context, body, commentId?)`** → `Promise<CommentResult>`

Posts or updates a PR comment via Octokit.

**`setStatusCheck(context, state, description)`** → `Promise<StatusCheckResult>`

Sets a commit status check.

**`formatPRComment(report)`** → `string`

Formats report as GitHub PR comment markdown.

### GitLab (`src/ci/gitlab.ts`)

**`postMRComment(context, body, noteId?)`** → `Promise<CommentResult>`

Posts or updates a GitLab MR note.

**`formatMRComment(report)`** → `string`

Formats report as GitLab MR note markdown.

### Exit Codes (`src/ci/exit-codes.ts`)

**`determineExitCode(passed, thresholdsMet, strict)`** → `ExitCode`

Maps results to standard exit codes:
- `0` (PASS) — All passed
- `1` (FAIL) — Tests failed
- `2` (ERROR) — Configuration/runtime error
- `3` (THRESHOLD) — Coverage threshold breached (strict mode)

## State Module (`src/state/`)

Persists runtime state across invocations.

### State File

`.covrr/state.json`:
```json
{
  "github_comment_id": 1234567890,
  "gitlab_note_id": 987654321,
  "last_commit_sha": "abc123..."
}
```

### Functions

**`saveStateCommentId(id)`** → `Promise<void>`

Saves GitHub comment ID for idempotent updates.

**`getStateCommentId()`** → `Promise<number | null>`

Retrieves saved comment ID.

**`saveStateNoteId(id)`** → `Promise<void>`

Saves GitLab note ID.

**`getStateNoteId()`** → `Promise<number | null>`

Retrieves saved note ID.
