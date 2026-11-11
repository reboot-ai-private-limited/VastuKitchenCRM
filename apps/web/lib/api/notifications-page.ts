'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { NotificationDto, PaginatedDto } from '@vastu/contracts';
import { api } from './client';

export const NOTIFICATIONS_PAGE_SIZE = 20;

/**
 * The full list for /notifications, "Load more" by page. The key starts with `['notifications']`, so the
 * existing mark-read mutations (which invalidate that prefix) refresh this list and the bell together.
 */
export const useNotificationsPage = (unreadOnly: boolean) =>
  useInfiniteQuery({
    queryKey: ['notifications', 'page', unreadOnly],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api<PaginatedDto<NotificationDto>>('/notifications', {
        query: {
          page: pageParam,
          pageSize: NOTIFICATIONS_PAGE_SIZE,
          unread: unreadOnly ? 'true' : undefined,
        },
        signal,
      }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
