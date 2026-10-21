# Revised execution plan

All entries are second-pass revisions (SP2) of the original IDs, planned at `fb32fa803c8b73faa69e123bfd5e9ca1c14db6f5`, 2026-09-19, plus existing source/spec modifications. No implementation is authorized or performed by this review.

## Shared execution contract

Work only in Covrr. Before editing, run `rtk git status --short` and `rtk git diff -- <the entry's exact scoped paths>` and compare source anchors below. Preserve the existing CLI shebang and six modified specs. Reconcile changed semantics before proceeding. Do not install, publish, deploy, contact providers, modify credentials, or revise unrelated files. Use ESM .js import suffixes and Jest conventions from src/script/__tests__/discovery.test.ts:5–22; new CLI/runner tests must mock execution, report persistence and delivery rather than invoke live services.

Command definitions verified in package.json: `rtk npm run lint` runs tsc --noEmit (passed in review); `rtk npm test -- --runInBand --no-cache` runs the existing Node ESM Jest script (not run in review). `rtk npm run build` is tsc but is not an acceptance check authorized by this review. Jest configuration selects **/__tests__/**/*.test.ts and ignores .claude/worktrees. Dependencies exist locally but suite execution is unverified.

Before implementing any entry, establish the Jest baseline in a separately authorized isolated execution environment, inspect fixture teardown, run the full test command, and record failures/suite totals. Do not run it against private runtime state. Expected baseline is exit 0; if it fails, record exact failures and obtain scope resolution rather than weakening tests or claiming they were introduced by these plans. This is a prerequisite within the existing tasks, not a fifth backlog item. Cleanup only resources that execution owns.

| Entry | Owner | Priority | Dependencies | Status |
|---|---|---|---|---|
| T-001 SP2 | AI | P1 | Isolated baseline | Ready after baseline |
| T-002 SP2 | Human | P1 | None | Decisions pending |
| T-003 SP2 | Pair | P1 | T-001; recorded T-002 approval | Blocked |
| T-004 SP2 | AI | P1 | Isolated baseline; rerun after fixes | Ready after baseline |

## T-001 SP2 — Make subprocess failures authoritative

Current state: runner.ts:116 uses `tests_failed > 0 ? 'failed' : 'passed'` for exit 1. run and trigger trust status (cli.ts:106,141,168). Scope: src/script/runner.ts, src/script/types.ts only if needed, src/cli.ts narrow testability/report seam, new src/script/__tests__/runner.test.ts and src/__tests__/cli.test.ts. Exclude reporter replacement, coverage policy, dependency changes and broad CLI restructuring. Risk: medium; retry results and public exit semantics must remain consistent.

1. Record baseline and diff; add mocked spawn event tests before fixing behavior. Test exit 1 with empty/unrecognized/recognized-failure stdout, exit 2, null close code, spawn error and valid exit 0. No real npx child may launch.
2. Map every nonzero/unknown termination to non-success; keep execution errors distinguishable from test failures. Preserve existing successful execution behavior and parsed counts; do not solve reporter-format accuracy in this task.
3. Test both CLI actions through a narrow injectable/testable seam or controlled module mocks; avoid unguarded import of the side-effectful CLI entry. Mock saveReport/saveLatestReport/deliverReport and process exit. For failed runner fixtures assert run and trigger both exit nonzero; run JSON overall/script status must not say passed. Assert valid success still exits 0.
4. Check report exit information does not contradict status. If preserving exact exit code requires a public contract change, stop for review; do not infer it from stderr text.
5. Run `rtk npm test -- --runInBand --no-cache --runTestsByPath src/script/__tests__/runner.test.ts src/__tests__/cli.test.ts` after creating those files, then `rtk npm run lint`. Both must exit 0; all listed regression branches must be asserted. Run full suite before handoff.

Acceptance: synthetic failing/terminated processes cannot pass either command; successful fixture remains successful; no browser or report disk writes in tests. Stop on changed status logic, broader CLI extraction needs, failing unrelated baseline or reporter redesign. Maintenance: retain these cases whenever retries/reporters change.

## T-002 SP2 — Resolve only policy conflicts and release boundary

Owner Human; no source changes. Scope: a future decision record within second-pass, referenced by T-003. Inputs: specs/s002-coverage-tracking/SPEC.md:70–87,129–165,237–245; specs/s003-version-change-detection/SPEC.md:46–53; specs/s004-validation-reporting/SPEC.md:21–25; src/coverage/__tests__/thresholds.test.ts:87–95. Low implementation risk; high risk of accidental scope expansion.

1. Record settled rules unchanged: per-script evaluation, equality passes, strict breach fails, non-strict breach warns, missing coverage warns/skips, corrupt file JSON fails, missing stdout falls back to file. Optional function metrics currently skip if absent.
2. Approve or explicitly amend missing-data behavior; recommendation is preserve S002 for this bounded release and document warning/skip, rather than silently strengthening strict mode. Decide whether explicitly requested absent function metrics retain skip behavior; recommendation preserve current tests unless an intentional policy revision is approved.
3. Resolve no-version-source conflict: S002 timestamp versus S003 error. Recommendation use S003's explicit error for a version-validation release, subject to owner approval, and document the discrepancy. Decide effective project directory for version identity when config is elsewhere.
4. Decide ambiguous input combinations (valid stdout plus valid file; malformed stdout plus file) and displayed aggregate percentage calculation. Recommendation prefer valid stdout then file and keep per-script gates independent of aggregate display; this is proposed until approved.
5. Choose bounded CLI validation milestone versus full S003/S006 completion. Recommendation bounded milestone with explicit unverified baseline/delta/provider delivery claims. Record owner/date and a table mapping every chosen case to status, warning and exit code.

Acceptance is documentary: no unresolved decision cell affecting T-003; owner approval links to the exact table. No shell command substitutes for human approval. Stop if new formats/providers or a policy reversal is requested; rescope dependent work first. Do not treat this review as approval.

## T-003 SP2 — Connect coverage and version evidence without changing working directory

Owner Pair. Blocked by T-001 and T-002. Current state: cli.ts:327 hardcodes version, :319–341 drops coverage; runner.ts:122–126 decodes raw JSON as CoverageData, whereas collector.ts:104–105 extracts CoverageReport.summary. Scope: src/cli.ts, src/script/runner.ts, src/script/types.ts as needed, src/coverage/collector.ts and thresholds.ts, src/ci/exit-codes.ts reuse, src/version/detect.ts narrow CWD fix if needed, src/config/loader.ts narrow resolved-path seam if needed, src/reporting/types.ts only for approved shape, new CLI tests and existing collector/threshold/detect/exit-code suites. Risk medium: working-directory changes, schema compatibility and duplicated/stale per-script coverage.

1. Read approved T-002 matrix and regression results; stop without them. Preserve documented per-script semantics instead of averaging away failures.
2. Establish the actual resolved config file location for explicit and auto-discovered configuration. loader.ts:119–138 currently returns config only. Resolve output_path against that file's directory (S002:76), not an assumed CWD. Capture each script's coverage immediately after its run so a shared output file is not read only after the entire sequence. Normalize through collector/extract helpers using approved precedence; keep errors distinguishable from missing evidence.
3. Apply existing threshold and exit helpers to each available report and combine with test results. Aggregate display must follow the approved calculation. Keep report verdict, warnings and CLI exit aligned. Script failures remain non-success even with passing coverage.
4. Detect project version separately from tool_version. detect.ts:179 changes global CWD; preserve caller CWD on success and error, preferably by making helper operations use explicit directories. Add only the narrow helper changes needed. Follow the approved no-source policy. Do not fabricate a baseline comparison; if the milestone requires it, stop and split the task.
5. Add fixtures for below/equal/above thresholds, strict/non-strict, one failing script plus one passing script, missing file, corrupt JSON, stdout fallback and approved ambiguous/missing-function cases. Add two distinct project-version fixtures; assert report identity differs while tool_version does not, and CWD/report output base remain unchanged. Cover relative explicit config and auto-discovered parent config. Mock subprocess/provider/storage boundaries.
6. Run `rtk npm test -- --runInBand --no-cache --runTestsByPath src/__tests__/cli.test.ts src/coverage/__tests__/collector.test.ts src/coverage/__tests__/thresholds.test.ts src/ci/__tests__/exit-codes.test.ts src/version/__tests__/detect.test.ts`, then `rtk npm run lint`, then full suite. Expected exit 0, with the approved policy cases asserted; file existence alone is not acceptance.

Acceptance: per-script strict breach fails; non-strict breach warns; documented/approved missing and malformed outcomes match; saved synthetic reports identify tested version and retain output location. Stop for report schema redesign, unknown aggregation, persistence migration, new format adapters or broader detector repair. Review formatter compatibility whenever report fields change.

## T-004 SP2 — Add a meaningful repository CI gate

Owner AI. Scope .github/workflows/covrr.yml and docs/development.md. Current state: workflow runs npm ci, browser install, build, then CLI against scripts: {}; empty CI run intentionally exits 0. Do not change that product behavior to make CI appear meaningful. Risk low-to-medium: previously ungated failures may surface.

1. Establish isolated baseline with the shared full Jest command and typecheck. Stop on failures; do not add continue-on-error or remove tests.
2. Add an explicit repository test gate on existing push/PR job paths using `npm test -- --runInBand --no-cache`, before relying on the CLI validation result. RTK is the local executor wrapper, not a new required CI dependency.
3. Label the empty-script CLI step accurately as a no-op smoke check or remove that redundant invocation; preserve unrelated workflow intent. Update development docs to describe the real gate and tsc-based lint command.
4. Run `rtk npm test -- --runInBand --no-cache` and `rtk npm run lint`: expected exit 0. Inspect `rtk git diff -- .github/workflows/covrr.yml docs/development.md` for unconditional test gating. After an independently authorized CI execution, record its suite counts/outcome separately from local evidence.

Acceptance: tracked push/PR workflow actually invokes Jest with failure propagation; local full-suite/typecheck results recorded. Remote CI remains unverified until observed. Stop on required secrets/services/dependency updates or unrelated test repairs. Rerun the gate after T-001/T-003; keep tracked src/coverage suites included despite generic ignore rules.

## Next actions

Authorize a later implementation task to establish the isolated baseline and execute T-001; obtain T-002 decisions before any dependent T-003 edits.
