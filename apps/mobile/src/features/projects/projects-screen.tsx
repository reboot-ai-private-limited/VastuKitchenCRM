import type React from 'react';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProjectDto, ProjectStage } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, space } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { NetworkError } from '@/lib/api/client';
import { formatDate, formatINR } from '@/lib/format';
import { softTick } from '@/lib/haptics';
import { DESIGN_SUB_LABEL, STAGE_LABEL, STAGE_ORDER, STAGE_TONE } from './project-meta';
import { useProjectsList } from './use-projects';

function ProjectRow({ project, isDuplicateName }: { project: ProjectDto; isDuplicateName: boolean }) {
  const router = useRouter();
  const closed = project.stage === 'CLOSED';
  const refCode = `#${project.id.slice(-4).toUpperCase()}`;
  const detailParts: string[] = [];
  if (project.siteAddress) detailParts.push(project.siteAddress);
  if (project.designer) detailParts.push(project.designer.name);
  if (isDuplicateName || detailParts.length === 0) {
    detailParts.push(`Created ${formatDate(project.createdAt)}`);
  }

  return (
    <Reveal>
      <PressableScale onPress={() => router.push({ pathname: '/projects/[id]', params: { id: project.id } })}>
        <View style={[styles.projectCard, closed && { opacity: 0.65 }]}>
          <View style={styles.row}>
            <Text variant="section" color={colors.inkDeep} numberOfLines={1} style={{ flex: 1 }}>
              {project.name}
            </Text>
            <Text variant="caption" color={colors.inkMuted} style={styles.refCode}>
              {refCode}
            </Text>
            <Feather name="chevron-right" size={18} color={colors.inkMuted} />
          </View>

          <View style={styles.customerRow}>
            <Text color={colors.inkMuted} numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>
              {project.customer.name}
            </Text>
            {project.value != null && !closed ? (
              <Text color={colors.inkDeep} style={styles.valueText}>
                {formatINR(project.value)}
              </Text>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            <Feather
              name={project.siteAddress ? 'map-pin' : 'calendar'}
              size={12}
              color={colors.inkMuted}
            />
            <Text variant="caption" color={colors.inkMuted} numberOfLines={1} style={{ flex: 1 }}>
              {detailParts.join('  ·  ')}
            </Text>
          </View>

          <View style={styles.stageRow}>
            <Badge label={STAGE_LABEL[project.stage]} t={STAGE_TONE[project.stage]} />
            {project.stage === 'DESIGN' ? (
              <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
                {DESIGN_SUB_LABEL[project.designStage]}
              </Text>
            ) : null}
          </View>
        </View>
      </PressableScale>
    </Reveal>
  );
}

export function ProjectsScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<ProjectStage | undefined>();
  const debounced = useDebouncedValue(search.trim(), 300);
  const q = useProjectsList(debounced, stage);
  const all = q.data ?? [];
  const closedCount = all.filter((p) => p.stage === 'CLOSED').length;
  const visible = stage === 'CLOSED' ? all : all.filter((p) => p.stage !== 'CLOSED');
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of visible) {
      const k = p.name.trim().toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const dups = new Set<string>();
    for (const [k, n] of counts) {
      if (n > 1) dups.add(k);
    }
    return dups;
  }, [visible]);

  let body: React.ReactElement | undefined;
  if (q.isPending) {
    body = (
      <View style={{ gap: 11 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.projectCard}>
            <Skeleton height={18} width="60%" />
            <Skeleton width="45%" />
            <Skeleton height={20} width={100} />
          </View>
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
  } else if (visible.length === 0) {
    body = (
      <EmptyState
        icon="layers"
        message={
          debounced
            ? 'No projects match your search'
            : stage === 'CLOSED'
              ? 'No closed projects.'
              : closedCount > 0 && stage === undefined
                ? 'No active projects right now. Check the Closed tab.'
                : 'No projects found.'
        }
      />
    );
  }

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.stickyHeader,
          { paddingTop: insets.top + space[4] },
        ]}
      >
        <Text variant="title" color={colors.inkDeep}>
          Projects
        </Text>
        <View style={styles.search}>
          <Feather name="search" size={17} color={colors.inkMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search project or customer"
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>
        <View style={styles.segmentedBar} accessibilityRole="tablist">
          {[undefined, ...STAGE_ORDER].map((s) => {
            const active = s === stage;
            const label =
              s === undefined
                ? 'Active'
                : s === 'CLOSED' && closedCount > 0
                  ? `${STAGE_LABEL[s]} (${closedCount})`
                  : STAGE_LABEL[s];
            return (
              <PressableScale
                key={s ?? 'active'}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  if (!active) softTick();
                  setStage(s);
                }}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text
                  variant="caption"
                  color={active ? colors.primaryForeground : colors.inkMuted}
                  numberOfLines={1}
                  style={active ? styles.segmentTextActive : styles.segmentText}
                >
                  {label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: space[3],
          paddingHorizontal: space[4],
          paddingBottom: space[8],
          gap: 11,
        }}
        data={visible}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <ProjectRow
            project={item}
            isDuplicateName={duplicateNames.has(item.name.trim().toLowerCase())}
          />
        )}
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
  projectCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 15,
    paddingVertical: space[4],
    paddingHorizontal: space[4],
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  valueText: {
    fontSize: 14,
    fontFamily: font.semibold,
    fontVariant: ['tabular-nums'],
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingTop: 2 },
  refCode: { fontSize: 11, fontVariant: ['tabular-nums'], letterSpacing: 0.4 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    height: 44,
    paddingHorizontal: space[3],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.inkDeep },
  segmentedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 4,
    gap: 2,
  },
  segment: {
    flex: 1,
    height: 36,
    paddingHorizontal: 6,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.tealStrong,
  },
  segmentText: {
    fontFamily: font.medium,
  },
  segmentTextActive: {
    fontFamily: font.semibold,
  },
});
