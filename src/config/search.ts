/**
 * Config discovery - searches 5 paths in priority order
 */

import fs from 'fs';
import path from 'path';
import { ConfigError, ConfigNotFoundError } from './loader.js';

export const CONFIG_FILENAMES = ['covrr.yaml', 'covrr.yml'];
export const SEARCH_PATHS = [
  './covrr.yaml',
  './covrr.yml',
  '.covrr/config.yaml',
];
export const HOME_CONFIG_PATH = path.join(process.env.HOME || '', '.covrr', 'config.yaml');

/**
 * Find the first existing config file from standard search paths.
 * Does NOT check --config override (caller handles that).
 */
export function findConfigSearchPath(): string | null {
  for (const candidate of SEARCH_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  if (fs.existsSync(HOME_CONFIG_PATH)) {
    return HOME_CONFIG_PATH;
  }

  return null;
}

/**
 * Resolve the config file path, including --config override.
 * Throws ConfigError if explicit path does not exist.
 * Throws ConfigNotFoundError if no config found anywhere.
 */
export function resolveConfigPath(explicitPath?: string): string {
  if (explicitPath) {
    if (!fs.existsSync(explicitPath)) {
      throw new ConfigError(`Config file not found: ${explicitPath}`, 'config');
    }
    return explicitPath;
  }

  const found = findConfigSearchPath();
  if (found) {
    return found;
  }

  const allPaths = [...SEARCH_PATHS, HOME_CONFIG_PATH];
  throw new ConfigNotFoundError(allPaths);
}
