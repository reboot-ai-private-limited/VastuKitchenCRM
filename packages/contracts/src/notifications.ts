import { z } from 'zod';
import { paginatedSchema } from './pagination.js';

export const NOTIFICATION_TYPES = [
  'PROPOSAL_SEEN',
  'PROPOSAL_UNSEEN',
  'PROPOSAL_NO_ACTION',
  'LEAD_STAGNANT',
  'LEAD_ASSIGNED',
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/** What a notification points at, so the app can open the right screen. */
export const NOTIFICATION_REF_KINDS = ['LEAD', 'PROPOSAL'] as const;
export const notificationRefSchema = z.object({
  kind: z.enum(NOTIFICATION_REF_KINDS),
  id: z.string(),
});
export type NotificationRefDto = z.infer<typeof notificationRefSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  ref: notificationRefSchema.nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type NotificationDto = z.infer<typeof notificationSchema>;

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  /** `true` returns only unread notifications. */
  unread: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ListNotificationsQueryDto = z.infer<typeof listNotificationsQuerySchema>;
export const notificationPageSchema = paginatedSchema(notificationSchema);

export const notificationIdParamsSchema = z.object({ id: z.string().min(1) });

export const unreadCountSchema = z.object({ count: z.number().int() });
export type UnreadCountDto = z.infer<typeof unreadCountSchema>;

export const readAllResultSchema = z.object({ marked: z.number().int() });

/** How many alerts a reminder run created, per rule. */
export const reminderRunResultSchema = z.object({
  unseen: z.number().int(),
  noAction: z.number().int(),
  stagnant: z.number().int(),
});
export type ReminderRunResultDto = z.infer<typeof reminderRunResultSchema>;
