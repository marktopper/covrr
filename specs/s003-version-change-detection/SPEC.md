# Spec S003: Version Change Detection

**Task:** MAR-114
**Parent:** MAR-111 (Plan Covrr)
**Status:** Draft
**Created:** 2026-04-24

---

## Summary

Covrr detects software versions using git tags, package files, or CLI flags — then builds a change set between two versions showing what files, commits, and packages changed. This powers the validation comparison (S004) and coverage delta (S002).

---

## 1. Overview

### Why versioning matters

Covrr's value is comparing validation results across versions. "Coverage was 85% in v1.2.0 but dropped to 72% in v1.3.0" only makes sense if we can determine what version we're testing and generate the diff.

### Version sources (in priority order)

1. **CLI flag** — `--version 1.2.3` (most explicit, overrides all)
2. **Git tag** — annotated tag matching semver (most trusted)
3. **Package file** — `package.json`, `pyproject.toml`, `Cargo.toml`
4. **Git commit hash** — fallback when nothing else is available

---

## 2. Version Detection

### `covrr version detect [--dir <path>]`

Returns the detected version string for the current project state.

```bash
covrr version detect
# v1.2.3

covrr version detect --dir ./subproject
# v2.0.0-beta.1
```

**Detection rules (in order):**
1. Check `--version` CLI flag → return as-is
2. Run `git tag --points-at HEAD` → filter for semver → return highest if multiple
3. Read `package.json` → `version` field
4. Read `pyproject.toml` → `project.version` (Python) or `tool.poetry.version` (Poetry)
5. Read `Cargo.toml` → `package.version`
6. Run `git rev-parse HEAD` → return first 8 chars as `<hash>`
7. Error: "Cannot determine version. Use --version or ensure a git tag or package file exists."

### Git tag matching

Tags must match semver (e.g. `v1.2.3`, `1.2.3`, `release-1.2.3`). Tags are sorted and the highest is returned.

```bash
git tag --points-at HEAD | grep -E '^v?[0-9]+\.[0-9]+\.[0-9]+' | sort -V | tail -1
```

If multiple tags point to the same commit, the highest semver is used.

### Package file fallback

If git tag detection fails, fall back to package files. Check in order:
- `package.json` (Node.js) — read `.version` field
- `pyproject.toml` (Python) — parse via `tomli`, check `project.version` then `tool.poetry.version`
- `Cargo.toml` (Rust) — parse via `toml`, read `package.version`
- Fail with "No version found in package files"

---

## 3. Version Comparison

### `covrr version compare <from> <to>`

Returns a structured diff between two versions.

```bash
covrr version compare v1.2.2 v1.3.0
```

**Output format (JSON):**
```json
{
  "from": "v1.2.2",
  "to": "v1.3.0",
  "compared_at": "2026-04-24T10:00:00Z",
  "source": "git_tag",
  "files_changed": [
    { "path": "src/auth.ts", "status": "modified", "additions": 12, "deletions": 3 },
    { "path": "src/new-file.ts", "status": "added", "additions": 50, "deletions": 0 },
    { "path": "src/deleted.ts", "status": "deleted", "additions": 0, "deletions": 20 }
  ],
  "commits_between": [
    { "hash": "abc1234", "message": "fix: auth redirect", "author": "dev@example.com", "date": "2026-04-20" }
  ],
  "packages_changed": [
    { "name": "lodash", "from": "4.17.20", "to": "4.17.21" }
  ]
}
```

### Change detection method

**Git-based (default):**
```bash
git diff <from-tag>..<to-tag> --name-status
git log <from-tag>..<to-tag> --oneline
```

**If tags don't exist as git refs** (e.g. version from package.json):
1. Find the commit that introduced the package.json change (git log -1 --follow)
2. Use that commit as the baseline
3. Compare against current HEAD

### Package-level changes

Detect dependency version bumps:
- `package.json` → use `npm ls --json` to get full tree, diff `dependencies` versions
- `pyproject.toml` → parse `project.dependencies` and `project.optional-dependencies`
- `Cargo.toml` → parse `dependencies` section

### Change types

| Status | Meaning |
|--------|---------|
| `added` | File didn't exist in `<from>` |
| `deleted` | File existed in `<from>` but not in `<to>` |
| `modified` | File existed in both, content differs |
| `renamed` | Same content, different path (git handles this) |

---

## 4. Baseline Version

### What is a baseline?

A "baseline" version is the reference point for comparisons. By default, the previous semver tag is used as the baseline for the current version.

### CLI override

```bash
covrr run --baseline v1.2.0
# Compare current version against v1.2.0 baseline
```

### Baseline selection rule

If `--baseline` is not specified:
1. Get all tags sorted semver
2. Find current version position in sorted list
3. Use the tag immediately before current as baseline
4. If no previous tag → use `git diff --root` (all changes vs empty repo)

### No baseline scenario

If no baseline can be determined (fresh repo, no tags):
- `covrr run` proceeds without comparison
- Reports show "No baseline available" instead of deltas
- Exit code unaffected

---

## 5. Semantic Versioning

### Semver compliance

Covrr uses semver for tag sorting and comparison. Tags must match:
- `v?MAJOR.MINOR.PATCH` (e.g. `1.2.3`, `v1.2.3`)
- Optional pre-release: `1.2.3-beta.1`
- Optional build metadata: `1.2.3+build123`

### Prerelease handling

Prereleases sort before stable releases (`1.0.0-alpha < 1.0.0`). For baseline selection, a prerelease is treated as the previous stable's "next version" rather than a successor.

### Non-semver versions

If a version string doesn't match semver (e.g. `latest`, `main`, `canary`):
- Sort alphabetically for ordering purposes
- Cannot determine "previous version" — baseline must be explicitly provided

---

## 6. Directory Structure

```
project/
├── .covrr/
│   └── versions/
│       ├── v1.2.2/
│       │   ├── manifest.json         # version metadata + detected_at
│       │   ├── commits.json           # commit log since baseline
│       │   └── diff.json              # file/package changes
│       └── v1.3.0/
│           └── manifest.json
```

Version data is stored to enable offline comparison and historical analysis.

---

## 7. Edge Cases

| Situation | Behaviour |
|-----------|-----------|
| No git repo | Fall back to package file version; warn "Not a git repo — using package.json version" |
| No version found anywhere | Error: "Cannot determine version. Use --version or ensure a git tag or package file exists." |
| Malformed semver tag | Skip it; if all tags malformed, fall through to package file |
| Git tag not a reachable commit | Warn "Tag '<tag>' is not reachable from HEAD. Using package.json version." |
| `--version` with spaces/special chars | Accept as-is; sanitize for directory storage (replace `[^a-zA-Z0-9.-]` → `_`) |
| Baseline version newer than current | Error: "Baseline <ver> is newer than current version <ver>. Check --baseline." |

---

## 8. Acceptance Criteria

- [ ] `covrr version detect` works from: CLI flag, git tag, package.json, pyproject.toml, Cargo.toml, git hash fallback
- [ ] Semver tags sorted correctly (v1.2.3 < v1.3.0 < v2.0.0-beta)
- [ ] `covrr version compare` outputs JSON with files_changed, commits_between, packages_changed
- [ ] Git diff used when tags are git refs; package-file fallback when not
- [ ] `--baseline` flag respected; previous semver tag auto-selected if omitted
- [ ] No baseline → no comparison (graceful degradation)
- [ ] Non-semver versions handled alphabetically; explicit --baseline required
- [ ] Version data cached in `.covrr/versions/<version>/`
- [ ] Unit tests for semver parsing, tag detection, diff generation

---

## 9. CLI Summary

| Command | Description |
|---------|-------------|
| `covrr version detect` | Print detected version string |
| `covrr version compare <from> <to>` | JSON diff between two versions |
| `covrr version list` | List all known versions in `.covrr/versions/` |

---

## 10. Dependencies

- `git` CLI (must be available in PATH)
- `js-yaml` for config
- `tomli` (Python projects) — only needed if reading pyproject.toml
- `toml` (Rust projects) — only needed if reading Cargo.toml
- Built with Node.js (TypeScript)

---

## 11. Future Considerations (out of scope for v1)

- GitHub API integration for commit/pull-request metadata
- Monorepo-aware version detection (versions per package in monorepo)
- Version alias support (`@latest`, `next`)
- Remote version catalog (lookup known versions from a registry)