import type React from 'react';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComplaintDto, ComplaintStatus } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space } from '@/constants/theme';
import { NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { timeAgo } from '@/lib/format';
import { softTick } from '@/lib/haptics';
import { STATUS_LABEL, STATUS_ORDER, STATUS_TONE } from './complaint-meta';
import { useComplaintsList } from './use-complaints';

export function ComplaintRow({ c, flat = false }: { c: ComplaintDto; flat?: boolean }) {
  const router = useRouter();
  const muted = c.status === 'CLOSED';
  const inner = (
    <View style={{ gap: 4 }}>
      <View style={styles.row}>
        <Text
          color={muted ? colors.inkMuted : colors.inkDeep}
          numberOfLines={1}
          style={styles.projectName}
        >
          {c.projectName}
        </Text>
        <Badge label={STATUS_LABEL[c.status]} t={STATUS_TONE[c.status]} />
        <Feather name="chevron-right" size={16} color={colors.inkMuted} />
      </View>
      <Text
        color={muted ? colors.inkMuted : colors.inkDeep}
        numberOfLines={2}
        style={styles.desc}
      >
        {c.description}
      </Text>
      <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
        {c.customer.name} · {timeAgo(c.createdAt)}
        {c.assignedTo ? ` · ${c.assignedTo.name}` : ''}
      </Text>
    </View>
  );

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/complaints/[id]', params: { id: c.id } } as Href)}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={`${c.projectName}, ${STATUS_LABEL[c.status]}. ${c.description}`}
      style={flat ? styles.flatRow : undefined}
    >
      {flat ? inner : <Card style={{ gap: space[2] }}>{inner}</Card>}
    </PressableScale>
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

  let body: React.ReactElement | undefined;
  if (q.isPending) {
    body = (
      <View>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.flatRow, i > 0 && styles.divider]}>
            <Skeleton height={18} width="55%" />
            <Skeleton height={14} width="85%" />
            <Skeleton height={13} width="45%" />
          </View>
        ))}
      </View>
    );
  } else if (q.isError) {
    body = (
      <View style={styles.errorWrap}>
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
    <View style={styles.root}>
      <View style={[styles.stickyHeader, { paddingTop: insets.top + space[4] }]}>
        <View style={styles.headerRow}>
          <Text variant="title" color={colors.inkDeep}>
            Complaints
          </Text>
          {canRaise ? (
            <Button
              title="+ Raise"
              size="sm"
              onPress={() => router.push('/complaints/new' as Href)}
            />
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTrack}
        >
          {[undefined, ...STATUS_ORDER].map((s) => {
            const active = s === status;
            return (
              <PressableScale
                key={s ?? 'all'}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  if (!active) softTick();
                  setStatus(s);
                }}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Text
                  variant="caption"
                  color={active ? colors.primaryForeground : colors.inkMuted}
                  style={active ? styles.pillTextActive : styles.pillText}
                >
                  {s ? STATUS_LABEL[s] : 'All'}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={q.data ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <ComplaintRow c={item} flat />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={body}
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <View style={{ padding: space[4] }}>
              <Skeleton height={56} />
            </View>
          ) : undefined
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + space[8] }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card },
  stickyHeader: {
    backgroundColor: colors.card,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    gap: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterTrack: { gap: space[2] },
  pill: {
    minHeight: 34,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.primary },
  pillText: { fontFamily: font.medium },
  pillTextActive: { fontFamily: font.semibold },
  flatRow: {
    backgroundColor: colors.card,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: hit,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  projectName: { flex: 1, fontSize: 16, lineHeight: 22, fontFamily: font.semibold },
  desc: { fontSize: 14, lineHeight: 20 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: space[4],
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  errorWrap: {
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[8],
    paddingHorizontal: space[4],
  },
});
