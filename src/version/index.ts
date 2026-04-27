/**
 * Covrr Version Change Detection Module (S003)
 */

export * from './types.js';
export { detectVersion, listSemverTags, findBaseline, sanitizeVersionForDir } from './detect.js';
export { compareVersions, compareWithBaseline } from './compare.js';
export {
  saveVersionManifest,
  loadVersionManifest,
  saveVersionDiff,
  loadVersionDiff,
  listKnownVersions,
  getLatestVersionDir,
} from './storage.js';
