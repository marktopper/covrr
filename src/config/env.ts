/**
 * Environment variable overrides for Covrr config.
 *
 * Precedence (highest to lowest):
 *  1. CLI flags
 *  2. Environment variables
 *  3. Config file
 *  4. Defaults (built-in)
 */

import { CovrrConfig } from './schema.js';

export interface EnvOverrideOptions {
  COVRR_CONFIG?: string;
  COVRR_VERSION?: string;
  COVRR_BASELINE?: string;
  COVRR_BROWSER?: string;
  COVRR_WORKERS?: string;
  COVRR_THRESHOLD_LINES?: string;
  COVRR_THRESHOLD_BRANCHES?: string;
  COVRR_THRESHOLD_FUNCTIONS?: string;
  COVRR_TIMEOUT_MS?: string;
}

/**
 * Apply environment variable overrides to a config.
 * Returns a new config object with env overrides applied.
 */
export function applyEnvOverrides(
  config: CovrrConfig,
  env: EnvOverrideOptions = process.env as EnvOverrideOptions
): CovrrConfig {
  const overridden = JSON.parse(JSON.stringify(config)) as CovrrConfig;

  // COVRR_BASELINE → version.baseline
  if (env.COVRR_BASELINE !== undefined) {
    overridden.version = { ...(overridden.version || {}), baseline: env.COVRR_BASELINE };
  }

  // COVRR_VERSION → version override (top-level)
  if (env.COVRR_VERSION !== undefined) {
    overridden.version = { ...(overridden.version || {}), baseline: env.COVRR_VERSION };
  }

  // COVRR_BROWSER → defaults.browser
  if (env.COVRR_BROWSER !== undefined) {
    overridden.defaults = { ...(overridden.defaults || {}), browser: env.COVRR_BROWSER as 'chromium' | 'firefox' | 'webkit' };
  }

  // COVRR_WORKERS → defaults.workers
  if (env.COVRR_WORKERS !== undefined) {
    const workers = parseInt(env.COVRR_WORKERS, 10);
    if (!isNaN(workers)) {
      overridden.defaults = { ...(overridden.defaults || {}), workers };
    }
  }

  // COVRR_TIMEOUT_MS → defaults.timeout_ms
  if (env.COVRR_TIMEOUT_MS !== undefined) {
    const timeout = parseInt(env.COVRR_TIMEOUT_MS, 10);
    if (!isNaN(timeout)) {
      overridden.defaults = { ...(overridden.defaults || {}), timeout_ms: timeout };
    }
  }

  // COVRR_THRESHOLD_LINES → coverage.thresholds.lines_percent
  if (env.COVRR_THRESHOLD_LINES !== undefined) {
    const val = parseFloat(env.COVRR_THRESHOLD_LINES);
    if (!isNaN(val)) {
      overridden.coverage = {
        ...(overridden.coverage || {}),
        thresholds: { ...(overridden.coverage?.thresholds || {}), lines_percent: val },
      };
    }
  }

  // COVRR_THRESHOLD_BRANCHES → coverage.thresholds.branches_percent
  if (env.COVRR_THRESHOLD_BRANCHES !== undefined) {
    const val = parseFloat(env.COVRR_THRESHOLD_BRANCHES);
    if (!isNaN(val)) {
      overridden.coverage = {
        ...(overridden.coverage || {}),
        thresholds: { ...(overridden.coverage?.thresholds || {}), branches_percent: val },
      };
    }
  }

  // COVRR_THRESHOLD_FUNCTIONS → coverage.thresholds.functions_percent
  if (env.COVRR_THRESHOLD_FUNCTIONS !== undefined) {
    const val = parseFloat(env.COVRR_THRESHOLD_FUNCTIONS);
    if (!isNaN(val)) {
      overridden.coverage = {
        ...(overridden.coverage || {}),
        thresholds: { ...(overridden.coverage?.thresholds || {}), functions_percent: val },
      };
    }
  }

  return overridden;
}

/**
 * Get a map of supported env var names to their config field paths.
 */
export function getEnvVarMap(): Record<string, string> {
  return {
    COVRR_CONFIG: 'config path',
    COVRR_VERSION: 'version override',
    COVRR_BASELINE: 'version.baseline',
    COVRR_BROWSER: 'defaults.browser',
    COVRR_WORKERS: 'defaults.workers',
    COVRR_THRESHOLD_LINES: 'coverage.thresholds.lines_percent',
    COVRR_THRESHOLD_BRANCHES: 'coverage.thresholds.branches_percent',
    COVRR_THRESHOLD_FUNCTIONS: 'coverage.thresholds.functions_percent',
    COVRR_TIMEOUT_MS: 'defaults.timeout_ms',
  };
}
