import type { Router } from 'express';
import { env } from '@/config/env.js';
import {
  CountUnreadUseCase,
  ListNotificationsUseCase,
  MarkAllReadUseCase,
  MarkReadUseCase,
  NotifyUseCase,
} from './application/usecases/notifications.usecases.js';
import {
  RegisterDeviceUseCase,
  RemoveDeviceUseCase,
} from './application/usecases/devices.usecases.js';
import { PushFanout } from './application/services/pushFanout.js';
import { FcmPushSender, NoopPushSender } from './infrastructure/fcmPushSender.js';
import { MongoDeviceRepository } from './infrastructure/mongoDevice.adapter.js';
import { MongoNotificationRepository } from './infrastructure/mongoNotification.adapter.js';
import {
  makeRegisterDeviceController,
  makeRemoveDeviceController,
} from './interface/devices.controller.js';
import {
  makeListController,
  makeMarkAllReadController,
  makeMarkReadController,
  makeUnreadCountController,
} from './interface/notifications.controller.js';
import { buildNotificationsRouter } from './interface/notifications.route.js';
import type { NotificationsPublicContract } from './notifications.public.js';

export interface NotificationsContainer {
  contract: NotificationsPublicContract;
  buildRouter: () => Router;
}

export function buildNotificationsContainer(): NotificationsContainer {
  const notifications = new MongoNotificationRepository();

  const devices = new MongoDeviceRepository();
  const sender =
    env.PUSH_ENABLED && env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? new FcmPushSender(env.FIREBASE_SERVICE_ACCOUNT_JSON)
      : new NoopPushSender();
  const notify = new NotifyUseCase(notifications, new PushFanout(devices, sender));
  const registerDevice = new RegisterDeviceUseCase(devices);
  const removeDevice = new RemoveDeviceUseCase(devices);
  const list = new ListNotificationsUseCase(notifications);
  const countUnread = new CountUnreadUseCase(notifications);
  const markRead = new MarkReadUseCase(notifications);
  const markAllRead = new MarkAllReadUseCase(notifications);

  return {
    contract: {
      notify: (input) =>
        notify.execute({
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          ref: input.ref ?? null,
          dedupeKey: input.dedupeKey ?? null,
        }),
      removeDevicesFor: (userId) => devices.removeAllForUser(userId),
    },
    buildRouter: () =>
      buildNotificationsRouter({
        registerDevice: makeRegisterDeviceController(registerDevice),
        removeDevice: makeRemoveDeviceController(removeDevice),
        list: makeListController(list),
        unreadCount: makeUnreadCountController(countUnread),
        markRead: makeMarkReadController(markRead),
        markAllRead: makeMarkAllReadController(markAllRead),
      }),
  };
}
