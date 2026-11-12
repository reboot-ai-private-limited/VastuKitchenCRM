import type React from 'react';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProposalDto, ProposalStatus } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, radius, space, type Tone } from '@/constants/theme';
import { NetworkError } from '@/lib/api/client';
import { formatINR, timeAgo } from '@/lib/format';
import { useProposalsList } from './use-proposals';

function statusBadge(p: ProposalDto): { label: string; tone: Tone } {
  if (p.status === 'DRAFT') return { label: 'Draft', tone: 'neutral' };
  if (p.seenCount > 0) return { label: `Seen · ${p.seenCount}x`, tone: 'accent' };
  return { label: 'Sent · Unseen', tone: 'info' };
}

function ProposalRow({ proposal, index }: { proposal: ProposalDto; index: number }) {
  const router = useRouter();
  const badge = statusBadge(proposal);

  return (
    <Reveal index={index}>
      <PressableScale
        onPress={() =>
          router.push({ pathname: '/proposals/[id]', params: { id: proposal.id } } as Href)
        }
        scaleTo={0.98}
      >
        <Card style={{ gap: space[2] }}>
          <View style={styles.row}>
            <Text variant="section" numberOfLines={1} style={{ flex: 1 }}>
              {proposal.customer.name}
            </Text>
            <Text variant="section" style={{ fontVariant: ['tabular-nums'] }}>
              {formatINR(proposal.total)}
            </Text>
          </View>
          <Text variant="caption" muted numberOfLines={1}>
            {proposal.number} · {proposal.title}
          </Text>
          <View style={styles.row}>
            <Badge label={badge.label} t={badge.tone} />
            <Text variant="caption" muted style={{ marginLeft: 'auto' }}>
              {proposal.sentAt ? `Sent ${timeAgo(proposal.sentAt)}` : `Created ${timeAgo(proposal.createdAt)}`}
            </Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </View>
        </Card>
      </PressableScale>
    </Reveal>
  );
}

export function ProposalsScreen() {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<ProposalStatus | undefined>();
  const q = useProposalsList(status);

  const header = (
    <View style={{ gap: space[2], paddingBottom: space[1] }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
        {([undefined, 'SENT', 'DRAFT'] as const).map((s) => {
          const active = s === status;
          const label = s === 'SENT' ? 'Sent' : s === 'DRAFT' ? 'Drafts' : 'All';
          return (
            <PressableScale
              key={s ?? 'all'}
              onPress={() => setStatus(s)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text variant="caption" color={active ? colors.primaryForeground : colors.mutedForeground}>
                {label}
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
    empty = <EmptyState icon="file-text" message="No proposals found." />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Proposals',
          headerShadowVisible: false,
          headerTintColor: colors.primary,
        }}
      />
      <FlatList
        style={styles.root}
        contentContainerStyle={{
          padding: space[4],
          paddingBottom: insets.bottom + space[8],
          gap: space[3],
        }}
        data={q.data ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item, index }) => <ProposalRow proposal={item} index={index} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
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
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
