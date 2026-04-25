/**
 * Playwright script discovery and result types
 */

export type ScriptStatus = 'passed' | 'failed' | 'timed_out' | 'error' | 'skipped';

export interface ScriptResult {
  name: string;
  status: ScriptStatus;
  duration_ms: number;
  tests_total: number;
  tests_passed: number;
  tests_failed: number;
  coverage?: CoverageData;
  errors: string[];
}

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

export interface CoverageReport {
  version: string;
  script_name: string;
  generated_at: string;
  tool: string;
  summary: CoverageData;
  files?: Array<{
    path: string;
    lines_total: number;
    lines_covered: number;
    lines_percent: number;
  }>;
}