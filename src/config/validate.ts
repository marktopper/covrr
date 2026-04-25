/**
 * Schema validation with field-path errors
 */

import {
  CovrrConfig,
  DefaultsConfig,
  SUPPORTED_BROWSERS,
} from './schema.js';
import { ConfigError } from './loader.js';

export interface ValidationError {
  field: string;
  message: string;
  validTypes?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Validate a fully-parsed config object.
 * Returns errors (fatal) and warnings (non-fatal).
 */
export function validateSchema(config: CovrrConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Check for duplicate script names
  if (config.scripts) {
    const names = Object.keys(config.scripts);
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    for (const dup of duplicates) {
      errors.push({
        field: `scripts.${dup}`,
        message: `Duplicate script name '${dup}' in config`,
      });
    }

    // Check each script has required fields
    for (const [name, script] of Object.entries(config.scripts)) {
      if (!script.pattern) {
        errors.push({
          field: `scripts.${name}.pattern`,
          message: `Script '${name}' missing required field 'pattern'`,
        });
      }
    }
  }

  // Validate defaults
  if (config.defaults) {
    validateDefaults(config.defaults, errors);
  }

  // Validate coverage thresholds
  if (config.coverage?.thresholds) {
    const t = config.coverage.thresholds;
    if (t.lines_percent !== undefined && typeof t.lines_percent !== 'number') {
      errors.push({
        field: 'coverage.thresholds.lines_percent',
        message: `Expected number, got "${t.lines_percent}"`,
        validTypes: 'integer (e.g. 80) or float (e.g. 80.5)',
      });
    }
    if (t.branches_percent !== undefined && typeof t.branches_percent !== 'number') {
      errors.push({
        field: 'coverage.thresholds.branches_percent',
        message: `Expected number, got "${t.branches_percent}"`,
        validTypes: 'integer (e.g. 80) or float (e.g. 80.5)',
      });
    }
    if (t.functions_percent !== undefined && typeof t.functions_percent !== 'number') {
      errors.push({
        field: 'coverage.thresholds.functions_percent',
        message: `Expected number, got "${t.functions_percent}"`,
        validTypes: 'integer (e.g. 80) or float (e.g. 80.5)',
      });
    }
    // strict is on CoverageConfig, not thresholds
    if (config.coverage?.strict !== undefined && typeof config.coverage.strict !== 'boolean') {
      errors.push({
        field: 'coverage.strict',
        message: `Expected boolean, got "${config.coverage.strict}"`,
        validTypes: 'true or false',
      });
    }
  }

  // Validate version.detect_from
  if (config.version?.detect_from !== undefined) {
    const valid = ['git', 'package'];
    if (!valid.includes(config.version.detect_from)) {
      errors.push({
        field: 'version.detect_from',
        message: `Expected one of: ${valid.join(', ')}`,
        validTypes: valid.join(' | '),
      });
    }
  }

  // Validate browser in defaults
  if (config.defaults?.browser) {
    if (!SUPPORTED_BROWSERS.includes(config.defaults.browser as typeof SUPPORTED_BROWSERS[number])) {
      errors.push({
        field: 'defaults.browser',
        message: `Expected one of: ${SUPPORTED_BROWSERS.join(', ')}`,
        validTypes: SUPPORTED_BROWSERS.join(' | '),
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateDefaults(defaults: DefaultsConfig, errors: ValidationError[]): void {
  if (defaults.timeout_ms !== undefined && typeof defaults.timeout_ms !== 'number') {
    errors.push({
      field: 'defaults.timeout_ms',
      message: `Expected number, got "${defaults.timeout_ms}"`,
      validTypes: 'integer (e.g. 60000)',
    });
  }
  if (defaults.timeout_ms !== undefined && defaults.timeout_ms < 0) {
    errors.push({
      field: 'defaults.timeout_ms',
      message: `Must be non-negative, got "${defaults.timeout_ms}"`,
    });
  }
  if (defaults.retry !== undefined && typeof defaults.retry !== 'number') {
    errors.push({
      field: 'defaults.retry',
      message: `Expected number, got "${defaults.retry}"`,
      validTypes: 'integer (e.g. 1)',
    });
  }
  if (defaults.retry !== undefined && defaults.retry < 0) {
    errors.push({
      field: 'defaults.retry',
      message: `Must be non-negative, got "${defaults.retry}"`,
    });
  }
  if (defaults.workers !== undefined && typeof defaults.workers !== 'number') {
    errors.push({
      field: 'defaults.workers',
      message: `Expected number, got "${defaults.workers}"`,
      validTypes: 'integer (e.g. 4)',
    });
  }
  if (defaults.workers !== undefined && defaults.workers < 1) {
    errors.push({
      field: 'defaults.workers',
      message: `Must be at least 1, got "${defaults.workers}"`,
    });
  }
}

/**
 * Format validation errors for human-readable output.
 */
export function formatValidationErrors(result: ValidationResult): string[] {
  const lines: string[] = [];
  for (const err of result.errors) {
    let line = `Config error at '${err.field}': ${err.message}`;
    if (err.validTypes) {
      line += `\n  Valid types: ${err.validTypes}`;
    }
    lines.push(line);
  }
  return lines;
}
