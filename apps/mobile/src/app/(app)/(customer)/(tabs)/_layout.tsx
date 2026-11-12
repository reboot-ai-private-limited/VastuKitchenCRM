import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuietTabButton } from '@/components/ui/quiet-tab-button';
import { colors, font } from '@/constants/theme';

function TabIcon({ name, color }: { name: keyof typeof Feather.glyphMap; color: string }) {
  return <Feather name={name} size={22} color={color} />;
}

/**
 * Customer 3-tab shell: Project · Docs · Complaints (01-personas-and-navigation.md §1 & §2.7).
 * Uses `customer-complaints` as the file segment so Expo Router URL patterns stay 100% unique.
 */
export default function CustomerTabsLayout() {
  const insets = useSafeAreaInsets();

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
      <Tabs.Screen
        name="project"
        options={{
          title: 'Project',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="docs"
        options={{
          title: 'Docs',
          tabBarIcon: ({ color }) => <TabIcon name="folder" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="customer-complaints"
        options={{
          title: 'Complaints',
          tabBarIcon: ({ color }) => <TabIcon name="shield" color={String(color)} />,
        }}
      />
    </Tabs>
  );
}
