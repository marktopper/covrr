/**
 * Playwright script discovery
 * Resolves glob patterns to file paths relative to config directory
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { ConfigError } from '../config/loader.js';

export class DiscoveryError extends ConfigError {
  constructor(message: string, public scriptName?: string) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

/**
 * Discover files matching a script's glob pattern
 */
export async function discoverScripts(
  scripts: Record<string, { pattern: string }>,
  configDir: string
): Promise<Record<string, string[]>> {
  const discovered: Record<string, string[]> = {};

  for (const [name, def] of Object.entries(scripts)) {
    const resolvedPattern = path.resolve(configDir, def.pattern);
    const files = await glob(resolvedPattern);

    if (files.length === 0) {
      throw new DiscoveryError(
        `Pattern '${def.pattern}' matched 0 files for script '${name}'`,
        name
      );
    }

    // Sort for deterministic order
    discovered[name] = files.sort();
  }

  return discovered;
}

/**
 * Check if Playwright is installed and accessible
 */
export function checkPlaywright(): { installed: boolean; version?: string; error?: string } {
  try {
    const result = require('child_process').execSync('npx playwright --version', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const version = result.trim();
    return { installed: true, version };
  } catch (e) {
    return {
      installed: false,
      error: 'Playwright not found. Install with: npm install -D @playwright/test && npx playwright install',
    };
  }
}

/**
 * Resolve env vars in a config object (for runtime env injection)
 */
export function resolveEnvVarsInObject(obj: Record<string, unknown>): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.startsWith('env:')) {
      const envKey = value.slice(4);
      resolved[key] = process.env[envKey] ?? value;
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}