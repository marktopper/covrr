/**
 * Validation report types for Covrr
 */

export type OverallStatus = 'passed' | 'failed' | 'warning' | 'error';
export type ScriptStatus = 'passed' | 'failed' | 'skipped' | 'timed_out' | 'error';
export type OutputFormat = 'text' | 'json' | 'markdown' | 'html' | 'github-annotation';

export interface ScriptResult {
  name: string;
  status: ScriptStatus;
  duration_ms: number;
  tests_passed: number;
  tests_failed: number;
  exit_code: number;
}

export interface CoverageSummary {
  overall_percent: number;
  threshold_percent: number | null;
  passed_threshold: boolean;
  by_script: {
    name: string;
    lines_percent: number;
    branches_percent: number;
  }[];
}

export interface VersionDiff {
  files_changed: number;
  files_added: number;
  files_modified: number;
  files_deleted: number;
  commits_between: number;
  packages_bumped: string[];
}

export interface ValidationReport {
  id: string;
  generated_at: string;
  version: string;
  baseline_version: string | null;
  tool_version: string;
  overall_status: OverallStatus;
  overall_message: string;
  scripts: ScriptResult[];
  coverage?: CoverageSummary;
  version_diff?: VersionDiff;
  triggers: string[];
}

export interface ReportDeliveryResult {
  success: boolean;
  destination: string;
  error?: string;
}

export interface DeliveryTargets {
  file?: string;
  outputs?: Array<{
    type: 'file' | 'artifact' | 'github_pr_comment' | 'webhook';
    path?: string;
    name?: string;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  }>;
}