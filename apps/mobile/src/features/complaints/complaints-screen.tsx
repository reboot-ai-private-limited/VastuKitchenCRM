import type React from 'react';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComplaintDto, ComplaintStatus } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space } from '@/constants/theme';
import { NetworkError } from '@/lib/api/client';
import { listProjects } from '@/lib/api/endpoints/projects';
import { useSession } from '@/lib/auth/session';
import { timeAgo } from '@/lib/format';
import { softTick } from '@/lib/haptics';
import { STATUS_LABEL, STATUS_ORDER, STATUS_TONE } from './complaint-meta';
import { useComplaintCounts, useComplaintsList } from './use-complaints';

export function ComplaintRow({ c, flat = false }: { c: ComplaintDto; flat?: boolean }) {
  const router = useRouter();
  const muted = c.status === 'CLOSED';
  const updates = c.history.filter((h) => h.type !== 'RAISED').length + c.comments.length;
  const firstImg = c.images[0];
  const inner = (
    <View style={{ gap: 6 }}>
      <View style={styles.row}>
        <Text
          color={muted ? colors.inkMuted : colors.inkDeep}
          numberOfLines={1}
          style={styles.projectName}
        >
          {c.projectName}
        </Text>
        <Badge label={STATUS_LABEL[c.status]} t={STATUS_TONE[c.status]} />
        {c.reopenCount > 0 ? <Badge label={`Reopened ×${c.reopenCount}`} t="warning" /> : null}
        <Feather name="chevron-right" size={16} color={colors.inkMuted} />
      </View>
      <View style={styles.bodyRow}>
        <Text
          color={muted ? colors.inkMuted : colors.inkDeep}
          numberOfLines={2}
          style={[styles.desc, { flex: 1 }]}
        >
          {c.description}
        </Text>
        {firstImg ? (
          <View style={styles.thumbWrap}>
            <Image
              source={{ uri: firstImg.thumbUrl ?? firstImg.url }}
              style={styles.thumb}
              contentFit="cover"
            />
            {c.images.length > 1 ? (
              <View style={styles.thumbCount}>
                <Text variant="caption" color={colors.primaryForeground} style={styles.thumbCountText}>
                  +{c.images.length - 1}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={styles.metaFooter}>
        <Text variant="caption" color={colors.inkMuted} numberOfLines={1} style={{ flex: 1 }}>
          {c.customer.name} · {timeAgo(c.createdAt)}
          {c.assignedTo ? ` · ${c.assignedTo.name}` : ''}
        </Text>
        {updates > 0 ? (
          <View style={styles.updateCount}>
            <Feather name="message-circle" size={12} color={colors.inkMuted} />
            <Text variant="caption" color={colors.inkMuted} style={{ fontVariant: ['tabular-nums'] }}>
              {updates}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/complaints/[id]', params: { id: c.id } } as Href)}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={`${c.projectName}, ${STATUS_LABEL[c.status]}. ${c.description}`}
      style={flat ? styles.cardRow : undefined}
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
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);

  const isStaff = !!user && user.role !== 'CUSTOMER';
  const q = useComplaintsList(status, projectId, assignedToMe ? 'me' : undefined);
  const countsQ = useComplaintCounts();
  const projectsQ = useQuery({
    queryKey: ['projects', 'complaint-filter-options'],
    queryFn: ({ signal }) => listProjects({ page: 1, pageSize: 100 }, signal),
    enabled: isStaff && (projectSheetOpen || !!projectId),
    staleTime: 60_000,
  });
  const projects = projectsQ.data?.items ?? [];
  const selectedProjectName = projects.find((p) => p.id === projectId)?.name;

  const canRaise =
    user?.role === 'ADMIN' ||
    user?.role === 'OFFICE' ||
    user?.role === 'SALES' ||
    user?.role === 'DESIGNER' ||
    user?.role === 'CUSTOMER';

  const counts = countsQ.data;
  const needAttention = counts ? counts.OPEN + counts.ASSIGNED : null;
  const hasFilters = !!status || assignedToMe || !!projectId;

  let body: React.ReactElement | undefined;
  if (q.isPending) {
    body = (
      <View style={{ gap: 10 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.cardRow}>
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
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text variant="title" color={colors.inkDeep} style={styles.heading}>
            Complaints
          </Text>
          {needAttention !== null && counts ? (
            <Text variant="caption" color={colors.inkMuted} style={{ fontVariant: ['tabular-nums'] }}>
              {needAttention} need attention · {counts.RESOLVED} resolved
            </Text>
          ) : null}
        </View>

        <View style={styles.controlsRow}>
          {isStaff ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={styles.filterTrack}
            >
              <PressableScale
                onPress={() => {
                  softTick();
                  setAssignedToMe((v) => !v);
                }}
                style={[styles.subPill, assignedToMe && styles.pillActive]}
              >
                <Feather
                  name="user"
                  size={13}
                  color={assignedToMe ? colors.primaryForeground : colors.inkDeep}
                />
                <Text
                  variant="caption"
                  color={assignedToMe ? colors.primaryForeground : colors.inkDeep}
                  style={assignedToMe ? styles.pillTextActive : styles.pillText}
                >
                  Mine
                </Text>
              </PressableScale>
              <PressableScale
                onPress={() => setProjectSheetOpen(true)}
                style={[styles.subPill, !!projectId && styles.pillActive]}
              >
                <Feather
                  name="layers"
                  size={13}
                  color={projectId ? colors.primaryForeground : colors.inkDeep}
                />
                <Text
                  variant="caption"
                  color={projectId ? colors.primaryForeground : colors.inkDeep}
                  style={projectId ? styles.pillTextActive : styles.pillText}
                  numberOfLines={1}
                >
                  {selectedProjectName ?? 'Project'}
                </Text>
                <Feather
                  name="chevron-down"
                  size={13}
                  color={projectId ? colors.primaryForeground : colors.inkMuted}
                />
              </PressableScale>
              {hasFilters ? (
                <PressableScale
                  onPress={() => {
                    setStatus(undefined);
                    setAssignedToMe(false);
                    setProjectId(undefined);
                  }}
                  style={styles.subPill}
                >
                  <Feather name="x" size={13} color={colors.destructive} />
                  <Text variant="caption" color={colors.destructive} style={styles.pillText}>
                    Clear
                  </Text>
                </PressableScale>
              ) : null}
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {canRaise ? (
            <PressableScale
              onPress={() =>
                router.push(
                  (projectId
                    ? { pathname: '/complaints/new', params: { projectId } }
                    : '/complaints/new') as Href,
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Raise complaint"
              hitSlop={4}
              style={styles.raiseBtn}
            >
              <Feather name="plus" size={15} color={colors.primaryForeground} />
              <Text variant="caption" color={colors.primaryForeground} style={{ fontFamily: font.semibold }}>
                Raise
              </Text>
            </PressableScale>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTrack}
        >
          {[undefined, ...STATUS_ORDER].map((s) => {
            const active = s === status;
            const count = s && counts ? counts[s] : undefined;
            const label = s
              ? count && count > 0
                ? `${STATUS_LABEL[s]} (${count})`
                : STATUS_LABEL[s]
              : 'All';
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
                  style={[
                    active ? styles.pillTextActive : styles.pillText,
                    { fontVariant: ['tabular-nums'] },
                  ]}
                >
                  {label}
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
        ListEmptyComponent={body}
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <View style={{ paddingVertical: space[3] }}>
              <Skeleton height={76} />
            </View>
          ) : undefined
        }
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: space[4],
          paddingTop: space[3],
          paddingBottom: insets.bottom + space[8],
          gap: 10,
        }}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !q.isFetchingNextPage}
            onRefresh={() => {
              void q.refetch();
              void countsQ.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      />

      <BottomSheet
        visible={projectSheetOpen}
        onClose={() => setProjectSheetOpen(false)}
        title="Filter by project"
      >
        <View style={{ gap: space[1] }}>
          <PressableScale
            onPress={() => {
              setProjectId(undefined);
              setProjectSheetOpen(false);
            }}
            style={styles.sheetRow}
          >
            <Text variant="label" color={colors.inkDeep} style={{ flex: 1 }}>
              All projects
            </Text>
            {!projectId ? <Feather name="check" size={16} color={colors.primary} /> : null}
          </PressableScale>
          {projectsQ.isPending ? <Skeleton height={48} /> : null}
          {projects.map((p) => (
            <PressableScale
              key={p.id}
              onPress={() => {
                setProjectId(p.id);
                setProjectSheetOpen(false);
              }}
              style={styles.sheetRow}
            >
              <View style={{ flex: 1 }}>
                <Text variant="label" color={colors.inkDeep} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
                  {p.customer.name}
                </Text>
              </View>
              {projectId === p.id ? <Feather name="check" size={16} color={colors.primary} /> : null}
            </PressableScale>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageSoft },
  stickyHeader: {
    backgroundColor: colors.pageSoft,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    gap: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  heading: { textAlign: 'center' },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  raiseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  filterTrack: { gap: space[2], alignItems: 'center' },
  pill: {
    minHeight: 34,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  subPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  bodyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  thumbWrap: { position: 'relative' },
  thumb: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.muted },
  thumbCount: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.inkDeep,
  },
  thumbCountText: { fontSize: 10, lineHeight: 13, fontFamily: font.semibold },
  metaFooter: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingTop: 2 },
  updateCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: hit,
    paddingHorizontal: space[2],
  },
  pillText: { fontFamily: font.medium },
  pillTextActive: { fontFamily: font.semibold },
  cardRow: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 15,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: hit,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  projectName: { flex: 1, fontSize: 16, lineHeight: 22, fontFamily: font.semibold },
  desc: { fontSize: 14, lineHeight: 20 },
  errorWrap: {
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[8],
    paddingHorizontal: space[4],
  },
});
