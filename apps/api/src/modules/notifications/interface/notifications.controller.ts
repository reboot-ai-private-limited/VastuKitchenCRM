import type { Request, RequestHandler } from 'express';
import type {
  DeviceDto,
  ListNotificationsQueryDto,
  NotificationDto,
  PaginatedDto,
  RegisterDeviceDto,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type {
  CountUnreadUseCase,
  ListNotificationsUseCase,
  MarkAllReadUseCase,
  MarkReadUseCase,
  RegisterDeviceUseCase,
  RemoveDeviceUseCase,
} from '../application/usecases/notifications.usecases.js';
import { toNotificationDto } from './notification.mapper.js';

/** Always the caller's own: there is no way to ask for someone else's notifications. */
function meOf(req: Request): string {
  if (!req.user) throw AppError.unauthenticated();
  return req.user.sub;
}

export function makeListController(useCase: ListNotificationsUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const query = req.query as unknown as ListNotificationsQueryDto;
    const { items, total } = await useCase.execute(meOf(req), query);
    const data: PaginatedDto<NotificationDto> = {
      items: items.map(toNotificationDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
    sendSuccess(req, res, data, 'OK');
  });
}

export function makeUnreadCountController(useCase: CountUnreadUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    sendSuccess(req, res, { count: await useCase.execute(meOf(req)) }, 'OK');
  });
}

export function makeMarkReadController(useCase: MarkReadUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    await useCase.execute(meOf(req), String(req.params['id']));
    sendSuccess(req, res, {}, 'Marked as read.');
  });
}

export function makeMarkAllReadController(useCase: MarkAllReadUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    sendSuccess(req, res, { marked: await useCase.execute(meOf(req)) }, 'All marked as read.');
  });
}

export function makeRegisterDeviceController(useCase: RegisterDeviceUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const d = await useCase.execute(meOf(req), req.body as RegisterDeviceDto);
    const data: DeviceDto = {
      id: d.id,
      platform: d.platform,
      appVersion: d.appVersion,
      deviceName: d.deviceName,
      lastSeenAt: d.lastSeenAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
    };
    sendSuccess(req, res, data, 'Device registered.');
  });
}

export function makeRemoveDeviceController(useCase: RemoveDeviceUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    await useCase.execute(meOf(req), String(req.params['id']));
    sendSuccess(req, res, {}, 'Device removed.');
  });
}
