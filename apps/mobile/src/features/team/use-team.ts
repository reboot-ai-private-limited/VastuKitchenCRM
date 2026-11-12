import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { StaffRole } from '@vastu/contracts';
import { listUsers } from '@/lib/api/endpoints/users';

const TEAM_PAGE_SIZE = 100;

/** Staff directory, paged so organisations beyond 100 people are fully reachable. */
export const useTeam = (search: string, role?: StaffRole) =>
  useInfiniteQuery({
    queryKey: ['users', 'team', { search, role }],
    queryFn: ({ pageParam, signal }) =>
      listUsers({ page: pageParam, pageSize: TEAM_PAGE_SIZE, search: search || undefined, role, active: true }, signal),
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    select: (d) => {
      const seen = new Set<string>();
      return d.pages
        .flatMap((p) => p.items)
        .filter((u) => u.role !== 'CUSTOMER' && !seen.has(u.id) && seen.add(u.id));
    },
  });
