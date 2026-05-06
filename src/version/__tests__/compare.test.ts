/**
 * Unit tests for S003 version comparison
 * Tests compareVersions public API without requiring execSync mocking.
 */

import { describe, it, expect } from '@jest/globals';
import { compareVersions, compareWithBaseline } from '../compare.js';

describe('compareVersions', () => {
  it('returns a result object with correct structure', () => {
    // Use refs that won't resolve to get empty but valid result
    const result = compareVersions('nonexistent-ref', 'another-nonexistent');

    expect(result).toHaveProperty('from', 'nonexistent-ref');
    expect(result).toHaveProperty('to', 'another-nonexistent');
    expect(result).toHaveProperty('compared_at');
    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('files_changed');
    expect(result).toHaveProperty('commits_between');
    expect(result).toHaveProperty('packages_changed');
    expect(Array.isArray(result.files_changed)).toBe(true);
    expect(Array.isArray(result.commits_between)).toBe(true);
    expect(Array.isArray(result.packages_changed)).toBe(true);
  });

  it('sets source to git_diff by default', () => {
    const result = compareVersions('ref1', 'ref2');
    expect(result.source).toBe('git_diff');
  });

  it('sets source to git_tag when isTagRef option is true', () => {
    const result = compareVersions('ref1', 'ref2', { isTagRef: true });
    expect(result.source).toBe('git_tag');
  });

  it('compared_at is a valid ISO timestamp', () => {
    const result = compareVersions('ref1', 'ref2');
    const date = new Date(result.compared_at);
    expect(date.toISOString()).toBe(result.compared_at);
  });
});

describe('compareWithBaseline', () => {
  it('calls compareVersions with isTagRef false', () => {
    const result = compareWithBaseline('baseline', 'head');

    expect(result.source).toBe('git_diff');
    expect(result.from).toBe('baseline');
    expect(result.to).toBe('head');
  });
});
