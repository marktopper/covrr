# Independent second-pass review — Covrr

Reviewed 2026-09-19 against commit `fb32fa803c8b73faa69e123bfd5e9ca1c14db6f5` and the current working tree. Source references are repository-relative. Source was not edited. First-pass AUDIT.md, TASKS.md, REQUIREMENTS.md, README.md and summary.json were read and preserved.

## Scope and affiliation

Covrr is a Playwright coverage/version-validation CLI (README.md:3–11; package.json:2–4). Sanitized origin inspection confirms `marktopper/covrr`. Sampled README, docs, specs, schema and CI contain no Eupry affiliation evidence. Product purpose and repository organization support inclusion; this conclusion does not rely on an author's email. No excluded components were inspected.

Workspace and project AGENTS.md were read. The project AGENTS.md now exists, contrary to the first-pass inventory, and contains historical context rather than fresh verification. The referenced CLEO injection remains absent; no tooling was initialized. Used installed capability-scout and improve guidance for TypeScript CLI, test and CI review; no external documentation was needed for this local code review. No agents were spawned.

## Finding verdicts

| Original ID | Verdict | Independently checked evidence | Impact and confidence |
|---|---|---|---|
| F-001 | CONFIRMED | src/script/runner.ts:97–118 maps null close code to 1, then maps exit 1 with zero parsed failures to passed. Parser at :38–44 ignores unrecognized lines. src/cli.ts:106–107,141 trusts status; trigger at :168 does too. Report exit_code at :338 derives from errors, not the actual process code. | Nonzero execution can yield successful run and trigger verdicts; report can disagree. High confidence from exact control flow, not a runtime reproduction. |
| F-002 | CORRECTED | src/cli.ts:103–107,141,319–341 still omits coverage enforcement and hardcodes project version. However S002:151–165 specifies per-script checking, and S002:237–245 already specifies missing/corrupt coverage and stdout fallback behavior. | Integration defect confirmed, but first-pass T-002/R-005 overstates missing policy and risks changing documented behavior. High confidence. Counted once as corrected, not also confirmed. |
| F-003 | CONFIRMED | Sole tracked GitHub workflow .github/workflows/covrr.yml:25–38 runs install/browser setup/build/CLI, not Jest. covrr.yaml:1 has no scripts; src/cli.ts:66–81 checks Playwright then permits CI empty-script exit 0. package.json:12 defines the suite. | This workflow does not gate the unit suite or execute configured scripts. High confidence; setup/build success and remote job outcome remain unknown. |

No original findings were rejected or left wholly unverified. All three remain actionable; no evidence of completion was found in their current execution paths. Historical completion labels do not override current source. T-001 overlaps S001/MAR-112 and S006/MAR-117; T-002/T-003 overlap S002–S004/MAR-113–115; T-004 overlaps S006/MAR-117. Keep these as revisions, not duplicate tracker work. Cross-project overlap was not assessed.

## Material corrections to the handoffs

1. S002:151–155 already calls for checking after each script. An aggregate passing average must not erase a per-script breach. Missing output warns/skips, corrupt file JSON marks the script failed, and missing stdout falls back to file (S002:237–245). Replacing missing-evidence warnings with strict failure is a proposed product-policy change requiring approval, not implementation of an absent requirement.
2. Genuine unresolved/conflicting points remain: S002:129–131,245 specifies timestamp fallback without Git, whereas S003:46–53 and detect.ts:198–200 specify error if no version source exists. Missing requested function data is skipped by thresholds.ts:42 and explicitly tested at thresholds.test.ts:87–95. Human review should resolve conflicts and release scope, not reopen all settled semantics.
3. Reusing detectVersion without scrutiny is unsafe for integration: src/version/detect.ts:175–190 calls process.chdir(dir) without restoration. Add an unchanged-CWD acceptance check and narrowly allow a helper fix if needed. Also establish the effective config path: loader.ts:119–138 returns config without its resolved path; cli.ts:88 uses CWD when no explicit path was supplied. Do not guess the coverage-file base directory.
4. T-001 must cover trigger as well as run, including null close code/signal termination. Exact subprocess code preservation is distinct from the minimum no-false-success invariant; agree report semantics before introducing a public field.
5. First-pass links from portfolio-review files to `../../specs/...` resolve under plans/specs, not root specs. In these nested reports root sources are three levels up; use repository-relative paths as stated here. Existing reports remain untouched.

## Checks actually run

- Read-only Git status, HEAD, CLI diff and tracked workflow/coverage inventory. Current CLI diff is only its shebang; six specs have pre-existing modifications. Untracked AGENTS.md, .domain.txt, pnpm-lock.yaml and plans were preserved.
- Exact source/spec/test reads supporting all three verdicts; scoped affiliation search and sanitized origin identity check.
- `rtk proxy npm run lint` completed with exit 0. package.json defines this as `tsc --noEmit`; this is type checking, not ESLint or runtime verification.
- Final four-file inventory, JSON parsing/schema-count checks, key source-anchor assertions and report reference validation.

## Limitations and cleanup

No Jest, builds, installs, browser/process execution through Covrr, migrations, services, deployment, Git mutations, external messages or tracker writes. Existing tests create temporary fixtures; none were run under this review's no-disposable-resource constraint. Runtime reproduction, remote CI, package installation/distribution, provider delivery, full compatibility/security/performance and production health remain unverified. No credential files, customer data or private runtime records were read. Absence of a Jest invocation in the tracked workflow is evidence of absence there; no runtime failure evidence is not evidence of healthy production.

No disposable resources were created. Existing resources have uncertain ownership and were retained; no cleanup was attempted. Only this new second-pass directory was written.

## Next actions

Establish the isolated Jest baseline during an authorized implementation task, then execute T-001 revision SP2. In parallel, obtain the narrow T-002 decisions before T-003 integration. A reusable review rule worth adding to improve later: read specification edge-case tables before classifying policy as unspecified; no skill files were changed.
