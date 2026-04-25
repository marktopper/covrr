/**
 * Coverage storage - store per-version coverage in .covrr/state/coverage/
 */

import fs from 'fs';
import path from 'path';
import { CoverageReport, VersionManifest, CoverageStorage } from './types.js';

const BASE_DIR = '.covrr/state/coverage';

/**
 * Get the storage base directory path
 */
function getBaseDir(): string {
  return path.resolve(process.cwd(), BASE_DIR);
}

/**
 * Sanitize version string for filesystem safety
 */
function sanitizeVersion(version: string): string {
  return version.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Create a coverage storage instance
 */
export function createCoverageStorage(): CoverageStorage {
  return {
    getVersionDir(version: string): string {
      const sanitized = sanitizeVersion(version);
      return path.join(getBaseDir(), sanitized);
    },

    async saveReport(version: string, scriptName: string, report: CoverageReport): Promise<void> {
      const versionDir = this.getVersionDir(version);

      // Ensure version directory exists
      if (!fs.existsSync(versionDir)) {
        fs.mkdirSync(versionDir, { recursive: true });
      }

      // Save the report
      const reportPath = path.join(versionDir, `${scriptName}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

      // Update manifest
      updateManifest(versionDir, version, scriptName, report);
    },

    loadReport(version: string, scriptName: string): CoverageReport | null {
      const reportPath = path.join(this.getVersionDir(version), `${scriptName}.json`);
      if (!fs.existsSync(reportPath)) {
        return null;
      }

      try {
        const content = fs.readFileSync(reportPath, 'utf-8');
        return JSON.parse(content) as CoverageReport;
      } catch {
        return null;
      }
    },

    loadManifest(version: string): VersionManifest | null {
      const manifestPath = path.join(this.getVersionDir(version), 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        return null;
      }

      try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        return JSON.parse(content) as VersionManifest;
      } catch {
        return null;
      }
    },

    listVersions(): string[] {
      const baseDir = getBaseDir();
      if (!fs.existsSync(baseDir)) {
        return [];
      }

      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    },

    getLatestVersion(): string | null {
      const versions = this.listVersions();
      if (versions.length === 0) {
        return null;
      }

      // Sort by captured_at in manifest, descending
      const versionsWithDate: Array<{ version: string; captured_at: string }> = [];
      for (const v of versions) {
        const manifest = this.loadManifest(v);
        if (manifest) {
          versionsWithDate.push({ version: v, captured_at: manifest.captured_at });
        }
      }

      if (versionsWithDate.length === 0) {
        return versions[0];
      }

      versionsWithDate.sort((a, b) => b.captured_at.localeCompare(a.captured_at));
      return versionsWithDate[0].version;
    },
  };
}

/**
 * Update manifest for a version directory
 */
function updateManifest(
  versionDir: string,
  version: string,
  scriptName: string,
  report: CoverageReport
): void {
  const manifestPath = path.join(versionDir, 'manifest.json');
  let manifest: VersionManifest;

  // Load existing manifest or create new
  if (fs.existsSync(manifestPath)) {
    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(content) as VersionManifest;
    } catch {
      manifest = createInitialManifest(version);
    }
  } else {
    manifest = createInitialManifest(version);
  }

  // Add script if not already present
  if (!manifest.scripts.includes(scriptName)) {
    manifest.scripts.push(scriptName);
  }

  // Update totals (recalculate from all scripts)
  recalculateTotals(versionDir, manifest);

  // Save manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function createInitialManifest(version: string): VersionManifest {
  return {
    version,
    captured_at: new Date().toISOString(),
    scripts: [],
    total_lines: 0,
    total_lines_covered: 0,
    overall_percent: 0,
  };
}

function recalculateTotals(versionDir: string, manifest: VersionManifest): void {
  let totalLines = 0;
  let totalLinesCovered = 0;

  for (const scriptName of manifest.scripts) {
    const reportPath = path.join(versionDir, `${scriptName}.json`);
    if (fs.existsSync(reportPath)) {
      try {
        const content = fs.readFileSync(reportPath, 'utf-8');
        const report = JSON.parse(content) as CoverageReport;
        totalLines += report.summary.lines_total;
        totalLinesCovered += report.summary.lines_covered;
      } catch {
        // Skip corrupted report
      }
    }
  }

  manifest.total_lines = totalLines;
  manifest.total_lines_covered = totalLinesCovered;
  manifest.overall_percent = totalLines > 0 ? (totalLinesCovered / totalLines) * 100 : 0;
}

/**
 * Get current version using git or timestamp fallback
 */
export function getVersion(): string {
  // Try git first
  try {
    const { execSync } = require('child_process');
    const gitVersion = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    return gitVersion.slice(0, 8);
  } catch {
    // Fall back to timestamp
    return `ts-${Date.now()}`;
  }
}

/**
 * Ensure coverage directory exists
 */
export function ensureCoverageDir(): void {
  const baseDir = getBaseDir();
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
}