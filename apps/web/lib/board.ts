import type { InfiniteData } from '@tanstack/react-query';
import type { LeadDto, LeadStatus, PaginatedDto } from '@vastu/contracts';

export type BoardData = InfiniteData<PaginatedDto<LeadDto>>;

/** Every lead currently loaded in a column, across its "load more" pages. */
export const boardLeads = (d: BoardData | undefined): LeadDto[] =>
  d?.pages.flatMap((p) => p.items) ?? [];

/** The column's true count: the server's `total` (not how many cards happen to be loaded). */
export const boardTotal = (d: BoardData | undefined): number => d?.pages[0]?.total ?? 0;

/** Takes a lead out of a column's cache, keeping the count honest. Returns the same object if it wasn't there. */
export function removeFromBoard(d: BoardData, id: string): BoardData {
  if (!boardLeads(d).some((l) => l.id === id)) return d;
  return {
    ...d,
    pages: d.pages.map((p, i) => ({
      ...p,
      total: i === 0 ? Math.max(0, p.total - 1) : p.total,
      items: p.items.filter((l) => l.id !== id),
    })),
  };
}

/** Puts a lead at the top of a column's cache (newest movement first), bumping the count. */
export function addToBoard(d: BoardData, lead: LeadDto): BoardData {
  if (boardLeads(d).some((l) => l.id === lead.id)) return d;
  const [first, ...rest] = d.pages;
  if (!first) return d;
  return {
    ...d,
    pages: [{ ...first, total: first.total + 1, items: [lead, ...first.items] }, ...rest],
  };
}

/** The lead as it looks right after moving: new status, "changed just now", no longer stuck. */
export const movedLead = (lead: LeadDto, to: LeadStatus, now = new Date()): LeadDto => ({
  ...lead,
  status: to,
  statusChangedAt: now.toISOString(),
  isStuck: false,
});
