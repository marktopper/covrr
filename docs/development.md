# Development Guide

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Playwright installed globally or locally

### Setup

```bash
cd ~/Projects/Covrr
npm install
npx playwright install
```

### Build

```bash
npm run build
```

Compiles TypeScript from `src/` to `dist/` using `tsconfig.json`.

### Development Mode

Watch and rebuild on changes:

```bash
npm run build -- --watch
```

## Testing

### Run All Tests

```bash
npm test
```

### Test Structure

Tests are co-located with source files in `__tests__/` directories:

```
src/
├── ci/__tests__/
│   ├── detector.test.ts
│   ├── exit-codes.test.ts
│   └── github.test.ts
├── config/__tests__/
│   ├── env.test.ts
│   ├── loader.test.ts
│   ├── migrate.test.ts
│   ├── search.test.ts
│   └── validate.test.ts
├── coverage/__tests__/
│   ├── collector.test.ts
│   ├── diff.test.ts
│   └── thresholds.test.ts
├── reporting/__tests__/
│   ├── formatters.test.ts
│   ├── history.test.ts
│   └── storage.test.ts
├── script/__tests__/
│   ├── discovery.test.ts
│   └── runner.test.ts
├── state/__tests__/
│   ├── manifest.test.ts
│   └── state.test.ts
└── version/__tests__/
    ├── compare.test.ts
    ├── detect.test.ts
    └── storage.test.ts
```

### Test Configuration

Jest configuration (`jest.config.js`):

```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts']
}
```

### Writing Tests

Example test pattern:

```typescript
import { discoverScripts } from '../discovery.js';

describe('discoverScripts', () => {
  it('resolves glob patterns to files', async () => {
    const scripts = {
      login: { pattern: '__fixtures__/login.spec.ts' }
    };
    const result = await discoverScripts(scripts, __dirname);
    expect(result.login).toContain(expect.stringContaining('login.spec.ts'));
  });
});
```

## Linting

```bash
npm run lint
```

Uses ESLint with TypeScript support.

## Project Conventions

### Module Pattern

Each module follows this structure:

```typescript
/**
 * Module description
 */

// Types
export interface MyType { ... }

// Errors
export class MyError extends Error { ... }

// Public API
export function publicFunction() { ... }

// Private helpers
function privateHelper() { ... }
```

### Import Style

Use `.js` extension for all imports (ESM requirement):

```typescript
// Correct
import { loadConfig } from './config/loader.js';

// Incorrect
import { loadConfig } from './config/loader';
```

### Error Handling

Use custom error classes:

```typescript
export class ConfigError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
```

## Adding New Features

### Adding a CLI Command

1. Add command in `src/cli.ts`:

```typescript
program
  .command('my-command <arg>')
  .description('Description')
  .option('--flag', 'Description')
  .action(async (arg, opts) => {
    // Implementation
  });
```

2. Add tests in `src/__tests__/cli.test.ts`

3. Update documentation

### Adding a Report Formatter

1. Add formatter in `src/reporting/formatters.ts`:

```typescript
export function formatNewFormat(report: ValidationReport): string {
  // Implementation
}
```

2. Register in `format()` function:

```typescript
case 'new-format':
  return formatNewFormat(report);
```

3. Update type in `src/reporting/types.ts`:

```typescript
export type OutputFormat = 'text' | 'json' | 'markdown' | 'html' | 'github-annotation' | 'new-format';
```

### Adding CI Platform Support

1. Create `src/ci/newplatform.ts`
2. Implement:
   - `postComment(context, body, commentId?)`
   - `formatComment(report)`
   - `getStateId()` / `saveStateId(id)`
3. Export from `src/ci/index.ts`
4. Add to `detectCIContext()` in `src/ci/detector.ts`

## Debugging

### Local Testing

Test CLI locally without installing:

```bash
node dist/cli.js run --config ./test/covrr.yaml
```

### Verbose Output

Set `DEBUG=covrr` environment variable for debug logging (if implemented).

### Common Issues

**"No covrr.yaml found"**
- Check you're in the right directory
- Run `covrr init` to create one

**"Playwright not found"**
- Install Playwright: `npx playwright install`
- Check `npx playwright --version` works

**"Pattern matched 0 files"**
- Verify glob pattern is relative to covrr.yaml location
- Check files exist: `ls path/to/pattern`

## Release Process

1. Update version in `package.json` and `src/cli.ts`
2. Update `CHANGELOG.md`
3. Build: `npm run build`
4. Test: `npm test`
5. Commit and tag: `git tag v0.1.0`
6. Push: `git push && git push --tags`

## Directory Structure

```
Covrr/
├── src/                    # Source code
│   ├── __tests__/          # CLI tests
│   ├── ci/                 # CI/CD integration
│   ├── config/             # Configuration
│   ├── coverage/           # Coverage tracking
│   ├── reporting/          # Reporting
│   ├── script/             # Script execution
│   ├── state/              # State persistence
│   └── version/            # Version management
├── dist/                   # Compiled output (git-ignored)
├── coverage/               # Test coverage (git-ignored)
├── specs/                  # Feature specifications
│   ├── s001-playwright-script-management/
│   ├── s002-coverage-tracking/
│   ├── s003-version-change-detection/
│   ├── s004-validation-reporting/
│   ├── s005-configuration-persistence/
│   └── s006-cicd-integration/
├── docs/                   # Documentation
├── action.yml              # GitHub Action
├── covrr.yaml              # Example config
├── jest.config.js          # Jest config
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
└── README.md               # Project readme
```
