# Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI (cli.ts)                        │
│  run | trigger | init | report (list/show) | version        │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Config     │    │   Script     │    │   Version    │
│   Module     │    │   Module     │    │   Module     │
│              │    │              │    │              │
│ • loader     │    │ • discovery  │    │ • detect     │
│ • validate   │    │ • runner     │    │ • compare    │
│ • env        │    │              │    │ • storage    │
│ • search     │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Coverage   │◄───┤   Report     │◄───┤     CI       │
│   Module     │    │   Module     │    │   Module     │
│              │    │              │    │              │
│ • collector  │    │ • formatters │    │ • detector   │
│ • thresholds │    │ • storage    │    │ • github     │
│ • diff       │    │ • delivery   │    │ • gitlab     │
│ • storage    │    │ • history    │    │ • exit-codes │
└──────────────┘    └──────────────┘    └──────────────┘
```

## Data Flow

### Run Command Flow

```
1. Parse CLI arguments
2. Load configuration (covrr.yaml)
   ├── Search paths: CWD, .covrr/, ~/.config/covrr/, etc.
   ├── Apply environment variable overrides
   └── Validate schema
3. Check Playwright installation
4. Discover scripts (resolve glob patterns)
5. Run scripts via Playwright CLI
   ├── Spawn npx playwright test
   ├── Parse list-reporter stdout
   └── Collect coverage (file or stdout)
6. Build validation report
   ├── Script results (pass/fail counts)
   ├── Coverage summary (with thresholds)
   └── Version diff (vs baseline)
7. Format output (text/json/markdown)
8. Save report to .covrr/reports/
9. Deliver to configured outputs
10. Exit with appropriate code
```

## Module Responsibilities

### Config Module (`src/config/`)

Handles all configuration concerns:
- **loader.ts** — Loads and merges YAML configs from search paths
- **schema.ts** — TypeScript interfaces and constants
- **validate.ts** — Schema validation
- **env.ts** — Environment variable overrides (`COVRR_*`)
- **search.ts** — Config file discovery logic
- **migrate.ts** — Config version migration with backups

### Script Module (`src/script/`)

Manages Playwright test execution:
- **discovery.ts** — Resolves glob patterns to file lists; checks Playwright availability
- **runner.ts** — Spawns Playwright process, parses stdout, handles timeouts/retries
- **types.ts** — Script result types

### Coverage Module (`src/coverage/`)

Collects and analyzes coverage data:
- **collector.ts** — Reads coverage from JSON files or stdout (`COVERAGE:base64`)
- **thresholds.ts** — Validates coverage against configured thresholds
- **diff.ts** — Compares coverage between versions
- **storage.ts** — Persists coverage data in `.covrr/versions/`

### Version Module (`src/version/`)

Detects and compares versions:
- **detect.ts** — Detects version from git tags, package.json, pyproject.toml, Cargo.toml, or git hash
- **compare.ts** — Generates diffs between versions (git diff or package file comparison)
- **storage.ts** — Saves/loads version manifests and diffs

### Reporting Module (`src/reporting/`)

Formats and delivers reports:
- **formatters.ts** — text, JSON, Markdown, HTML formatters
- **storage.ts** — Saves reports to `.covrr/reports/`
- **history.ts** — Lists and retrieves historical reports
- **delivery.ts** — Sends to files, artifacts, GitHub PR comments, webhooks

### CI Module (`src/ci/`)

Integrates with CI/CD platforms:
- **detector.ts** — Detects CI environment (GitHub Actions, GitLab CI)
- **github.ts** — Posts PR comments, sets status checks via Octokit
- **gitlab.ts** — Posts MR notes via GitLab API
- **exit-codes.ts** — Maps results to standard exit codes

### State Module (`src/state/`)

Persists runtime state:
- **manifest.ts** — .covrr directory manifest
- **state.ts** — GitHub comment IDs, last commit SHA

## Key Design Decisions

1. **ES2022 Modules** — Uses native ESM with `.js` extension in imports
2. **Config-Relative Discovery** — Script glob patterns resolve relative to config file location, not CWD
3. **Deterministic Ordering** — Discovered files are sorted for reproducible runs
4. **Retry Handling** — Playwright retries are tracked; only final results count
5. **Coverage via stdout** — Supports `COVERAGE:base64json` line in stdout for CI flexibility
6. **Idempotent Comments** — Updates existing PR comments instead of posting duplicates
7. **External Fork Guard** — Skips comment posting on external forks (no write permissions)

## File Organization

```
src/
├── cli.ts                    # Single entry point, all commands
├── ci/
│   ├── detector.ts           # CI environment detection
│   ├── exit-codes.ts         # Exit code mapping
│   ├── github.ts             # GitHub API integration
│   ├── gitlab.ts             # GitLab API integration
│   ├── index.ts              # Main integration orchestrator
│   └── types.ts              # CI-specific types
├── config/
│   ├── env.ts                # Environment variable handling
│   ├── loader.ts             # Config file loading
│   ├── migrate.ts            # Config migration
│   ├── schema.ts             # TypeScript interfaces
│   ├── search.ts             # Config discovery
│   ├── validate.ts           # Schema validation
│   └── __tests__/            # Unit tests
├── coverage/
│   ├── collector.ts          # Coverage data collection
│   ├── diff.ts               # Coverage comparison
│   ├── storage.ts            # Coverage persistence
│   ├── thresholds.ts         # Threshold validation
│   ├── types.ts              # Coverage types
│   └── __tests__/            # Unit tests
├── reporting/
│   ├── delivery.ts           # Report delivery
│   ├── formatters.ts         # Output formatters
│   ├── history.ts            # Report history
│   ├── storage.ts            # Report persistence
│   ├── types.ts              # Report types
│   └── __tests__/            # Unit tests
├── script/
│   ├── discovery.ts          # Script file discovery
│   ├── runner.ts             # Script execution
│   ├── types.ts              # Script types
│   └── __tests__/            # Unit tests
├── state/
│   ├── manifest.ts           # State manifest
│   ├── state.ts              # State operations
│   └── __tests__/            # Unit tests
└── version/
    ├── compare.ts            # Version comparison
    ├── detect.ts             # Version detection
    ├── index.ts              # Public API
    ├── storage.ts            # Version persistence
    ├── types.ts              # Version types
    └── __tests__/            # Unit tests
```
