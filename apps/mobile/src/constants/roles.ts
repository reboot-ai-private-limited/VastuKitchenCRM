import type { Feather } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import type { RoleName, StaffRole, UserDto } from '@vastu/contracts';
import type { Tone } from './theme';

export type StaffTabKey =
  | 'home'
  | 'projects'
  | 'leads'
  | 'customers'
  | 'todos'
  | 'complaints'
  | 'team'
  | 'alerts';

export type MoreItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  tone: Tone;
  href: Href;
};

export const ROLE_LABEL: Record<RoleName, string> = {
  ADMIN: 'Admin',
  HR: 'HR',
  SALES: 'Sales',
  DESIGNER: 'Designer',
  TECHNICIAN: 'Technician',
  OFFICE: 'Office',
  CUSTOMER: 'Customer',
};

/** Home tab label per staff role (01-personas-and-navigation.md §1). */
export const HOME_TAB_META: Record<StaffRole, { title: string; icon: keyof typeof Feather.glyphMap }> = {
  ADMIN: { title: 'Glance', icon: 'pie-chart' },
  HR: { title: 'Board', icon: 'calendar' },
  SALES: { title: 'Today', icon: 'sun' },
  DESIGNER: { title: 'Today', icon: 'sun' },
  TECHNICIAN: { title: 'Today', icon: 'sun' },
  OFFICE: { title: 'Today', icon: 'sun' },
};

/** Primary bottom tabs per staff role (max 4; 'More' is added as slot 5). */
export const STAFF_PRIMARY_TABS: Record<StaffRole, StaffTabKey[]> = {
  ADMIN: ['home', 'projects', 'leads', 'alerts'],
  HR: ['home', 'team', 'alerts'],
  SALES: ['home', 'leads', 'projects', 'alerts'],
  DESIGNER: ['home', 'projects', 'todos', 'alerts'],
  TECHNICIAN: ['home', 'projects', 'complaints', 'alerts'],
  OFFICE: ['home', 'leads', 'customers', 'alerts'],
};

export function isStaffRole(role: RoleName): role is StaffRole {
  return role !== 'CUSTOMER';
}

export function landingHrefForRole(role: RoleName): Href {
  return (role === 'CUSTOMER' ? '/project' : '/home') as Href;
}

const ITEM_CATALOG = {
  proposals: {
    key: 'proposals',
    title: 'Proposals',
    subtitle: 'Sent quotes, seen tracking and links',
    icon: 'file-text',
    tone: 'info',
    href: '/proposals' as Href,
  },
  customers: {
    key: 'customers',
    title: 'Customers',
    subtitle: 'Accounts, projects and invites',
    icon: 'users',
    tone: 'accent',
    href: '/customers' as Href,
  },
  projects: {
    key: 'projects',
    title: 'Projects',
    subtitle: 'Active kitchen workspaces',
    icon: 'layers',
    tone: 'violet',
    href: '/projects' as Href,
  },
  todos: {
    key: 'todos',
    title: 'To-dos',
    subtitle: 'My tasks grouped by due date',
    icon: 'check-square',
    tone: 'warning',
    href: '/todos' as Href,
  },
  complaints: {
    key: 'complaints',
    title: 'Complaints',
    subtitle: 'Service tickets and resolutions',
    icon: 'alert-circle',
    tone: 'orange',
    href: '/complaints' as Href,
  },
  attendanceBoard: {
    key: 'attendance-board',
    title: 'Attendance board',
    subtitle: 'Who is present, absent or missing check-out',
    icon: 'calendar',
    tone: 'success',
    href: '/attendance/board' as Href,
  },
  myAttendance: {
    key: 'my-attendance',
    title: 'My attendance',
    subtitle: 'Check-in status and monthly calendar',
    icon: 'map-pin',
    tone: 'success',
    href: '/attendance' as Href,
  },
  team: {
    key: 'team',
    title: 'Team',
    subtitle: 'Staff directory with tap to call',
    icon: 'briefcase',
    tone: 'info',
    href: '/team' as Href,
  },
  profile: {
    key: 'profile',
    title: 'Profile & account',
    subtitle: 'Password, language and account settings',
    icon: 'user',
    tone: 'neutral',
    href: '/profile' as Href,
  },
} satisfies Record<string, MoreItem>;

/** Exact "In More" list per staff persona (01-personas-and-navigation.md §1). */
export function moreItemsForUser(user: UserDto | null): MoreItem[] {
  if (!user || !isStaffRole(user.role)) return [];
  const hasAttendance = user.attendanceType !== null;
  const out: MoreItem[] = [];

  switch (user.role) {
    case 'ADMIN':
      out.push(
        ITEM_CATALOG.proposals,
        ITEM_CATALOG.customers,
        ITEM_CATALOG.todos,
        ITEM_CATALOG.complaints,
        ITEM_CATALOG.attendanceBoard,
        ITEM_CATALOG.team,
      );
      break;
    case 'HR':
      break;
    case 'SALES':
      out.push(
        ITEM_CATALOG.proposals,
        ITEM_CATALOG.customers,
        ITEM_CATALOG.todos,
        ITEM_CATALOG.complaints,
      );
      break;
    case 'DESIGNER':
      out.push(ITEM_CATALOG.complaints);
      break;
    case 'TECHNICIAN':
      out.push(ITEM_CATALOG.todos);
      break;
    case 'OFFICE':
      out.push(ITEM_CATALOG.projects, ITEM_CATALOG.todos, ITEM_CATALOG.complaints);
      break;
  }

  if (hasAttendance) {
    out.push(ITEM_CATALOG.myAttendance);
  }
  out.push(ITEM_CATALOG.profile);
  return out;
}
