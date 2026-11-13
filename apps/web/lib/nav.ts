import {
  BadgeCheck,
  CalendarCheck,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Boxes,
  Contact,
  LifeBuoy,
  MessageCircle,
  ListChecks,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { RoleName } from '@vastu/contracts';

/** Sidebar sections, in display order. 'Overview' has no heading. */
export const NAV_GROUPS = ['Overview', 'Sales', 'Operations', 'HR', 'Admin'] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly RoleName[];
  group: NavGroup;
}

const STAFF_EXCEPT_HR: readonly RoleName[] = ['ADMIN', 'SALES', 'DESIGNER', 'TECHNICIAN', 'OFFICE'];

/** What each role sees in the sidebar (docs/05-design/layout-and-navigation.md). Cosmetic only: the API enforces access. */
export const NAV: readonly NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'HR'], group: 'Overview' },
  {
    href: '/leads',
    label: 'Leads',
    icon: Users,
    roles: ['ADMIN', 'SALES', 'OFFICE'],
    group: 'Sales',
  },
  {
    href: '/proposals',
    label: 'Proposals',
    icon: FileText,
    roles: ['ADMIN', 'SALES'],
    group: 'Sales',
  },
  {
    href: '/customers',
    label: 'Customers',
    icon: Contact,
    roles: ['ADMIN', 'SALES', 'OFFICE'],
    group: 'Sales',
  },
  {
    href: '/whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    roles: ['ADMIN', 'SALES', 'OFFICE'],
    group: 'Sales',
  },
  {
    href: '/projects',
    label: 'Projects',
    icon: FolderKanban,
    roles: ['ADMIN', 'SALES', 'DESIGNER', 'TECHNICIAN', 'OFFICE', 'CUSTOMER'],
    group: 'Operations',
  },
  { href: '/todos', label: 'To-dos', icon: ListChecks, roles: STAFF_EXCEPT_HR, group: 'Operations' },
  {
    href: '/complaints',
    label: 'Complaints',
    icon: LifeBuoy,
    roles: ['ADMIN', 'SALES', 'DESIGNER', 'TECHNICIAN', 'OFFICE', 'CUSTOMER'],
    group: 'Operations',
  },
  { href: '/stocks', label: 'Stocks', icon: Boxes, roles: ['ADMIN', 'OFFICE'], group: 'Operations' },
  {
    href: '/attendance',
    label: 'Attendance',
    icon: CalendarCheck,
    roles: ['ADMIN', 'HR', 'SALES', 'DESIGNER', 'TECHNICIAN', 'OFFICE'],
    group: 'HR',
  },
  {
    href: '/employees',
    label: 'Employees',
    icon: BadgeCheck,
    roles: ['ADMIN', 'HR'],
    group: 'HR',
  },
  { href: '/salary', label: 'Salary', icon: Wallet, roles: ['ADMIN', 'HR'], group: 'HR' },
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
