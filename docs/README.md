# Covrr Documentation

## Overview

Covrr is a Playwright coverage and version-validation tool designed for CI/CD pipelines. It discovers, runs, and tracks Playwright test scripts while collecting coverage data and detecting version changes.

## What It Does

- **Playwright Script Management** — Discovers and runs Playwright test scripts via glob patterns
- **Coverage Tracking** — Collects code coverage from test runs and enforces thresholds
- **Version Change Detection** — Detects version from git tags, package files, or CLI flags; compares versions to generate diffs
- **Validation Reporting** — Formats results as text, JSON, or Markdown; delivers to GitHub PR comments, GitLab MR notes, files, or webhooks
- **CI/CD Integration** — Native GitHub Actions and GitLab CI support with status checks and PR comments

## Quick Start

```bash
# Initialize a new covrr.yaml
npx covrr init

# Run all scripts defined in covrr.yaml
npx covrr run

# Run specific scripts
npx covrr run auth login

# Check version
npx covrr version detect
```

## Project Structure

```
Covrr/
├── src/
│   ├── cli.ts              # CLI entry point (Commander.js)
│   ├── ci/                 # CI/CD integration (GitHub, GitLab)
│   ├── config/             # Config loading, validation, env overrides
│   ├── coverage/           # Coverage collection, thresholds, diffs
│   ├── reporting/          # Report formatting, storage, delivery
│   ├── script/             # Script discovery and runner
│   ├── state/              # State persistence (.covrr/)
│   └── version/            # Version detection and comparison
├── specs/                  # Feature specifications (Spec-Kit)
├── action.yml              # GitHub Action definition
├── covrr.yaml              # Example configuration
└── docs/                   # This documentation
```

## Stack

- **Runtime**: Node.js 18+ (ES2022 modules)
- **Language**: TypeScript 5.3
- **CLI Framework**: Commander.js 11
- **Testing**: Jest 29 with ts-jest
- **Dependencies**: @playwright/test, @octokit/rest, js-yaml, glob, toml

## Specifications

The project follows Spec-Kit methodology with 6 specifications:

| Spec | Feature | Status |
|------|---------|--------|
| S001 | Playwright Script Management | Implemented |
| S002 | Coverage Tracking | Implemented |
| S003 | Version Change Detection | Implemented |
| S004 | Validation Reporting | Implemented |
| S005 | Configuration Persistence | Implemented |
| S006 | CI/CD Integration | Implemented |

## Links

- [Architecture](./architecture.md)
- [CLI Usage](./cli-usage.md)
- [Configuration](./configuration.md)
- [Modules](./modules.md)
- [Development](./development.md)
