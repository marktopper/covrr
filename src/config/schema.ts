/**
 * Covrr configuration schema and types
 */

export interface ScriptDefinition {
  pattern: string;
  timeout_ms?: number;
  retry?: number;
  env?: Record<string, string>;
}

export interface ScriptsConfig {
  [name: string]: ScriptDefinition;
}

export interface DefaultsConfig {
  timeout_ms?: number;
  retry?: number;
  workers?: number;
  browser?: 'chromium' | 'firefox' | 'webkit';
}

export interface CoverageThresholds {
  lines_percent?: number;
  branches_percent?: number;
  functions_percent?: number;
}

export interface CoverageConfig {
  tool?: string;
  output_path?: string;
  thresholds?: CoverageThresholds;
  strict?: boolean;
}

export interface VersionConfig {
  baseline?: string;
  detect_from?: 'git' | 'package';
}

export interface ReportOutput {
  type: 'file' | 'artifact' | 'github_pr_comment' | 'webhook';
  path?: string;
  name?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
}

export interface ReportConfig {
  outputs?: ReportOutput[];
}

export interface CIConfig {
  github?: {
    token?: string;
    annotation?: boolean;
  };
  gitlab?: {
    token?: string;
    annotation?: boolean;
  };
}

export interface CovrrConfig {
  scripts?: ScriptsConfig;
  defaults?: DefaultsConfig;
  coverage?: CoverageConfig;
  version?: VersionConfig;
  report?: ReportConfig;
  ci?: CIConfig;
}

export const DEFAULT_TIMEOUT_MS = 60000;
export const DEFAULT_RETRY = 1;
export const DEFAULT_WORKERS = 4;
export const DEFAULT_BROWSER = 'chromium' as const;
export const SUPPORTED_BROWSERS = ['chromium', 'firefox', 'webkit'] as const;