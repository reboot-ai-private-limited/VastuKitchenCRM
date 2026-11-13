import type { Router } from 'express';
import {
  CountUnreadUseCase,
  ListNotificationsUseCase,
  MarkAllReadUseCase,
  MarkReadUseCase,
  NotifyUseCase,
} from './application/usecases/notifications.usecases.js';
import { MongoNotificationRepository } from './infrastructure/mongoNotification.adapter.js';
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

  const notify = new NotifyUseCase(notifications);
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
    },
    buildRouter: () =>
      buildNotificationsRouter({
        list: makeListController(list),
        unreadCount: makeUnreadCountController(countUnread),
        markRead: makeMarkReadController(markRead),
        markAllRead: makeMarkAllReadController(markAllRead),
      }),
  };
}
