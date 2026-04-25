/**
 * Version data persistence for S003
 *
 * Stores version metadata in .covrr/versions/<version>/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { VersionManifest, VersionCompareResult } from './types.js';
import { sanitizeVersionForDir } from './detect.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVRR_DIR = '.covrr';
const VERSIONS_DIR = path.join(COVRR_DIR, 'versions');

function ensureCovrrDir(): void {
  if (!fs.existsSync(COVRR_DIR)) {
    fs.mkdirSync(COVRR_DIR, { recursive: true });
  }
  if (!fs.existsSync(VERSIONS_DIR)) {
    fs.mkdirSync(VERSIONS_DIR, { recursive: true });
  }
}

function getVersionDir(version: string): string {
  const sanitized = sanitizeVersionForDir(version);
  return path.join(VERSIONS_DIR, sanitized);
}

/**
 * Save version manifest (metadata about a detected version).
 */
export function saveVersionManifest(
  version: string,
  manifest: VersionManifest
): void {
  ensureCovrrDir();
  const dir = getVersionDir(version);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );
}

/**
 * Load version manifest for a given version.
 */
export function loadVersionManifest(version: string): VersionManifest | null {
  const manifestPath = path.join(getVersionDir(version), 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Save version diff for a given version pair.
 */
export function saveVersionDiff(
  fromVersion: string,
  toVersion: string,
  diff: VersionCompareResult
): void {
  ensureCovrrDir();
  const toDir = getVersionDir(toVersion);
  if (!fs.existsSync(toDir)) {
    fs.mkdirSync(toDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(toDir, 'diff.json'),
    JSON.stringify(diff, null, 2),
    'utf-8'
  );
}

/**
 * Load version diff for a given version pair.
 */
export function loadVersionDiff(
  fromVersion: string,
  toVersion: string
): VersionCompareResult | null {
  const diffPath = path.join(getVersionDir(toVersion), 'diff.json');
  if (!fs.existsSync(diffPath)) return null;
  try {
    const loaded = JSON.parse(fs.readFileSync(diffPath, 'utf-8'));
    // Verify the from version matches
    if (loaded.from !== fromVersion) return null;
    return loaded;
  } catch {
    return null;
  }
}

/**
 * List all known versions in .covrr/versions/.
 */
export function listKnownVersions(): string[] {
  ensureCovrrDir();
  if (!fs.existsSync(VERSIONS_DIR)) return [];

  return fs
    .readdirSync(VERSIONS_DIR)
    .filter((entry) => {
      const stat = fs.statSync(path.join(VERSIONS_DIR, entry));
      return stat.isDirectory();
    })
    .sort();
}

/**
 * Get the latest version directory (by modification time).
 */
export function getLatestVersionDir(): string | null {
  ensureCovrrDir();
  if (!fs.existsSync(VERSIONS_DIR)) return null;

  const entries = fs
    .readdirSync(VERSIONS_DIR)
    .filter((entry) => {
      const stat = fs.statSync(path.join(VERSIONS_DIR, entry));
      return stat.isDirectory();
    })
    .map((entry) => ({
      name: entry,
      mtime: fs.statSync(path.join(VERSIONS_DIR, entry)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return entries.length > 0 ? entries[0].name : null;
}
