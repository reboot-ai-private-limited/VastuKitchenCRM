import { z } from 'zod';

/**
 * What the mobile app asks the server at launch: the oldest version still allowed, the newest
 * recommended one, where to get an update, a maintenance switch, and a few tunables. Public and
 * cacheable. Versions are dotted numbers ("1.4.2"; a "-beta" style suffix is ignored).
 *
 * The app also sends X-App-Version / X-App-Build / X-Platform on every request; a build below
 * `minVersion` gets 426 with code UPGRADE_REQUIRED on routes that are not allow-listed.
 */
export const APP_PLATFORMS = ['android', 'ios'] as const;
export const appPlatformSchema = z.enum(APP_PLATFORMS);
export type AppPlatform = z.infer<typeof appPlatformSchema>;

export const APP_VERSION_HEADER = 'x-app-version';
export const APP_BUILD_HEADER = 'x-app-build';
export const APP_PLATFORM_HEADER = 'x-platform';

export const appVersionSchema = z.string().regex(/^\d+(\.\d+){0,2}([-+][0-9A-Za-z.-]+)?$/, 'Use 1.2.3');

export const appConfigQuerySchema = z.object({ platform: appPlatformSchema.default('android') });
export type AppConfigQueryDto = z.infer<typeof appConfigQuerySchema>;

export const appConfigSchema = z.object({
  platform: appPlatformSchema,
  /** Below this the app must update before it can be used. */
  minVersion: appVersionSchema,
  /** Below this the app shows a dismissible "update available" banner. */
  recommendedVersion: appVersionSchema,
  /** Play Store / App Store page. Null when not published there. */
  storeUrl: z.string().nullable(),
  /** Direct APK download (sideloaded builds). Android only. */
  apkUrl: z.string().nullable(),
  maintenance: z.object({ active: z.boolean(), message: z.string() }),
  polling: z.object({ unreadSec: z.number().int(), chatSec: z.number().int() }),
  /** Largest file the app may upload, in bytes. */
  uploadMaxBytes: z.number().int(),
});
export type AppConfigDto = z.infer<typeof appConfigSchema>;

/** Body of the 426 response's `data`: what the app needs to show the update screen. */
export const upgradeRequiredDataSchema = z.object({
  minVersion: appVersionSchema,
  storeUrl: z.string().nullable(),
  apkUrl: z.string().nullable(),
});
export type UpgradeRequiredDataDto = z.infer<typeof upgradeRequiredDataSchema>;
