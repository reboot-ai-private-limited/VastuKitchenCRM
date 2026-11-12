import { describe, expect, it } from 'vitest';
import { GetAppConfigUseCase, type AppConfigSource } from './getAppConfig.usecase.js';

const source: AppConfigSource = {
  versions: async (p) =>
    p === 'android' ? { min: '1.2.0', recommended: '1.3.0' } : { min: '0.0.0', recommended: '0.0.0' },
  maintenance: async () => ({ active: false, message: 'back soon' }),
  uploadMaxBytes: async () => 10 * 1024 * 1024,
  links: (p) =>
    p === 'android'
      ? { storeUrl: 'https://play.google.com/x', apkUrl: 'https://x/app.apk' }
      : { storeUrl: null, apkUrl: null },
  polling: { unreadSec: 60, chatSec: 15 },
};

describe('GetAppConfigUseCase', () => {
  it('returns the per-platform config', async () => {
    const uc = new GetAppConfigUseCase(source);
    expect(await uc.execute('android')).toEqual({
      platform: 'android',
      minVersion: '1.2.0',
      recommendedVersion: '1.3.0',
      storeUrl: 'https://play.google.com/x',
      apkUrl: 'https://x/app.apk',
      maintenance: { active: false, message: 'back soon' },
      polling: { unreadSec: 60, chatSec: 15 },
      uploadMaxBytes: 10485760,
    });
    expect(await uc.execute('ios')).toMatchObject({ minVersion: '0.0.0', storeUrl: null, apkUrl: null });
  });
});
