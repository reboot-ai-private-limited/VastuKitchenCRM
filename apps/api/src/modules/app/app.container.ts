import type { RequestHandler, Router } from 'express';
import type { AppPlatform } from '@vastu/contracts';
import { env } from '@/config/env.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type { SettingsPublicContract } from '../settings/settings.public.js';
import { GetAppConfigUseCase } from './application/usecases/getAppConfig.usecase.js';
import { buildAppRouter } from './interface/app.route.js';
import { versionGate } from './interface/versionGate.middleware.js';

export interface AppContainer {
  buildRouter: () => Router;
  /** Mounted on /api before the routers: stamps the app version on logs and answers 426 below the minimum. */
  versionGate: () => RequestHandler;
}

export interface AppModuleDeps {
  settings: SettingsPublicContract;
}

const LINKS: Record<AppPlatform, { storeUrl: string | null; apkUrl: string | null }> = {
  android: { storeUrl: env.APP_ANDROID_STORE_URL ?? null, apkUrl: env.APP_ANDROID_APK_URL ?? null },
  ios: { storeUrl: env.APP_IOS_STORE_URL ?? null, apkUrl: null },
};

export function buildAppContainer({ settings }: AppModuleDeps): AppContainer {
  const getConfig = new GetAppConfigUseCase({
    versions: async (p) => ({
      min: await settings.get(`app.${p}.minVersion`),
      recommended: await settings.get(`app.${p}.recommendedVersion`),
    }),
    maintenance: async () => ({
      active: await settings.get('app.maintenanceActive'),
      message: await settings.get('app.maintenanceMessage'),
    }),
    uploadMaxBytes: async () => (await settings.get('docs.maxFileMb')) * 1024 * 1024,
    links: (p) => LINKS[p],
    polling: { unreadSec: env.APP_POLL_UNREAD_SEC, chatSec: env.APP_POLL_CHAT_SEC },
  });

  const controller: RequestHandler = asyncHandler(async (req, res) => {
    const { platform } = req.query as unknown as { platform: AppPlatform };
    // Cacheable: the app (and any CDN) may reuse it for 5 minutes.
    res.setHeader('Cache-Control', 'public, max-age=300');
    sendSuccess(req, res, await getConfig.execute(platform), 'OK');
  });

  return {
    buildRouter: () => buildAppRouter(controller),
    versionGate: () => versionGate((platform) => getConfig.execute(platform)),
  };
}
