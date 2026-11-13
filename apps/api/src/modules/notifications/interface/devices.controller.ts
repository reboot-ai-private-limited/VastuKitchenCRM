import type { Request, RequestHandler } from 'express';
import type { DeviceDto, RegisterDeviceDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type {
  RegisterDeviceUseCase,
  RemoveDeviceUseCase,
} from '../application/usecases/devices.usecases.js';
import type { Device } from '../domain/device.entity.js';

function meOf(req: Request): string {
  if (!req.user) throw AppError.unauthenticated();
  return req.user.sub;
}

const toDeviceDto = (d: Device): DeviceDto => ({
  id: d.id,
  platform: d.platform,
  appVersion: d.appVersion,
  deviceName: d.deviceName,
  lastSeenAt: d.lastSeenAt.toISOString(),
  createdAt: d.createdAt.toISOString(),
});

export function makeRegisterDeviceController(useCase: RegisterDeviceUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const device = await useCase.execute(meOf(req), req.body as RegisterDeviceDto);
    sendSuccess(req, res, toDeviceDto(device), 'Device registered.');
  });
}

export function makeRemoveDeviceController(useCase: RemoveDeviceUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    await useCase.execute(meOf(req), String(req.params['id']));
    sendSuccess(req, res, {}, 'Device removed.');
  });
}
