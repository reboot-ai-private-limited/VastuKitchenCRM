import type React from 'react';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BoardDto } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, hit, radius, space, type Tone } from '@/constants/theme';
import { NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { addDays, businessDate, formatDay, formatTime } from '@/lib/format';
import { CheckInCard } from './check-in-card';
import { useAttendanceBoard } from './use-attendance';

type Filter = 'all' | 'present' | 'absent' | 'missingOut';
type BoardItem = BoardDto['items'][number];

const DAY_TONE: Record<BoardItem['day']['status'], Tone> = {
  PRESENT: 'success',
  ABSENT: 'danger',
  OFF: 'neutral',
  FUTURE: 'neutral',
};

const DAY_LABEL: Record<BoardItem['day']['status'], string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  OFF: 'Off',
  FUTURE: 'Upcoming',
};

function BoardRow({ item }: { item: BoardItem }) {
  const router = useRouter();
  const { day } = item;
  const timeText = day.inAt
    ? `${formatTime(day.inAt)}${day.outAt ? ` – ${formatTime(day.outAt)}` : ''}`
    : null;

  return (
    <Reveal>
      <PressableScale
        onPress={() =>
          router.push({ pathname: '/attendance/[userId]', params: { userId: item.userId } } as Href)
        }
      >
        <Card style={styles.rowCard}>
          <Avatar name={item.name} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" numberOfLines={1}>
              {item.name}
            </Text>
            <Text variant="caption" muted numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
              {item.designation ?? item.attendanceType}
              {timeText ? `  ·  ${timeText}` : ''}
            </Text>
          </View>
          <View style={styles.badgesCol}>
            {day.status !== 'FUTURE' ? (
              <Badge label={DAY_LABEL[day.status]} t={DAY_TONE[day.status]} />
            ) : null}
            {day.missingOut ? <Badge label="No out" t="warning" /> : null}
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Card>
      </PressableScale>
    </Reveal>
  );
}

export function AttendanceBoardView({ standalone = false }: { standalone?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const today = businessDate();
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState<Filter>('all');
  const q = useAttendanceBoard(date);
  const canGoForward = date < today;

  const items = (q.data?.items ?? []).filter((it) => {
    if (filter === 'present') return it.day.status === 'PRESENT';
    if (filter === 'absent') return it.day.status === 'ABSENT';
    if (filter === 'missingOut') return it.day.missingOut;
    return true;
  });

  const header = (
    <View style={{ gap: space[4], paddingBottom: space[2] }}>
      {!standalone ? (
        <View style={styles.titleBar}>
          <View style={{ flex: 1 }}>
            <Text variant="title">Attendance</Text>
            <Text variant="caption" muted>
              Daily staff board
            </Text>
          </View>
          {user ? (
            <Avatar name={user.name} size={36} accent onPress={() => router.push('/profile' as Href)} />
          ) : null}
        </View>
      ) : null}

      {!standalone ? <CheckInCard /> : null}

      <Card style={styles.stepperCard}>
        <PressableScale
          onPress={() => setDate((d) => addDays(d, -1))}
          accessibilityLabel="Previous day"
          style={styles.stepBtn}
        >
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </PressableScale>

        <PressableScale
          onPress={() => setDate(today)}
          disabled={date === today}
          accessibilityLabel="Jump to today"
          style={{ alignItems: 'center', flex: 1 }}
        >
          <Text variant="section" style={{ fontVariant: ['tabular-nums'] }}>
            {formatDay(date)}
          </Text>
          <Text variant="caption" color={date === today ? colors.mutedForeground : colors.primary}>
            {date === today ? (q.data?.offDay ? 'Today · Weekly off' : 'Today') : 'Tap for Today'}
          </Text>
        </PressableScale>

        <PressableScale
          onPress={() => canGoForward && setDate((d) => addDays(d, 1))}
          disabled={!canGoForward}
          accessibilityLabel="Next day"
          style={[styles.stepBtn, !canGoForward && { opacity: 0.35 }]}
        >
          <Feather name="chevron-right" size={20} color={colors.foreground} />
        </PressableScale>
      </Card>

      {q.data ? (
        <View style={styles.countersRow}>
          <Card style={styles.counterTile}>
            <Text variant="caption" muted>
              Present
            </Text>
            <Text variant="counter" color={colors.primary} style={{ fontVariant: ['tabular-nums'] }}>
              {q.data.counts.present}
            </Text>
          </Card>
          <Card style={styles.counterTile}>
            <Text variant="caption" muted>
              Absent
            </Text>
            <Text variant="counter" style={{ fontVariant: ['tabular-nums'] }}>
              {q.data.counts.absent}
            </Text>
          </Card>
          <Card style={styles.counterTile}>
            <Text variant="caption" muted>
              No out
            </Text>
            <Text variant="counter" style={{ fontVariant: ['tabular-nums'] }}>
              {q.data.counts.missingOut}
            </Text>
          </Card>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
        {(
          [
            ['all', 'All'],
            ['present', 'Present'],
            ['absent', 'Absent'],
            ['missingOut', 'Missing out'],
          ] as const
        ).map(([k, label]) => {
          const active = filter === k;
          return (
            <PressableScale
              key={k}
              onPress={() => setFilter(k)}
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
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} style={{ gap: space[2] }}>
            <Skeleton height={18} width="55%" />
            <Skeleton width="35%" />
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
    empty = <EmptyState icon="users" message="No staff match this filter." />;
  }

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={{
        paddingTop: standalone ? space[2] : insets.top + space[4],
        paddingHorizontal: space[4],
        paddingBottom: insets.bottom + space[8],
        gap: space[3],
      }}
      data={items}
      keyExtractor={(it) => it.userId}
      renderItem={({ item }) => <BoardRow item={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          tintColor={colors.primary}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  stepperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[2],
    paddingHorizontal: space[2],
  },
  stepBtn: {
    width: hit,
    height: hit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countersRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  counterTile: {
    flex: 1,
    padding: space[3],
    gap: 2,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  badgesCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary },
});
