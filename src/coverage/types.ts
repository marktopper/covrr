/**
 * Coverage tracking types for Covrr
 */

export interface CoverageData {
  lines_total: number;
  lines_covered: number;
  lines_percent: number;
  branches_total: number;
  branches_covered: number;
  branches_percent: number;
  functions_total?: number;
  functions_covered?: number;
  functions_percent?: number;
}

export interface CoverageFile {
  path: string;
  lines_total: number;
  lines_covered: number;
  lines_percent: number;
}

export interface CoverageReport {
  version: string;
  script_name: string;
  generated_at: string;
  tool: string;
  summary: CoverageData;
  files?: CoverageFile[];
}

export interface CoverageThresholds {
  lines_percent?: number;
  branches_percent?: number;
  functions_percent?: number;
}

export interface CoverageThresholdResult {
  passed: boolean;
  lines_percent?: number;
  lines_threshold?: number;
  branches_percent?: number;
  branches_threshold?: number;
  functions_percent?: number;
  functions_threshold?: number;
}

export interface CoverageDiff {
  version_from: string;
  version_to: string;
  lines_percent_delta: number;
  branches_percent_delta: number;
  files: CoverageFileDiff[];
  degraded_files: string[];
}

export interface CoverageFileDiff {
  path: string;
  lines_percent_from: number;
  lines_percent_to: number;
  delta: number;
}

export interface VersionManifest {
  version: string;
  captured_at: string;
  scripts: string[];
  total_lines: number;
  total_lines_covered: number;
  overall_percent: number;
}

export interface CoverageStorage {
  getVersionDir(version: string): string;
  saveReport(version: string, scriptName: string, report: CoverageReport): Promise<void>;
  loadReport(version: string, scriptName: string): CoverageReport | null;
  loadManifest(version: string): VersionManifest | null;
  listVersions(): string[];
  getLatestVersion(): string | null;
}