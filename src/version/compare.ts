/**
 * Version comparison for S003
 *
 * Generates a diff between two versions:
 * - Git-based if both are git refs
 * - Package-file-based fallback otherwise
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import toml from 'toml';
import type { FileChange, CommitInfo, PackageChange, VersionCompareResult, DetectedVersion } from './types.js';

function isGitRepo(): boolean {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function isGitRef(ref: string): boolean {
  try {
    execSync(`git rev-parse ${ref}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getFileChanges(from: string, to: string): FileChange[] {
  try {
    const output = execSync(
      `git diff ${from}..${to} --name-status`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    return output.split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [statusCode, ...pathParts] = line.split('\t');
        const filePath = pathParts.join('\t');
        const statusMap: Record<string, FileChange['status']> = {
          A: 'added',
          D: 'deleted',
          M: 'modified',
          R: 'renamed',
        };

        // Get additions/deletions for the file
        let additions = 0;
        let deletions = 0;
        try {
          const diffOutput = execSync(
            `git diff ${from}..${to} -- "${filePath}"`,
            { encoding: 'utf-8', stdio: 'pipe' }
          );
          const addMatch = diffOutput.match(/^(\+{3})/m);
          const delMatch = diffOutput.match(/^(-{3})/m);
          // Rough estimate from diff stats
          const lines = diffOutput.split('\n');
          additions = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;
          deletions = lines.filter((l) => l.startsWith('-') && !l.startsWith('---')).length;
        } catch {
          // Ignore diff errors for individual files
        }

        return {
          path: filePath,
          status: statusMap[statusCode] || 'modified',
          additions,
          deletions,
        };
      });
  } catch {
    return [];
  }
}

function getCommitsBetween(from: string, to: string): CommitInfo[] {
  try {
    const output = execSync(
      `git log ${from}..${to} --format="%H|%s|%ae|%ad" --date=short`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    return output.split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [hash, message, author, date] = line.split('|');
        return { hash, message, author, date };
      });
  } catch {
    return [];
  }
}

function getPackageChanges(fromVersion: string, toVersion: string): PackageChange[] {
  // Try to diff package files between two git refs if they're git refs
  if (!isGitRepo()) return [];
  if (!isGitRef(fromVersion) || !isGitRef(toVersion)) return [];

  const changes: PackageChange[] = [];

  for (const pkgFile of ['package.json', 'pyproject.toml', 'Cargo.toml']) {
    try {
      const oldContent = execSync(`git show ${fromVersion}:${pkgFile}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      const newContent = execSync(`git show ${toVersion}:${pkgFile}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      if (oldContent === newContent) continue;

      const oldPkgs = parseDependencies(oldContent, pkgFile);
      const newPkgs = parseDependencies(newContent, pkgFile);

      for (const [name, newVer] of Object.entries(newPkgs)) {
        const oldVer = oldPkgs[name];
        if (oldVer && oldVer !== newVer) {
          changes.push({ name, from: oldVer, to: newVer });
        }
      }
    } catch {
      // File didn't exist in one or both refs
    }
  }

  return changes;
}

function parseDependencies(content: string, file: string): Record<string, string> {
  try {
    if (file === 'package.json') {
      const pkg = JSON.parse(content);
      return { ...pkg.dependencies, ...pkg.devDependencies };
    }

    if (file === 'pyproject.toml') {
      const pyproject = toml.parse(content);
      const deps: Record<string, string> = {};

      if (pyproject.project?.dependencies) {
        for (const dep of pyproject.project.dependencies) {
          const [name, version] = parsePyDep(String(dep));
          if (name) deps[name] = version;
        }
      }

      if (pyproject.project?.['optional-dependencies']) {
        for (const group of Object.values(pyproject.project['optional-dependencies'])) {
          for (const dep of group as string[]) {
            const [name, version] = parsePyDep(String(dep));
            if (name) deps[name] = version;
          }
        }
      }

      return deps;
    }

    if (file === 'Cargo.toml') {
      const cargo = toml.parse(content);
      const deps: Record<string, string> = {};

      if (cargo.dependencies) {
        for (const [name, val] of Object.entries(cargo.dependencies)) {
          deps[name] = typeof val === 'string' ? val : (val as { version?: string }).version || '*';
        }
      }

      return deps;
    }
  } catch {
    // Parse errors — ignore
  }

  return {};
}

function parsePyDep(dep: string): [string, string] {
  // Handle formats: "package>=1.0", "package[extra]>=1.0", "package"
  const match = dep.match(/^([a-zA-Z0-9_-]+)(?:[>=<![,;].*)?$/);
  if (!match) return ['', ''];

  const name = match[1];
  const versionMatch = dep.match(/[>=<![]([\d.]+)/);
  const version = versionMatch ? versionMatch[1] : '*';
  return [name, version];
}

/**
 * Compare two versions and return a structured diff.
 */
export function compareVersions(
  from: string,
  to: string,
  options: { isTagRef?: boolean } = {}
): VersionCompareResult {
  const source: VersionCompareResult['source'] = options.isTagRef ? 'git_tag' : 'git_diff';

  const filesChanged = getFileChanges(from, to);
  const commitsBetween = getCommitsBetween(from, to);
  const packagesChanged = getPackageChanges(from, to);

  return {
    from,
    to,
    compared_at: new Date().toISOString(),
    source,
    files_changed: filesChanged,
    commits_between: commitsBetween,
    packages_changed: packagesChanged,
  };
}

/**
 * Compare using a baseline commit (when version is from package file, not git tag).
 * Finds the commit that introduced the package file change and uses that as baseline.
 */
export function compareWithBaseline(
  baselineRef: string,
  headRef: string
): VersionCompareResult {
  return compareVersions(baselineRef, headRef, { isTagRef: false });
}
