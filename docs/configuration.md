# Configuration

## Configuration File

Covrr uses a YAML configuration file named `covrr.yaml` (or `covrr.yml`).

## Search Paths

Covrr searches for the configuration file in this order:

1. Path specified by `--config` flag
2. `./covrr.yaml`
3. `./covrr.yml`
4. `./.covrr/covrr.yaml`
5. `~/.config/covrr/covrr.yaml`

## Schema

### Top-Level Structure

```yaml
# Required: Script definitions
scripts:
  [script-name]:
    pattern: string          # Glob pattern for test files (required)
    timeout_ms: number       # Per-script timeout (default: 60000)
    retry: number            # Retry count (default: 1)
    env:                     # Environment variables
      KEY: value

# Optional: Default settings for all scripts
defaults:
  timeout_ms: 60000          # Default timeout in milliseconds
  retry: 1                   # Default retry count
  workers: 4                 # Playwright worker count
  browser: chromium          # Browser: chromium, firefox, webkit

# Optional: Coverage settings
coverage:
  tool: string               # Coverage tool name
  output_path: string        # Path to coverage JSON file
  thresholds:                # Coverage thresholds
    lines_percent: number
    branches_percent: number
    functions_percent: number
  strict: boolean            # Fail on threshold breach

# Optional: Version detection settings
version:
  baseline: string           # Baseline version for comparison
  detect_from: git|package   # Version detection source

# Optional: Report delivery
report:
  outputs:
    - type: file             # Save to file
      path: reports/covrr.json
    - type: artifact         # CI artifact
      name: covrr-report
    - type: github_pr_comment # Post PR comment
    - type: webhook          # POST to webhook
      url: https://example.com/hook
      method: POST
      headers:
        Authorization: Bearer token

# Optional: CI-specific settings
ci:
  github:
    token: string            # GitHub token (or use GITHUB_TOKEN env var)
    annotation: boolean      # Enable GitHub annotations
  gitlab:
    token: string            # GitLab token (or use GITLAB_TOKEN env var)
    annotation: boolean      # Enable GitLab annotations
```

## Example Configuration

### Minimal

```yaml
scripts:
  login:
    pattern: tests/login.spec.ts
  checkout:
    pattern: tests/checkout/**/*.spec.ts
```

### Full Configuration

```yaml
scripts:
  auth:
    pattern: tests/auth/**/*.spec.ts
    timeout_ms: 120000
    retry: 2
    env:
      TEST_USER: admin

  e2e:
    pattern: tests/e2e/**/*.spec.ts
    timeout_ms: 300000

defaults:
  timeout_ms: 60000
  retry: 1
  workers: 4
  browser: chromium

coverage:
  tool: nyc
  output_path: coverage/coverage-final.json
  thresholds:
    lines_percent: 80
    branches_percent: 75
    functions_percent: 70
  strict: true

version:
  baseline: auto
  detect_from: git

report:
  outputs:
    - type: file
      path: reports/covrr-report.json
    - type: github_pr_comment

ci:
  github:
    annotation: true
```

## Script Definition

Each script entry defines a set of Playwright tests to run.

### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `pattern` | string | Yes | — | Glob pattern for test files |
| `timeout_ms` | number | No | `60000` | Test timeout in milliseconds |
| `retry` | number | No | `1` | Number of retries on failure |
| `env` | object | No | `{}` | Environment variables for this script |

### Pattern Resolution

Glob patterns are resolved relative to the configuration file's directory, not the current working directory.

```yaml
# If covrr.yaml is in ./e2e/
scripts:
  login:
    pattern: tests/*.spec.ts   # Resolves to ./e2e/tests/*.spec.ts
```

### Environment Variables

Script-specific environment variables are merged with process environment:

```yaml
scripts:
  staging:
    pattern: tests/**/*.spec.ts
    env:
      BASE_URL: https://staging.example.com
      API_KEY: ${STAGING_API_KEY}  # Can reference parent env vars
```

## Defaults

Default settings apply to all scripts unless overridden at the script level.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `timeout_ms` | number | `60000` | Test timeout in milliseconds |
| `retry` | number | `1` | Retry count on failure |
| `workers` | number | `4` | Playwright worker processes |
| `browser` | string | `chromium` | Browser to use |

## Coverage

### Collection Methods

Covrr supports two coverage collection methods:

1. **File-based** — Reads coverage from a JSON file specified by `output_path`
2. **Stdout-based** — Parses `COVERAGE:<base64>` lines from test stdout

### Thresholds

Coverage thresholds are checked per-category:

```yaml
coverage:
  thresholds:
    lines_percent: 80
    branches_percent: 75
    functions_percent: 70
  strict: true   # If true, threshold breach fails the run
```

If `strict` is `true`, the overall run fails if any threshold is not met.

## Version Detection

### Sources

Version detection uses this priority order:

1. CLI flag `--version`
2. Git tag at HEAD (annotated, semver, highest if multiple)
3. Package files: `package.json`, `pyproject.toml`, `Cargo.toml`
4. Git commit hash (fallback)

### Baseline

The baseline version is used for comparison. Set to `auto` to use the latest known version.

```yaml
version:
  baseline: v1.0.0   # Compare against specific version
  # or
  baseline: auto     # Compare against latest stored version
```

## Report Outputs

### File Output

```yaml
report:
  outputs:
    - type: file
      path: ./reports/covrr.json
```

### Artifact Output

```yaml
report:
  outputs:
    - type: artifact
      name: covrr-report
```

### GitHub PR Comment

```yaml
report:
  outputs:
    - type: github_pr_comment
```

Requires `GITHUB_TOKEN` environment variable.

### Webhook Output

```yaml
report:
  outputs:
    - type: webhook
      url: https://hooks.slack.com/services/...
      method: POST
      headers:
        Content-Type: application/json
```

## Environment Variable Overrides

All configuration values can be overridden via environment variables:

| Config Path | Environment Variable |
|-------------|---------------------|
| `scripts.*.timeout_ms` | `COVRR_SCRIPT_[NAME]_TIMEOUT_MS` |
| `scripts.*.retry` | `COVRR_SCRIPT_[NAME]_RETRY` |
| `defaults.timeout_ms` | `COVRR_DEFAULT_TIMEOUT_MS` |
| `defaults.retry` | `COVRR_DEFAULT_RETRY` |
| `defaults.workers` | `COVRR_DEFAULT_WORKERS` |
| `defaults.browser` | `COVRR_DEFAULT_BROWSER` |
| `coverage.tool` | `COVRR_COVERAGE_TOOL` |
| `coverage.output_path` | `COVRR_COVERAGE_OUTPUT_PATH` |
| `version.baseline` | `COVRR_VERSION_BASELINE` |

## Configuration Migration

Covrr automatically migrates older configuration formats and creates backups:

```
.covrr/
├── covrr.yaml          # Current config
└── backups/
    ├── covrr-2024-01-15-10-30-00.yaml
    └── covrr-2024-01-14-08-15-00.yaml
```
