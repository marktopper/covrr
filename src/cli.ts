/**
 * Covrr CLI entry point
 */

import { Command } from 'commander';
import path from 'path';
import { loadConfig, ConfigNotFoundError, ConfigError, SEARCH_PATHS, HOME_CONFIG_PATH } from './config/loader.js';
import { validateSchema, formatValidationErrors, ValidationResult } from './config/validate.js';
import { getEnvVarMap } from './config/env.js';
import { discoverScripts, checkPlaywright, DiscoveryError } from './script/discovery.js';
import { runScripts } from './script/runner.js';
import { ScriptResult } from './script/types.js';
import type { ValidationReport, OutputFormat } from './reporting/types.js';
import { saveReport, saveLatestReport } from './reporting/storage.js';
import { format } from './reporting/formatters.js';
import { listHistoricalReports, showReport, formatReportList } from './reporting/history.js';
import { deliverReport } from './reporting/delivery.js';
import { readState, writeState, StateData, ensureCovrrDir } from './state/state.js';
import { writeVersionManifest } from './state/manifest.js';
import { createCoverageStorage } from './coverage/storage.js';
import { collectFromFile, collectFromStdout, CoverageParseError } from './coverage/collector.js';
import { checkThresholds, formatThresholdResult, getThresholdExitCode, getThresholdWarning } from './coverage/thresholds.js';
import { calculateDiff, formatDiff } from './coverage/diff.js';
import { CoverageReport, CoverageData } from './coverage/types.js';
import fs from 'fs';
import yaml from 'js-yaml';

const VERSION = '0.1.0';

async function main() {
  const program = new Command();

  program
    .name('covrr')
    .version(VERSION)
    .description('Playwright coverage and version-validation tool');

  // ── covrr run ──────────────────────────────────────────────────────────────

  program
    .command('run [scripts...]')
    .description('Run Playwright scripts')
    .option('--config <path>', 'Path to covrr.yaml')
    .option('--format <format>', 'Output format: text, json, markdown', 'text')
    .option('--output <path>', 'Save report to file')
    .option('--ci <platform>', 'CI platform: github, gitlab, manual')
    .option('--pr-comment-id <id>', 'Existing PR comment ID for idempotent updates')
    .option('--status-check <name>', 'GitHub status check name')
    .option('--no-comment', 'Run without posting PR comment')
    .action(async (scriptNames: string[], opts: { config?: string; format?: string; output?: string; ci?: string; prCommentId?: string; statusCheck?: string; noComment?: boolean }) => {
      try {
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

        const pwCheck = checkPlaywright();
        if (!pwCheck.installed) {
          console.error('Error:', pwCheck.error);
          process.exit(2);
        }

        const scriptsToRun = scriptNames.length > 0
          ? scriptNames.filter((n) => Object.keys(config.scripts || {}).includes(n))
          : Object.keys(config.scripts || {});

        if (scriptsToRun.length === 0) {
          console.error('Error: No scripts defined in covrr.yaml');
          process.exit(2);
        }

        const playwrightConfig = findPlaywrightConfig();
        const configDir = opts.config ? path.dirname(opts.config) : process.cwd();
        const discovered = await discoverScripts(
          Object.fromEntries(scriptsToRun.map((n) => [n, config.scripts![n]])),
          configDir
        );

        const scriptList = scriptsToRun.map((name) => ({
          name,
          definition: config.scripts![name],
          files: discovered[name],
        }));

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
          const { writeFileSync } = await import('fs');
          writeFileSync(opts.output, format(report, 'json'), 'utf-8');
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

        // Update state after run
        const lastVersion = detectVersionFromRun(results);
        if (lastVersion) {
          updateRunState(lastVersion, results);
        }

        process.exit(allPassed ? 0 : 1);
      } catch (e) {
        const err = e as Error;
        console.error('Error:', err.message);
        process.exit(2);
      }
    });

  // ── covrr trigger ─────────────────────────────────────────────────────────

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

  // ── covrr init ────────────────────────────────────────────────────────────

  program
    .command('init')
    .description('Interactively create a covrr.yaml and initialise .covrr/')
    .option('--defaults', 'Use all defaults, no prompts')
    .option('--script-pattern <pattern>', 'Glob pattern for test files')
    .option('--coverage', 'Enable coverage collection')
    .option('--baseline <version>', 'Baseline version')
    .action(async (opts: {
      defaults?: boolean;
      scriptPattern?: string;
      coverage?: boolean;
      baseline?: string;
    }) => {
      try {
        const projectRoot = process.cwd();
        ensureCovrrDir(projectRoot);

        const config = buildDefaultConfig(opts);
        const configPath = path.join(projectRoot, 'covrr.yaml');

        fs.writeFileSync(configPath, yaml.dump(config), 'utf-8');
        console.log('Created covrr.yaml');

        const statePath = path.join(projectRoot, '.covrr', 'state.json');
        const initialState: StateData = {
          last_version_at: new Date().toISOString(),
          ...(opts.baseline ? { baseline_version: opts.baseline } : {}),
        };
        fs.writeFileSync(statePath, JSON.stringify(initialState, null, 2), 'utf-8');
        console.log('Initialized .covrr/ directory');
        console.log("Run 'covrr run' to start");
      } catch (e) {
        console.error('Error:', (e as Error).message);
        process.exit(2);
      }
    });

  // ── covrr config show ─────────────────────────────────────────────────────

  program
    .command('config show')
    .description('Print current resolved config (with defaults and env overrides applied)')
    .option('--config <path>', 'Path to covrr.yaml')
    .option('--no-env', 'Skip environment variable overrides')
    .action(async (opts: { config?: string; env?: boolean }) => {
      try {
        const config = loadConfig(opts.config, opts.env !== false);
        console.log(yaml.dump(config));
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
    });

  // ── covrr config validate ──────────────────────────────────────────────────

  program
    .command('config validate')
    .description('Validate the covrr.yaml file and report errors')
    .option('--config <path>', 'Path to covrr.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = loadConfig(opts.config, false);
        const result = validateSchema(config);

        if (result.valid) {
          console.log('Config is valid.');
          process.exit(0);
        } else {
          const lines = formatValidationErrors(result);
          for (const line of lines) {
            console.error(line);
          }
          process.exit(1);
        }
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
    });

  // ── covrr coverage report ───────────────────────────────────────────────────

  program
    .command('coverage report')
    .description('Show coverage summary for a version and optional script')
    .option('--version <ver>', 'Version to show (defaults to latest)')
    .option('--script <name>', 'Script name to filter by')
    .action(async (opts: { version?: string; script?: string }) => {
      try {
        const storage = createCoverageStorage();
        const version = opts.version || storage.getLatestVersion();

        if (!version) {
          console.error('No coverage data found. Run scripts first.');
          process.exit(1);
        }

        const manifest = storage.loadManifest(version);
        if (!manifest) {
          console.error(`No coverage data for version ${version}`);
          process.exit(1);
        }

        const scripts = opts.script ? [opts.script] : manifest.scripts;
        for (const scriptName of scripts) {
          const report = storage.loadReport(version, scriptName);
          if (!report) {
            console.error(`No report for script '${scriptName}' in version ${version}`);
            continue;
          }

          const s = report.summary;
          console.log(
            `Lines: ${s.lines_percent.toFixed(1)}% (${s.lines_covered}/${s.lines_total}) | ` +
            `Branches: ${s.branches_percent.toFixed(1)}% (${s.branches_covered}/${s.branches_total}) | ` +
            `Tool: ${report.tool}`
          );
        }
      } catch (e) {
        console.error('Error:', (e as Error).message);
        process.exit(2);
      }
    });

  // ── covrr coverage diff ────────────────────────────────────────────────────

  program
    .command('coverage diff <from> <to>')
    .description('Show coverage delta between two versions')
    .action(async (fromVersion: string, toVersion: string) => {
      try {
        const storage = createCoverageStorage();

        const fromManifest = storage.loadManifest(fromVersion);
        const toManifest = storage.loadManifest(toVersion);

        if (!toManifest) {
          console.error(`Version '${toVersion}' not found`);
          process.exit(1);
        }

        const allScripts = new Set<string>([
          ...(fromManifest?.scripts || []),
          ...toManifest.scripts,
        ]);

        for (const scriptName of allScripts) {
          const fromReport = storage.loadReport(fromVersion, scriptName);
          const toReport = storage.loadReport(toVersion, scriptName);

          if (!toReport) {
            console.error(`No report for script '${scriptName}' in version '${toVersion}'`);
            continue;
          }

          const diff = calculateDiff(fromReport, toReport);
          console.log(`=== ${scriptName} ===`);
          console.log(formatDiff(diff));
        }
      } catch (e) {
        console.error('Error:', (e as Error).message);
        process.exit(2);
      }
    });

  // ── covrr coverage status ──────────────────────────────────────────────────

  program
    .command('coverage status')
    .description('Show current version coverage against thresholds')
    .option('--version <ver>', 'Version to check (defaults to latest)')
    .action(async (opts: { version?: string }) => {
      try {
        const config = loadConfig();
        const storage = createCoverageStorage();
        const version = opts.version || storage.getLatestVersion();

        if (!version) {
          console.error('No coverage data found. Run scripts first.');
          process.exit(1);
        }

        const manifest = storage.loadManifest(version);
        if (!manifest) {
          console.error(`No coverage data for version ${version}`);
          process.exit(1);
        }

        const thresholds = config.coverage?.thresholds;
        const strict = config.coverage?.strict ?? false;

        if (!thresholds) {
          console.log('No thresholds configured. Skipping threshold check.');
          process.exit(0);
        }

        let hasFailure = false;
        for (const scriptName of manifest.scripts) {
          const report = storage.loadReport(version, scriptName);
          if (!report) continue;

          const result = checkThresholds(report.summary, { thresholds, strict });
          console.log(formatThresholdResult(result, scriptName));

          if (!result.passed && strict) {
            hasFailure = true;
          }
        }

        process.exit(hasFailure ? 1 : 0);
      } catch (e) {
        console.error('Error:', (e as Error).message);
        process.exit(2);
      }
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

  await program.parseAsync(process.argv);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function findPlaywrightConfig(): string | undefined {
  const candidates = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
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

function buildValidationReport(results: ScriptResult[], allPassed: boolean): ValidationReport {
  const triggers: string[] = ['cli'];
  if (process.env.GITHUB_ACTIONS) triggers.push('github-actions');
  if (process.env.GITLAB_CI) triggers.push('gitlab-ci');

  const overallStatus = allPassed ? 'passed' : 'failed';
  const messages: string[] = [];

  if (allPassed) {
    messages.push('All scripts passed.');
  } else {
    const failedCount = results.filter((r) => r.status === 'failed').length;
    messages.push(`${failedCount} script(s) failed.`);
  }

  return {
    id: crypto.randomUUID(),
    generated_at: new Date().toISOString(),
    version: '0.1.0', // Will be replaced with actual version detection
    baseline_version: null,
    tool_version: VERSION,
    overall_status: overallStatus,
    overall_message: messages.join(' '),
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
  return {
    owner,
    repo,
    prNumber: parseInt(match[1], 10),
    token,
  };
}

function detectVersionFromRun(_results: ScriptResult[]): string | null {
  // Placeholder: in a real implementation, this would detect from git or package.json
  return null;
}

function updateRunState(version: string, results: ScriptResult[]): void {
  const projectRoot = process.cwd();
  const allPassed = results.every((r) => r.status === 'passed');
  const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);

  const state: StateData = {
    last_version: version,
    last_version_at: new Date().toISOString(),
    last_run_duration_ms: totalDuration,
    last_run_scripts: results.map((r) => r.name),
    last_run_status: allPassed ? 'passed' : 'failed',
  };

  writeState(state, projectRoot);

  // Write version manifest
  writeVersionManifest(version, {
    baseline: undefined,
    scripts: results.map((r) => r.name),
  }, projectRoot);
}

function buildDefaultConfig(opts: {
  defaults?: boolean;
  scriptPattern?: string;
  coverage?: boolean;
  baseline?: string;
}): Record<string, unknown> {
  const config: Record<string, unknown> = {
    scripts: {
      smoke: {
        pattern: opts.scriptPattern || 'tests/**/*.spec.ts',
        timeout_ms: 30000,
        retry: 2,
      },
    },
    defaults: {
      timeout_ms: 60000,
      retry: 1,
      workers: 4,
      browser: 'chromium',
    },
  };

  if (opts.coverage) {
    config.coverage = {
      tool: 'istanbul',
      output_path: './coverage/coverage-final.json',
      thresholds: {
        lines_percent: 80,
        branches_percent: 75,
      },
      strict: false,
    };
  }

  if (opts.baseline) {
    config.version = {
      baseline: opts.baseline,
      detect_from: 'git',
    };
  }

  return config;
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(2);
});
