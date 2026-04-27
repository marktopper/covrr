/**
 * Unit tests for S003 version detection
 */

const SEMVER_REGEX = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

function isSemver(tag: string): boolean {
  return SEMVER_REGEX.test(tag);
}

function parseSemver(tag: string): { major: number; minor: number; patch: number; prerelease: string } | null {
  const match = tag.match(SEMVER_REGEX);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || '',
  };
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  if (pa.prerelease && !pb.prerelease) return -1;
  if (!pa.prerelease && pb.prerelease) return 1;
  if (pa.prerelease && pb.prerelease) return pa.prerelease.localeCompare(pb.prerelease);
  return 0;
}

function sanitizeVersionForDir(version: string): string {
  return version.replace(/[^a-zA-Z0-9.-]/g, '_');
}

describe('Semver parsing', () => {
  it('recognises valid semver tags', () => {
    expect(isSemver('1.2.3')).toBe(true);
    expect(isSemver('v1.2.3')).toBe(true);
    expect(isSemver('v1.2.3-beta.1')).toBe(true);
    expect(isSemver('1.2.3+build123')).toBe(true);
    expect(isSemver('v1.2.3-alpha.1+build')).toBe(true);
  });

  it('rejects non-semver strings', () => {
    expect(isSemver('latest')).toBe(false);
    expect(isSemver('main')).toBe(false);
    expect(isSemver('canary')).toBe(false);
    expect(isSemver('1.2')).toBe(false);
    expect(isSemver('v1')).toBe(false);
  });

  it('parses semver components correctly', () => {
    const parsed = parseSemver('v1.2.3-beta.1+build');
    expect(parsed).toEqual({ major: 1, minor: 2, patch: 3, prerelease: 'beta.1' });
  });

  it('handles versions without prerelease', () => {
    const parsed = parseSemver('1.2.3');
    expect(parsed).toEqual({ major: 1, minor: 2, patch: 3, prerelease: '' });
  });
});

describe('Semver sorting', () => {
  it('sorts versions in ascending order', () => {
    const tags = ['v1.2.3', 'v1.2.2', 'v2.0.0', 'v1.3.0', 'v1.2.3-alpha'];
    const sorted = [...tags].sort(compareSemver);
    expect(sorted).toEqual([
      'v1.2.2',
      'v1.2.3-alpha',
      'v1.2.3',
      'v1.3.0',
      'v2.0.0',
    ]);
  });

  it('sorts prerelease before stable', () => {
    const tags = ['1.0.0', '1.0.0-alpha', '1.0.0-beta'];
    const sorted = [...tags].sort(compareSemver);
    expect(sorted).toEqual(['1.0.0-alpha', '1.0.0-beta', '1.0.0']);
  });

  it('picks highest version', () => {
    const tags = ['v0.9.0', 'v1.0.0', 'v0.9.5'];
    const sorted = [...tags].sort(compareSemver);
    expect(sorted[sorted.length - 1]).toBe('v1.0.0');
  });
});

describe('Version sanitization for directory names', () => {
  it('keeps valid version strings unchanged', () => {
    expect(sanitizeVersionForDir('v1.2.3')).toBe('v1.2.3');
    expect(sanitizeVersionForDir('1.2.3-beta_1')).toBe('1.2.3-beta_1');
    expect(sanitizeVersionForDir('v1.2.3+build')).toBe('v1.2.3_build');
  });

  it('replaces invalid characters with underscores', () => {
    expect(sanitizeVersionForDir('v1.2.3 beta')).toBe('v1.2.3_beta');
    expect(sanitizeVersionForDir('v1.2.3+build')).toBe('v1.2.3_build');
    expect(sanitizeVersionForDir('version/1.2.3')).toBe('version_1.2.3');
  });
});
