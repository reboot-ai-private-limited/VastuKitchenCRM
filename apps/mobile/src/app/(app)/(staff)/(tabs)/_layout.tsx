import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuietTabButton } from '@/components/ui/quiet-tab-button';
import {
  HOME_TAB_META,
  isStaffRole,
  STAFF_PRIMARY_TABS,
  type StaffTabKey,
} from '@/constants/roles';
import { colors, font } from '@/constants/theme';
import { useUnreadCount } from '@/features/alerts/use-notifications';
import { useSession } from '@/lib/auth/session';

const CONTENT_TABS: {
  key: StaffTabKey;
  name: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { key: 'home', name: 'home', title: 'Today', icon: 'sun' },
  { key: 'projects', name: 'projects', title: 'Projects', icon: 'layers' },
  { key: 'leads', name: 'leads', title: 'Leads', icon: 'phone-call' },
  { key: 'customers', name: 'customers', title: 'Customers', icon: 'users' },
  { key: 'todos', name: 'todos', title: 'To-dos', icon: 'check-square' },
  { key: 'complaints', name: 'complaints', title: 'Complaints', icon: 'alert-circle' },
  { key: 'team', name: 'team', title: 'Team', icon: 'briefcase' },
  { key: 'alerts', name: 'alerts', title: 'Alerts', icon: 'bell' },
];

function TabIcon({ name, color }: { name: keyof typeof Feather.glyphMap; color: string }) {
  return <Feather name={name} size={22} color={color} />;
}

export default function StaffTabsLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const unread = useUnreadCount().data;

  const staffRole = user && isStaffRole(user.role) ? user.role : 'ADMIN';
  const allowed = STAFF_PRIMARY_TABS[staffRole];
  const homeMeta = HOME_TAB_META[staffRole];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: QuietTabButton,
        animation: 'fade',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
      }}
    >
      {CONTENT_TABS.map((t) => {
        const title = t.key === 'home' ? homeMeta.title : t.title;
        const icon = t.key === 'home' ? homeMeta.icon : t.icon;
        return (
          <Tabs.Screen
            key={t.key}
            name={t.name}
            options={{
              title,
              tabBarBadge: t.key === 'alerts' && unread ? (unread > 99 ? '99+' : unread) : undefined,
              // Hidden tabs stay routable (More opens them); href: null would make them unreachable.
              tabBarButton: allowed.includes(t.key) ? QuietTabButton : () => null,
              tabBarItemStyle: allowed.includes(t.key) ? undefined : { display: 'none' },
              tabBarIcon: ({ color }) => <TabIcon name={icon} color={String(color)} />,
            }}
          />
        );
      })}

      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <TabIcon name="grid" color={String(color)} />,
        }}
      />
    </Tabs>
  );
}
