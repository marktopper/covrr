# Covrr current state

Review date: 2026-09-19. Scope: only `/Users/mark/Projects/Covrr`; quick sampled static review. Maturity: **implemented-unverified**. No application tests, typecheck, builds, services, or browser sessions ran.

Covrr is a TypeScript CLI for developers and CI maintainers running their own Playwright tests, collecting code coverage, and comparing validation across versions. These users are inferred from README.md:3 and specs/s001-playwright-script-management/SPEC.md:21.

## Repository and components

The project owns its Git repository at `/Users/mark/Projects/Covrr`, on `main`, commit `fb32fa803c8b73faa69e123bfd5e9ca1c14db6f5`. It is not the parent workspace repository. Origin metadata identifies `marktopper/covrr`; README.md:3, package.json:2 and .domain.txt:1 describe an independent Playwright tool. No Eupry affiliation was found in sampled nonsecret metadata, docs, specs, or CI files; no Eupry components were reviewed.

One application repository was identified. `src/cli.ts` connects config, script discovery/execution, reporting and version commands. `src/coverage/` contains collectors, thresholds, storage and comparison; `src/ci/` contains provider adapters and exit mapping; `src/state/` handles persistence. Co-located Jest suites cover several modules. `docs/` and six `specs/` describe intended behavior. `action.yml`, `.github/workflows/covrr.yml` and `.gitlab-ci.yml` provide integration surfaces.

Before this review, all six SPEC.md files and src/cli.ts were modified; .domain.txt and pnpm-lock.yaml were untracked. The CLI change is a shebang; spec edits include completion claims. These changes were preserved. Latest five commits span 2026-04-25 through 2026-05-14, with documentation, version tests, and tooling activity. Remote state was not fetched.

## State and blocker

Configuration, discovery, runner, reports, coverage helpers and version helpers are present. Their integration is incomplete: a failed subprocess can become a passing script; coverage thresholds do not participate in the CLI verdict; reports use a constant project version. The main blocker is trustworthy end-to-end validation semantics, not absence of module code. SPEC completion labels are historical/local claims, not verification evidence.

Read [AUDIT.md](AUDIT.md), [REQUIREMENTS.md](REQUIREMENTS.md), [TASKS.md](TASKS.md), and [summary.json](summary.json).

## Next action

Start T-001: inspect the current diff of src/script/runner.ts and src/cli.ts, then add a mocked subprocess regression where exit code 1 and empty stdout must never produce a passed result. This report does not execute that task.

## Cleanup and limitations

Existing node_modules/, dist/, root coverage/, .covrr/, .claude/, .claude-state/ and watchman cookies were retained because ownership/current use is uncertain. Only top-level names were inspected for these resources; no private runtime content or copied worktrees were reviewed. No disposable resource was created, so none was removed. Only these five planning files were written.

Workspace instructions were read; no applicable project AGENTS.md or CLAUDE.md was found in the root or sampled source/docs/specs/CI paths. The referenced CLEO injection file was absent. Skills used: capability-scout and improve; no external skills, documentation browsing or agents were needed for this static review.

Executor cleanup rule: preserve source and required evidence; remove only disposable resources created by that execution when no longer needed. Never remove pre-existing artifacts merely because they look generated. Static review does not establish production readiness; see audit exclusions.
