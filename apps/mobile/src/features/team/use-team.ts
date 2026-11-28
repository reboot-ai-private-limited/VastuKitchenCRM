import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateDesignationBodyDto,
  CreateUserBodyDto,
  SetTargetBodyDto,
  SetUserPasswordBodyDto,
  StaffRole,
  UpdateDesignationBodyDto,
  UpdateUserBodyDto,
} from '@vastu/contracts';
import {
  createDesignation,
  createUser,
  getTargetsSheet,
  listDesignations,
  listUsers,
  setUserPassword,
  setUserTarget,
  updateDesignation,
  updateUser,
} from '@/lib/api/endpoints/users';

const TEAM_PAGE_SIZE = 100;

/** Staff directory, paged so organisations beyond 100 people are fully reachable. */
export const useTeam = (search: string, role?: StaffRole, active: boolean | null = true) =>
  useInfiniteQuery({
    queryKey: ['users', 'team', { search, role, active }],
    queryFn: ({ pageParam, signal }) =>
      listUsers(
        { page: pageParam, pageSize: TEAM_PAGE_SIZE, search: search || undefined, role, active },
        signal,
      ),
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

function useInvalidatePeople() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['users'] });
    void qc.invalidateQueries({ queryKey: ['designations'] });
    void qc.invalidateQueries({ queryKey: ['targets'] });
    void qc.invalidateQueries({ queryKey: ['attendance'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useCreateEmployee() {
  const inv = useInvalidatePeople();
  return useMutation({
    mutationFn: (body: CreateUserBodyDto) => createUser(body),
    onSuccess: inv,
  });
}

export function useUpdateEmployee() {
  const inv = useInvalidatePeople();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateUserBodyDto & { id: string }) => updateUser(id, body),
    onSuccess: inv,
  });
}

export function useSetEmployeePassword() {
  const inv = useInvalidatePeople();
  return useMutation({
    mutationFn: ({ id, ...body }: SetUserPasswordBodyDto & { id: string }) =>
      setUserPassword(id, body),
    onSuccess: inv,
  });
}

export const useDesignations = (includeInactive = false, enabled = true) =>
  useQuery({
    queryKey: ['designations', includeInactive],
    queryFn: ({ signal }) => listDesignations(includeInactive, signal),
    enabled,
    staleTime: 60_000,
  });

export function useCreateDesignation() {
  const inv = useInvalidatePeople();
  return useMutation({
    mutationFn: (body: CreateDesignationBodyDto) => createDesignation(body),
    onSuccess: inv,
  });
}

export function useUpdateDesignation() {
  const inv = useInvalidatePeople();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateDesignationBodyDto & { id: string }) =>
      updateDesignation(id, body),
    onSuccess: inv,
  });
}

export const useTargetsSheet = (month: string, enabled = true) =>
  useQuery({
    queryKey: ['targets', month],
    queryFn: ({ signal }) => getTargetsSheet(month, signal),
    enabled: enabled && !!month,
  });

export function useSetUserTarget() {
  const inv = useInvalidatePeople();
  return useMutation({
    mutationFn: ({
      month,
      userId,
      ...body
    }: SetTargetBodyDto & { month: string; userId: string }) =>
      setUserTarget(month, userId, body),
    onSuccess: inv,
  });
}
