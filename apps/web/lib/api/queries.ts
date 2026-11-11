'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DashboardDto,
  DashboardQueryDto,
  NotificationDto,
  PaginatedDto,
  UnreadCountDto,
} from '@vastu/contracts';
import { api } from './client';

export const useDashboard = (range: DashboardQueryDto) =>
  useQuery({
    queryKey: ['dashboard', range.from ?? null, range.to ?? null],
    queryFn: ({ signal }) =>
      api<DashboardDto>('/dashboard', { query: { from: range.from, to: range.to }, signal }),
    // The owner leaves this screen open: keep it reasonably fresh without hammering the API.
    refetchInterval: 60_000,
  });

/** The bell's number. Polled: nothing else is pushed to the browser. */
export const useUnreadCount = () =>
  useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: ({ signal }) => api<UnreadCountDto>('/notifications/unread-count', { signal }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

export const useNotifications = (pageSize: number, enabled = true) =>
  useQuery({
    queryKey: ['notifications', 'list', pageSize],
    queryFn: ({ signal }) =>
      api<PaginatedDto<NotificationDto>>('/notifications', { query: { pageSize }, signal }),
    enabled,
  });

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
