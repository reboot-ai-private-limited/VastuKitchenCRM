import type React from 'react';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LeadDto, LeadStatus } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { STATUS_LABEL, STATUS_ORDER, STATUS_TONE } from './lead-meta';
import { useLeadsList } from './use-leads';

function LeadRow({ lead, index }: { lead: LeadDto; index: number }) {
  const router = useRouter();
  return (
    <Reveal index={index}>
      <PressableScale
        onPress={() => router.push({ pathname: '/leads/[id]', params: { id: lead.id } } as Href)}
        scaleTo={0.98}
      >
        <Card style={{ gap: space[2] }}>
          <View style={styles.rowTop}>
            <Text variant="section" numberOfLines={1} style={{ flex: 1 }}>
              {lead.name}
            </Text>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </View>
          <Text muted style={{ fontVariant: ['tabular-nums'] }}>
            {lead.phone}
            {lead.city ? `  ·  ${lead.city}` : ''}
          </Text>
          <View style={styles.rowTop}>
            <Badge label={STATUS_LABEL[lead.status]} t={STATUS_TONE[lead.status]} />
            {lead.isStuck ? <Badge label="Stuck" t="danger" /> : null}
          </View>
        </Card>
      </PressableScale>
    </Reveal>
  );
}

export function LeadsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LeadStatus | undefined>();
  const q = useLeadsList(search.trim(), status);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'SALES' || user?.role === 'OFFICE';

  const header = (
    <View style={{ gap: space[3], paddingBottom: space[2] }}>
      <View style={styles.headerRow}>
        <Text variant="title">Leads</Text>
        {canCreate ? (
          <Button
            title={user?.role === 'OFFICE' ? '+ Walk-in' : '+ Add'}
            size="sm"
            onPress={() => router.push('/leads/new' as Href)}
          />
        ) : null}
      </View>
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
        {[undefined, ...STATUS_ORDER].map((s) => {
          const active = s === status;
          return (
            <PressableScale
              key={s ?? 'all'}
              onPress={() => setStatus(s)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text variant="caption" color={active ? colors.primaryForeground : colors.mutedForeground}>
                {s ? STATUS_LABEL[s] : 'All'}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );

  let body: React.ReactElement | undefined;
  if (q.isPending) {
    body = (
      <View style={{ gap: space[3] }}>
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} style={{ gap: space[2] }}>
            <Skeleton height={18} width="55%" />
            <Skeleton width="40%" />
            <Skeleton height={20} width={90} />
          </Card>
        ))}
      </View>
    );
  } else if (q.isError) {
    body = (
      <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[8] }}>
        <Text muted style={{ textAlign: 'center' }}>
          {q.error instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : q.error.message}
        </Text>
        <Button title="Retry" variant="outline" onPress={() => void q.refetch()} />
      </View>
    );
  } else if (q.data.length === 0) {
    body = <EmptyState icon="phone-call" message="No leads found." />;
  }

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + space[4],
        paddingHorizontal: space[4],
        paddingBottom: space[8],
        gap: space[3],
      }}
      data={q.data ?? []}
      keyExtractor={(l) => l.id}
      renderItem={({ item, index }) => <LeadRow lead={item} index={index} />}
      ListHeaderComponent={header}
      ListEmptyComponent={body}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
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
