import type { NotificationDto, PaginatedDto, UnreadCountDto } from '@vastu/contracts';
import { request } from '@/lib/api/client';

export const listNotifications = (page: number, signal?: AbortSignal) =>
  request<PaginatedDto<NotificationDto>>('GET', `/notifications?page=${page}&pageSize=20`, undefined, {
    signal,
  });

export const getUnreadCount = (signal?: AbortSignal) =>
  request<UnreadCountDto>('GET', '/notifications/unread-count', undefined, { signal });

export const markRead = (id: string) => request<unknown>('POST', `/notifications/${id}/read`);
export const markAllRead = () => request<unknown>('POST', '/notifications/read-all');
