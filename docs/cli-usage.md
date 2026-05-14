# CLI Usage

## Installation

### As a Dependency

```bash
npm install --save-dev covrr
# or
yarn add --dev covrr
```

### Global Installation

```bash
npm install -g covrr
```

### NPX (No Install)

```bash
npx covrr <command>
```

## Commands

### `covrr run [scripts...]`

Run Playwright scripts and generate a validation report.

**Arguments:**
- `scripts` — Optional script names to run (runs all if omitted)

**Options:**
- `--config <path>` — Path to covrr.yaml (default: auto-detect)
- `--format <format>` — Output format: `text`, `json`, `markdown` (default: `text`)
- `--output <path>` — Save JSON report to file

**Exit Codes:**
- `0` — All scripts passed
- `1` — One or more scripts failed
- `2` — Configuration or runtime error

**Examples:**
```bash
# Run all scripts
covrr run

# Run specific scripts
covrr run auth login

# With custom config
covrr run --config ./e2e/covrr.yaml

# Output as JSON
covrr run --format json

# Save report to file
covrr run --output report.json
```

### `covrr trigger <script>`

Run a single script and output raw JSON result to stdout.

**Arguments:**
- `script` — Script name to run

**Options:**
- `--config <path>` — Path to covrr.yaml

**Exit Codes:**
- `0` — Script passed
- `1` — Script failed
- `2` — Error

**Example:**
```bash
covrr trigger login --config ./e2e/covrr.yaml
```

### `covrr init`

Interactively create a covrr.yaml configuration file.

**Options:**
- `--defaults` — Use all defaults without prompts

**Example:**
```bash
covrr init
covrr init --defaults
```

### `covrr report list`

List historical validation reports.

**Options:**
- `--limit <n>` — Maximum number of reports to show (default: 10)

**Example:**
```bash
covrr report list
covrr report list --limit 20
```

### `covrr report show <ref>`

Show a specific validation report.

**Arguments:**
- `ref` — Report reference (timestamp or ID)

**Options:**
- `--format <format>` — Output format: `text`, `json`, `markdown` (default: `text`)

**Example:**
```bash
covrr report show 2024-01-15T10-30-00
covrr report show latest --format markdown
```

### `covrr version detect`

Print the detected version string.

**Options:**
- `--version <version>` — Override detected version
- `--dir <path>` — Directory to detect version in (default: `.`)

**Example:**
```bash
covrr version detect
covrr version detect --version 1.2.3
```

### `covrr version compare <from> <to>`

Generate a JSON diff between two versions.

**Arguments:**
- `from` — Starting version (git ref or version string)
- `to` — Ending version (git ref or version string)

**Options:**
- `--json` — Output as JSON (default)

**Example:**
```bash
covrr version compare v1.0.0 v1.1.0
covrr version compare HEAD~5 HEAD
```

### `covrr version list`

List all known versions stored in `.covrr/versions/`.

**Example:**
```bash
covrr version list
```

## GitHub Action

Use Covrr in GitHub Actions workflows:

```yaml
- uses: covrr@v1
  with:
    version: 'latest'        # Covrr version to use
    baseline: 'auto'         # Baseline version for comparison
    format: 'markdown'       # Output format
    threshold: '80'          # Minimum coverage percentage
    ci: 'github'             # CI platform
    no-comment: 'false'      # Skip PR comment
```

**Inputs:**

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `version` | No | `latest` | Covrr version to use |
| `baseline` | No | auto-detect | Baseline version for comparison |
| `format` | No | `markdown` | Output format (text, json, markdown) |
| `threshold` | No | — | Minimum coverage percentage |
| `ci` | No | `github` | CI platform (github, gitlab, manual) |
| `no-comment` | No | `false` | Skip posting PR comment |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `COVRR_CONFIG` | Path to covrr.yaml |
| `COVRR_CI` | Set to enable CI mode |
| `GITHUB_TOKEN` | GitHub API token for PR comments |
| `GITLAB_TOKEN` | GitLab API token for MR notes |

## Output Examples

### Text Format

```
✓ auth         passed   12.3s    (15 tests, 0 failed)
✗ checkout     failed   45.1s    (8 tests, 3 failed)
○ search       skipped  0ms      (0 tests, 0 failed)

Coverage: 78.5% (threshold: 80%) ✗
Version: v1.2.0 vs v1.1.0 (12 files changed, 5 commits)

Overall: FAILED
```

### JSON Format

```json
{
  "id": "covrr-2024-01-15T10-30-00-000Z",
  "generated_at": "2024-01-15T10:30:00.000Z",
  "version": "v1.2.0",
  "baseline_version": "v1.1.0",
  "tool_version": "0.1.0",
  "overall_status": "failed",
  "overall_message": "2 scripts failed, coverage below threshold",
  "scripts": [
    {
      "name": "auth",
      "status": "passed",
      "duration_ms": 12300,
      "tests_passed": 15,
      "tests_failed": 0,
      "exit_code": 0
    }
  ],
  "coverage": {
    "overall_percent": 78.5,
    "threshold_percent": 80,
    "passed_threshold": false
  }
}
```
