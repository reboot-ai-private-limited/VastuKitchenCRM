import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { DashboardAttentionDto } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
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
import { ComplaintsCard, KpiRow, TeamCard } from './admin-dashboard-parts';
import { NetworkError } from '@/lib/api/client';
import { getDashboard } from '@/lib/api/endpoints/dashboard';
import { useSession } from '@/lib/auth/session';
import {
  addDays,
  businessDate,
  businessMonth,
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

function daysInRange(r: { from: string; to: string }): number {
  const ms = new Date(r.to + 'T00:00:00Z').getTime() - new Date(r.from + 'T00:00:00Z').getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

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

          {/* KPI ROW + TEAM (same order as the website dashboard) */}
          {data.counters ? (
            <Reveal>
              <KpiRow counters={data.counters} staff={data.staff} />
            </Reveal>
          ) : null}

          {data.people ? (
            <Reveal index={1}>
              <View style={{ gap: space[2] }}>
                <Text variant="caption" muted style={styles.eyebrow}>
                  TEAM · {rangeTitle.toUpperCase()}
                </Text>
                <TeamCard people={data.people} days={daysInRange(range)} offDay={data.staff?.offDay ?? false} />
              </View>
            </Reveal>
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

          {/* COMPLAINTS */}
          {data.counters && attention ? (
            <Reveal index={1}>
              <View style={{ gap: space[2] }}>
                <Text variant="caption" muted style={styles.eyebrow}>
                  COMPLAINTS · PENDING NOW
                </Text>
                <ComplaintsCard counts={data.counters.complaints} overdue={attention.overdueComplaints} />
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
