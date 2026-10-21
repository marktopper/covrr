# Covrr audit

2026-09-19; reviewed against `fb32fa803c8b73faa69e123bfd5e9ca1c14db6f5` plus the pre-existing dirty working tree. Evidence paths below are project-relative and refer to the working tree.

## F-001 — Subprocess failure can become successful validation

- Category: correctness; priority **P1**; confirmed code-path defect, not a reproduced runtime incident.
- Evidence: `src/script/runner.ts:115` assigns exit code 1 a passed status when parsed failures are zero; `src/script/runner.ts:38` recognizes only specific human-readable output; `src/script/runner.ts:67` does not select a reporter. `src/cli.ts:106` reduces those statuses to allPassed and `src/cli.ts:141` exits zero accordingly.
- Impact: failed runs with empty or unrecognized stdout can produce successful CI validation. Report exit_code can disagree with overall status because errors are independently populated.
- Confidence: high. Effort: S. Change risk: medium; failure classification and retry expectations must remain consistent.
- Action: make nonzero subprocess exits authoritative for non-success, add runner regression tests and a CLI verdict regression. Related existing work: [S001 / MAR-112](../../specs/s001-playwright-script-management/SPEC.md), [S006 / MAR-117](../../specs/s006-cicd-integration/SPEC.md). Handoff: T-001.

## F-002 — Coverage and version helpers are disconnected from run reports

- Category: core-flow integration; priority **P1**; confirmed implementation/documentation gap.
- Evidence: `specs/s002-coverage-tracking/SPEC.md:151` requires threshold evaluation; `src/coverage/thresholds.ts:15` implements checking, and `src/coverage/__tests__/thresholds.test.ts:40` tests a breach. Yet `src/cli.ts:103` proceeds from running scripts straight to a status-only report, `src/cli.ts:141` ignores coverage in the exit verdict, and `src/cli.ts:327` hardcodes version `0.1.0` with null baseline. `src/cli.ts:332` maps script results without coverage. `specs/s004-validation-reporting/SPEC.md:21` requires coverage and version context.
- Impact: configuring strict thresholds does not enforce the documented gate through `run`; saved reports do not identify the actual tested version. Existing helper tests cannot prove the CLI contract.
- Confidence: high. Effort: M for the bounded first integration slice; full history/delta completion is larger. Change risk: medium; missing-data policy and report schema need alignment.
- Action: resolve missing-data/aggregation policy, then connect existing helpers to the CLI. Do not rewrite the collectors or silently relax strict mode. Related existing work: [S002 / MAR-113](../../specs/s002-coverage-tracking/SPEC.md), [S003 / MAR-114](../../specs/s003-version-change-detection/SPEC.md), [S004 / MAR-115](../../specs/s004-validation-reporting/SPEC.md). Handoffs: T-002, T-003.

## F-003 — Repository CI does not exercise its unit tests or a configured script

- Category: verification; priority **P1**; confirmed workflow gap, remote outcome unknown.
- Evidence: `.github/workflows/covrr.yml:25` installs, builds and runs the CLI but contains no npm test step; `covrr.yaml:1` defines an empty scripts map; `.github/workflows/covrr.yml:38` sets COVRR_CI; `src/cli.ts:78` exits zero for that empty CI run. `package.json:12` already defines a Jest command.
- Impact: if setup/build succeed, the final CLI step can succeed without validating any test script, while regressions in existing Jest suites are not gated by this workflow.
- Confidence: high. Effort: S. Change risk: low-to-medium; adding tests may expose pre-existing failures.
- Action: add the established Jest command to CI and clearly identify empty-script execution as a no-op, not integration evidence. Related existing work: [S006 / MAR-117](../../specs/s006-cicd-integration/SPEC.md). Handoff: T-004.

## Coverage, checks and exclusions

Read README, package scripts, TypeScript/Jest config, triage, all six spec introductions and relevant acceptance sections, architecture/development docs, both CI configurations and action metadata, full CLI and runner, discovery and its tests, config schema/loader sample, coverage collector/threshold code and threshold tests, reporting types, and exit-code helper/tests. Inventoried other source/tests without exhaustively auditing them. Reconciled the source inventory with Git tracked files because ignore rules hide src/coverage from ordinary rg file listings.

Checks run: repository root/branch/HEAD and origin metadata inspection; `rtk git status --short`, recent five-commit log, diff/stat inspection; scoped metadata affiliation search (no Eupry matches); file/line evidence reads; report integrity validation described below. Shell commands used the rtk prefix (some grouped reads via rtk proxy). All were read-only except writing the requested planning files.

No application checks ran: no npm test, npm run lint, build, Playwright execution, dependency audit, installs, network calls, remote CI inspection or deployment checks. No performance, full security, release-package, provider API, runtime-history or compatibility audit. Tests present are not tests passed. No vulnerability or deployment-health claim is made. Existing output was not trusted as fresh verification. An initial filename listing included Git internal paths; no object/log contents were reviewed through that listing.

Considered but not elevated: stale development claims (ESLint vs tsc, runner tests listed but absent) are supporting documentation cleanup for the focused tasks; broad migrations and new product features lack enough evidence for this review. Action packaging and provider behavior remain unverified, not declared working or broken.

Report integrity: five requested files exist; summary JSON parses; finding/task counts and relative Markdown links were checked; cited evidence lines exist and F-001's failure-status assignment was rechecked. No source changes or resource removals.
