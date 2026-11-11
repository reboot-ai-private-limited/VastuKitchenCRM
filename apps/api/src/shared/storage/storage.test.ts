import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CloudinaryStorage, UnconfiguredStorage, signParams } from './cloudinaryStorage.adapter.js';
import { isInFolder, projectFolder } from './folders.js';

const storage = new CloudinaryStorage({
  cloudName: 'demo',
  apiKey: 'key123',
  apiSecret: 'shh',
  rootFolder: 'vastu-dev',
});
const NOW = new Date('2026-11-11T10:00:00Z');

describe('Cloudinary signing', () => {
  it('signs the parameters sorted by name, with the secret appended, as SHA-1', () => {
    const expected = createHash('sha1').update('folder=f&timestamp=1&zzz=9secret').digest('hex');
    // Given in a different order: the signature must not depend on it.
    expect(signParams({ zzz: '9', timestamp: '1', folder: 'f' }, 'secret')).toBe(expected);
  });

  it('builds a ticket whose signature covers the folder and timestamp, but not the api key', () => {
    const t = storage.signImageUpload('vastu-dev/projects/p1', NOW);
    const ts = String(Math.floor(NOW.getTime() / 1000));
    expect(t.url).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');
    expect(t.fields['folder']).toBe('vastu-dev/projects/p1');
    expect(t.fields['timestamp']).toBe(ts);
    expect(t.fields['api_key']).toBe('key123');
    expect(t.fields['signature']).toBe(
      signParams(
        {
          allowed_formats: 'jpg,jpeg,png,webp,heic,heif',
          folder: 'vastu-dev/projects/p1',
          timestamp: ts,
        },
        'shh',
      ),
    );
    // The secret itself must never reach the client.
    expect(JSON.stringify(t)).not.toContain('shh');
    expect(t.expiresAt).toBe('2026-11-11T10:55:00.000Z');
  });

  it('builds display URLs with automatic format and quality', () => {
    const u = storage.imageUrls('vastu-dev/projects/p1/abc');
    expect(u.url).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/vastu-dev/projects/p1/abc',
    );
    expect(u.thumbUrl).toContain('c_limit,w_480');
  });

  it('refuses to sign when storage is not configured, with a clear message', () => {
    expect(() => new UnconfiguredStorage('vastu').signImageUpload()).toThrowError(/not set up/);
  });
});

describe('folder rules', () => {
  const folder = projectFolder('vastu-dev', 'p1');
  it('accepts only ids directly inside the project folder', () => {
    expect(isInFolder(`${folder}/abc123`, folder)).toBe(true);
    expect(isInFolder('vastu-dev/projects/p2/abc123', folder)).toBe(false); // another project
    expect(isInFolder('elsewhere/abc123', folder)).toBe(false);
    expect(isInFolder(`${folder}/../p2/abc`, folder)).toBe(false); //          climbing out
    expect(isInFolder(`${folder}/sub/abc`, folder)).toBe(false); //            nested
    expect(isInFolder(`${folder}/`, folder)).toBe(false); //                   empty name
    expect(isInFolder(`${folder}abc`, folder)).toBe(false); //                 prefix trick
  });
});
