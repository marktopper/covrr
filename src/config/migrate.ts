/**
 * Config format migration with backup.
 *
 * Format version marker: covrr_format_version in YAML.
 * Current format version: "1"
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { ConfigError } from './loader.js';

export const CURRENT_FORMAT_VERSION = '1';
export const FORMAT_VERSION_KEY = 'covrr_format_version';

/**
 * Read the format version from a config file's raw content.
 */
export function readFormatVersion(content: string): string | null {
  try {
    const parsed = yaml.load(content) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && FORMAT_VERSION_KEY in parsed) {
      return String(parsed[FORMAT_VERSION_KEY]);
    }
  } catch {
    // Ignore parse errors here — they'll surface elsewhere
  }
  return null;
}

/**
 * Migrate config content to the current format version.
 * Returns the migrated content string, or the original if no migration needed.
 */
export function migrateConfig(content: string): { content: string; migrated: boolean; fromVersion?: string } {
  const version = readFormatVersion(content);

  if (version === CURRENT_FORMAT_VERSION) {
    return { content, migrated: false };
  }

  let migrated = content;

  // Future migrations go here:
  // if (version === '1') { migrated = migrateFromV1(content); }
  // if (version === '2') { migrated = migrateFromV2(content); }

  // For now, just add the version marker if missing
  if (!version) {
    const parsed = yaml.load(migrated) as Record<string, unknown>;
    const updated = { ...parsed, [FORMAT_VERSION_KEY]: CURRENT_FORMAT_VERSION };
    migrated = yaml.dump(updated);
  }

  return {
    content: migrated,
    migrated: true,
    fromVersion: version || undefined,
  };
}

/**
 * Backup the current config file before migration.
 * Saves as config.yaml.backup.<timestamp>
 */
export function backupConfig(configPath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${configPath}.backup.${timestamp}`;
  const content = fs.readFileSync(configPath, 'utf-8');
  fs.writeFileSync(backupPath, content, 'utf-8');
  return backupPath;
}

/**
 * Attempt auto-migration with backup on failure.
 * Throws ConfigError if migration fails.
 */
export function migrateConfigWithBackup(configPath: string): { migrated: boolean; backupPath?: string } {
  const content = fs.readFileSync(configPath, 'utf-8').trim();
  const result = migrateConfig(content);

  if (!result.migrated) {
    return { migrated: false };
  }

  // Backup original before writing
  const backupPath = backupConfig(configPath);

  // Write migrated version
  fs.writeFileSync(configPath, result.content, 'utf-8');

  return { migrated: true, backupPath };
}
