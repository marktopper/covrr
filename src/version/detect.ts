/**
 * Version detection for S003
 *
 * Priority order:
 * 1. CLI flag --version
 * 2. Git tag (annotated, semver, highest if multiple)
 * 3. Package files (package.json, pyproject.toml, Cargo.toml)
 * 4. Git commit hash (fallback)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import toml from 'toml';
import type { DetectedVersion } from './types.js';

const SEMVER_REGEX = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

function isSemver(tag: string): boolean {
  return SEMVER_REGEX.test(tag);
}

function parseSemver(tag: string): { major: number; minor: number; patch: number; prerelease: string } | null {
  const match = tag.match(SEMVER_REGEX);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || '',
  };
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;

  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;

  // Prerelease: empty > prerelease (1.0.0 > 1.0.0-alpha)
  if (pa.prerelease && !pb.prerelease) return -1;
  if (!pa.prerelease && pb.prerelease) return 1;
  if (pa.prerelease && pb.prerelease) return pa.prerelease.localeCompare(pb.prerelease);
  return 0;
}

function isGitRepo(): boolean {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getGitTags(): string[] {
  try {
    const output = execSync('git tag --points-at HEAD', { encoding: 'utf-8', stdio: 'pipe' });
    return output.split('\n').map((t) => t.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function detectGitTag(): DetectedVersion | null {
  const tags = getGitTags();
  const semverTags = tags.filter(isSemver);

  if (semverTags.length === 0) return null;

  // Sort by semver descending and pick highest
  semverTags.sort(compareSemver);
  const highest = semverTags[semverTags.length - 1];

  return {
    version: highest.startsWith('v') ? highest : `v${highest}`,
    source: 'git_tag',
    raw: highest,
  };
}

function readPackageJson(dir: string): { version: string } | null {
  try {
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    const content = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    return { version: pkg.version || '' };
  } catch {
    return null;
  }
}

function readPyproject(dir: string): string | null {
  try {
    const pyPath = path.join(dir, 'pyproject.toml');
    if (!fs.existsSync(pyPath)) return null;
    const content = fs.readFileSync(pyPath, 'utf-8');
    const pyproject = toml.parse(content);

    // Try PEP 621 standard (project.version)
    if (pyproject.project?.version) {
      return String(pyproject.project.version);
    }
    // Try Poetry (tool.poetry.version)
    if (pyproject.tool?.poetry?.version) {
      return String(pyproject.tool.poetry.version);
    }
    return null;
  } catch {
    return null;
  }
}

function readCargoToml(dir: string): string | null {
  try {
    const cargoPath = path.join(dir, 'Cargo.toml');
    if (!fs.existsSync(cargoPath)) return null;
    const content = fs.readFileSync(cargoPath, 'utf-8');
    const cargo = toml.parse(content);

    if (cargo.package?.version) {
      return String(cargo.package.version);
    }
    return null;
  } catch {
    return null;
  }
}

function detectPackageVersion(dir: string): DetectedVersion | null {
  const pkg = readPackageJson(dir);
  if (pkg?.version) {
    return { version: pkg.version, source: 'package_json', raw: pkg.version };
  }

  const pyver = readPyproject(dir);
  if (pyver) {
    return { version: pyver, source: 'pyproject', raw: pyver };
  }

  const cargover = readCargoToml(dir);
  if (cargover) {
    return { version: cargover, source: 'cargo', raw: cargover };
  }

  return null;
}

function detectGitHash(): DetectedVersion | null {
  try {
    const hash = execSync('git rev-parse HEAD', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    const short = hash.slice(0, 8);
    return { version: short, source: 'git_hash', raw: hash };
  } catch {
    return null;
  }
}

/**
 * Detect the version for a given directory.
 * @param opts.version - CLI override (--version flag)
 * @param opts.dir - Directory to check (default: cwd)
 */
export function detectVersion(opts: { version?: string; dir?: string } = {}): DetectedVersion {
  const dir = opts.dir || process.cwd();

  // 1. CLI flag
  if (opts.version) {
    return { version: opts.version, source: 'cli', raw: opts.version };
  }

  // 2. Git tag
  if (isGitRepo()) {
    try {
      process.chdir(dir);
    } catch {
      // dir may not exist or not be accessible
    }

    const gitTag = detectGitTag();
    if (gitTag) return gitTag;
  }

  // 3. Package files
  const pkgVersion = detectPackageVersion(dir);
  if (pkgVersion) return pkgVersion;

  // 4. Git hash fallback
  if (isGitRepo()) {
    const gitHash = detectGitHash();
    if (gitHash) return gitHash;
  }

  throw new Error(
    'Cannot determine version. Use --version or ensure a git tag or package file exists.'
  );
}

/**
 * List all semver tags in the repository, sorted from lowest to highest.
 */
export function listSemverTags(): string[] {
  if (!isGitRepo()) return [];

  try {
    const output = execSync('git tag', { encoding: 'utf-8', stdio: 'pipe' });
    const tags = output.split('\n').map((t) => t.trim()).filter(isSemver);
    tags.sort(compareSemver);
    return tags;
  } catch {
    return [];
  }
}

/**
 * Find the baseline version for a given version.
 * Uses the previous semver tag in sorted order.
 */
export function findBaseline(currentVersion: string): string | null {
  const tags = listSemverTags();

  // Remove 'v' prefix for comparison if present
  const stripV = (v: string) => v.startsWith('v') ? v.slice(1) : v;
  const withV = (v: string) => v.startsWith('v') ? v : `v${v}`;

  const current = stripV(currentVersion);
  const idx = tags.findIndex((t) => stripV(withV(t)) === current);

  if (idx <= 0) return null;
  return withV(tags[idx - 1]);
}

/**
 * Sanitize a version string for use as a directory name.
 * Replaces characters not in [a-zA-Z0-9.-] with underscores.
 */
export function sanitizeVersionForDir(version: string): string {
  return version.replace(/[^a-zA-Z0-9.-]/g, '_');
}
