# Covrr

Playwright coverage and version-validation tool for CI/CD pipelines.

## Features

- **Playwright Script Management** — Discover and run Playwright tests via glob patterns
- **Coverage Tracking** — Collect coverage data and enforce thresholds
- **Version Change Detection** — Detect versions from git tags, package files, or CLI flags
- **Validation Reporting** — Text, JSON, Markdown, and HTML output formats
- **CI/CD Integration** — Native GitHub Actions and GitLab CI support with PR comments

## Quick Start

```bash
# Initialize configuration
npx covrr init

# Run all scripts
npx covrr run

# Run specific scripts
npx covrr run auth login
```

## Usage

### CLI

```bash
# Run with custom config
covrr run --config ./e2e/covrr.yaml

# Output as JSON
covrr run --format json

# Check version
covrr version detect
```

### GitHub Action

```yaml
- uses: covrr@v1
  with:
    format: markdown
    threshold: 80
```

## Configuration

Create a `covrr.yaml`:

```yaml
scripts:
  login:
    pattern: tests/login.spec.ts
  checkout:
    pattern: tests/checkout/**/*.spec.ts

coverage:
  thresholds:
    lines_percent: 80
  strict: true
```

See [docs/configuration.md](docs/configuration.md) for full reference.

## Documentation

- [Architecture](docs/architecture.md) — System design and data flow
- [CLI Usage](docs/cli-usage.md) — All commands and options
- [Configuration](docs/configuration.md) — Complete config reference
- [Modules](docs/modules.md) — API documentation
- [Development](docs/development.md) — Contributing guide

## Installation

```bash
npm install --save-dev covrr
```

Requires Node.js 18+ and Playwright.

## License

MIT
