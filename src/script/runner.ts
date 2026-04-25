/**
 * Playwright script executor
 * Runs Playwright tests and parses results
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ScriptDefinition } from '../config/schema.js';
import { ScriptResult, CoverageData } from './types.js';

export class RunnerError extends Error {
  constructor(message: string, public scriptName?: string, public exitCode?: number) {
    super(message);
    this.name = 'RunnerError';
  }
}

/**
 * Run a Playwright script and collect results
 */
export async function runScript(
  name: string,
  definition: ScriptDefinition,
  files: string[],
  playwrightConfig?: string
): Promise<ScriptResult> {
  const startTime = Date.now();

  // Build Playwright CLI arguments
  const args = ['playwright', 'test'];

  if (playwrightConfig) {
    args.push('--config', playwrightConfig);
  }

  args.push(
    '--timeout', String(definition.timeout_ms || 60000),
    '--retries', String(definition.retry ?? 1),
    ...files
  );

  // Prepare environment
  const env = { ...process.env, ...definition.env };

  // Run Playwright
  let stdout = '';
  let stderr = '';

  try {
    const result = await new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve, reject) => {
      const proc = spawn('npx', args, {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd(),
      });

      proc.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
      proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        resolve({ exitCode: code ?? 1, stdout, stderr });
      });
      proc.on('error', (err) => reject(err));
    });

    const duration_ms = Date.now() - startTime;
    const exitCode = result.exitCode;

    // Parse JSON report if available
    const reportPath = path.join(process.cwd(), 'playwright-report.json');
    let tests_total = 0;
    let tests_passed = 0;
    let tests_failed = 0;
    let status: ScriptResult['status'] = 'passed';

    if (fs.existsSync(reportPath)) {
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
        tests_total = report.stats?.total || 0;
        tests_passed = report.stats?.passed || 0;
        tests_failed = report.stats?.failed || 0;
      } catch {
        // Ignore parse errors
      }
    }

    if (exitCode === 0) {
      status = 'passed';
    } else if (exitCode === 1) {
      status = tests_failed > 0 ? 'failed' : 'passed';
    } else {
      status = 'error';
    }

    // Try to extract coverage from stdout
    const coverageMatch = stdout.match(/^COVERAGE:(\S+)$/m);
    let coverage: CoverageData | undefined;
    if (coverageMatch) {
      try {
        coverage = JSON.parse(Buffer.from(coverageMatch[1], 'base64').toString('utf-8'));
      } catch {
        // Ignore malformed coverage data
      }
    }

    return {
      name,
      status,
      duration_ms,
      tests_total,
      tests_passed,
      tests_failed,
      coverage,
      errors: exitCode !== 0 ? [stderr.slice(0, 500)] : [],
    };
  } catch (e) {
    const duration_ms = Date.now() - startTime;
    const err = e as Error;
    return {
      name,
      status: 'error',
      duration_ms,
      tests_total: 0,
      tests_passed: 0,
      tests_failed: 0,
      errors: [err.message],
    };
  }
}

/**
 * Run multiple scripts sequentially
 */
export async function runScripts(
  scripts: Array<{ name: string; definition: ScriptDefinition; files: string[] }>,
  playwrightConfig?: string
): Promise<ScriptResult[]> {
  const results: ScriptResult[] = [];

  for (const script of scripts) {
    const result = await runScript(script.name, script.definition, script.files, playwrightConfig);
    results.push(result);
  }

  return results;
}

/**
 * Parse Playwright JSON report
 */
export function parsePlaywrightReport(reportPath: string): {
  tests_total: number;
  tests_passed: number;
  tests_failed: number;
  duration_ms: number;
} | null {
  if (!fs.existsSync(reportPath)) {
    return null;
  }

  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    return {
      tests_total: report.stats?.total || 0,
      tests_passed: report.stats?.passed || 0,
      tests_failed: report.stats?.failed || 0,
      duration_ms: report.stats?.duration || 0,
    };
  } catch {
    return null;
  }
}