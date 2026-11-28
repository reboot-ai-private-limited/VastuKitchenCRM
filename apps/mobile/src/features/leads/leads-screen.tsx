import type React from 'react';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CLOSED_LEAD_STATUSES,
  DESIGN_VISIBLE_LEAD_STATUSES,
  LEAD_PRODUCTS_OF_INTEREST,
  LEAD_SOURCES,
  type LeadDto,
  type LeadProductOfInterest,
  type LeadSource,
  type LeadStatus,
} from '@vastu/contracts';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { crm, font, hit, radius, space, stageTone, tone as themeTone } from '@/constants/theme';
import { SheetRow } from '@/features/projects/sheet-row';
import { SlidingSwitch } from '@/features/projects/sliding-switch';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { formatPhone, timeAgo } from '@/lib/format';
import { softTick } from '@/lib/haptics';
import { PendingSyncBadge } from '@/offline';
import {
  daysInStage,
  followUpDue,
  PRODUCT_LABEL,
  SOURCE_LABEL,
  STAGE_TONE,
  STATUS_LABEL,
  STATUS_ORDER,
} from './lead-meta';
import { leadKey, useLeadCount, useLeadsList } from './use-leads';

/** Keeps the list readable on tablets. */
const MAX_WIDTH = 720;

function LeadRow({ lead }: { lead: LeadDto }) {
  const router = useRouter();
  const days = daysInStage(lead.statusChangedAt);
  const closed = lead.status === 'LOST' || lead.status === 'INVALID_DATA';
  const tone = stageTone[STAGE_TONE[lead.status]];
  const contact = [formatPhone(lead.phone), lead.city].filter(Boolean).join(' \u00b7 ');
  const owner = lead.assignedTo?.name ?? 'Unassigned';
  const products = lead.productsOfInterest.map((p) => PRODUCT_LABEL[p]).join(', ');
  // Time in the current stage, not time since the last contact.
  const stuck = lead.isStuck ? (days ? `Stuck ${days}d` : 'Stuck') : null;
  const age = !lead.isStuck && days != null ? (days === 0 ? 'Moved today' : `${days}d in stage`) : null;

  const open = !CLOSED_LEAD_STATUSES.includes(lead.status);
  const due = open && lead.nextFollowUpAt ? followUpDue(lead.nextFollowUpAt) : null;
  const next = open && (due || lead.nextAction) ? (lead.nextAction ?? 'Follow up') : null;
  const contacted = lead.lastContactedAt ? `Last contact ${timeAgo(lead.lastContactedAt)}` : null;
  const dueColor =
    due?.state === 'overdue' ? crm.danger : due?.state === 'today' ? themeTone.warning.fg : crm.muted;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/leads/[id]', params: { id: lead.id } } as Href)}
      accessibilityRole="button"
      accessibilityLabel={[
        lead.name,
        contact,
        STATUS_LABEL[lead.status],
        lead.isStuck ? `stuck${days ? `, ${days} days in stage` : ''}` : null,
        owner,
        products,
        next,
        due?.label,
        contacted,
      ]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.line}>
        <Text numberOfLines={1} color={closed ? crm.muted : crm.heading} style={styles.name}>
          {lead.name}
        </Text>
        {stuck ? (
          <View style={styles.stuck}>
            <View style={styles.stuckDot} />
            <Text color={crm.danger} style={styles.stuckText}>
              {stuck}
            </Text>
          </View>
        ) : null}
        <Feather name="chevron-right" size={16} color={crm.muted} />
      </View>

      <Text numberOfLines={1} color={crm.body} style={styles.contact}>
        {contact}
      </Text>

      {products ? (
        <Text numberOfLines={1} color={crm.muted} style={styles.products}>
          {products}
        </Text>
      ) : null}

      <View style={styles.metaLine}>
        <View style={[styles.stage, { backgroundColor: tone.bg }]}>
          <Text color={tone.fg} style={styles.stageText}>
            {STATUS_LABEL[lead.status]}
          </Text>
        </View>
        <Text color={lead.assignedTo ? crm.muted : themeTone.warning.fg} style={styles.meta}>
          {[owner, age].filter(Boolean).join(' \u00b7 ')}
        </Text>
      </View>
      {next ? (
        <View style={styles.followUp}>
          <Text numberOfLines={1} color={crm.heading} style={styles.nextAction}>
            {next}
          </Text>
          {due ? (
            <Text color={dueColor} style={styles.dueText}>
              {due.label}
            </Text>
          ) : null}
        </View>
      ) : null}
      {contacted ? (
        <Text color={crm.muted} style={styles.products}>
          {contacted}
        </Text>
      ) : null}
      <PendingSyncBadge filter={(i) => i.entityKey === leadKey(lead.id)} />
    </Pressable>
  );
}

function Notice({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <View style={styles.notice}>
      <Text color={crm.heading} style={styles.noticeTitle}>
        {title}
      </Text>
      <Text color={crm.body} style={styles.noticeText}>
        {message}
      </Text>
      {action}
    </View>
  );
}

export function LeadsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'all' | 'stuck' | 'due'>('all');
  const [status, setStatus] = useState<LeadStatus | undefined>();
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [products, setProducts] = useState<LeadProductOfInterest[]>([]);
  const [showLost, setShowLost] = useState(false);
  const [sheet, setSheet] = useState<'stage' | 'filters' | null>(null);
  const debounced = useDebouncedValue(search.trim(), 350);
  // Lost leads are hidden unless asked for; choosing a stage overrides that.
  const excludeLost = !showLost && !status ? true : undefined;
  const countExcludeLost = showLost ? undefined : true;
  const q = useLeadsList(
    debounced,
    status,
    view === 'stuck' ? true : undefined,
    products.length > 0 ? products : undefined,
    excludeLost,
    sources.length > 0 ? sources : undefined,
    view === 'due' ? true : undefined,
  );
  const total = useLeadCount({ excludeLost: countExcludeLost });
  const stuckTotal = useLeadCount({ stuck: true, excludeLost: countExcludeLost });
  const dueTotal = useLeadCount({ followUpDue: true });

  const canCreate = user?.role === 'ADMIN' || user?.role === 'SALES' || user?.role === 'OFFICE';
  const isDesigner = user?.role === 'DESIGNER';
  const stageOptions = isDesigner ? DESIGN_VISIBLE_LEAD_STATUSES : STATUS_ORDER;
  const extraFilters = products.length + sources.length + (showLost ? 1 : 0);
  const filtered = Boolean(debounced || view !== 'all' || status || extraFilters);
  const totalWord = showLost
    ? total.data === 1
      ? 'lead'
      : 'leads'
    : total.data === 1
      ? 'active lead'
      : 'active leads';
  const summary = [
    total.data != null ? `${total.data} ${totalWord}` : null,
    stuckTotal.data ? `${stuckTotal.data} stuck` : null,
    dueTotal.data ? `${dueTotal.data} due` : null,
  ]
    .filter(Boolean)
    .join(' \u00b7 ');

  const refresh = () => {
    void q.refetch();
    void total.refetch();
    void stuckTotal.refetch();
    void dueTotal.refetch();
  };

  const clearExtraFilters = () => {
    setProducts([]);
    setSources([]);
    setShowLost(false);
  };

  const clearFilters = () => {
    setSearch('');
    setView('all');
    setStatus(undefined);
    clearExtraFilters();
  };

  const pick = (apply: () => void) => {
    softTick();
    apply();
    setSheet(null);
  };

  let empty: React.ReactElement;
  if (q.isPending) {
    empty = (
      <View accessibilityLabel="Loading leads">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.row, styles.skeletonRow, i > 0 && styles.divider]}>
            <Skeleton height={16} width="48%" />
            <Skeleton height={14} width="62%" />
            <Skeleton height={20} width={96} />
          </View>
        ))}
      </View>
    );
  } else if (q.isError) {
    empty = (
      <Notice
        title="Could not load leads"
        message={
          q.error instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : q.error.message
        }
        action={<Button title="Retry" variant="outline" onPress={refresh} />}
      />
    );
  } else if (filtered) {
    empty = (
      <Notice
        title="No leads found"
        message="Try changing your search or filters."
        action={<Button title="Clear filters" variant="outline" onPress={clearFilters} />}
      />
    );
  } else {
    empty = (
      <Notice
        title="No leads yet"
        message={canCreate ? 'Add a lead to start your pipeline.' : 'Leads will appear here.'}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text accessibilityRole="header" color={crm.heading} style={styles.title}>
                Leads
              </Text>
              <Text numberOfLines={1} color={crm.muted} style={styles.summary}>
                {summary || ' '}
              </Text>
            </View>
          </View>

          <View style={styles.searchRow}>
            <View style={styles.search}>
              <Feather name="search" size={18} color={crm.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search name or phone..."
                placeholderTextColor={crm.muted}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Search leads by name or phone"
                style={styles.searchInput}
              />
              {search.length > 0 ? (
                <PressableScale
                  onPress={() => setSearch('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  style={styles.clear}
                >
                  <Feather name="x" size={18} color={crm.muted} />
                </PressableScale>
              ) : null}
            </View>
            {canCreate ? (
              <PressableScale
                onPress={() => router.push('/leads/new' as Href)}
                accessibilityRole="button"
                accessibilityLabel={user?.role === 'OFFICE' ? 'Add walk-in lead' : 'Add lead'}
                hitSlop={4}
                style={styles.add}
              >
                <Feather name="plus" size={16} color={crm.surface} />
                <Text color={crm.surface} style={styles.addText}>
                  {user?.role === 'OFFICE' ? 'Walk-in' : 'Add lead'}
                </Text>
              </PressableScale>
            ) : null}
          </View>

          <SlidingSwitch
            options={[
              { value: 'all', label: 'All leads' },
              { value: 'stuck', label: 'Stuck' },
              { value: 'due', label: 'Follow-up due' },
            ]}
            value={view}
            onChange={setView}
            style={styles.viewSwitch}
          />
          <View style={styles.filters}>
            <PressableScale
              onPress={() => setSheet('stage')}
              accessibilityRole="button"
              accessibilityLabel={status ? `Stage filter: ${STATUS_LABEL[status]}` : 'Filter by stage'}
              style={[styles.control, styles.stageControl, status && styles.controlActive]}
            >
              <Text numberOfLines={1} color={status ? crm.primaryDark : crm.heading} style={styles.controlText}>
                {status ? STATUS_LABEL[status] : 'Stage'}
              </Text>
              <Feather name="chevron-down" size={16} color={status ? crm.primaryDark : crm.muted} />
            </PressableScale>
            <PressableScale
              onPress={() => setSheet('filters')}
              accessibilityRole="button"
              accessibilityLabel={extraFilters ? `Filters, ${extraFilters} applied` : 'More filters'}
              style={[styles.control, styles.iconControl, extraFilters > 0 && styles.controlActive]}
            >
              <Feather name="filter" size={16} color={extraFilters ? crm.primaryDark : crm.heading} />
              {extraFilters ? (
                <Text color={crm.primaryDark} style={styles.controlText}>
                  {extraFilters}
                </Text>
              ) : null}
            </PressableScale>
          </View>
        </View>
      </View>

      <FlatList
        data={q.data ?? []}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => <LeadRow lead={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={empty}
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <View style={styles.footer}>
              <Skeleton height={56} />
            </View>
          ) : q.isFetchNextPageError ? (
            <View style={styles.footer}>
              <Button title="Could not load more. Retry" variant="outline" onPress={() => void q.fetchNextPage()} />
            </View>
          ) : undefined
        }
        style={[styles.content, styles.list]}
        contentContainerStyle={styles.listContent}
        onEndReached={() =>
          q.hasNextPage && !q.isFetchingNextPage && !q.isFetchNextPageError && void q.fetchNextPage()
        }
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !q.isFetchingNextPage}
            onRefresh={refresh}
            tintColor={crm.primary}
          />
        }
      />

      <BottomSheet visible={sheet === 'stage'} onClose={() => setSheet(null)} title="Stage">
        <SheetRow
          icon="layers"
          label="All stages"
          selected={status === undefined}
          onPress={() => pick(() => setStatus(undefined))}
        />
        {stageOptions.map((s) => (
          <SheetRow
            key={s}
            icon={s === 'WON' ? 'check-circle' : s === 'LOST' ? 'x-circle' : 'circle'}
            label={STATUS_LABEL[s]}
            selected={status === s}
            onPress={() => pick(() => setStatus(s))}
          />
        ))}
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'filters'}
        onClose={() => setSheet(null)}
        title="Filters"
        footer={
          <View style={styles.sheetActions}>
            <View style={styles.sheetAction}>
              <Button title="Clear" variant="outline" disabled={!extraFilters} onPress={clearExtraFilters} fullWidth />
            </View>
            <View style={styles.sheetAction}>
              <Button title="Done" onPress={() => setSheet(null)} fullWidth />
            </View>
          </View>
        }
      >
        <View style={styles.filterSheetBody}>
          {!isDesigner ? (
            <Pressable
              onPress={() => {
                softTick();
                setShowLost((v) => !v);
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: showLost }}
              style={styles.toggleRow}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text color={crm.heading} style={styles.toggleLabel}>
                  Show lost leads
                </Text>
                {status ? (
                  <Text color={crm.muted} style={styles.toggleHint}>
                    Overridden while a stage filter is active
                  </Text>
                ) : null}
              </View>
              <Switch
                value={showLost}
                onValueChange={(v) => {
                  softTick();
                  setShowLost(v);
                }}
                trackColor={{ false: crm.border, true: crm.primary }}
                thumbColor={crm.surface}
              />
            </Pressable>
          ) : null}

          <View style={styles.filterSection}>
            <View style={styles.filterSectionHead}>
              <Text color={crm.heading} style={styles.sectionLabel}>
                Product of interest{products.length > 0 ? ` (${products.length})` : ''}
              </Text>
              {products.length > 0 ? (
                <PressableScale
                  onPress={() => {
                    softTick();
                    setProducts([]);
                  }}
                  hitSlop={8}
                >
                  <Text color={crm.primaryDark} style={styles.clearLink}>
                    Clear
                  </Text>
                </PressableScale>
              ) : null}
            </View>
            <View style={styles.chipGrid}>
              {LEAD_PRODUCTS_OF_INTEREST.map((p) => {
                const active = products.includes(p);
                return (
                  <PressableScale
                    key={p}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    onPress={() => {
                      softTick();
                      setProducts((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
                    }}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    {active ? <Feather name="check" size={13} color={crm.primaryDark} /> : null}
                    <Text
                      color={active ? crm.primaryDark : crm.body}
                      style={[styles.filterChipText, active && styles.filterChipTextActive]}
                    >
                      {PRODUCT_LABEL[p]}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <View style={styles.filterSection}>
            <View style={styles.filterSectionHead}>
              <Text color={crm.heading} style={styles.sectionLabel}>
                Lead source{sources.length > 0 ? ` (${sources.length})` : ''}
              </Text>
              {sources.length > 0 ? (
                <PressableScale
                  onPress={() => {
                    softTick();
                    setSources([]);
                  }}
                  hitSlop={8}
                >
                  <Text color={crm.primaryDark} style={styles.clearLink}>
                    Clear
                  </Text>
                </PressableScale>
              ) : null}
            </View>
            <View style={styles.chipGrid}>
              {LEAD_SOURCES.map((s) => {
                const active = sources.includes(s);
                return (
                  <PressableScale
                    key={s}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    onPress={() => {
                      softTick();
                      setSources((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
                    }}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    {active ? <Feather name="check" size={13} color={crm.primaryDark} /> : null}
                    <Text
                      color={active ? crm.primaryDark : crm.body}
                      style={[styles.filterChipText, active && styles.filterChipTextActive]}
                    >
                      {SOURCE_LABEL[s]}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: crm.background },
  content: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  header: {
    paddingHorizontal: space[4],
    backgroundColor: crm.background,
    borderBottomWidth: 1,
    borderBottomColor: crm.border,
  },
  titleRow: { justifyContent: 'center', alignItems: 'center', minHeight: 40 },
  titleBlock: { alignItems: 'center' },
  title: { fontFamily: font.semibold, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  summary: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'], textAlign: 'center' },
  add: {
    height: hit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    backgroundColor: crm.primary,
  },
  addText: { fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[3],
  },
  search: {
    flex: 1,
    height: hit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingLeft: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: crm.border,
    backgroundColor: crm.surface,
  },
  searchInput: { flex: 1, height: '100%', fontFamily: font.regular, fontSize: 15, color: crm.heading },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[2], paddingBottom: space[3] },
  viewSwitch: { marginTop: space[2], height: 40 },
  control: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: crm.border,
    backgroundColor: crm.surface,
  },
  controlActive: { borderColor: crm.primary, backgroundColor: crm.neutral },
  stageControl: { flex: 1, justifyContent: 'space-between', gap: space[1], paddingHorizontal: space[3] },
  iconControl: { minWidth: 40, gap: space[1], paddingHorizontal: space[2] },
  controlText: { flexShrink: 1, fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  list: { flex: 1, backgroundColor: crm.surface },
  listContent: { flexGrow: 1, paddingBottom: space[6] },
  row: { paddingHorizontal: space[4], paddingVertical: space[3], backgroundColor: crm.surface },
  rowPressed: { backgroundColor: crm.neutral },
  line: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  name: { flex: 1, fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  contact: { fontFamily: font.medium, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  products: { fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  followUp: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[2] },
  nextAction: { flex: 1, fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  dueText: { fontFamily: font.semibold, fontSize: 12, lineHeight: 18, fontVariant: ['tabular-nums'] },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: space[2],
    rowGap: 4,
    marginTop: space[2],
  },
  stage: { paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.sm },
  stageText: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  meta: {
    flexShrink: 1,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  stuck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: crm.dangerSoft,
  },
  stuckDot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: crm.danger },
  stuckText: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] },
  separator: { height: 1, marginLeft: space[4], backgroundColor: crm.border },
  divider: { borderTopWidth: 1, borderTopColor: crm.border },
  skeletonRow: { gap: space[2] },
  notice: { alignItems: 'center', gap: space[2], paddingHorizontal: space[6], paddingVertical: space[10] },
  noticeTitle: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  noticeText: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  footer: { padding: space[4] },
  filterSheetBody: { gap: space[4] },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    minHeight: hit,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: crm.border,
    backgroundColor: crm.background,
  },
  toggleLabel: { fontFamily: font.medium, fontSize: 15, lineHeight: 20 },
  toggleHint: { fontFamily: font.regular, fontSize: 12, lineHeight: 16 },
  filterSection: { gap: space[2] },
  filterSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontFamily: font.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  clearLink: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: crm.border,
    backgroundColor: crm.surface,
  },
  filterChipActive: {
    borderColor: crm.primary,
    backgroundColor: crm.neutral,
  },
  filterChipText: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  filterChipTextActive: { fontFamily: font.semibold },
  sheetActions: { flexDirection: 'row', gap: space[2] },
  sheetAction: { flex: 1 },
});
