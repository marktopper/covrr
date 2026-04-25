/**
 * Tests for script discovery
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { discoverScripts } from '../discovery.js';

const testDir = path.join(os.tmpdir(), 'covrr-discovery-test-' + Date.now());

beforeAll(() => {
  fs.mkdirSync(path.join(testDir, 'tests/smoke'), { recursive: true });
  fs.mkdirSync(path.join(testDir, 'tests/e2e'), { recursive: true });
  fs.writeFileSync(path.join(testDir, 'tests/smoke/smoke.spec.ts'), '// smoke');
  fs.writeFileSync(path.join(testDir, 'tests/smoke/login.spec.ts'), '// login');
  fs.writeFileSync(path.join(testDir, 'tests/e2e/checkout.spec.ts'), '// checkout');
});

afterAll(() => {
  try { fs.rmSync(testDir, { recursive: true }); } catch {}
});

describe('discoverScripts', () => {
  it('resolves glob patterns to file arrays', async () => {
    const scripts = {
      smoke: { pattern: 'tests/smoke/**/*.spec.ts' },
    };
    const discovered = await discoverScripts(scripts, testDir);
    expect(discovered.smoke).toHaveLength(2);
    expect(discovered.smoke).toContain(path.join(testDir, 'tests/smoke/smoke.spec.ts'));
    expect(discovered.smoke).toContain(path.join(testDir, 'tests/smoke/login.spec.ts'));
  });

  it('throws when pattern matches no files', async () => {
    const scripts = {
      nonexistent: { pattern: 'tests/nonexistent/**/*.spec.ts' },
    };
    await expect(discoverScripts(scripts, testDir)).rejects.toThrow();
  });

  it('sorts files for deterministic order', async () => {
    const scripts = {
      smoke: { pattern: 'tests/smoke/**/*.spec.ts' },
    };
    const discovered = await discoverScripts(scripts, testDir);
    expect(discovered.smoke).toEqual([...discovered.smoke].sort());
  });
});