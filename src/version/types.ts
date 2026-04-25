/**
 * Types for S003: Version Change Detection
 */

export interface DetectedVersion {
  version: string;
  source: 'cli' | 'git_tag' | 'package_json' | 'pyproject' | 'cargo' | 'git_hash';
  raw: string;
}

export interface FileChange {
  path: string;
  status: 'added' | 'deleted' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface PackageChange {
  name: string;
  from: string;
  to: string;
}

export interface VersionCompareResult {
  from: string;
  to: string;
  compared_at: string;
  source: 'git_tag' | 'git_diff' | 'package_file';
  files_changed: FileChange[];
  commits_between: CommitInfo[];
  packages_changed: PackageChange[];
}

export interface VersionManifest {
  version: string;
  detected_at: string;
  source: DetectedVersion['source'];
  baseline: string | null;
}
