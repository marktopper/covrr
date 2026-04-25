/**
 * Covrr CLI entry point
 */

import { Command } from 'commander';
import path from 'path';
import { loadConfig, ConfigNotFoundError, ConfigError } from './config/loader.js';
import { discoverScripts, checkPlaywright, DiscoveryError } from './script/discovery.js';
import { runScripts } from './script/runner.js';
import { ScriptResult } from './script/types.js';

const VERSION = '0.1.0';

async function main() {
  const program = new Command();

  program
    .name('covrr')
    .version(VERSION)
    .description('Playwright coverage and version-validation tool');

  program
    .command('run [scripts...]')
    .description('Run Playwright scripts')
    .option('--config <path>', 'Path to covrr.yaml')
    .option('--format <format>', 'Output format: text, json, markdown', 'text')
    .option('--output <path>', 'Save report to file')
    .action(async (scriptNames: string[], opts: { config?: string; format?: string; output?: string }) => {
      try {
        // Load config
        let config;
        try {
          config = loadConfig(opts.config);
        } catch (e) {
          if (e instanceof ConfigNotFoundError) {
            console.error('Error:', e.message);
            process.exit(2);
          }
          if (e instanceof ConfigError) {
            console.error(`Config error at '${e.field}': ${e.message}`);
            process.exit(2);
          }
          throw e;
        }

        // Check Playwright
        const pwCheck = checkPlaywright();
        if (!pwCheck.installed) {
          console.error('Error:', pwCheck.error);
          process.exit(2);
        }

        // Determine which scripts to run
        const scriptsToRun = scriptNames.length > 0
          ? scriptNames.filter((n) => Object.keys(config.scripts || {}).includes(n))
          : Object.keys(config.scripts || {});

        if (scriptsToRun.length === 0) {
          console.error('Error: No scripts defined in covrr.yaml');
          process.exit(2);
        }

        // Find Playwright config
        const playwrightConfig = findPlaywrightConfig();

        // Discover script files
        const configDir = opts.config ? path.dirname(opts.config) : process.cwd();
        const discovered = await discoverScripts(
          Object.fromEntries(scriptsToRun.map((n) => [n, config.scripts![n]])),
          configDir
        );

        // Build script list with resolved files
        const scriptList = scriptsToRun.map((name) => ({
          name,
          definition: config.scripts![name],
          files: discovered[name],
        }));

        // Run scripts
        const results = await runScripts(scriptList, playwrightConfig);

        // Output results
        if (opts.format === 'json') {
          const output = {
            version: VERSION,
            generated_at: new Date().toISOString(),
            scripts: results,
            overall_status: results.every((r) => r.status === 'passed') ? 'passed' : 'failed',
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          // Text format
          for (const result of results) {
            const icon = result.status === 'passed' ? '✓' : '✗';
            const duration = formatDuration(result.duration_ms);
            console.log(`${icon} ${result.name.padEnd(12)} ${result.status.padEnd(8)} ${duration.padEnd(8)} (${result.tests_passed}/${result.tests_total})`);
          }
          const allPassed = results.every((r) => r.status === 'passed');
          console.log(`\nOverall: ${allPassed ? 'PASS' : 'FAIL'}`);
        }

        // Save to file if requested
        if (opts.output) {
          const { writeFileSync } = await import('fs');
          const output = {
            version: VERSION,
            generated_at: new Date().toISOString(),
            scripts: results,
            overall_status: results.every((r) => r.status === 'passed') ? 'passed' : 'failed',
          };
          writeFileSync(opts.output, JSON.stringify(output, null, 2));
        }

        // Exit code
        const allPassed = results.every((r) => r.status === 'passed');
        process.exit(allPassed ? 0 : 1);
      } catch (e) {
        const err = e as Error;
        console.error('Error:', err.message);
        process.exit(2);
      }
    });

  program
    .command('trigger <script>')
    .description('Run a single script and output JSON to stdout')
    .option('--config <path>', 'Path to covrr.yaml')
    .action(async (scriptName: string, opts: { config?: string }) => {
      try {
        const config = loadConfig(opts.config);
        const definition = config.scripts?.[scriptName];
        if (!definition) {
          console.error(`Script '${scriptName}' not found`);
          process.exit(2);
        }

        const configDir = opts.config ? path.dirname(opts.config) : process.cwd();
        const discovered = await discoverScripts({ [scriptName]: definition }, configDir);
        const playwrightConfig = findPlaywrightConfig();
        const results = await runScripts([{ name: scriptName, definition, files: discovered[scriptName] }], playwrightConfig);

        console.log(JSON.stringify(results[0], null, 2));
        process.exit(results[0].status === 'passed' ? 0 : 1);
      } catch (e) {
        console.error('Error:', (e as Error).message);
        process.exit(2);
      }
    });

  program
    .command('init')
    .description('Interactively create a covrr.yaml')
    .option('--defaults', 'Use all defaults, no prompts')
    .action(async (opts: { defaults?: boolean }) => {
      const { writeFileSync, mkdirSync, existsSync } = await import('fs');

      const config = opts.defaults ? getDefaultConfig() : getDefaultConfig();

      // Create .covrr directory
      const covrrDir = '.covrr';
      if (!existsSync(covrrDir)) {
        mkdirSync(covrrDir, { recursive: true });
      }

      writeFileSync('covrr.yaml', YAML.stringify(config));
      console.log('Created covrr.yaml');
      console.log(`Initialized .covrr/ directory`);
      console.log("Run 'covrr run' to start");
    });

  await program.parseAsync(process.argv);
}

function findPlaywrightConfig(): string | undefined {
  const candidates = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'];
  const { existsSync } = require('fs');
  for (const c of candidates) {
    if (existsSync(c)) {
      return c;
    }
  }
  return undefined;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}

function getDefaultConfig() {
  return {
    scripts: {
      smoke: { pattern: 'tests/**/*.spec.ts', timeout_ms: 30000, retry: 2 },
    },
    defaults: { timeout_ms: 60000, retry: 1, workers: 4, browser: 'chromium' },
  };
}

async function promptConfig(): Promise<Record<string, unknown>> {
  // Placeholder for interactive prompts (not yet implemented)
  return getDefaultConfig();
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const YAML = { stringify: (obj: unknown) => require('js-yaml').dump(obj) };

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(2);
});