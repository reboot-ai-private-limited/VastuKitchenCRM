import type React from 'react';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LeadDto, LeadStatus } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space, tone } from '@/constants/theme';
import { SheetRow } from '@/features/projects/sheet-row';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { softTick } from '@/lib/haptics';
import { PendingSyncBadge } from '@/offline';
import { daysInStage, STATUS_LABEL, STATUS_ORDER, STATUS_TONE } from './lead-meta';
import { leadKey, useLeadsList } from './use-leads';

function stuckLabel(statusChangedAt: string): string {
  const days = daysInStage(statusChangedAt);
  if (days == null || days < 1) return 'Stuck';
  return `Stuck · ${days} ${days === 1 ? 'day' : 'days'} in stage`;
}

function LeadRow({ lead }: { lead: LeadDto }) {
  const router = useRouter();
  const isMutedOutcome = lead.status === 'LOST' || lead.status === 'INVALID_DATA';

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/leads/[id]', params: { id: lead.id } } as Href)}
      scaleTo={0.99}
      accessibilityRole="button"
      style={styles.leadRow}
    >
      <View style={styles.rowTop}>
        <Text
          color={isMutedOutcome ? colors.inkMuted : colors.inkDeep}
          numberOfLines={1}
          style={styles.leadName}
        >
          {lead.name}
        </Text>
        <Feather name="chevron-right" size={16} color={colors.inkMuted} />
      </View>

      <Text variant="caption" color={colors.inkMuted} numberOfLines={1} style={styles.contactLine}>
        {lead.phone}
        {lead.city ? `  ·  ${lead.city}` : ''}
      </Text>

      <View style={styles.metaRow}>
        <Badge label={STATUS_LABEL[lead.status]} t={STATUS_TONE[lead.status]} />
        {lead.isStuck ? (
          <View style={styles.stuckPill}>
            <View style={styles.stuckDot} />
            <Text variant="caption" color={tone.danger.fg} style={styles.stuckText}>
              {stuckLabel(lead.statusChangedAt)}
            </Text>
          </View>
        ) : null}
        <PendingSyncBadge filter={(i) => i.entityKey === leadKey(lead.id)} />
      </View>
    </PressableScale>
  );
}

export function LeadsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const [search, setSearch] = useState('');
  const [stuckOnly, setStuckOnly] = useState(false);
  const [status, setStatus] = useState<LeadStatus | undefined>();
  const [stageSheetOpen, setStageSheetOpen] = useState(false);
  const debounced = useDebouncedValue(search.trim(), 350);
  const q = useLeadsList(debounced, status, stuckOnly ? true : undefined);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'SALES' || user?.role === 'OFFICE';
  const stageLabel = status ? STATUS_LABEL[status] : 'Stage';

  let body: React.ReactElement | undefined;
  if (q.isPending) {
    body = (
      <View style={styles.skeletonList}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.leadRow, i > 0 && styles.divider]}>
            <Skeleton height={18} width="52%" />
            <Skeleton height={14} width="42%" />
            <Skeleton height={22} width={104} />
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
    const emptyMsg = debounced
      ? 'No leads match your search.'
      : stuckOnly && status
        ? `No stuck leads in ${STATUS_LABEL[status]}.`
        : stuckOnly
          ? 'No stuck leads right now.'
          : status
            ? `No leads in ${STATUS_LABEL[status]}.`
            : 'No leads found.';
    body = <EmptyState icon="phone-call" message={emptyMsg} />;
  }

  return (
    <View style={styles.root}>
      <View style={[styles.stickyHeader, { paddingTop: insets.top + space[4] }]}>
        <View style={styles.headerRow}>
          <Text variant="title" color={colors.inkDeep}>
            Leads
          </Text>
          {canCreate ? (
            <Button
              title={user?.role === 'OFFICE' ? '+ Walk-in' : '+ Add lead'}
              size="sm"
              onPress={() => router.push('/leads/new' as Href)}
            />
          ) : null}
        </View>

        <View style={styles.search}>
          <Feather name="search" size={17} color={colors.inkMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or phone"
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {search.length > 0 ? (
            <PressableScale
              onPress={() => setSearch('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={10}
            >
              <Feather name="x" size={16} color={colors.inkMuted} />
            </PressableScale>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          <View style={styles.viewGroup} accessibilityRole="tablist">
            <PressableScale
              onPress={() => {
                if (stuckOnly) softTick();
                setStuckOnly(false);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: !stuckOnly }}
              style={[styles.viewPill, !stuckOnly && styles.viewPillActive]}
            >
              <Text
                variant="caption"
                color={!stuckOnly ? colors.primaryForeground : colors.inkMuted}
                numberOfLines={1}
                style={!stuckOnly ? styles.pillTextActive : styles.pillText}
              >
                All leads
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => {
                if (!stuckOnly) softTick();
                setStuckOnly(true);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: stuckOnly }}
              style={[styles.viewPill, stuckOnly && styles.viewPillActive]}
            >
              <Text
                variant="caption"
                color={stuckOnly ? colors.primaryForeground : colors.inkMuted}
                numberOfLines={1}
                style={stuckOnly ? styles.pillTextActive : styles.pillText}
              >
                Stuck
              </Text>
            </PressableScale>
          </View>

          <PressableScale
            onPress={() => {
              softTick();
              setStageSheetOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={status ? `Stage filter: ${STATUS_LABEL[status]}` : 'Filter by stage'}
            style={[styles.stageTrigger, status && styles.stageTriggerActive]}
          >
            <Text
              variant="caption"
              color={status ? colors.primaryPressed : colors.inkDeep}
              numberOfLines={1}
              style={[styles.stageTriggerText, status && { fontFamily: font.semibold }]}
            >
              {stageLabel}
            </Text>
            <Feather
              name="chevron-down"
              size={15}
              color={status ? colors.primaryPressed : colors.inkMuted}
            />
          </PressableScale>
        </View>
      </View>

      <FlatList
        data={q.data ?? []}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => <LeadRow lead={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={body}
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <Skeleton height={56} />
            </View>
          ) : undefined
        }
        contentContainerStyle={styles.listContent}
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

      <BottomSheet
        visible={stageSheetOpen}
        onClose={() => setStageSheetOpen(false)}
        title="Stage"
      >
        <View style={{ gap: 2 }}>
          <SheetRow
            icon="layers"
            label="All stages"
            selected={status === undefined}
            onPress={() => {
              softTick();
              setStatus(undefined);
              setStageSheetOpen(false);
            }}
          />
          {STATUS_ORDER.map((s) => (
            <SheetRow
              key={s}
              icon={s === 'WON' ? 'check-circle' : s === 'LOST' ? 'x-circle' : 'circle'}
              label={STATUS_LABEL[s]}
              selected={status === s}
              onPress={() => {
                softTick();
                setStatus(s);
                setStageSheetOpen(false);
              }}
            />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.card,
  },
  stickyHeader: {
    backgroundColor: colors.card,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    gap: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
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
    backgroundColor: colors.pageSoft,
  },
  searchInput: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.foreground,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  viewGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 3,
    gap: 2,
  },
  viewPill: {
    minHeight: 34,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewPillActive: {
    backgroundColor: colors.primary,
  },
  pillText: {
    fontFamily: font.medium,
  },
  pillTextActive: {
    fontFamily: font.semibold,
  },
  stageTrigger: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[1],
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  stageTriggerActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  stageTriggerText: {
    flexShrink: 1,
    fontFamily: font.medium,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: space[8],
  },
  leadRow: {
    backgroundColor: colors.card,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: 4,
    minHeight: hit,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  leadName: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: font.semibold,
  },
  contactLine: {
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
    paddingTop: 4,
  },
  stuckPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tone.danger.bg,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  stuckDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: tone.danger.fg,
  },
  stuckText: {
    fontFamily: font.semibold,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: space[4],
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  skeletonList: {
    backgroundColor: colors.card,
  },
  errorWrap: {
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[8],
    paddingHorizontal: space[4],
  },
  footerLoader: {
    padding: space[4],
  },
});
