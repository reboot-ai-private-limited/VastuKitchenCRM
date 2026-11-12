'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ProposalTemplate,
  ProposalTemplateSummaryDto,
  SaveProposalTemplateBodyDto,
} from '@vastu/contracts';
import { api } from './client';

export const useProposalTemplates = () =>
  useQuery({
    queryKey: ['proposal-templates', 'list'],
    queryFn: ({ signal }) =>
      api<{ items: ProposalTemplateSummaryDto[] }>('/proposal-templates', { signal }),
    staleTime: 60_000,
  });

export const useProposalTemplate = (key: string | null) =>
  useQuery({
    queryKey: ['proposal-templates', 'detail', key],
    queryFn: ({ signal }) => api<ProposalTemplate>(`/proposal-templates/${key}`, { signal }),
    enabled: !!key,
    staleTime: 60_000,
  });

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['proposal-templates'] });
}

export function useCreateProposalTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: SaveProposalTemplateBodyDto) =>
      api<ProposalTemplate>('/proposal-templates', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useSaveProposalTemplate(key: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: SaveProposalTemplateBodyDto) =>
      api<ProposalTemplate>(`/proposal-templates/${key}`, { method: 'PUT', body }),
    onSuccess: invalidate,
  });
}

export function useDuplicateProposalTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { key: string; name?: string }) =>
      api<ProposalTemplate>(`/proposal-templates/${v.key}/duplicate`, {
        method: 'POST',
        body: v.name ? { name: v.name } : {},
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteProposalTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (key: string) => api(`/proposal-templates/${key}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
