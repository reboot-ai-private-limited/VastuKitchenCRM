import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { DashboardAttentionDto, RecentFeedItemDto } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, radius, space, tone, type Tone } from '@/constants/theme';
import { routeFor } from '@/features/alerts/route-for';
import { CheckInCard } from '@/features/attendance/check-in-card';
import { NetworkError } from '@/lib/api/client';
import { getDashboard } from '@/lib/api/endpoints/dashboard';
import { useSession } from '@/lib/auth/session';
import {
  addDays,
  businessDate,
  businessMonth,
  formatINRShort,
  formatTime,
  timeAgo,
} from '@/lib/format';

type RangePreset = 'today' | '7d' | 'month';
type AttentionKey = keyof DashboardAttentionDto;

const RANGE_OPTIONS: { key: RangePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: 'month', label: 'This month' },
];

const ATTENTION_META: {
  key: AttentionKey;
  label: string;
  tone: Tone;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { key: 'stagnantLeads', label: 'Stagnant leads', tone: 'danger', icon: 'phone-missed' },
  { key: 'overdueComplaints', label: 'Overdue complaints', tone: 'orange', icon: 'alert-circle' },
  { key: 'unseenProposals', label: 'Unseen quotes', tone: 'warning', icon: 'eye-off' },
  { key: 'noActionProposals', label: 'No action quotes', tone: 'info', icon: 'file-text' },
  { key: 'overdueTodos', label: 'Overdue to-dos', tone: 'violet', icon: 'check-square' },
];

const RECENT_ICON: Record<RecentFeedItemDto['kind'], keyof typeof Feather.glyphMap> = {
  POST: 'layers',
  COMMENT: 'message-square',
  APPROVAL: 'check-circle',
};

const RECENT_VERB: Record<RecentFeedItemDto['kind'], string> = {
  POST: 'posted an update',
  COMMENT: 'commented',
  APPROVAL: 'approved the design',
};

function computeRange(preset: RangePreset): { from: string; to: string } {
  const today = businessDate();
  if (preset === 'today') return { from: today, to: today };
  if (preset === '7d') return { from: addDays(today, -6), to: today };
  return { from: `${businessMonth()}-01`, to: today };
}

export function AdminGlanceHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();

  const [preset, setPreset] = useState<RangePreset>('today');
  const [selectedBucket, setSelectedBucket] = useState<AttentionKey | null>(null);
  const range = useMemo(() => computeRange(preset), [preset]);

  const q = useQuery({
    queryKey: ['dashboard', range],
    queryFn: ({ signal }) => getDashboard(range, signal),
  });

  const data = q.data;
  const attention = data?.attention ?? null;

  const nonEmptyBuckets = useMemo(() => {
    if (!attention) return [];
    return ATTENTION_META.filter((m) => attention[m.key].total > 0);
  }, [attention]);

  const activeBucketKey: AttentionKey | null =
    selectedBucket && attention && attention[selectedBucket].total > 0
      ? selectedBucket
      : (nonEmptyBuckets[0]?.key ?? null);

  const activeItems = activeBucketKey && attention ? attention[activeBucketKey].items.slice(0, 5) : [];

  const rangeTitle = RANGE_OPTIONS.find((r) => r.key === preset)?.label ?? 'Today';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + space[4],
        paddingHorizontal: space[4],
        paddingBottom: insets.bottom + space[8],
        gap: space[5],
      }}
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">Vastu Kitchen</Text>
          <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
            {data ? `Updated ${formatTime(data.generatedAt)}` : 'Executive glance'}
          </Text>
        </View>
        {user ? (
          <Avatar
            name={user.name}
            size={36}
            accent icon
            onPress={() => router.push('/profile' as Href)}
            accessibilityLabel={`${user.name}, open profile`}
          />
        ) : null}
      </View>

      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map((opt) => {
          const active = opt.key === preset;
          return (
            <Chip key={opt.key} label={opt.label} active={active} onPress={() => setPreset(opt.key)} />
          );
        })}
      </View>

      <CheckInCard />

      {q.isPending ? (
        <View style={{ gap: space[3] }}>
          <Skeleton height={140} />
          <Skeleton height={76} />
          <Skeleton height={180} />
        </View>
      ) : q.isError ? (
        <Card style={{ alignItems: 'center', gap: space[3], paddingVertical: space[6] }}>
          <Text muted style={{ textAlign: 'center' }}>
            {q.error instanceof NetworkError
              ? 'Connection lost. Check your internet and try again.'
              : q.error.message}
          </Text>
          <Button title="Retry" variant="outline" onPress={() => void q.refetch()} />
        </Card>
      ) : data ? (
        <>
          {data.errors.length > 0 ? (
            <Card style={styles.partialWarn}>
              <Feather name="info" size={16} color={tone.warning.fg} />
              <Text variant="caption" color={tone.warning.fg} style={{ flex: 1 }}>
                Some dashboard sections ({data.errors.join(', ')}) could not be refreshed. Pull down to retry.
              </Text>
            </Card>
          ) : null}

          {/* NEEDS YOUR ATTENTION */}
          {attention ? (
            <Reveal>
              <View style={{ gap: space[2] }}>
                <Text variant="caption" muted style={styles.eyebrow}>
                  NEEDS YOUR ATTENTION
                </Text>
                {nonEmptyBuckets.length === 0 ? (
                  <Card style={styles.allClearCard}>
                    <View style={[styles.iconCircle, { backgroundColor: tone.success.bg }]}>
                      <Feather name="check" size={18} color={tone.success.fg} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="label">All caught up</Text>
                      <Text variant="caption" muted>
                        No stagnant leads, unseen quotes, or overdue items right now.
                      </Text>
                    </View>
                  </Card>
                ) : (
                  <Card style={{ gap: space[3] }}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: space[2] }}
                    >
                      {nonEmptyBuckets.map((b) => {
                        const block = attention[b.key];
                        const selected = b.key === activeBucketKey;
                        const countStr = `${block.total}${block.capped ? '+' : ''}`;
                        return (
                          <PressableScale
                            key={b.key}
                            onPress={() => setSelectedBucket(b.key)}
                            hitSlop={7}
                            accessibilityState={{ selected }}
                            style={[
                              styles.bucketPill,
                              {
                                backgroundColor: selected ? colors.primary : tone[b.tone].bg,
                              },
                            ]}
                          >
                            <Feather
                              name={b.icon}
                              size={14}
                              color={selected ? colors.primaryForeground : tone[b.tone].fg}
                            />
                            <Text
                              variant="caption"
                              color={selected ? colors.primaryForeground : tone[b.tone].fg}
                              style={{ fontVariant: ['tabular-nums'] }}
                            >
                              {b.label} · {countStr}
                            </Text>
                          </PressableScale>
                        );
                      })}
                    </ScrollView>

                    <View style={{ gap: space[2] }}>
                      {activeItems.map((item, idx) => {
                        const href = routeFor(item.ref, 'ADMIN');
                        return (
                          <PressableScale
                            key={`${item.ref.kind}-${item.ref.id}-${idx}`}
                            disabled={!href}
                            onPress={() => href && router.push(href)}
                            style={styles.attentionRow}
                          >
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text variant="label" numberOfLines={1}>
                                {item.title}
                              </Text>
                              <Text variant="caption" muted numberOfLines={1}>
                                {item.detail} · since {timeAgo(item.since)}
                              </Text>
                            </View>
                            {href ? (
                              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                            ) : null}
                          </PressableScale>
                        );
                      })}
                    </View>
                  </Card>
                )}
              </View>
            </Reveal>
          ) : null}

          {/* STAFF TODAY */}
          {data.staff ? (
            <Reveal index={1}>
              <View style={{ gap: space[2] }}>
                <Text variant="caption" muted style={styles.eyebrow}>
                  STAFF TODAY
                </Text>
                <PressableScale onPress={() => router.push('/attendance/board' as Href)}>
                  <Card style={styles.staffCard}>
                    <View style={[styles.iconCircle, { backgroundColor: tone.success.bg }]}>
                      <Feather name="users" size={18} color={tone.success.fg} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                        <Text variant="section" style={{ fontVariant: ['tabular-nums'] }}>
                          {data.staff.present} / {data.staff.tracked} in
                        </Text>
                        {data.staff.offDay ? <Badge label="Weekly off" t="neutral" /> : null}
                      </View>
                      <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
                        {data.staff.absent} absent today · tap to view board
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </Card>
                </PressableScale>
              </View>
            </Reveal>
          ) : null}

          {/* COUNTERS & VALUE */}
          {data.counters ? (
            <Reveal index={2}>
              <View style={{ gap: space[2] }}>
                <Text variant="caption" muted style={styles.eyebrow}>
                  OVERVIEW ({rangeTitle.toUpperCase()})
                </Text>
                <View style={styles.gridRow}>
                  <PressableScale style={{ flex: 1 }} onPress={() => router.push('/leads' as Href)}>
                    <Card style={styles.metricTile}>
                      <Text variant="caption" muted>
                        Open leads
                      </Text>
                      <Text variant="counter" style={{ fontVariant: ['tabular-nums'] }}>
                        {data.counters.leads.open}
                      </Text>
                      <Text variant="caption" color={tone.accent.fg} style={{ fontVariant: ['tabular-nums'] }}>
                        +{data.counters.leads.newInRange} new
                      </Text>
                    </Card>
                  </PressableScale>

                  <PressableScale style={{ flex: 1 }} onPress={() => router.push('/complaints' as Href)}>
                    <Card style={styles.metricTile}>
                      <Text variant="caption" muted>
                        Complaints
                      </Text>
                      <Text variant="counter" style={{ fontVariant: ['tabular-nums'] }}>
                        {data.counters.complaints.pending}
                      </Text>
                      <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
                        {data.counters.complaints.OPEN} unassigned
                      </Text>
                    </Card>
                  </PressableScale>
                </View>

                <PressableScale onPress={() => router.push('/projects' as Href)}>
                  <Card style={styles.wideMetric}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="caption" muted>
                        Running projects
                      </Text>
                      <Text variant="counter" style={{ fontVariant: ['tabular-nums'] }}>
                        {data.counters.projects.running}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: space[2] }}>
                      <Badge label={`${data.counters.projects.design} design`} t="violet" />
                      <Badge label={`${data.counters.projects.site} site`} t="orange" />
                    </View>
                  </Card>
                </PressableScale>

                <View style={styles.gridRow}>
                  <PressableScale style={{ flex: 1 }} onPress={() => router.push('/proposals' as Href)}>
                    <Card style={styles.metricTile}>
                      <Text variant="caption" muted>
                        Pipeline
                      </Text>
                      <Text variant="counter" style={{ fontVariant: ['tabular-nums'] }}>
                        {formatINRShort(data.counters.value.pipeline)}
                        {data.counters.value.pipelineCapped ? '+' : ''}
                      </Text>
                      <Text variant="caption" muted>
                        Open quotes
                      </Text>
                    </Card>
                  </PressableScale>

                  <PressableScale style={{ flex: 1 }} onPress={() => router.push('/customers' as Href)}>
                    <Card style={styles.metricTile}>
                      <Text variant="caption" muted>
                        Won ({rangeTitle.toLowerCase()})
                      </Text>
                      <Text variant="counter" color={colors.primary} style={{ fontVariant: ['tabular-nums'] }}>
                        {formatINRShort(data.counters.value.wonInRange)}
                      </Text>
                      <Text variant="caption" muted>
                        Converted value
                      </Text>
                    </Card>
                  </PressableScale>
                </View>
              </View>
            </Reveal>
          ) : null}

          {/* CUSTOMER ACTIVITY */}
          {data.recent ? (
            <Reveal index={3}>
              <View style={{ gap: space[2] }}>
                <Text variant="caption" muted style={styles.eyebrow}>
                  CUSTOMER ACTIVITY
                </Text>
                {data.recent.length === 0 ? (
                  <Card>
                    <Text muted>No recent project updates yet.</Text>
                  </Card>
                ) : (
                  <Card style={{ gap: space[3] }}>
                    {data.recent.slice(0, 5).map((item, idx) => (
                      <PressableScale
                        key={`${item.postId}-${item.kind}-${idx}`}
                        onPress={() =>
                          router.push({
                            pathname: '/projects/[id]',
                            params: { id: item.projectId },
                          } as Href)
                        }
                        style={[
                          styles.recentRow,
                          idx < Math.min(data.recent!.length, 5) - 1 && styles.recentDivider,
                        ]}
                      >
                        <View
                          style={[
                            styles.recentIcon,
                            {
                              backgroundColor:
                                item.kind === 'APPROVAL' ? tone.success.bg : colors.muted,
                            },
                          ]}
                        >
                          <Feather
                            name={RECENT_ICON[item.kind]}
                            size={15}
                            color={
                              item.kind === 'APPROVAL' ? tone.success.fg : colors.mutedForeground
                            }
                          />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
                            <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
                              {item.projectName}
                            </Text>
                            <Text variant="caption" muted>
                              {timeAgo(item.at)}
                            </Text>
                          </View>
                          <Text variant="caption" muted numberOfLines={1}>
                            {item.authorName} {RECENT_VERB[item.kind]}
                            {item.hasPhotos ? ' · 📷' : ''}
                          </Text>
                          {item.snippet ? (
                            <Text variant="caption" numberOfLines={1}>
                              {item.snippet}
                            </Text>
                          ) : null}
                        </View>
                      </PressableScale>
                    ))}
                  </Card>
                )}
              </View>
            </Reveal>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  rangeRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  eyebrow: {
    letterSpacing: 0.6,
  },
  partialWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: tone.warning.bg,
    borderColor: tone.warning.bg,
  },
  allClearCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bucketPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.full,
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  gridRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  metricTile: {
    gap: 4,
    padding: space[4],
  },
  wideMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  recentDivider: {
    paddingBottom: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  recentIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});
