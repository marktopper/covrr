# Covrr

Playwright coverage and version-validation tool.

Covrr discovers and runs your Playwright scripts from a `covrr.yaml` config, collects coverage, compares results across versions, and can report into CI (PR comments, artifacts, webhooks).

---

## Install

**Requirements:** Node.js ≥ 18, and Playwright available in the project (`@playwright/test` plus browsers).

```bash
# From a local clone (package is not confirmed published on npm)
git clone https://github.com/marktopper/covrr.git
cd covrr
npm install
npm run build

# Link the CLI, or invoke via node/npx from the package root
npm link   # optional: exposes `covrr` globally
```

In a consumer project, install Playwright if you have not already:

```bash
npm install -D @playwright/test
npx playwright install
```

---

## Quick start

```bash
# In your Playwright project
covrr init --defaults          # writes covrr.yaml and creates .covrr/
# Edit covrr.yaml so script patterns match your tests
covrr run                      # run all scripts
covrr run smoke                # run one named script
covrr trigger smoke            # run one script; JSON result on stdout
```

Exit codes:

| Code | Meaning |
|------|---------|
| `0` | All scripts passed |
| `1` | One or more scripts failed |
| `2` | Covrr error (missing config, Playwright not found, invalid config, etc.) |

---

## Config

Covrr looks for config in this order:

1. `--config <path>`
2. `./covrr.yaml`
3. `./covrr.yml`
4. `.covrr/config.yaml`
5. `~/.covrr/config.yaml`

### Example `covrr.yaml`

```yaml
scripts:
  smoke:
    pattern: "tests/smoke/**/*.spec.ts"
    timeout_ms: 30000
    retry: 2

  e2e:
    pattern: "tests/e2e/**/*.spec.ts"
    timeout_ms: 120000
    retry: 1
    env:
      BASE_URL: "https://staging.example.com"

defaults:
  timeout_ms: 60000
  retry: 1
  workers: 4
  browser: chromium   # chromium | firefox | webkit

coverage:
  tool: istanbul
  output_path: ./coverage/coverage-final.json
  thresholds:
    lines_percent: 80
    branches_percent: 75
    functions_percent: 70
  strict: false

version:
  baseline: v1.2.0        # omit for auto-detect (previous semver tag)
  detect_from: git        # git | package

report:
  outputs:
    - type: file
      path: .covrr/reports/latest.json
    - type: artifact
      name: covrr-report
    - type: github_pr_comment
    - type: webhook
      url: https://ci.example.com/webhook
      method: POST
      headers:
        Authorization: "Bearer token"

ci:
  github:
    token: env:GITHUB_TOKEN
    annotation: true
  gitlab:
    token: env:GITLAB_TOKEN
    annotation: true
```

### Schema reference

#### `scripts.<name>`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pattern` | string (glob) | **required** | Test files relative to the config directory |
| `timeout_ms` | number | from `defaults` / `60000` | Playwright `--timeout` |
| `retry` | number | from `defaults` / `1` | Playwright `--retries` |
| `env` | map of string → string | `{}` | Env vars injected for that script |

#### `defaults`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `timeout_ms` | number | `60000` | Global timeout |
| `retry` | number | `1` | Global retries |
| `workers` | number | `4` | Playwright workers |
| `browser` | string | `chromium` | `chromium`, `firefox`, or `webkit` |

#### `coverage`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `tool` | string | — | Coverage tool label (e.g. `istanbul`, `nyc`) |
| `output_path` | string | — | Path to coverage JSON after a run |
| `thresholds.lines_percent` | number | none | Minimum line coverage % |
| `thresholds.branches_percent` | number | none | Minimum branch coverage % |
| `thresholds.functions_percent` | number | none | Minimum function coverage % |
| `strict` | boolean | `false` | If `true`, threshold breach fails the run |

Scripts may also emit coverage on stdout as `COVERAGE:<base64-json>` (see specs/S002).

#### `version`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `baseline` | string | auto | Baseline version for diffs |
| `detect_from` | `git` \| `package` | `git` | Prefer git tags or package files |

Detection priority (when not overridden): CLI → git semver tag → `package.json` / `pyproject.toml` / `Cargo.toml` → git commit hash.

#### `report.outputs[]`

| Field | Type | Description |
|-------|------|-------------|
| `type` | `file` \| `artifact` \| `github_pr_comment` \| `webhook` | Delivery channel |
| `path` | string | File path (`type: file`) |
| `name` | string | Artifact name (`type: artifact`) |
| `url` | string | Webhook URL |
| `method` | string | HTTP method for webhook |
| `headers` | map | Webhook headers |

#### `ci`

| Field | Type | Description |
|-------|------|-------------|
| `github.token` | string | GitHub token; use `env:VAR_NAME` to read from the environment |
| `github.annotation` | boolean | Emit GitHub Actions annotations |
| `gitlab.token` | string | GitLab token; supports `env:VAR_NAME` |
| `gitlab.annotation` | boolean | Emit GitLab annotations |

Tokens written as `env:GITHUB_TOKEN` are resolved from the process environment at runtime.

---

## CLI

### `covrr run [scripts...]`

Run one or more named scripts from `covrr.yaml`. With no names, runs every script.

```bash
covrr run
covrr run smoke e2e
covrr run --config ./subproject/covrr.yaml
covrr run --format json
covrr run --format text --output .covrr/report.json
```

| Option | Description |
|--------|-------------|
| `--config <path>` | Path to `covrr.yaml` |
| `--format <format>` | `text` (default), `json`, or `markdown` |
| `--output <path>` | Write a JSON report to a file |

Text output example:

```text
✓ smoke        passed   45.2s    (12/12)
✗ e2e          failed   3m2s     (46/48)

Overall: FAIL
```

### `covrr trigger <script>`

Run a single script and print its JSON result to stdout (handy for webhooks or CI steps).

```bash
covrr trigger smoke > result.json
```

### `covrr init`

Create a starter `covrr.yaml` and a `.covrr/` directory.

```bash
covrr init              # currently writes the same defaults as --defaults
covrr init --defaults   # non-interactive defaults
```

Default config written by `init`:

```yaml
scripts:
  smoke:
    pattern: tests/**/*.spec.ts
    timeout_ms: 30000
    retry: 2
defaults:
  timeout_ms: 60000
  retry: 1
  workers: 4
  browser: chromium
```

### Additional commands (specified; see Notes)

The product specs also define:

| Command | Purpose |
|---------|---------|
| `covrr coverage report [--script] [--version]` | Coverage summary |
| `covrr coverage diff <from> <to>` | Coverage delta between versions |
| `covrr coverage status` | Threshold pass/fail |
| `covrr version detect` | Print detected version |
| `covrr version compare <from> <to>` | File/commit/package diff |
| `covrr version list` | Known versions under `.covrr/versions/` |
| `covrr report list [--limit n]` | Historical validation reports |
| `covrr report show <ref>` | Show one stored report |
| `covrr config show` | Resolved config |
| `covrr config validate` | Validate `covrr.yaml` |

CI-oriented flags from the specs include `--ci github|gitlab`, `--baseline`, `--no-comment`, `--status-check`, and `--pr-comment-id`. Prefer the implemented `run` / `trigger` / `init` surface until those land on your branch.

---

## Example

Project layout:

```text
my-app/
├── covrr.yaml
├── playwright.config.ts
├── tests/
│   ├── smoke/
│   │   └── smoke.spec.ts
│   └── e2e/
│       └── checkout.spec.ts
└── .covrr/                 # created on init / first run
```

`covrr.yaml`:

```yaml
scripts:
  smoke:
    pattern: "tests/smoke/**/*.spec.ts"
    timeout_ms: 30000
    retry: 2
  e2e:
    pattern: "tests/e2e/**/*.spec.ts"
    timeout_ms: 120000
    retry: 1
    env:
      BASE_URL: "http://localhost:3000"

defaults:
  timeout_ms: 60000
  retry: 1
  workers: 4
  browser: chromium

coverage:
  tool: istanbul
  output_path: ./coverage/coverage-final.json
  thresholds:
    lines_percent: 80
  strict: true

version:
  detect_from: git

report:
  outputs:
    - type: file
      path: .covrr/reports/latest.json
    - type: github_pr_comment

ci:
  github:
    token: env:GITHUB_TOKEN
    annotation: true
```

GitHub Actions sketch:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: actions/setup-node@v4
  with:
    node-version: "20"
- run: npm ci
- run: npx playwright install --with-deps
- run: npx covrr run --format markdown
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Development

```bash
git clone https://github.com/marktopper/covrr.git
cd covrr
npm install
npm run build    # tsc → dist/
npm test         # Jest (experimental VM modules)
npm run lint     # eslint src/  (on this branch)
```

| Item | Detail |
|------|--------|
| Language | TypeScript (ES2022 modules) |
| Entry | `src/cli.ts` → `dist/cli.js` (`bin.covrr`) |
| Config | `src/config/` (`schema.ts`, `loader.ts`) |
| Scripts | `src/script/` (discovery, runner, types) |
| Specs | `specs/s001`–`s006` (script mgmt, coverage, version, reporting, config, CI) |
| Engines | Node ≥ 18 |

Default branch for this draft: `implement/s001-playwright-script-management`.

---

## License

**Unknown.** There is no `LICENSE` file and no `license` field in `package.json` on the researched branch. Confirm with the maintainer before redistributing.

---

## Notes / unknowns

- Researched from branch `implement/s001-playwright-script-management` (`package.json`, `src/**`, `specs/**`, `tsconfig.json`). No existing `README.md` on that branch.
- On this branch, the **implemented** CLI is `run`, `trigger`, and `init`. Coverage / version / report / config subcommands and most CI flags are defined in specs and typed in `src/config/schema.ts`, but not wired in `src/cli.ts` yet. Other branches (`implement/s002-*`, `s004-*`, `s006-*`, `main`) may be further ahead.
- `covrr init` interactive prompts are a placeholder; both `init` and `init --defaults` write the same default YAML today.
- `--format markdown` is accepted; on this branch non-`json` formats use the text printer. Specs also mention `html` and `github-annotation`.
- `defaults.workers` / `defaults.browser` are validated and stored; the current runner passes timeout and retries to Playwright but does not yet pass workers/browser CLI flags.
- npm publish status is unclear — install from git/clone until a registry package is confirmed.
- Package version: `0.1.0`. Description: “Playwright coverage and version-validation tool”.
