import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { isUpgradeExempt, versionGate } from './versionGate.middleware.js';

const cfg = async () => ({ minVersion: '1.2.0', storeUrl: 'https://s', apkUrl: null });

function run(
  headers: Record<string, string>,
  method = 'POST',
  path = '/projects',
  getConfig: typeof cfg = cfg,
) {
  return new Promise<unknown>((resolve) => {
    versionGate(getConfig)({ headers, method, path } as unknown as Request, {} as Response, (err) =>
      resolve(err),
    );
  });
}

describe('versionGate', () => {
  it('passes clients that send no version header (web)', async () => {
    expect(await run({})).toBeUndefined();
  });
  it('passes a current or newer app', async () => {
    expect(await run({ 'x-app-version': '1.2.0', 'x-platform': 'android' })).toBeUndefined();
    expect(await run({ 'x-app-version': '1.10.0', 'x-platform': 'android' })).toBeUndefined();
  });
  it('answers 426 UPGRADE_REQUIRED below the minimum', async () => {
    const err = await run({ 'x-app-version': '1.1.9', 'x-platform': 'android' });
    expect(err).toMatchObject({
      statusCode: 426,
      code: 'UPGRADE_REQUIRED',
      publicDetails: { minVersion: '1.2.0', storeUrl: 'https://s' },
    });
  });
  it('lets allow-listed routes through even when outdated', async () => {
    const h = { 'x-app-version': '0.1.0', 'x-platform': 'android' };
    expect(await run(h, 'GET', '/app/config')).toBeUndefined();
    expect(await run(h, 'POST', '/identity/auth/login')).toBeUndefined();
    expect(await run(h, 'GET', '/attendance/me')).toBeUndefined();
    expect(await run(h, 'POST', '/attendance/check-in')).toMatchObject({ statusCode: 426 });
  });
  it('never blocks when the platform is unknown, the version is unreadable or config fails', async () => {
    expect(await run({ 'x-app-version': '0.0.1' })).toBeUndefined();
    expect(await run({ 'x-app-version': 'garbage', 'x-platform': 'android' })).toBeUndefined();
    const broken = async () => {
      throw new Error('db down');
    };
    expect(
      await run({ 'x-app-version': '0.0.1', 'x-platform': 'ios' }, 'POST', '/x', broken),
    ).toBeUndefined();
  });
  it('exempts preflight', () => {
    expect(isUpgradeExempt('OPTIONS', '/projects')).toBe(true);
  });
});
