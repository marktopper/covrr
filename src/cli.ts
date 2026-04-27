/**
 * Covrr CLI entry point
 */

import { Command } from 'commander';
import path from 'path';
import { loadConfig, ConfigNotFoundError, ConfigError } from './config/loader.js';
import { discoverScripts, checkPlaywright, DiscoveryError } from './script/discovery.js';
import { runScripts } from './script/runner.js';
import { ScriptResult } from './script/types.js';
import type { ValidationReport, OutputFormat } from './reporting/types.js';
import { saveReport, saveLatestReport } from './reporting/storage.js';
import { format } from './reporting/formatters.js';
import { listHistoricalReports, showReport, formatReportList } from './reporting/history.js';
import { deliverReport } from './reporting/delivery.js';
import {
  detectVersion,
  listSemverTags,
  findBaseline,
  sanitizeVersionForDir,
  compareVersions,
  listKnownVersions,
  saveVersionManifest,
  loadVersionManifest,
  saveVersionDiff,
  loadVersionDiff,
} from './version/index.js';
import fs from 'fs';
import yaml from 'js-yaml';

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
          // In CI mode with no scripts, exit cleanly rather than failing
          if (process.env.COVRR_CI) {
            process.exit(0);
          }
          console.error('Error: No scripts defined in covrr.yaml');
          process.exit(2);
        }

        // Find Playwright config (look in config directory, not CWD)
        const configDir = opts.config ? path.dirname(opts.config) : process.cwd();
        const playwrightConfig = findPlaywrightConfig(configDir);
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

        // Build validation report
        const allPassed = results.every((r) => r.status === 'passed');
        const report = buildValidationReport(results, allPassed);

        // Determine output format
        const outputFormat = (opts.format || 'text') as OutputFormat;

        // Output to stdout
        if (outputFormat === 'json') {
          console.log(format(report, 'json'));
        } else {
          console.log(format(report, outputFormat));
        }

        // Save to file if requested
        if (opts.output) {
          fs.writeFileSync(opts.output, format(report, 'json'), 'utf-8');
        }

        // Save to reports directory
        saveReport(report);
        saveLatestReport(report);

        // Deliver to configured outputs
        if (config.report?.outputs && config.report.outputs.length > 0) {
          const githubContext = getGitHubContext();
          const deliveryResults = await deliverReport(report, config.report.outputs, githubContext);

          for (const result of deliveryResults) {
            if (!result.success) {
              console.error(`Warning: Failed to deliver to ${result.destination}: ${result.error}`);
            }
          }
        }

        // Exit code
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
        const playwrightConfig = findPlaywrightConfig(configDir);
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

      writeFileSync('covrr.yaml', yaml.dump(config));
      console.log('Created covrr.yaml');
      console.log(`Initialized .covrr/ directory`);
      console.log("Run 'covrr run' to start");
    });

  // ── covrr report ─────────────────────────────────────────────────────────────

  const reportCmd = program
    .command('report')
    .description('Historical report commands');

  reportCmd
    .command('list')
    .description('List historical validation reports')
    .option('--limit <n>', 'Maximum number of reports to show', '10')
    .action(async (opts: { limit: string }) => {
      try {
        const limit = parseInt(opts.limit, 10) || 10;
        const reports = listHistoricalReports(limit);

        if (reports.length === 0) {
          console.log('No reports found. Run `covrr run` first.');
          process.exit(0);
        }

        console.log(formatReportList(reports));
      } catch (e) {
        console.error('Error:', (e as Error).message);
        process.exit(2);
      }
    });

  reportCmd
    .command('show <ref>')
    .description('Show a specific validation report')
    .option('--format <format>', 'Output format: text, json, markdown', 'text')
    .action(async (ref: string, opts: { format?: string }) => {
      try {
        const outputFormat = (opts.format || 'text') as OutputFormat;
        const output = showReport(ref, outputFormat);

        if (!output) {
          console.error(`Report not found: ${ref}`);
          process.exit(1);
        }

        console.log(output);
      } catch (e) {
        console.error('Error:', (e as Error).message);
        process.exit(2);
      }
    });

  // ── covrr version ────────────────────────────────────────────────────────────

  const versionCmd = program
    .command('version')
    .description('Version detection and comparison commands');

  versionCmd
    .command('detect')
    .description('Print the detected version string')
    .option('--version <version>', 'Override detected version')
    .option('--dir <path>', 'Directory to detect version in', '.')
    .action(async (opts: { version?: string; dir?: string }) => {
      try {
        const detected = detectVersion({ version: opts.version, dir: opts.dir });
        console.log(detected.version);
      } catch (e) {
        console.error('Error:', (e as Error).message);
        process.exit(2);
      }
    });

  versionCmd
    .command('compare <from> <to>')
    .description('JSON diff between two versions')
    .option('--json', 'Output as JSON (default)')
    .action(async (from: string, to: string, _opts: Record<string, unknown>) => {
      try {
        const isTagRef = from.startsWith('v') || from.match(/^\d+\.\d+\.\d+/);
        const result = compareVersions(from, to, { isTagRef: !!isTagRef });
        console.log(JSON.stringify(result, null, 2));
      } catch (e) {
        console.error('Error:', (e as Error).message);
        process.exit(2);
      }
    });

  versionCmd
    .command('list')
    .description('List all known versions in .covrr/versions/')
    .action(async () => {
      try {
        const versions = listKnownVersions();
        if (versions.length === 0) {
          console.log('No versions stored. Run `covrr version detect` first.');
          process.exit(0);
        }
        for (const v of versions) {
          console.log(v);
        }
      } catch (e) {
        console.error('Error:', (e as Error).message);
        process.exit(2);
      }
    });

  await program.parseAsync(process.argv);
}

function findPlaywrightConfig(configDir: string): string | undefined {
  const candidates = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'];
  for (const c of candidates) {
    const fullPath = path.join(configDir, c);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return undefined;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}

function buildValidationReport(results: ScriptResult[], allPassed: boolean): ValidationReport {
  const triggers: string[] = ['cli'];
  if (process.env.GITHUB_ACTIONS) triggers.push('github-actions');
  if (process.env.GITLAB_CI) triggers.push('gitlab-ci');

  return {
    id: crypto.randomUUID(),
    generated_at: new Date().toISOString(),
    version: '0.1.0',
    baseline_version: null,
    tool_version: VERSION,
    overall_status: allPassed ? 'passed' : 'failed',
    overall_message: allPassed ? 'All scripts passed.' : `${results.filter((r) => r.status === 'failed').length} script(s) failed.`,
    scripts: results.map((r) => ({
      name: r.name,
      status: r.status,
      duration_ms: r.duration_ms,
      tests_passed: r.tests_passed,
      tests_failed: r.tests_failed,
      exit_code: r.errors.length > 0 ? 1 : 0,
    })),
    triggers,
  };
}

function getGitHubContext(): { owner: string; repo: string; prNumber: number; token: string } | undefined {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) return undefined;

  const ref = process.env.GITHUB_REF;
  const match = ref?.match(/refs\/pull\/(\d+)\/merge/);
  if (!match) return undefined;

  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) return undefined;

  const [owner, repo] = repository.split('/');
  return { owner, repo, prNumber: parseInt(match[1], 10), token };
}

function detectVersionFromRun(_results: ScriptResult[]): string | null {
  return null;
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

const YAML = { stringify: (obj: unknown) => yaml.dump(obj) };

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(2);
});