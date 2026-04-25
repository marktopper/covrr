# Spec S005: Configuration & Persistence

**Task:** MAR-116
**Parent:** MAR-111 (Plan Covrr)
**Status:** Draft
**Created:** 2026-04-24

---

## Summary

Covrr is configured via a `covrr.yaml` file with sensible defaults. State (coverage data, version history, reports) is stored in a `.covrr/` directory in the project root. This spec covers config schema, discovery, precedence, and state management.

---

## 1. Configuration File

### File: `covrr.yaml`

The canonical configuration file for Covrr. All settings can be overridden via CLI flags.

```yaml
# Which scripts to run and how
scripts:
  smoke:
    pattern: "tests/smoke/**/*.spec.ts"
    timeout_ms: 30000
    retry: 2

# Global script defaults
defaults:
  timeout_ms: 60000
  retry: 1
  workers: 4
  browser: chromium

# Coverage collection (see S002)
coverage:
  tool: istanbul
  output_path: ./coverage/coverage-final.json
  thresholds:
    lines_percent: 80
    branches_percent: 75
  strict: false

# Version baseline (see S003)
version:
  baseline: v1.2.0       # explicit baseline; omit for auto-detect
  detect_from: git        # git | package (default: git, fallback: package)

# Reporting (see S004)
report:
  outputs:
    - type: file
      path: .covrr/reports/latest.json

# CI/CD integration (see S006)
ci:
  github:
    token: env:GITHUB_TOKEN
    annotation: true
```

---

## 2. Config Schema

### Top-level fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `scripts` | map | `{}` | Script definitions (see S001) |
| `defaults` | object | `{}` | Global script defaults |
| `coverage` | object | `{}` | Coverage settings (see S002) |
| `version` | object | `{}` | Version detection settings |
| `report` | object | `{}` | Report output settings |
| `ci` | object | `{}` | CI/CD integration settings |

### `defaults` schema

| Field | Type | Default |
|-------|------|---------|
| `timeout_ms` | integer | `60000` |
| `retry` | integer | `1` |
| `workers` | integer | `4` |
| `browser` | string | `chromium` |

### `coverage.thresholds` schema

| Field | Type | Default |
|-------|------|---------|
| `lines_percent` | number | `null` (no threshold) |
| `branches_percent` | number | `null` |
| `functions_percent` | number | `null` |
| `strict` | boolean | `false` |

---

## 3. Config Discovery

### Search paths (in order)

1. `--config <path>` — explicit path (highest priority)
2. `./covrr.yaml` — current working directory
3. `./covrr.yml` — alternative extension
4. `.covrr/config.yaml` — hidden directory in project root
5. `~/.covrr/config.yaml` — home directory fallback (rarely used)

### Discovery logic

```python
def find_config():
    if cli_args.config:
        return read_config(cli_args.config)

    for path in ['covrr.yaml', 'covrr.yml', '.covrr/config.yaml']:
        if os.path.exists(path):
            return read_config(path)

    if os.path.exists(os.path.expanduser('~/.covrr/config.yaml')):
        return read_config('~/.covrr/config.yaml')

    raise ConfigNotFoundError("No covrr.yaml found")
```

### No config scenario

If no config is found:
- `covrr run` → error with instructions to run `covrr init`
- `covrr version detect` → works (no config needed)
- `covrr coverage *` → error "No project config found"

---

## 4. Config Precedence

Priority (highest to lowest):
1. CLI flags (`--version`, `--config`, etc.)
2. Environment variables (`COVRR_VERSION`, `COVRR_CONFIG`, etc.)
3. Config file (`covrr.yaml`)
4. Defaults (built-in)

### Environment variable mapping

| Env var | Config field | Example |
|---------|-------------|---------|
| `COVRR_CONFIG` | config path | `/path/to/covrr.yaml` |
| `COVRR_VERSION` | `version` override | `v1.2.3` |
| `COVRR_BASELINE` | `version.baseline` | `v1.2.0` |
| `COVRR_BROWSER` | `defaults.browser` | `firefox` |
| `COVRR_WORKERS` | `defaults.workers` | `8` |
| `COVRR_THRESHOLD_LINES` | `coverage.thresholds.lines_percent` | `80` |

---

## 5. Config Validation

### On load

- File must be valid YAML (parse error → error with line number)
- Unknown top-level keys → warning (ignored, not fatal)
- Type errors (integer expected, string given) → error with field path

### Schema validation

```typescript
// Minimal valid config
{ scripts: {} }

// Full config with all fields (see schema above)
```

### Error format

```
Config error at 'coverage.thresholds.lines_percent':
  Expected number, got string "eighty"
  Valid types: integer (e.g. 80) or float (e.g. 80.5)
```

---

## 6. State Directory

### Location

`.covrr/` in the project root. Created automatically on first `covrr run`.

### Directory structure

```
project/
└── .covrr/
    ├── config.yaml              # Symlink to source config (or copied)
    ├── coverage/                 # Coverage data (S002)
    │   ├── v1.2.3/
    │   │   ├── smoke.json
    │   │   └── e2e.json
    │   └── v1.3.0/
    │       └── smoke.json
    ├── versions/                 # Version data (S003)
    │   ├── v1.2.3/
    │   │   ├── manifest.json
    │   │   └── diff.json
    │   └── v1.3.0/
    ├── reports/                  # Validation reports (S004)
    │   ├── 2026-04-24T10-00-00Z_v1.3.0.json
    │   └── latest -> 2026-04-24T10-00-00Z_v1.3.0.json
    └── state.json                # Global state (last version, baseline, etc.)
```

### Version-specific subdirectories

Each version gets its own subdirectory, sanitized for filesystem safety:
- `v1.2.3` stays `v1.2.3`
- `v1.2.3+build` stays `v1.2.3_build` (underscore replaces `+`)
- `v1.2.3-beta.1` stays `v1.2.3-beta_1`
- Non-semver strings: replace `[^a-zA-Z0-9.-]` with `_`

---

## 7. State File

### `state.json` — global state

```json
{
  "last_version": "v1.3.0",
  "last_version_at": "2026-04-24T10:00:00Z",
  "baseline_version": "v1.2.3",
  "last_run_duration_ms": 274592,
  "last_run_scripts": ["smoke", "e2e", "coverage"],
  "last_run_status": "passed",
  "project_id": "my-project"  // optional, used in remote scenarios
}
```

Updated after every `covrr run`. Used by `--resume` scenarios and for quick status checks.

---

## 8. Config Migration

### Format upgrades

When a new Covrr version changes the config schema:
1. On first run with new version, check `config.yaml` version marker
2. If format has changed, attempt auto-migration
3. If auto-migration fails, warn and back up old config as `config.yaml.backup.<timestamp>`

### Version marker

```yaml
# v1 format (current)
covrr_format_version: "1"

# If we ship a breaking change, bump to "2", etc.
```

---

## 9. `covrr init`

### Interactive initialisation

```bash
$ covrr init
✓ Detected Node.js project (package.json found)
✓ Detected Playwright (playwright.config.ts found)

Script pattern to use? [tests/**/*.spec.ts]:
Timeout (ms)? [60000]:
Enable coverage collection? [y/N]:
GitHub token for PR comments? [skip]:

Created covrr.yaml
Initialized .covrr/ directory
Run 'covrr run' to start
```

### Non-interactive init

```bash
covrr init --defaults  # use all defaults, no prompts
covrr init --script-pattern "tests/**/*.spec.ts" --coverage
```

---

## 10. Edge Cases

| Situation | Behaviour |
|-----------|-----------|
| Config file empty | Use all defaults; warn "covrr.yaml is empty, using defaults" |
| Config file has trailing whitespace / BOM | Strip before parsing |
| `.covrr/` already exists as a file (not dir) | Error: ".covrr exists as a file — remove it first" |
| Can't write to `.covrr/` (permissions) | Error with suggestion: `chmod +w .` or run in different directory |
| Config has unknown keys | Warning only — proceed with loading |
| Duplicate script names | Error: "Duplicate script name '<name>' in config" |
| Script with no `pattern` field | Error: "Script '<name>' missing required field 'pattern'" |

---

## 11. Acceptance Criteria

- [ ] `covrr.yaml` schema fully documented (all fields, types, defaults)
- [ ] Config discovery from 5 search paths in priority order
- [ ] `--config` flag overrides all discovery paths
- [ ] Env var overrides work for all documented env vars
- [ ] CLI flags override env vars and config file
- [ ] Unknown top-level keys produce warning (not error)
- [ ] Type errors produce helpful error messages with field path
- [ ] `.covrr/` directory structure created on first run
- [ ] `state.json` updated after every run with correct fields
- [ ] `covrr init` creates config and initialises `.covrr/` with prompts
- [ ] `covrr init --defaults` works non-interactively
- [ ] Config migration backup works when format changes
- [ ] Unit tests for config loading, precedence, and validation

---

## 12. CLI Summary

| Command | Description |
|---------|-------------|
| `covrr init` | Interactively create `covrr.yaml` and `.covrr/` |
| `covrr init --defaults` | Create with all defaults, no prompts |
| `covrr config show` | Print current config (resolved, with defaults applied) |
| `covrr config validate` | Validate config file and report errors |

---

## 13. Dependencies

- `js-yaml` for config file parsing
- `commander` or `clipanion` for CLI (TypeScript)
- Built with Node.js (TypeScript)

---

## 14. Future Considerations (out of scope for v1)

- Remote config (fetch from URL)
- Config inheritance (base config + project overrides)
- TOML config format support
- `covrr config migrate` CLI command for non-interactive upgrades