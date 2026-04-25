/**
 * Version-level manifest.json creation.
 *
 * Directory structure:
 *   .covrr/versions/<version>/manifest.json
 *   .covrr/versions/<version>/diff.json  (future)
 */

import fs from 'fs';
import path from 'path';
import { ConfigError } from '../config/loader.js';

export interface VersionManifest {
  version: string;
  created_at: string;
  baseline?: string;
  scripts?: string[];
}

const VERSIONS_DIR = 'versions';

/**
 * Sanitize a version string for use as a filesystem directory name.
 * - v1.2.3+build → v1.2.3_build
 * - v1.2.3-beta.1 → v1.2.3-beta_1
 * - non-semver strings: replace [^a-zA-Z0-9.-] with _
 */
export function sanitizeVersionDir(version: string): string {
  // Handle build metadata: v1.2.3+build → v1.2.3_build
  let sanitized = version.replace(/\+/g, '_');

  // For semver-like strings (v1.2.3, v1.2.3-beta.1), preserve the core major.minor.patch
  // and replace dots in any suffix (prerelease/build metadata) with underscore
  // Non-semver strings: replace all non-alphanumeric except dots and dashes with underscore
  const semverMatch = sanitized.match(/^(v?\d+\.\d+\.\d+)(.*)$/);
  if (semverMatch) {
    const [, core, suffix] = semverMatch;
    const sanitizedSuffix = suffix.replace(/\./g, '_');
    return core + sanitizedSuffix;
  }

  // Non-semver strings: preserve only alphanumeric, dots, and dashes
  sanitized = sanitized.replace(/[^a-zA-Z0-9.-]/g, '_');

  return sanitized;
}

/**
 * Get the path to a version's directory.
 */
export function getVersionDir(version: string, projectRoot: string = process.cwd()): string {
  const baseDir = path.join(projectRoot, '.covrr', VERSIONS_DIR);
  return path.join(baseDir, sanitizeVersionDir(version));
}

/**
 * Ensure the version directory exists.
 */
export function ensureVersionDir(version: string, projectRoot: string = process.cwd()): string {
  const dir = getVersionDir(version, projectRoot);

  if (fs.existsSync(dir)) {
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
      throw new ConfigError(`.covrr/versions/${sanitizeVersionDir(version)} exists as a file — cannot create directory`);
    }
  } else {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
}

/**
 * Write a version-level manifest.json.
 */
export function writeVersionManifest(
  version: string,
  manifest: Omit<VersionManifest, 'version' | 'created_at'>,
  projectRoot: string = process.cwd()
): void {
  const dir = ensureVersionDir(version, projectRoot);
  const manifestPath = path.join(dir, 'manifest.json');

  const full: VersionManifest = {
    version,
    created_at: new Date().toISOString(),
    baseline: manifest.baseline,
    scripts: manifest.scripts,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(full, null, 2), 'utf-8');
}

/**
 * Read a version-level manifest.json.
 */
export function readVersionManifest(
  version: string,
  projectRoot: string = process.cwd()
): VersionManifest | null {
  const manifestPath = path.join(getVersionDir(version, projectRoot), 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content) as VersionManifest;
  } catch {
    return null;
  }
}

/**
 * List all version directories in .covrr/versions/.
 */
export function listVersionDirs(projectRoot: string = process.cwd()): string[] {
  const versionsDir = path.join(projectRoot, '.covrr', VERSIONS_DIR);

  if (!fs.existsSync(versionsDir)) {
    return [];
  }

  return fs.readdirSync(versionsDir).filter((name) => {
    const stat = fs.statSync(path.join(versionsDir, name));
    return stat.isDirectory();
  });
}
