import type React from 'react';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProposalDto, ProposalStatus } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RoleGate } from '@/components/ui/role-gate';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space, type Tone } from '@/constants/theme';
import { SlidingSwitch } from '@/features/projects/sliding-switch';
import { NetworkError } from '@/lib/api/client';
import { formatINR, timeAgo } from '@/lib/format';
import { softTick } from '@/lib/haptics';
import { useProposalsList } from './use-proposals';

function statusBadge(p: ProposalDto): { label: string; tone: Tone } {
  if (p.status === 'DRAFT') return { label: 'Draft', tone: 'neutral' };
  if (p.seenCount > 0) return { label: `Seen · ${p.seenCount}x`, tone: 'accent' };
  return { label: 'Sent · Unseen', tone: 'info' };
}

function ProposalRow({ proposal }: { proposal: ProposalDto }) {
  const router = useRouter();
  const badge = statusBadge(proposal);

  return (
    <PressableScale
      onPress={() =>
        router.push({ pathname: '/proposals/[id]', params: { id: proposal.id } } as Href)
      }
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={`${proposal.customer.name}, ${proposal.number}, ${formatINR(proposal.total)}, ${badge.label}`}
      style={styles.flatRow}
    >
      <View style={styles.row}>
        <Text color={colors.inkDeep} numberOfLines={1} style={styles.name}>
          {proposal.customer.name}
        </Text>
        <Text color={colors.inkDeep} style={styles.amount}>
          {formatINR(proposal.total)}
        </Text>
      </View>
      <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
        {proposal.number} · {proposal.title}
      </Text>
      <View style={styles.metaRow}>
        <Badge label={badge.label} t={badge.tone} />
        <Text variant="caption" color={colors.inkMuted} style={{ marginLeft: 'auto' }}>
          {proposal.sentAt ? `Sent ${timeAgo(proposal.sentAt)}` : `Created ${timeAgo(proposal.createdAt)}`}
        </Text>
        <Feather name="chevron-right" size={16} color={colors.inkMuted} />
      </View>
    </PressableScale>
  );
}

export function ProposalsScreen() {
  return (
    <RoleGate roles={['ADMIN', 'SALES']}>
      <ProposalsList />
    </RoleGate>
  );
}

function ProposalsList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { leadId: leadParam } = useLocalSearchParams<{ leadId?: string }>();
  const [leadId, setLeadId] = useState<string | undefined>(leadParam || undefined);
  const [status, setStatus] = useState<ProposalStatus | undefined>();
  const q = useProposalsList(status, leadId);

  let empty: React.ReactElement | undefined;
  if (q.isPending) {
    empty = (
      <View>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.flatRow, i > 0 && styles.divider]}>
            <Skeleton height={18} width="55%" />
            <Skeleton height={14} width="45%" />
            <Skeleton height={20} width={92} />
          </View>
        ))}
      </View>
    );
  } else if (q.isError) {
    empty = (
      <View style={styles.errorWrap}>
        <Text muted style={{ textAlign: 'center' }}>
          {q.error instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : q.error.message}
        </Text>
        <Button title="Retry" variant="outline" onPress={() => void q.refetch()} />
      </View>
    );
  } else {
    empty = <EmptyState icon="file-text" message="No proposals found." />;
  }

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Proposals',
          headerShadowVisible: false,
          headerTintColor: colors.primary,
          headerRight: () => (
            <Button
              title="New"
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: '/proposals/new',
                  params: leadId ? { leadId } : {},
                } as unknown as Href)
              }
            />
          ),
        }}
      />

      <View style={styles.stickyBar}>
        <SlidingSwitch
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'SENT', label: 'Sent' },
            { value: 'DRAFT', label: 'Drafts' },
          ]}
          value={status ?? 'ALL'}
          onChange={(next) => setStatus(next === 'ALL' ? undefined : next)}
          style={{ flex: 1, maxWidth: 280 }}
        />
        {leadId ? (
          <PressableScale
            onPress={() => {
              softTick();
              setLeadId(undefined);
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear lead filter"
            style={styles.leadFilterPill}
          >
            <Text variant="caption" color={colors.primaryPressed} style={{ fontFamily: font.semibold }}>
              Filtered to lead
            </Text>
            <Feather name="x" size={14} color={colors.primaryPressed} />
          </PressableScale>
        ) : null}
      </View>

      <FlatList
        data={q.data ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ProposalRow proposal={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={empty}
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
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingTop: space[1],
    paddingBottom: space[3],
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 3,
    gap: 2,
  },
  segment: {
    minHeight: 34,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontFamily: font.medium },
  segmentTextActive: { fontFamily: font.semibold },
  leadFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  flatRow: {
    backgroundColor: colors.card,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: 4,
    minHeight: hit,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  name: { flex: 1, fontSize: 16, lineHeight: 22, fontFamily: font.semibold },
  amount: { fontSize: 15, lineHeight: 22, fontFamily: font.semibold, fontVariant: ['tabular-nums'] },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingTop: 4 },
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
