import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUnreadCount, listNotifications, markAllRead, markRead } from '@/lib/api/endpoints/notifications';

export const useNotifications = () =>
  useInfiniteQuery({
    queryKey: ['notifications', 'list'],
    queryFn: ({ pageParam, signal }) => listNotifications(pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    select: (d) => {
      const seen = new Set<string>();
      return d.pages.flatMap((p) => p.items).filter((n) => !seen.has(n.id) && seen.add(n.id));
    },
  });

/** Polled every 30 s while the app is in the foreground (there is no push yet). */
export const useUnreadCount = () =>
  useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: ({ signal }) => getUnreadCount(signal),
    refetchInterval: 30_000,
    select: (d) => d.count,
  });

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markRead,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllRead,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
