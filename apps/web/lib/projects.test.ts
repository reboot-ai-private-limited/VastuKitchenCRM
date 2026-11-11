import { describe, expect, it } from 'vitest';
import type { ProjectDto } from '@vastu/contracts';
import {
  DEFAULT_PROJECT_FILTERS,
  parseProjectFilters,
  projectFiltersToSearch,
  projectPermissions,
} from './projects';

const p = (over: Partial<ProjectDto> = {}): ProjectDto => ({
  id: 'p1',
  name: 'X',
  customer: { id: 'c', name: 'C', phone: '9000000000' },
  leadId: null,
  siteAddress: null,
  value: null,
  stage: 'DESIGN',
  designStage: 'IN_DESIGN',
  designer: { id: 'd1', name: 'D' },
  members: [{ id: 'd1', name: 'D', designation: null }],
  createdAt: '2026-01-01T00:00:00Z',
  closedAt: null,
  ...over,
});

describe('project filters in the URL', () => {
  it('round-trips and ignores junk', () => {
    const f = {
      ...DEFAULT_PROJECT_FILTERS,
      search: 'das',
      stage: 'SITE' as const,
      designStage: 'SHARED' as const,
      designerId: 'd1',
      page: 2,
      view: 'table' as const,
    };
    expect(parseProjectFilters(new URLSearchParams(projectFiltersToSearch(f).slice(1)))).toEqual(f);
    expect(parseProjectFilters(new URLSearchParams('stage=NOPE&design=x&page=0'))).toEqual(
      DEFAULT_PROJECT_FILTERS,
    );
    expect(projectFiltersToSearch(DEFAULT_PROJECT_FILTERS)).toBe('');
  });
});

describe('project permissions', () => {
  it('admin does everything', () => {
    const c = projectPermissions('ADMIN', 'a', p());
    expect(c).toMatchObject({
      createProject: true,
      manageMembers: true,
      changeStage: true,
      summaryOnly: false,
    });
  });
  it('the designer can move design stage but not stage', () => {
    const c = projectPermissions('DESIGNER', 'd1', p());
    expect(c.changeDesignStage).toBe(true);
    expect(c.changeStage).toBe(false);
    expect(c.seesTeam).toBe(true);
  });
  it('a sales owner who is not a member only gets the summary', () => {
    const c = projectPermissions('SALES', 's1', p());
    expect(c.summaryOnly).toBe(true);
    expect(c.seesTeam).toBe(false);
  });
  it('a customer never sees the team tab', () => {
    const c = projectPermissions('CUSTOMER', 'c', p());
    expect(c.isCustomer).toBe(true);
    expect(c.seesTeam).toBe(false);
    expect(c.summaryOnly).toBe(false);
  });
});
