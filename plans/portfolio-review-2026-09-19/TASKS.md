# Covrr execution handoff

Planned at `fb32fa803c8b73faa69e123bfd5e9ca1c14db6f5` plus existing modifications to six specs and the CLI shebang. These are local handoff IDs under existing MAR-111 work, not replacement tracker issues. No implementation has run.

| ID | Title | Priority | Status | Executor | Effort | Dependencies |
|---|---|---|---|---|---|---|
| T-001 | Prevent failed subprocesses from passing validation | P1 | TODO | AI | S | None |
| T-002 | Decide coverage evidence and release-slice policy | P1 | TODO | Human | S | None |
| T-003 | Wire coverage gates and project version into run | P1 | BLOCKED | Pair | M | T-001, T-002 |
| T-004 | Make repository CI run the established test suite | P1 | TODO | AI | S | None; rerun after T-001/T-003 |

All executors: work only in Covrr; prefix commands with rtk. Before changes run `rtk git status --short` and `rtk git diff -- <in-scope paths>`, compare relevant source with this evidence and preserve existing changes. Match ESM .js imports and co-located Jest tests using imports from @jest/globals. Existing scripts are in package.json:10–13; lint means TypeScript no-emit checking, not ESLint. Do not install, deploy, publish or modify unrelated instructions as part of these tasks. If dependencies are unavailable, report the access/setup blocker. Preserve source and required evidence; clean only task-created disposable resources.

## T-001 — Prevent failed subprocesses from passing validation

Status: TODO. Executor: AI. Priority: P1. Effort: S. Risk: medium (exit and retry semantics).

Why/evidence: runner.ts:115–116 currently uses `tests_failed > 0 ? 'failed' : 'passed'` when exitCode is 1. cli.ts:106 and :141 trust this result. This can approve failed execution. F-001; R-001/R-006. Existing task: [MAR-112 / S001](../../specs/s001-playwright-script-management/SPEC.md), also [MAR-117 / S006](../../specs/s006-cicd-integration/SPEC.md).

Scope: src/script/runner.ts, src/script/types.ts if required, new src/script/__tests__/runner.test.ts, narrow CLI verdict seam/tests in src/cli.ts and src/__tests__/cli.test.ts. No coverage-policy changes, reporter redesign, dependency changes or real Playwright runs. No human decision required for the invariant that failed processes cannot pass.

1. Recheck the dirty diff and current runner status mapping. Stop if another change already modifies verdict semantics; reconcile its intended behavior first.
2. Add mocked child-process cases for exit 1 with empty and unrecognized stdout, recognized failed output, exit 0, exit 2, and process spawn error. Follow src/script/__tests__/discovery.test.ts for Jest conventions, but avoid launching npx. Establish a small injectable verdict seam if necessary rather than importing the side-effectful CLI entry unguarded.
3. Correct status mapping so any nonzero process exit is non-success. Preserve successful exit 0 behavior and distinguish execution errors; align report status/exit information. Add a CLI verdict regression showing the failing runner result cannot yield exit 0.
4. Run `rtk npm test -- --runInBand --no-cache --runTestsByPath src/script/__tests__/runner.test.ts src/__tests__/cli.test.ts` and `rtk npm run lint`. Expect both exit 0 and all specified cases asserted. These tests are to be created; they do not exist today.

Acceptance: no tested nonzero subprocess result becomes passed or a zero run verdict; valid success remains successful. Stop if resolving result counts requires replacing the reporter protocol or broad CLI restructuring; record that as a separate scoped task. Maintenance: future reporter/retry changes must retain these invariant cases.

## T-002 — Decide coverage evidence and release-slice policy

Status: TODO. Executor: Human. Priority: P1. Effort: S. Risk: low; no source implementation. Dependencies: none.

Why/evidence: F-002; R-002/R-003/R-005. Existing [MAR-113 / S002](../../specs/s002-coverage-tracking/SPEC.md), [MAR-114 / S003](../../specs/s003-version-change-detection/SPEC.md), [MAR-115 / S004](../../specs/s004-validation-reporting/SPEC.md). S002:159–165 settles strict versus warning behavior, but the sampled contract does not settle every missing-data/aggregation case. collector.ts:19 returns null for absent files, while thresholds.test.ts:87 intentionally skips missing optional function metrics.

Scope: add a decision record within this report directory and refine REQUIREMENTS.md/T-003 only. No source/spec instruction changes, no tracker writes, no reversal of existing strict-mode decisions without explicit owner choice.

1. Read S002 coverage schema, enforcement and storage sections, S004 report schema, coverage/types.ts, collector.ts and thresholds.test.ts.
2. Record expected verdicts for valid coverage, missing file, malformed payload, missing requested function metric, multiple scripts and mixed metrics. Decide per-script versus aggregate evaluation and precedence of file/stdout inputs. Recommended default: required strict evidence cannot silently disappear; label this as a proposal until approved.
3. Confirm the bounded first slice: gate enforcement plus actual project-version identity. Record whether baseline/delta delivery is a release prerequisite or remains explicit follow-up work under MAR-114/MAR-115.
4. Review the written decision table with the owner. Verification is documentary: every listed case has a status/exit outcome, input precedence and an owner/date; no application command proves this human decision.

Acceptance: approved policy and release boundary linked into T-003; conflicting existing tests/specs identified explicitly. Stop if product direction expands into new coverage formats/providers or contradicts an existing decision without owner approval. Do not mark T-003 ready while a policy cell is undecided.

## T-003 — Wire coverage gates and project version into run

Status: BLOCKED pending T-002 approval and T-001 verdict fix. Executor: Pair. Priority: P1. Effort: M. Risk: medium (report contract and backward compatibility).

Why/evidence: F-002; R-002/R-003/R-005/R-006. cli.ts:103–107 ignores coverage while constructing the verdict, :327 hardcodes the tested version. Reuse [MAR-113 / S002](../../specs/s002-coverage-tracking/SPEC.md), [MAR-114 / S003](../../specs/s003-version-change-detection/SPEC.md), [MAR-115 / S004](../../specs/s004-validation-reporting/SPEC.md).

Scope: src/cli.ts run/report construction, src/script/runner.ts coverage handoff, src/coverage/collector.ts and thresholds.ts only as needed for the approved contract, src/ci/exit-codes.ts reuse, src/version/detect.ts reuse, reporting/types.ts if strictly necessary, and focused tests in src/__tests__/cli.test.ts and existing coverage test directories. Exclude historical migration, provider networking, broad version comparison changes and new coverage formats.

1. Confirm T-002's decision record and T-001 regression results. Re-read actual collector/runner coverage shapes (CoverageReport wraps summary; the runner currently decodes directly to CoverageData). Stop on incompatible source drift.
2. Use existing validated collection/extraction helpers and approved file/stdout precedence to obtain coverage per script. Resolve configured file paths against the effective config location. Do not duplicate parsers or silently discard required evidence.
3. Apply existing threshold and exit helpers using the approved aggregation/missing-data policy. Feed coverage summary and warning/failure into report assembly and the final process verdict. Script failures remain failures regardless of coverage.
4. Feed detectVersion output into report.version, keeping tool_version separate. Baseline remains null only when absent; if T-002 requires full baseline/delta work first, split and re-estimate rather than claiming it completed in this slice.
5. Add synthetic CLI integration cases for pass, equal threshold, strict breach, non-strict warning, approved missing/malformed cases and two distinct detected project versions. Mock external execution, use task-owned temporary directories and teardown.
6. Run `rtk npm test -- --runInBand --no-cache --runTestsByPath src/__tests__/cli.test.ts src/coverage/__tests__/collector.test.ts src/coverage/__tests__/thresholds.test.ts src/ci/__tests__/exit-codes.test.ts` and `rtk npm run lint`. Expect zero exits and matching JSON/verdict assertions.

Acceptance: the approved policy matrix passes, strict breach exits 1, non-strict breach warns with exit 0 when tests pass, and reports carry actual project-version fixtures. Stop if persistence migration or new format support becomes necessary, or existing unrelated tests fail; record evidence and seek scope resolution. Maintenance: changes to report schemas must update formatter fixtures and the policy matrix together.

## T-004 — Make repository CI run the established test suite

Status: TODO. Executor: AI. Priority: P1. Effort: S. Risk: low-to-medium (latent failures may surface). Dependencies: none for adding the gate; final CI verification should include T-001/T-003 once landed.

Why/evidence: F-003; R-004/R-006. .github/workflows/covrr.yml:25–38 omits npm test and executes an empty config (covrr.yaml:1); cli.ts:78 allows this to exit zero in CI. Existing work: [MAR-117 / S006](../../specs/s006-cicd-integration/SPEC.md).

Scope: .github/workflows/covrr.yml and docs/development.md testing/CI description. Do not change empty-config product behavior, action distribution, secrets, permissions, package versions, GitLab integration or root covrr.yaml merely to simulate coverage.

1. Review the current workflow and package.json scripts. Add the established npm test invocation as an explicit CI gate after dependency setup and before relying on any CLI validation result. Do not use continue-on-error for it.
2. Identify the empty-script CLI invocation as a no-op smoke check, or remove that redundant step while preserving unrelated workflow intent. Do not claim it exercises Playwright scripts.
3. Run `rtk npm test -- --runInBand --no-cache` and `rtk npm run lint` in an authorized execution environment with existing dependencies. Expect both exit 0. Inspect test setup first; ensure tests clean task-created temporary data. Stop and report pre-existing failures rather than weakening assertions.
4. Inspect the workflow diff to confirm the test step is on push/PR paths and cannot be skipped by empty scripts. On a later authorized CI run, record suite totals and job outcome; no push or remote run is authorized by this plan alone.

Acceptance: workflow visibly invokes the repository test command, local suite evidence is recorded, and a future CI result is distinguished from static workflow inspection. Stop on new credential/service requirements or any attempt to solve failing tests with unrelated refactors. Maintenance: keep suite paths inclusive of tracked src/coverage even when generic file-search ignore rules hide it.
