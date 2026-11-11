'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SettingDto } from '@vastu/contracts';
import { api } from './client';

export const useSettings = () =>
  useQuery({
    queryKey: ['settings'],
    queryFn: ({ signal }) => api<SettingDto[]>('/settings', { signal }),
  });

/** Several settings at once, all-or-nothing: the API saves none if one is bad. */
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, string | number | boolean>) =>
      api<SettingDto[]>('/settings', { method: 'PATCH', body: { values } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

export function useResetSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api(`/settings/${encodeURIComponent(key)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}
