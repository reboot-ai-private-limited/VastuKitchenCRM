'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AttendanceMonthDto,
  BoardDto,
  CreateDesignationBodyDto,
  CreateUserBodyDto,
  RangeDto,
  DesignationDto,
  PaginatedDto,
  SalarySheetDto,
  SetTargetBodyDto,
  TargetsSheetDto,
  SetDayBodyDto,
  SetUserPasswordBodyDto,
  UpdateDesignationBodyDto,
  UpdateSalaryBodyDto,
  UpdateUserBodyDto,
  UserDto,
} from '@vastu/contracts';
import type { EmployeeFilters } from '@/lib/hr';
import { api, apiBlob } from './client';

export const EMPLOYEE_PAGE_SIZE = 20;

/* ── attendance ─────────────────────────────────────────────────────────────── */

/** Admin/HR: everyone's day. The board is "live", so it refreshes while the page is open. */
export const useBoard = (date: string) =>
  useQuery({
    queryKey: ['hr', 'board', date],
    queryFn: ({ signal }) => api<BoardDto>('/attendance/board', { query: { date }, signal }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

/** Admin/HR: everyone over a date range (`YYYY-MM-DD`, inclusive). */
export const useRange = (from: string, to: string) =>
  useQuery({
    queryKey: ['hr', 'range', from, to],
    queryFn: ({ signal }) => api<RangeDto>('/attendance/range', { query: { from, to }, signal }),
    placeholderData: keepPreviousData,
  });

/** Admin/HR: one person's month. */
export const useUserMonth = (userId: string, month: string, enabled = true) =>
  useQuery({
    queryKey: ['hr', 'month', userId, month],
    queryFn: ({ signal }) =>
      api<AttendanceMonthDto>(`/attendance/users/${userId}`, { query: { month }, signal }),
    placeholderData: keepPreviousData,
    enabled,
  });

/** Any staff on attendance: their own month. */
export const useMyMonth = (month: string, enabled = true) =>
  useQuery({
    queryKey: ['hr', 'me', month],
    queryFn: ({ signal }) =>
      api<AttendanceMonthDto>('/attendance/me', { query: { month }, signal }),
    placeholderData: keepPreviousData,
    enabled,
  });

function useRefreshHr() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['hr'] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

export function useSetDay(userId: string) {
  const refresh = useRefreshHr();
  return useMutation({
    mutationFn: ({ date, ...body }: SetDayBodyDto & { date: string }) =>
      api(`/attendance/users/${userId}/days/${date}`, { method: 'PUT', body }),
    onSuccess: refresh,
  });
}

export function useRemoveDay(userId: string) {
  const refresh = useRefreshHr();
  return useMutation({
    mutationFn: (date: string) =>
      api(`/attendance/users/${userId}/days/${date}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
}

export function useSimulateAttendance() {
  const refresh = useRefreshHr();
  return useMutation({
    mutationFn: (days: number) =>
      api<{ created: number; skipped: number }>('/attendance/simulate', {
        method: 'POST',
        body: { days },
      }),
    onSuccess: refresh,
  });
}

/* ── employees ──────────────────────────────────────────────────────────────── */

export const useEmployees = (f: EmployeeFilters) =>
  useQuery({
    queryKey: ['hr', 'employees', f],
    queryFn: ({ signal }) =>
      api<PaginatedDto<UserDto>>('/identity/users', {
        query: {
          page: f.page,
          pageSize: EMPLOYEE_PAGE_SIZE,
          search: f.search,
          role: f.role,
          active: f.active === null ? undefined : String(f.active),
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  });

/** The picker and the master screen share one query; `includeInactive` is for the admin screen only. */
export const useDesignationList = (includeInactive: boolean, enabled = true) =>
  useQuery({
    queryKey: ['hr', 'designations', includeInactive],
    queryFn: ({ signal }) =>
      api<DesignationDto[]>('/identity/designations', {
        query: { includeInactive: includeInactive ? 'true' : undefined },
        signal,
      }),
    enabled,
    staleTime: 60_000,
  });

function useRefreshPeople() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['hr'] }),
      // Other screens' pickers (lead assignment, project team) read the same people.
      qc.invalidateQueries({ queryKey: ['users'] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

export function useCreateEmployee() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: (body: CreateUserBodyDto) =>
      api<UserDto>('/identity/users', { method: 'POST', body }),
    onSuccess: refresh,
  });
}
export function useUpdateEmployee(id: string) {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: (body: UpdateUserBodyDto) =>
      api<UserDto>(`/identity/users/${id}`, { method: 'PATCH', body }),
    onSuccess: refresh,
  });
}
export function useSetEmployeePassword(id: string) {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: (body: SetUserPasswordBodyDto) =>
      api<UserDto>(`/identity/users/${id}/password`, { method: 'PUT', body }),
    onSuccess: refresh,
  });
}

export function useCreateDesignation() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: (body: CreateDesignationBodyDto) =>
      api<DesignationDto>('/identity/designations', { method: 'POST', body }),
    onSuccess: refresh,
  });
}
export function useUpdateDesignation() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateDesignationBodyDto & { id: string }) =>
      api<DesignationDto>(`/identity/designations/${id}`, { method: 'PATCH', body }),
    onSuccess: refresh,
  });
}

/* ── salary ─────────────────────────────────────────────────────────────────── */

export const useSalary = (month: string) =>
  useQuery({
    queryKey: ['hr', 'salary', month],
    queryFn: ({ signal }) => api<SalarySheetDto>(`/salary/${month}`, { signal }),
    placeholderData: keepPreviousData,
  });

export function useGenerateSalary(month: string) {
  const refresh = useRefreshHr();
  return useMutation({
    mutationFn: () => api<SalarySheetDto>(`/salary/${month}/generate`, { method: 'POST' }),
    onSuccess: refresh,
  });
}
export function useUpdateSalaryRow(month: string) {
  const refresh = useRefreshHr();
  return useMutation({
    mutationFn: ({ userId, ...body }: UpdateSalaryBodyDto & { userId: string }) =>
      api<SalarySheetDto>(`/salary/${month}/users/${userId}`, { method: 'PATCH', body }),
    onSuccess: refresh,
  });
}
export function useFinalizeSalary(month: string) {
  const refresh = useRefreshHr();
  return useMutation({
    mutationFn: () => api<SalarySheetDto>(`/salary/${month}/finalize`, { method: 'POST' }),
    onSuccess: refresh,
  });
}

/** The CSV needs the bearer header, so it is fetched as a blob and saved from memory (a plain link would 401). */
export async function downloadSalaryCsv(month: string, fileName: string): Promise<void> {
  const blob = await apiBlob(`/salary/${month}/export.csv`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── monthly sales targets ──────────────────────────────────────────────────── */

export const useTargets = (month: string, enabled = true) =>
  useQuery({
    queryKey: ['hr', 'targets', month],
    queryFn: ({ signal }) => api<TargetsSheetDto>(`/targets/${month}`, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });

export function useSetTarget(month: string, userId: string) {
  const refresh = useRefreshHr();
  return useMutation({
    mutationFn: (body: SetTargetBodyDto) =>
      api<TargetsSheetDto>(`/targets/${month}/users/${userId}`, { method: 'PUT', body }),
    onSuccess: refresh,
  });
}
