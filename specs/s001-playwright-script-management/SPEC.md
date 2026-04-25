# Spec S001: Playwright Script Management

**Task:** MAR-112
**Parent:** MAR-111 (Plan Covrr)
**Status:** Draft
**Created:** 2026-04-24

---

## Summary

Covrr discovers and executes user-authored Playwright scripts via a `covrr.yaml` configuration file. Scripts run through the `covrr run` CLI command, which handles discovery, environment injection, timeout/retry, and result collection.

---

## 1. Overview

### What is a "script" in Covrr?

A script is a **Playwright test file** (or collection of files) that follows the Playwright test runner convention. Users author their own Playwright tests; Covrr is responsible for discovering, executing, and collecting results from them.

### What Covrr is NOT

- Covrr does NOT write Playwright scripts — users own their test code
- Covrr does NOT manage browser infrastructure directly — it delegates to the Playwright runner
- Covrr does NOT require a specific project structure beyond a config file

---

## 2. Configuration File

### File: `covrr.yaml`

Location: project root (where `covrr run` is invoked). Can also be passed via `--config <path>`.

```yaml
scripts:
  # Key = script name, value = discovery pattern or direct path
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

  coverage:
    pattern: "tests/coverage/**/*.spec.ts"
    timeout_ms: 60000
    retry: 0

# Global defaults (apply to all scripts unless overridden)
defaults:
  timeout_ms: 60000
  retry: 1
  workers: 4
  browser: chromium
```

### Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `scripts.<name>.pattern` | string (glob) | required | Files to include |
| `scripts.<name>.timeout_ms` | integer | `60000` | Per-script timeout |
| `scripts.<name>.retry` | integer | `1` | Retries on failure |
| `scripts.<name>.env` | map<string,string> | `{}` | Env vars injected |
| `defaults.timeout_ms` | integer | `60000` | Global timeout |
| `defaults.retry` | integer | `1` | Global retries |
| `defaults.workers` | integer | `4` | Playwright workers |
| `defaults.browser` | string | `chromium` | Browser: chromium/firefox/webkit |

---

## 3. CLI Interface

### `covrr run [script-name]`

Executes one or more scripts by name. If `script-name` is omitted, runs all scripts defined in `covrr.yaml`.

**Examples:**
```bash
covrr run               # run all scripts
covrr run smoke         # run only "smoke"
covrr run smoke e2e     # run "smoke" and "e2e"
covrr run --config ./subproject/covrr.yaml  # custom config path
```

**Exit codes:**
- `0` — all scripts passed
- `1` — one or more scripts failed
- `2` — Covrr error (config not found, etc.)

### `covrr trigger <script-name>`

Programmatic trigger for external systems (webhooks, CI). Runs a single script and outputs JSON result to stdout.

```bash
covrr trigger smoke > result.json
```

---

## 4. Script Discovery

1. Read `covrr.yaml` from current directory or `--config` path
2. For each script entry, resolve `pattern` glob relative to config file directory
3. Expand glob to file paths; fail if no files match
4. Pass file list to Playwright runner

**Discovery rules:**
- If `pattern` resolves to zero files → error with helpful message
- Patterns are relative to `covrr.yaml` location
- Absolute paths are supported (useful for monorepos)

---

## 5. Execution

### Playwright runner invocation

Covrr translates script definitions into Playwright CLI / API calls:

```bash
npx playwright test \
  --config=playwright.config.ts \
  --timeout=30000 \
  --retries=2 \
  --workers=4 \
  <resolved-file-paths>
```

### Environment injection

Env vars from `scripts.<name>.env` are set in the process environment before Playwright runs. They override any existing env vars of the same name.

### Timeout and retry

- `timeout_ms` → `--timeout` on Playwright CLI
- `retry` → `--retries` on Playwright CLI
- Total budget = `(timeout_ms * (retry + 1))` per script
- If timeout is exceeded during a retry, the run is marked failed

### Parallelisation

- `workers` controls Playwright's `--workers` parallelism
- Scripts within a single `covrr run` invocation run sequentially by name
- Multiple `covrr run` invocations can be parallelised externally (CI steps, background jobs)

---

## 6. Result Collection

### How Covrr gets results

Playwright outputs a `stdout`/`stderr` stream and a JSON report file. Covrr reads the JSON report (`playwright-report.json` or `playwright-results/`) to extract:

- Test pass/fail counts
- Duration per test
- Error messages for failed tests
- Coverage data (if the Playwright test emits coverage annotations — see Spec S002)

### Result format (internal)

```typescript
interface ScriptResult {
  name: string;
  status: 'passed' | 'failed' | 'timed_out' | 'error';
  duration_ms: number;
  tests_total: number;
  tests_passed: number;
  tests_failed: number;
  coverage?: CoverageData;  // See Spec S002
  errors: string[];
}
```

### Passing results to Covrr

Scripts communicate results to Covrr via:
1. **JSON report file** — Playwright's native `json` reporter output
2. **stdout parsing** — fallback if report file not found
3. **Coverage annotations** — stdout lines matching `COVERAGE:<base64-json>` (future, see S002)

---

## 7. Directory Structure

```
my-project/
├── covrr.yaml              # Covrr config (required)
├── playwright.config.ts   # Playwright config (user-owned)
├── tests/
│   ├── smoke/
│   │   └── smoke.spec.ts
│   ├── e2e/
│   │   └── checkout.spec.ts
│   └── coverage/
│       └── full.spec.ts
└── node_modules/
```

---

## 8. Edge Cases

| Situation | Behaviour |
|-----------|-----------|
| No `covrr.yaml` found | Error: "No covrr.yaml found. Run `covrr init` to create one." |
| Script pattern matches no files | Error: "Pattern '<pattern>' matched 0 files for script '<name>'" |
| Script times out | Mark as `timed_out`, record attempt count |
| Playwright not installed | Error with instructions: `npm install -D @playwright/test && npx playwright install` |
| Invalid env var in config | Warning on parse, ignore invalid entries |
| Empty env map | No-op, no warning |

---

## 9. Acceptance Criteria

- [ ] `covrr.yaml` schema fully documented with all fields
- [ ] `covrr run` executes all defined scripts in name order
- [ ] `covrr run <name>` executes only the named script
- [ ] `--config` flag allows custom config path
- [ ] Timeout is enforced per script via Playwright `--timeout`
- [ ] Retries work via Playwright `--retries`
- [ ] Env vars from config are injected into the Playwright process
- [ ] `covrr trigger` outputs JSON result to stdout
- [ ] Exit code 0 on all pass, 1 on any failure, 2 on error
- [ ] Helpful error messages when config or files are missing
- [ ] Unit tests covering config parsing, discovery, and result parsing

---

## 10. Dependencies

- `@playwright/test` (peer dependency — user must install)
- `js-yaml` (for `covrr.yaml` parsing)
- Built with Node.js (TypeScript)

---

## 11. Future Considerations (out of scope for v1)

- Script discovery via npm package exports
- Webhook trigger endpoint (HTTP server mode)
- Direct API invocation (not CLI)
- Browser stack management (Docker, cloud browsers)