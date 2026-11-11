import type { Request, RequestHandler } from 'express';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type {
  ListSettingsUseCase,
  ResetSettingUseCase,
  UpdateSettingsUseCase,
} from '../application/usecases/settings.usecases.js';

const me = (req: Request): string => {
  if (!req.user) throw AppError.unauthenticated();
  return req.user.sub;
};

export const makeListSettings = (uc: ListSettingsUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(), 'OK');
  });

export const makeUpdateSettings = (uc: UpdateSettingsUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(me(req), req.body.values), 'Settings saved.');
  });

export const makeResetSetting = (uc: ResetSettingUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(String(req.params['key'])), 'Reset to the default.');
  });
