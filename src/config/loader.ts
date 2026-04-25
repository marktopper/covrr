/**
 * Covrr configuration file loader
 * Handles discovery, parsing, validation, and precedence
 */

import fs from 'fs';
import yaml from 'js-yaml';
import {
  CovrrConfig,
  DefaultsConfig,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_RETRY,
  DEFAULT_WORKERS,
  DEFAULT_BROWSER,
  SUPPORTED_BROWSERS,
} from './schema.js';
import { findConfigSearchPath, resolveConfigPath, HOME_CONFIG_PATH, SEARCH_PATHS } from './search.js';

export { SEARCH_PATHS, HOME_CONFIG_PATH };
import { applyEnvOverrides, EnvOverrideOptions } from './env.js';
import { migrateConfigWithBackup, CURRENT_FORMAT_VERSION, FORMAT_VERSION_KEY } from './migrate.js';

export class ConfigError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ConfigNotFoundError extends Error {
  constructor(paths: string[]) {
    super(`No covrr.yaml found. Searched: ${paths.join(', ')}. Run 'covrr init' to create one.`);
    this.name = 'ConfigNotFoundError';
  }
}

/**
 * Find config file by searching standard paths
 */
export function findConfig(explicitPath?: string): string | null {
  if (explicitPath) {
    if (!fs.existsSync(explicitPath)) {
      throw new ConfigError(`Config file not found: ${explicitPath}`, 'config');
    }
    return explicitPath;
  }

  return findConfigSearchPath();
}

/**
 * Parse and validate a covrr.yaml file
 */
export function parseConfig(content: string, filePath: string): CovrrConfig {
  let raw: Record<string, unknown>;

  try {
    raw = yaml.load(content) as Record<string, unknown>;
  } catch (e) {
    const err = e as yaml.YAMLException;
    throw new ConfigError(`Invalid YAML: ${err.message}${err.mark ? ` at line ${err.mark.line}` : ''}`);
  }

  if (raw === null || raw === undefined) {
    return {};
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ConfigError('Config must be a YAML object');
  }

  // Validate scripts
  if ('scripts' in raw) {
    if (typeof raw.scripts !== 'object' || raw.scripts === null) {
      throw new ConfigError("'scripts' must be a map of script name to definition", 'scripts');
    }
    for (const [name, def] of Object.entries(raw.scripts as Record<string, unknown>)) {
      if (typeof def !== 'object' || def === null) {
        throw new ConfigError(`Script '${name}' must be an object`, `scripts.${name}`);
      }
      const scriptDef = def as Record<string, unknown>;
      if (!scriptDef.pattern) {
        throw new ConfigError(`Script '${name}' missing required field 'pattern'`, `scripts.${name}.pattern`);
      }
      if (typeof scriptDef.pattern !== 'string') {
        throw new ConfigError(`Script '${name}.pattern' must be a string`, `scripts.${name}.pattern`);
      }
    }
  }

  // Validate defaults
  if ('defaults' in raw) {
    if (typeof raw.defaults !== 'object' || raw.defaults === null) {
      throw new ConfigError("'defaults' must be an object", 'defaults');
    }
    const def = raw.defaults as Record<string, unknown>;
    if (def.timeout_ms !== undefined && typeof def.timeout_ms !== 'number') {
      throw new ConfigError("'defaults.timeout_ms' must be a number", 'defaults.timeout_ms');
    }
    if (def.retry !== undefined && typeof def.retry !== 'number') {
      throw new ConfigError("'defaults.retry' must be a number", 'defaults.retry');
    }
    if (def.workers !== undefined && typeof def.workers !== 'number') {
      throw new ConfigError("'defaults.workers' must be a number", 'defaults.workers');
    }
    if (def.browser !== undefined && typeof def.browser !== 'string') {
      throw new ConfigError("'defaults.browser' must be a string", 'defaults.browser');
    }
  }

  return raw as CovrrConfig;
}

/**
 * Load and return a fully-resolved config
 * Handles discovery, parsing, migration, defaults, and env overrides.
 */
export function loadConfig(explicitPath?: string, applyEnv?: boolean): CovrrConfig {
  const configPath = resolveConfigPath(explicitPath);
  if (!configPath) {
    throw new ConfigNotFoundError([...SEARCH_PATHS, HOME_CONFIG_PATH]);
  }

  // Check for format migration
  migrateConfigWithBackup(configPath);

  const content = fs.readFileSync(configPath, 'utf-8').trim();
  const parsed = parseConfig(content, configPath);

  // Apply defaults
  let config = applyDefaults(parsed);

  // Apply env overrides
  if (applyEnv !== false) {
    config = applyEnvOverrides(config);
  }

  return config;
}

/**
 * Apply built-in defaults to a parsed config
 */
function applyDefaults(config: CovrrConfig): CovrrConfig {
  const defaults: DefaultsConfig = config.defaults || {};

  const resolvedDefaults: DefaultsConfig = {
    timeout_ms: defaults.timeout_ms ?? DEFAULT_TIMEOUT_MS,
    retry: defaults.retry ?? DEFAULT_RETRY,
    workers: defaults.workers ?? DEFAULT_WORKERS,
    browser: (defaults.browser && SUPPORTED_BROWSERS.includes(defaults.browser as typeof SUPPORTED_BROWSERS[number]))
      ? defaults.browser as typeof DEFAULT_BROWSER
      : DEFAULT_BROWSER,
  };

  // Apply defaults to each script
  const scripts = config.scripts || {};
  for (const [name, script] of Object.entries(scripts)) {
    scripts[name] = {
      pattern: script.pattern,
      timeout_ms: script.timeout_ms ?? resolvedDefaults.timeout_ms,
      retry: script.retry ?? resolvedDefaults.retry,
      env: script.env || {},
    };
  }

  return {
    ...config,
    defaults: resolvedDefaults,
    scripts,
  };
}

/**
 * Resolve env var placeholders in config values
 * Supports: env:VAR_NAME syntax
 */
export function resolveEnvVars(config: CovrrConfig): CovrrConfig {
  const resolved = JSON.parse(JSON.stringify(config)); // deep clone

  // Resolve env vars in CI config
  if (resolved.ci?.github?.token) {
    if (resolved.ci.github.token.startsWith('env:')) {
      const envKey = resolved.ci.github.token.slice(4);
      resolved.ci.github.token = process.env[envKey] || '';
            }
  }
  if (resolved.ci?.gitlab?.token) {
    if (resolved.ci.gitlab.token.startsWith('env:')) {
      const envKey = resolved.ci.gitlab.token.slice(4);
      resolved.ci.gitlab.token = process.env[envKey] || '';
            }
  }

  return resolved;
}

export function validateConfig(config: CovrrConfig): string[] {
  const errors: string[] = [];

  // Check for duplicate script names
  if (config.scripts) {
    const names = Object.keys(config.scripts);
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate script names: ${duplicates.join(', ')}`);
    }
  }

  // Check unknown top-level keys (warning, not error)
  const KNOWN_KEYS = ['scripts', 'defaults', 'coverage', 'version', 'report', 'ci'];

  return errors;
}