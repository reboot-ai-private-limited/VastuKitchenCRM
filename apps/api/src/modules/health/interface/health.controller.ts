import type { RequestHandler } from 'express';
import type { GetHealthUseCase } from '../application/usecases/getHealth.usecase.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';

export function makeGetHealthController(useCase: GetHealthUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const report = await useCase.execute();
    // 503 when degraded so load balancers notice; still the standard envelope.
    sendSuccess(req, res, report, 'Health check complete', report.status === 'OK' ? 200 : 503);
  });
}
