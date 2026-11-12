import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { moreItemsForUser, ROLE_LABEL } from '@/constants/roles';
import { colors, space } from '@/constants/theme';
import { confirmSignOut } from '@/lib/auth/sign-out';
import { useSession } from '@/lib/auth/session';
import { formatPhone } from '@/lib/format';
import { moreSheet, useMoreSheetOpen } from './more-store';

export function MoreMenuContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useSession();
  const router = useRouter();
  const items = moreItemsForUser(user);

  const go = (href: Href) => {
    onNavigate?.();
    router.push(href);
  };

  if (!user) return null;

  return (
    <View style={{ gap: space[3] }}>
      <PressableScale onPress={() => go('/profile' as Href)}>
        <Card style={styles.userCard}>
          <Avatar name={user.name} size={40} accent />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="section" numberOfLines={1}>
              {user.name}
            </Text>
            <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
              {formatPhone(user.phone)}
            </Text>
          </View>
          <Badge label={user.designation ?? ROLE_LABEL[user.role]} t="accent" />
        </Card>
      </PressableScale>

      <Card style={{ paddingVertical: space[1] }}>
        {items.map((item, idx) => (
          <ListRow
            key={item.key}
            icon={item.icon}
            iconTone={item.tone}
            title={item.title}
            subtitle={item.subtitle}
            divider={idx < items.length - 1}
            onPress={() => go(item.href)}
          />
        ))}
      </Card>

      <Card style={{ paddingVertical: space[1] }}>
        <ListRow
          icon="log-out"
          title="Sign out"
          subtitle="Sign out of Vastu Kitchen on this phone"
          destructive
          onPress={() => confirmSignOut(onNavigate)}
        />
      </Card>
    </View>
  );
}

export function MoreSheet() {
  const visible = useMoreSheetOpen();
  return (
    <BottomSheet visible={visible} onClose={moreSheet.close} title="More">
      <MoreMenuContent onNavigate={moreSheet.close} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.muted,
  },
});
