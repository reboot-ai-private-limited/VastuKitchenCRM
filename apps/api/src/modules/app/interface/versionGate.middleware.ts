import type { RequestHandler } from 'express';
import {
  APP_BUILD_HEADER,
  APP_PLATFORM_HEADER,
  APP_VERSION_HEADER,
  appPlatformSchema,
  type AppConfigDto,
  type AppPlatform,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { compareVersions } from '@/shared/app/appVersion.js';
import { setClientInfo } from '@/shared/http/request-context.js';

/** Routes an outdated app may still use (mounted under /api, so paths are relative to it). */
const ALLOWED_PREFIXES = ['/app/config', '/health', '/identity/auth', '/notifications/devices'];

export function isUpgradeExempt(method: string, path: string): boolean {
  if (method === 'OPTIONS') return true;
  if (ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return true;
  return method === 'GET' && path === '/attendance/me';
}

const header = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/**
 * Reads X-App-Version, X-App-Build and X-Platform (all optional; the web app sends none), puts them
 * on the log context, and answers 426 UPGRADE_REQUIRED when the app is older than the platform's
 * `minVersion` and the route is not allow-listed. Never blocks when the headers are missing or
 * unreadable, or when the config cannot be loaded: a policy outage must not take the API down.
 */
export function versionGate(
  getConfig: (
    platform: AppPlatform,
  ) => Promise<Pick<AppConfigDto, 'minVersion' | 'storeUrl' | 'apkUrl'>>,
): RequestHandler {
  return (req, _res, next) => {
    const version = header(req.headers[APP_VERSION_HEADER]);
    if (!version) return next();
    const platform = appPlatformSchema.safeParse(
      header(req.headers[APP_PLATFORM_HEADER])?.toLowerCase(),
    );
    const build = header(req.headers[APP_BUILD_HEADER]);
    setClientInfo({
      appVersion: version.slice(0, 32),
      ...(platform.success ? { appPlatform: platform.data } : {}),
      ...(build ? { appBuild: build.slice(0, 32) } : {}),
    });
    if (!platform.success || isUpgradeExempt(req.method, req.path)) return next();
    getConfig(platform.data).then(
      (cfg) => {
        const cmp = compareVersions(version, cfg.minVersion);
        if (Number.isNaN(cmp) || cmp >= 0) return next();
        next(
          new AppError({
            statusCode: 426,
            code: 'UPGRADE_REQUIRED',
            message: 'Please update the app to continue.',
            publicDetails: {
              minVersion: cfg.minVersion,
              storeUrl: cfg.storeUrl,
              apkUrl: cfg.apkUrl,
            },
          }),
        );
      },
      () => next(),
    );
  };
}
