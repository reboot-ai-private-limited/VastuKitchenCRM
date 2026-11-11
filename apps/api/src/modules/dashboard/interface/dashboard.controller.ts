import type { Request, RequestHandler } from 'express';
import type { DashboardQueryDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type { GetDashboardUseCase } from '../application/usecases/getDashboard.usecase.js';

export const makeGetDashboard = (uc: GetDashboardUseCase): RequestHandler =>
  asyncHandler(async (req: Request, res) => {
    if (!req.user) throw AppError.unauthenticated();
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(
      req,
      res,
      await uc.execute({ role: req.user.role }, req.query as unknown as DashboardQueryDto),
      'OK',
    );
  });
