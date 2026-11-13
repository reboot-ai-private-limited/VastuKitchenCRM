import type { Router } from 'express';
// import { env } from '@/config/env.js'; // used only by the push sender (disabled)
import {
  CountUnreadUseCase,
  ListNotificationsUseCase,
  MarkAllReadUseCase,
  MarkReadUseCase,
  RegisterDeviceUseCase,
  RemoveDeviceUseCase,
  RemoveUserDevicesUseCase,
  NotifyUseCase,
} from './application/usecases/notifications.usecases.js';
// Push disabled for now (not required). Re-enable together with the sender wiring below.
// import { ExpoPushSender } from './infrastructure/expoPushSender.adapter.js';
import { MongoDeviceRepository } from './infrastructure/mongoDevice.adapter.js';
import { MongoNotificationRepository } from './infrastructure/mongoNotification.adapter.js';
import {
  makeListController,
  makeMarkAllReadController,
  makeMarkReadController,
  makeRegisterDeviceController,
  makeRemoveDeviceController,
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
  // Push is switched off: in-app notifications only. To re-enable, restore the ExpoPushSender
  // import and pass the second argument below.
  // const notify = new NotifyUseCase(notifications, {
  //   devices,
  //   sender: new ExpoPushSender(env.EXPO_ACCESS_TOKEN),
  // });
  const notify = new NotifyUseCase(notifications);
  const list = new ListNotificationsUseCase(notifications);
  const countUnread = new CountUnreadUseCase(notifications);
  const markRead = new MarkReadUseCase(notifications);
  const markAllRead = new MarkAllReadUseCase(notifications);
  const registerDevice = new RegisterDeviceUseCase(devices);
  const removeDevice = new RemoveDeviceUseCase(devices);
  const removeUserDevices = new RemoveUserDevicesUseCase(devices);

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
      removeDevicesFor: async (userId) => {
        await removeUserDevices.execute(userId);
      },
    },
    buildRouter: () =>
      buildNotificationsRouter({
        list: makeListController(list),
        unreadCount: makeUnreadCountController(countUnread),
        markRead: makeMarkReadController(markRead),
        markAllRead: makeMarkAllReadController(markAllRead),
        registerDevice: makeRegisterDeviceController(registerDevice),
        removeDevice: makeRemoveDeviceController(removeDevice),
      }),
  };
}
