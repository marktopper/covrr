/**
 * Coverage collection from files and stdout
 */

import fs from 'fs';
import path from 'path';
import { CoverageReport, CoverageData } from './types.js';

const COVERAGE_STDOUT_REGEX = /^COVERAGE:(.+)$/;

export interface CollectorOptions {
  tool?: string;
  output_path?: string;
}

/**
 * Collect coverage from a JSON file
 */
export function collectFromFile(outputPath: string): CoverageReport | null {
  if (!fs.existsSync(outputPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(outputPath, 'utf-8');
    return parseCoverageJson(content);
  } catch (e) {
    throw new CoverageParseError(`Failed to read coverage file: ${(e as Error).message}`);
  }
}

/**
 * Parse coverage from stdout lines
 */
export function collectFromStdout(stdout: string): CoverageReport | null {
  const lines = stdout.split('\n');
  for (const line of lines) {
    const match = line.match(COVERAGE_STDOUT_REGEX);
    if (match) {
      try {
        const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
        return parseCoverageJson(decoded);
      } catch {
        // Continue searching for valid line
      }
    }
  }
  return null;
}

/**
 * Parse JSON into CoverageReport with validation
 */
export function parseCoverageJson(content: string): CoverageReport {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (e) {
    throw new CoverageParseError(`Invalid JSON: ${(e as Error).message}`);
  }

  if (!isCoverageReport(data)) {
    throw new CoverageParseError('Coverage data does not match expected schema');
  }

  return data;
}

export class CoverageParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoverageParseError';
  }
}

/**
 * Validate coverage report structure
 */
function isCoverageReport(data: unknown): data is CoverageReport {
  if (typeof data !== 'object' || data === null) return false;

  const report = data as Record<string, unknown>;

  if (typeof report.version !== 'string') return false;
  if (typeof report.script_name !== 'string') return false;
  if (typeof report.generated_at !== 'string') return false;
  if (typeof report.tool !== 'string') return false;
  if (typeof report.summary !== 'object') return false;

  const summary = report.summary as Record<string, unknown>;
  if (typeof summary.lines_total !== 'number') return false;
  if (typeof summary.lines_covered !== 'number') return false;
  if (typeof summary.lines_percent !== 'number') return false;
  if (typeof summary.branches_total !== 'number') return false;
  if (typeof summary.branches_covered !== 'number') return false;
  if (typeof summary.branches_percent !== 'number') return false;

  return true;
}

/**
 * Extract coverage summary from report for ScriptResult
 */
export function extractCoverageData(report: CoverageReport): CoverageData {
  return report.summary;
}