import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ListRow } from '@/components/ui/list-row';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { moreGroupsForUser, ROLE_LABEL } from '@/constants/roles';
import { colors, font, radius, space } from '@/constants/theme';
import { useConfirmSignOut } from '@/lib/auth/sign-out';
import { useSession } from '@/lib/auth/session';
import { formatPhone } from '@/lib/format';
import { moreSheet, useMoreSheetOpen } from './more-store';

export function MoreMenuContent({ onNavigate }: { onNavigate?: () => void }) {
  const confirmSignOut = useConfirmSignOut();
  const { user } = useSession();
  const router = useRouter();
  const groups = moreGroupsForUser(user);

  const go = (href: Href) => {
    onNavigate?.();
    router.push(href);
  };

  if (!user) return null;

  const roleLabel = user.designation ?? ROLE_LABEL[user.role];

  return (
    <View style={styles.container}>
      <PressableScale
        onPress={() => go('/profile' as Href)}
        accessibilityRole="button"
        accessibilityLabel={`${user.name}, ${roleLabel}, open account settings`}
        style={styles.accountCard}
      >
        <Avatar name={user.name} size={40} accent />
        <View style={{ flex: 1, gap: 2 }}>
          <Text color={colors.inkDeep} numberOfLines={1} style={styles.accountName}>
            {user.name}
          </Text>
          <Text variant="caption" color={colors.inkMuted} style={styles.tabular}>
            {formatPhone(user.phone)}
          </Text>
        </View>
        <Badge label={roleLabel} t="neutral" />
        <Feather name="chevron-right" size={16} color={colors.inkMuted} />
      </PressableScale>

      {groups.map((group) => (
        <View key={group.key} style={styles.section}>
          <Text variant="caption" color={colors.inkMuted} style={styles.sectionTitle}>
            {group.title}
          </Text>
          <View style={styles.group}>
            {group.items.map((item, idx) => (
              <ListRow
                key={item.key}
                icon={item.icon}
                title={item.title}
                subtitle={item.subtitle}
                divider={idx < group.items.length - 1}
                onPress={() => go(item.href)}
              />
            ))}
          </View>
        </View>
      ))}

      <View style={[styles.group, styles.signOutGroup]}>
        <ListRow
          icon="log-out"
          title="Sign out"
          destructive
          onPress={() => confirmSignOut(onNavigate)}
        />
      </View>
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
  container: {
    gap: space[4],
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.pageSoft,
  },
  accountName: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: font.semibold,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  section: {
    gap: space[1],
  },
  sectionTitle: {
    fontFamily: font.semibold,
    paddingHorizontal: 2,
  },
  group: {
    backgroundColor: colors.pageSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingHorizontal: space[3],
  },
  signOutGroup: {
    marginTop: space[1],
  },
});
