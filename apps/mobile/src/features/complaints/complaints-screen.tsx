import type React from 'react';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComplaintDto, ComplaintStatus } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, radius, space } from '@/constants/theme';
import { NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { timeAgo } from '@/lib/format';
import { STATUS_LABEL, STATUS_ORDER, STATUS_TONE } from './complaint-meta';
import { useComplaintsList } from './use-complaints';

export function ComplaintRow({ c }: { c: ComplaintDto }) {
  const router = useRouter();
  return (
    <Reveal>
      <PressableScale
        onPress={() => router.push({ pathname: '/complaints/[id]', params: { id: c.id } } as Href)}
      >
        <Card style={{ gap: space[2] }}>
          <View style={styles.row}>
            <Text variant="section" numberOfLines={1} style={{ flex: 1 }}>
              {c.projectName}
            </Text>
            <Badge label={STATUS_LABEL[c.status]} t={STATUS_TONE[c.status]} />
          </View>
          <Text numberOfLines={2}>{c.description}</Text>
          <Text variant="caption" muted>
            {c.customer.name} · {timeAgo(c.createdAt)}
            {c.assignedTo ? ` · ${c.assignedTo.name}` : ''}
          </Text>
        </Card>
      </PressableScale>
    </Reveal>
  );
}

export function ComplaintsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const [status, setStatus] = useState<ComplaintStatus | undefined>();
  const q = useComplaintsList(status);

  const canRaise =
    user?.role === 'ADMIN' ||
    user?.role === 'OFFICE' ||
    user?.role === 'SALES' ||
    user?.role === 'DESIGNER' ||
    user?.role === 'CUSTOMER';

  const header = (
    <View style={{ gap: space[3], paddingBottom: space[2] }}>
      <View style={styles.headerRow}>
        <Text variant="title">Complaints</Text>
        {canRaise ? (
          <Button
            title="+ Raise"
            size="sm"
            onPress={() => router.push('/complaints/new' as Href)}
          />
        ) : null}
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
        {[0, 1, 2].map((i) => (
          <Card key={i} style={{ gap: space[2] }}>
            <Skeleton height={18} width="55%" />
            <Skeleton width="85%" />
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
    body = <EmptyState icon="check-circle" message="No complaints here." />;
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + space[4],
        paddingHorizontal: space[4],
        paddingBottom: insets.bottom + space[8],
        gap: space[3],
      }}
      data={q.data ?? []}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <ComplaintRow c={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={body}
      ListFooterComponent={q.isFetchingNextPage ? <Skeleton height={80} /> : undefined}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
      onEndReachedThreshold={0.5}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
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
