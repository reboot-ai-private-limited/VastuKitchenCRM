import {
  BadgeCheck,
  CalendarCheck,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Boxes,
  Contact,
  LifeBuoy,
  ListChecks,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { RoleName } from '@vastu/contracts';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly RoleName[];
  group: 'Work' | 'People' | 'Admin';
}

const STAFF_EXCEPT_HR: readonly RoleName[] = ['ADMIN', 'SALES', 'DESIGNER', 'TECHNICIAN', 'OFFICE'];

/** What each role sees in the sidebar (docs/05-design/layout-and-navigation.md). Cosmetic only: the API enforces access. */
export const NAV: readonly NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'HR'], group: 'Work' },
  {
    href: '/leads',
    label: 'Leads',
    icon: Users,
    roles: ['ADMIN', 'SALES', 'OFFICE'],
    group: 'Work',
  },
  {
    href: '/proposals',
    label: 'Proposals',
    icon: FileText,
    roles: ['ADMIN', 'SALES'],
    group: 'Work',
  },
  {
    href: '/customers',
    label: 'Customers',
    icon: Contact,
    roles: ['ADMIN', 'SALES', 'OFFICE'],
    group: 'Work',
  },
  {
    href: '/projects',
    label: 'Projects',
    icon: FolderKanban,
    roles: ['ADMIN', 'SALES', 'DESIGNER', 'TECHNICIAN', 'OFFICE', 'CUSTOMER'],
    group: 'Work',
  },
  { href: '/todos', label: 'To-dos', icon: ListChecks, roles: STAFF_EXCEPT_HR, group: 'Work' },
  {
    href: '/complaints',
    label: 'Complaints',
    icon: LifeBuoy,
    roles: ['ADMIN', 'SALES', 'DESIGNER', 'TECHNICIAN', 'OFFICE', 'CUSTOMER'],
    group: 'Work',
  },
  { href: '/stocks', label: 'Stocks', icon: Boxes, roles: ['ADMIN', 'OFFICE'], group: 'Work' },
  {
    href: '/attendance',
    label: 'Attendance',
    icon: CalendarCheck,
    roles: ['ADMIN', 'HR', 'SALES', 'DESIGNER', 'TECHNICIAN', 'OFFICE'],
    group: 'People',
  },
  {
    href: '/employees',
    label: 'Employees',
    icon: BadgeCheck,
    roles: ['ADMIN', 'HR'],
    group: 'People',
  },
  { href: '/salary', label: 'Salary', icon: Wallet, roles: ['ADMIN', 'HR'], group: 'People' },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'], group: 'Admin' },
];

export const navFor = (role: RoleName): NavItem[] => NAV.filter((i) => i.roles.includes(role));

/** Where each role lands after signing in. */
export function landingFor(role: RoleName): string {
  switch (role) {
    case 'ADMIN':
    case 'HR': // the dashboard IS HR's attendance overview
      return '/';
    case 'SALES':
      return '/leads';
    case 'TECHNICIAN':
      return '/complaints';
    default:
      return '/projects'; // designer, office, customer
  }
}

/** Is `href` the page the user is on (the dashboard only matches exactly)? */
export const isActive = (href: string, pathname: string): boolean =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
