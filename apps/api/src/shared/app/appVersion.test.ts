import { describe, expect, it } from 'vitest';
import { compareVersions, parseVersion } from './appVersion.js';

describe('app versions', () => {
  it('parses dotted versions and ignores suffixes', () => {
    expect(parseVersion('1.4.2')).toEqual([1, 4, 2]);
    expect(parseVersion('2')).toEqual([2, 0, 0]);
    expect(parseVersion('1.2.3-beta.1')).toEqual([1, 2, 3]);
    expect(parseVersion('abc')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
  it('compares numerically, not as text', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.9.9', '1.0.0')).toBeLessThan(0);
    expect(compareVersions('x', '1.0.0')).toBeNaN();
  });
});
