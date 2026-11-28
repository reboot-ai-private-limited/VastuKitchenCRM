import type {
  DeviceDto,
  NotificationDto,
  PaginatedDto,
  RegisterDeviceDto,
  UnreadCountDto,
} from '@vastu/contracts';
import { request } from '@/lib/api/client';

export type NotificationFilter = 'unread' | 'read' | 'all';

export const listNotifications = (
  page: number,
  filter: NotificationFilter = 'all',
  signal?: AbortSignal,
) =>
  request<PaginatedDto<NotificationDto>>(
    'GET',
    `/notifications?page=${page}&pageSize=20${filter === 'unread' ? '&unread=true' : filter === 'read' ? '&unread=false' : ''}`,
    undefined,
    { signal },
  );

export const getUnreadCount = (signal?: AbortSignal) =>
  request<UnreadCountDto>('GET', '/notifications/unread-count', undefined, { signal });

export const markRead = (id: string) => request<unknown>('POST', `/notifications/${id}/read`);
export const markAllRead = () => request<unknown>('POST', '/notifications/read-all');

export const registerDevice = (body: RegisterDeviceDto) =>
  request<DeviceDto>('POST', '/notifications/devices', body);
export const removeDevice = (id: string) => request<unknown>('DELETE', `/notifications/devices/${id}`);
