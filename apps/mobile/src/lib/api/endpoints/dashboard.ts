import type { DashboardDto } from '@vastu/contracts';
import { request } from '@/lib/api/client';

export type DashboardRangeQuery = { from?: string; to?: string };

export function getDashboard(q: DashboardRangeQuery = {}, signal?: AbortSignal) {
  const parts: string[] = [];
  if (q.from) parts.push(`from=${encodeURIComponent(q.from)}`);
  if (q.to) parts.push(`to=${encodeURIComponent(q.to)}`);
  const suffix = parts.length ? `?${parts.join('&')}` : '';
  return request<DashboardDto>('GET', `/dashboard${suffix}`, undefined, { signal });
}
