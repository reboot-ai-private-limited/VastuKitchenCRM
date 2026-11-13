import { describe, expect, it } from 'vitest';
import { ROLE_NAMES, type RoleName } from '@vastu/contracts';
import { NAV, isActive, landingFor, navFor } from './nav';
import { groupOf, refHref } from './notifications';

const labels = (role: RoleName) => navFor(role).map((i) => i.label);

describe('navigation per role (docs/05-design/layout-and-navigation.md)', () => {
  it('Admin sees everything', () => {
    expect(labels('ADMIN')).toEqual([
      'Dashboard',
      'Leads',
      'Proposals',
      'Customers',
      'Projects',
      'To-dos',
      'Complaints',
      'Stocks',
      'Attendance',
      'Employees',
      'Salary',
      'Settings',
    ]);
  });

  it('HR sees the dashboard (attendance view), attendance, employees and salary only', () => {
    expect(labels('HR')).toEqual(['Dashboard', 'Attendance', 'Employees', 'Salary']);
  });

  it('Sales, Office, Designer, Technician', () => {
    expect(labels('SALES')).toEqual([
      'Leads',
      'Proposals',
      'Customers',
      'Projects',
      'To-dos',
      'Complaints',
      'Attendance',
    ]);
    expect(labels('OFFICE')).toEqual([
      'Leads',
      'Customers',
      'Projects',
      'To-dos',
      'Complaints',
      'Stocks',
      'Attendance',
    ]);
    expect(labels('DESIGNER')).toEqual(['Projects', 'To-dos', 'Complaints', 'Attendance']);
    expect(labels('TECHNICIAN')).toEqual(['Projects', 'To-dos', 'Complaints', 'Attendance']);
  });

  it('a customer sees only their project and complaints (no to-dos, no staff pages)', () => {
    expect(labels('CUSTOMER')).toEqual(['Projects', 'Complaints']);
  });

  it('every role has a landing page it can open', () => {
    for (const role of ROLE_NAMES) {
      const href = landingFor(role);
      expect(
        href === '/' ? ['ADMIN', 'HR'].includes(role) : navFor(role).some((i) => i.href === href),
      ).toBe(true);
    }
  });

  it('only the Admin gets Settings; nothing is listed twice', () => {
    expect(NAV.find((i) => i.href === '/settings')?.roles).toEqual(['ADMIN']);
    expect(new Set(NAV.map((i) => i.href)).size).toBe(NAV.length);
  });

  it('marks the active item (the dashboard only on an exact match)', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/', '/leads')).toBe(false);
    expect(isActive('/leads', '/leads/abc')).toBe(true);
    expect(isActive('/leads', '/leadsx')).toBe(false);
  });
});

describe('notification deep links (docs/05-design/api-map.md §10)', () => {
  it('routes every kind of reference', () => {
    expect(refHref({ kind: 'LEAD', id: 'l1' })).toBe('/leads/l1');
    expect(refHref({ kind: 'PROPOSAL', id: 'p1' })).toBe('/proposals/p1');
    expect(refHref({ kind: 'COMPLAINT', id: 'c1', projectId: 'pr' })).toBe('/complaints/c1');
    expect(refHref({ kind: 'PROJECT', id: 'pr1' })).toBe('/projects/pr1');
    expect(refHref({ kind: 'PROJECT', id: 'pr1', postId: 'po1' })).toBe('/projects/pr1?post=po1');
    expect(refHref({ kind: 'PROJECT', id: 'pr1', fileId: 'f1' })).toBe(
      '/projects/pr1?file=f1&tab=docs',
    );
    expect(refHref({ kind: 'TODO', id: 't1', projectId: 'pr1' })).toBe(
      '/projects/pr1?tab=todos&todo=t1',
    );
    expect(refHref({ kind: 'TODO', id: 't1' })).toBe('/todos');
    expect(refHref(null)).toBe('/');
  });

  it('groups notification types for their icon', () => {
    expect(groupOf('PROPOSAL_SEEN')).toBe('proposal');
    expect(groupOf('COMPLAINT_OVERDUE')).toBe('complaint');
    expect(groupOf('TODO_ASSIGNED')).toBe('todo');
    expect(groupOf('FILE_SHARED')).toBe('file');
    expect(groupOf('PROJECT_POST')).toBe('project');
    expect(groupOf('LEAD_ASSIGNED')).toBe('lead');
  });
});
