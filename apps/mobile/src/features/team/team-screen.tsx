import type React from 'react';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STAFF_ROLES, type StaffRole, type UserDto } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Chip } from '@/components/ui/chip';
import { RoleGate } from '@/components/ui/role-gate';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ROLE_LABEL } from '@/constants/roles';
import { colors, font, hit, radius, space } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { NetworkError } from '@/lib/api/client';
import { formatPhone } from '@/lib/format';
import { openLink, telUrl, whatsappUrlFor } from '@/lib/phone';
import { useTeam } from './use-team';

/** Read-only staff directory for Admin & HR. Never displays `fixedSalary` (00-principles-and-scope.md §5). */
function StaffCard({ member }: { member: UserDto }) {
  const router = useRouter();
  return (
    <Reveal>
      <PressableScale
        onPress={() =>
          router.push({ pathname: '/attendance/[userId]', params: { userId: member.id } } as Href)
        }
        scaleTo={0.98}
        accessibilityLabel={`${member.name}, view attendance`}
      >
      <Card style={styles.card}>
        <Avatar name={member.name} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" numberOfLines={1}>
            {member.name}
          </Text>
          <Text variant="caption" muted numberOfLines={1}>
            {member.designation ?? ROLE_LABEL[member.role]}
          </Text>
          <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
            {formatPhone(member.phone)}
          </Text>
        </View>
        <Badge label={ROLE_LABEL[member.role]} t="neutral" />
        <IconButton
          icon="phone"
          label={`Call ${member.name}`}
          onPress={() => void openLink(telUrl(member.phone))}
        />
        <IconButton
          icon="message-circle"
          label={`WhatsApp ${member.name}`}
          onPress={() => void openLink(whatsappUrlFor(member.phone))}
        />
      </Card>
      </PressableScale>
    </Reveal>
  );
}

export function TeamScreen() {
  return (
    <RoleGate roles={['ADMIN', 'HR']}>
      <TeamList />
    </RoleGate>
  );
}

function TeamList() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<StaffRole | undefined>();

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const q = useTeam(debouncedSearch, role);

  const header = (
    <View style={{ gap: space[3], paddingBottom: space[2] }}>
      <Text variant="title">Team</Text>
      <View style={styles.search}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or phone"
          placeholderTextColor={colors.placeholder}
          returnKeyType="search"
          accessibilityLabel="Search team"
          style={styles.searchInput}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
        {[undefined, ...STAFF_ROLES].map((r) => {
          const active = r === role;
          return (
            <Chip key={r ?? 'all'} label={r ? ROLE_LABEL[r] : 'All staff'} active={active} onPress={() => setRole(r)} />
          );
        })}
      </ScrollView>
    </View>
  );

  let empty: React.ReactElement | undefined;
  if (q.isPending) {
    empty = (
      <View style={{ gap: space[3] }}>
        {[0, 1, 2].map((i) => (
          <Card key={i} style={{ gap: space[2] }}>
            <Skeleton height={18} width="55%" />
            <Skeleton width="40%" />
          </Card>
        ))}
      </View>
    );
  } else if (q.isError) {
    empty = (
      <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[8] }}>
        <Text muted style={{ textAlign: 'center' }}>
          {q.error instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : q.error.message}
        </Text>
        <Button title="Retry" variant="outline" onPress={() => void q.refetch()} />
      </View>
    );
  } else {
    empty = <EmptyState icon="briefcase" message="No team members found." />;
  }

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + space[4],
        paddingHorizontal: space[4],
        paddingBottom: insets.bottom + space[8],
        gap: space[3],
      }}
      data={q.data ?? []}
      keyExtractor={(u) => u.id}
      renderItem={({ item }) => <StaffCard member={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={q.isFetchingNextPage ? <Skeleton height={80} /> : undefined}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
      onEndReachedThreshold={0.5}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching && !q.isFetchingNextPage}
          onRefresh={() => void q.refetch()}
          tintColor={colors.primary}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    height: hit,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
  },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 16, color: colors.foreground },
});
