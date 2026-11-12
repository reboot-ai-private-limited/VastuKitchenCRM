import type React from 'react';
import { useState } from 'react';
import { FlatList, Linking, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { STAFF_ROLES, type StaffRole, type UserDto } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ROLE_LABEL } from '@/constants/roles';
import { colors, font, radius, space } from '@/constants/theme';
import { NetworkError } from '@/lib/api/client';
import { listUsers } from '@/lib/api/endpoints/users';
import { formatPhone } from '@/lib/format';

/** Read-only staff directory for Admin & HR. Never displays `fixedSalary` (00-principles-and-scope.md §5). */
function StaffCard({ member }: { member: UserDto }) {
  const digits = member.phone.replace(/\D/g, '').slice(-10);
  return (
    <Reveal>
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
          onPress={() => void Linking.openURL(`tel:${digits}`)}
        />
        <IconButton
          icon="message-circle"
          label={`WhatsApp ${member.name}`}
          onPress={() => void Linking.openURL(`https://wa.me/91${digits}`)}
        />
      </Card>
    </Reveal>
  );
}

export function TeamScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<StaffRole | undefined>();

  const q = useQuery({
    queryKey: ['users', 'team', { search: search.trim(), role }],
    queryFn: ({ signal }) =>
      listUsers({ page: 1, pageSize: 100, search: search.trim() || undefined, role, active: true }, signal),
    select: (d) => d.items.filter((u) => u.role !== 'CUSTOMER'),
  });

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
          style={styles.searchInput}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
        {[undefined, ...STAFF_ROLES].map((r) => {
          const active = r === role;
          return (
            <PressableScale
              key={r ?? 'all'}
              onPress={() => setRole(r)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text variant="caption" color={active ? colors.primaryForeground : colors.mutedForeground}>
                {r ? ROLE_LABEL[r] : 'All staff'}
              </Text>
            </PressableScale>
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
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
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
    height: 44,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
  },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 16, color: colors.foreground },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary },
});
