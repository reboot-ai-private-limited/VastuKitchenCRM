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
  subtitle?: string;
  icon: keyof typeof Feather.glyphMap;
  tone: Tone;
  href: Href;
};

export type MoreGroup = {
  key: string;
  title: string;
  items: MoreItem[];
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
  ADMIN: { title: 'Home', icon: 'home' },
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
    icon: 'file-text',
    tone: 'neutral',
    href: '/proposals' as Href,
  },
  customers: {
    key: 'customers',
    title: 'Customers',
    icon: 'users',
    tone: 'neutral',
    href: '/customers' as Href,
  },
  projects: {
    key: 'projects',
    title: 'Projects',
    icon: 'layers',
    tone: 'neutral',
    href: '/projects' as Href,
  },
  leads: {
    key: 'leads',
    title: 'Leads',
    icon: 'phone-call',
    tone: 'neutral',
    href: '/leads' as Href,
  },
  todos: {
    key: 'todos',
    title: 'To-dos',
    icon: 'check-square',
    tone: 'neutral',
    href: '/todos' as Href,
  },
  complaints: {
    key: 'complaints',
    title: 'Complaints',
    icon: 'alert-circle',
    tone: 'neutral',
    href: '/complaints' as Href,
  },
  attendanceBoard: {
    key: 'attendance-board',
    title: 'Attendance board',
    subtitle: 'Team check-ins and absences',
    icon: 'calendar',
    tone: 'neutral',
    href: '/attendance/board' as Href,
  },
  myAttendance: {
    key: 'my-attendance',
    title: 'My attendance',
    subtitle: 'Your check-ins and monthly log',
    icon: 'map-pin',
    tone: 'neutral',
    href: '/attendance' as Href,
  },
  team: {
    key: 'team',
    title: 'Team',
    icon: 'briefcase',
    tone: 'neutral',
    href: '/team' as Href,
  },
} satisfies Record<string, MoreItem>;

/** Grouped "In More" destinations per staff persona (profile is accessed via the top account card). */
export function moreGroupsForUser(user: UserDto | null): MoreGroup[] {
  if (!user || !isStaffRole(user.role)) return [];
  const hasAttendance = user.attendanceType !== null;
  const work: MoreItem[] = [];
  const people: MoreItem[] = [];

  switch (user.role) {
    case 'ADMIN':
      work.push(
        ITEM_CATALOG.proposals,
        ITEM_CATALOG.customers,
        ITEM_CATALOG.todos,
        ITEM_CATALOG.complaints,
      );
      people.push(ITEM_CATALOG.attendanceBoard, ITEM_CATALOG.team);
      break;
    case 'HR':
      break;
    case 'SALES':
      work.push(
        ITEM_CATALOG.proposals,
        ITEM_CATALOG.customers,
        ITEM_CATALOG.todos,
        ITEM_CATALOG.complaints,
      );
      break;
    case 'DESIGNER':
      work.push(ITEM_CATALOG.leads, ITEM_CATALOG.complaints);
      break;
    case 'TECHNICIAN':
      work.push(ITEM_CATALOG.todos);
      break;
    case 'OFFICE':
      work.push(ITEM_CATALOG.projects, ITEM_CATALOG.todos, ITEM_CATALOG.complaints);
      break;
  }

  if (hasAttendance) {
    people.push(ITEM_CATALOG.myAttendance);
  }

  const groups: MoreGroup[] = [];
  if (work.length > 0) groups.push({ key: 'work', title: 'Work', items: work });
  if (people.length > 0) groups.push({ key: 'people', title: 'People', items: people });
  return groups;
}

export function moreItemsForUser(user: UserDto | null): MoreItem[] {
  return moreGroupsForUser(user).flatMap((g) => g.items);
}
