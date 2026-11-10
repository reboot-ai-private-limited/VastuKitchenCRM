import type { RequestHandler } from 'express';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type { RunRemindersUseCase } from '../application/usecases/runReminders.usecase.js';

export function makeRunController(useCase: RunRemindersUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const result = await useCase.execute();
    const total = result.unseen + result.noAction + result.stagnant;
    sendSuccess(req, res, result, `Reminder run finished: ${total} new alert(s).`);
  });
}
