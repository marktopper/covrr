# Covrr lightweight product brief

Basis: existing S001–S006 specifications under parent MAR-111. Completion labels describe prior intent/claims; this brief does not treat them as acceptance evidence. Review date: 2026-09-19.

Users/problem: developers and CI maintainers need a reliable verdict over user-authored Playwright scripts, code-coverage thresholds and version changes. Desired outcome: a failing validation cannot be reported as passing, and reports identify what was tested.

Documented decisions: users author tests and own browser infrastructure (S001:21–27); coverage is production code coverage, not test pass rate (S002:21–23); strict breaches fail while non-strict breaches warn (S002:159–165); ESM imports use .js extensions (docs/development.md:149); reports combine script, coverage and version context (S004:21–25).

## MVP boundaries

Existing product scope remains CLI configuration/discovery, execution, coverage collection and gates, version detection/comparison, local reports and CI delivery. The proposed immediate release slice is correct verdicts, coverage gate integration, accurate project-version identity and a meaningful automated check. Full baseline/delta and provider-delivery verification remain explicit follow-ups within the existing product roadmap. No new hosted service, test authoring system, browser infrastructure, UI or dependency migration is proposed.

## Requirements

| ID | Basis and source | Requirement and observable acceptance |
|---|---|---|
| R-001 | documented — specs/s001-playwright-script-management/SPEC.md:94; inferred safety invariant from src/script/runner.ts:115 | Nonzero subprocess exits cannot become passed script/run results. Empty/unrecognized stdout with exit 1 produces non-success; exit 0 success remains supported; process errors are distinguished. |
| R-002 | documented — specs/s002-coverage-tracking/SPEC.md:151, src/ci/exit-codes.ts:27 | Apply configured coverage thresholds in run. Passing tests plus below-threshold coverage exit 1 in strict mode; non-strict mode exits 0 with warning; equal-to-threshold passes. Report verdict and CLI exit agree. |
| R-003 | documented — specs/s004-validation-reporting/SPEC.md:45; specs/s003-version-change-detection/SPEC.md:23 | Reports identify tested project version separately from tool version. Two different project-version fixtures produce different report.version values; no constant 0.1.0 substitution. Null baseline must mean no baseline, not a computed comparison. |
| R-004 | proposed — gap at .github/workflows/covrr.yml:25 and package.json:12 | Repository CI runs its Jest suite and fails on test failures. Empty configuration is not described as successful integration coverage; logs identify the unit-test gate separately. |
| R-005 | proposed — src/coverage/collector.ts:19 returns null for missing file; src/coverage/__tests__/thresholds.test.ts:87 skips absent function data | Owner records handling of missing/malformed coverage and absent requested metrics, and whether thresholds apply per script or aggregate. Every approved case has an expected status/exit code before integration is accepted. Recommended policy: configured strict gates must not silently pass without required evidence; preserve existing optional-metric behavior until explicitly changed. |
| R-006 | inferred — docs/development.md:45 and existing test fixture cleanup at src/script/__tests__/discovery.test.ts:21 | Regression checks use synthetic fixtures and mocked subprocesses without credentials, real browser sessions or API writes. Cleanup removes only resources created by those checks; existing source and evidence remain intact. |

## Dependencies and human decisions

T-002 resolves R-005 and confirms the first release slice; T-003 is blocked until it does. Reuse existing collectors, threshold checker, exit mapper and version detector. Node, TypeScript, Jest and Playwright requirements are recorded in package.json; actual supported-runtime compatibility has not been verified. Existing dirty changes must be preserved and reconciled before edits. Future API-specific implementation should consult current official docs through the applicable documentation workflow.

Proposed success measures (no measured baseline): zero false-success cases in the new regression matrix; all strict-breach cases fail; every saved report fixture carries the expected project version; CI demonstrably invokes and passes the existing Jest suite. These are acceptance targets, not current results. Baseline/delta and real provider acceptance evidence must be recorded before claiming the full S003/S006 experience is complete.
