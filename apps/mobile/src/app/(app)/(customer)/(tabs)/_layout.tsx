import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { PillTabBar } from '@/components/ui/pill-tab-bar';

function TabIcon({ name, color }: { name: keyof typeof Feather.glyphMap; color: string }) {
  return <Feather name={name} size={22} color={color} />;
}

/**
 * Customer 3-tab shell: Project · Docs · Complaints (01-personas-and-navigation.md §1 & §2.7).
 * Uses `customer-complaints` as the file segment so Expo Router URL patterns stay 100% unique.
 */
export default function CustomerTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'fade' }}
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
