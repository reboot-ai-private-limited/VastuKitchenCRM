import type React from 'react';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BoardDto, RangeDto } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space, tone, type Tone } from '@/constants/theme';
import { SlidingSwitch } from '@/features/projects/sliding-switch';
import { NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { addDays, addMonths, businessDate, formatDay, formatTime } from '@/lib/format';
import { CheckInCard } from './check-in-card';
import { CorrectDaySheet, type CorrectDayTarget } from './correct-day-sheet';
import { useAttendanceBoard, useAttendanceRange } from './use-attendance';

type Filter = 'all' | 'present' | 'absent' | 'missingOut';
type Mode = 'day' | 'range';
type BoardItem = BoardDto['items'][number];
type RangeItem = RangeDto['items'][number];

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

const TYPE_LABEL: Record<BoardItem['attendanceType'], string> = {
  GPS: 'GPS',
  BIOMETRIC: 'Biometric',
};

function formatWorked(minutes: number): string {
  if (minutes <= 0) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function monthBounds(ym: string, today: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y ?? 2026, m ?? 1, 0)).getUTCDate();
  const from = `${ym}-01`;
  const monthEnd = `${ym}-${String(lastDay).padStart(2, '0')}`;
  return { from, to: monthEnd > today ? today : monthEnd };
}

function BoardRow({
  item,
  date,
  canEdit,
  onEdit,
}: {
  item: BoardItem;
  date: string;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const { day } = item;
  const timeText = day.inAt
    ? `${formatTime(day.inAt)}${day.outAt ? ` – ${formatTime(day.outAt)}` : ''}`
    : null;
  const subParts = [item.designation, TYPE_LABEL[item.attendanceType], timeText].filter(Boolean);

  return (
    <Reveal>
      <Card style={styles.rowCard}>
        <PressableScale
          onPress={() =>
            router.push({
              pathname: '/attendance/[userId]',
              params: { userId: item.userId, month: date.slice(0, 7) },
            } as Href)
          }
          style={styles.rowMain}
        >
          <Avatar name={item.name} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" numberOfLines={1}>
              {item.name}
            </Text>
            <Text variant="caption" muted numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
              {subParts.join(' · ')}
            </Text>
          </View>
          <View style={styles.badgesCol}>
            {day.status !== 'FUTURE' ? (
              <Badge label={DAY_LABEL[day.status]} t={DAY_TONE[day.status]} />
            ) : null}
            {day.missingOut ? <Badge label="No out" t="warning" /> : null}
            {day.corrected ? <Badge label="Corrected" t="info" /> : null}
          </View>
        </PressableScale>
        {canEdit ? (
          <PressableScale
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}'s attendance`}
            style={styles.editBtn}
          >
            <Feather name="edit-2" size={15} color={colors.inkMuted} />
          </PressableScale>
        ) : (
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        )}
      </Card>
    </Reveal>
  );
}

function RangeRow({ item, toMonth }: { item: RangeItem; toMonth: string }) {
  const router = useRouter();
  return (
    <Reveal>
      <PressableScale
        onPress={() =>
          router.push({
            pathname: '/attendance/[userId]',
            params: { userId: item.userId, month: toMonth },
          } as Href)
        }
      >
        <Card style={{ gap: space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Avatar name={item.name} size={36} />
            <View style={{ flex: 1 }}>
              <Text variant="label" numberOfLines={1}>
                {item.name}
              </Text>
              <Text variant="caption" muted numberOfLines={1}>
                {[item.designation, TYPE_LABEL[item.attendanceType]].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </View>
          <View style={styles.rangeStats}>
            <View style={styles.statCell}>
              <Text variant="caption" muted>
                Present
              </Text>
              <Text variant="label" color={tone.success.fg} style={styles.tabular}>
                {item.present}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Text variant="caption" muted>
                Absent
              </Text>
              <Text
                variant="label"
                color={item.absent > 0 ? tone.danger.fg : colors.inkMuted}
                style={styles.tabular}
              >
                {item.absent}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Text variant="caption" muted>
                No out
              </Text>
              <Text
                variant="label"
                color={item.missingOut > 0 ? tone.warning.fg : colors.inkMuted}
                style={styles.tabular}
              >
                {item.missingOut}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Text variant="caption" muted>
                Hours
              </Text>
              <Text variant="label" color={colors.inkDeep} style={styles.tabular}>
                {formatWorked(item.workedMinutes)}
              </Text>
            </View>
          </View>
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
  const canEdit = user?.role === 'ADMIN' || user?.role === 'HR';

  const [mode, setMode] = useState<Mode>('day');
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState<Filter>('all');
  const [dateJumpOpen, setDateJumpOpen] = useState(false);
  const [dateInput, setDateInput] = useState(today);
  const [correctTarget, setCorrectTarget] = useState<CorrectDayTarget | null>(null);

  const initialMonth = monthBounds(today.slice(0, 7), today);
  const [fromDate, setFromDate] = useState(initialMonth.from);
  const [toDate, setToDate] = useState(initialMonth.to);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [fromInput, setFromInput] = useState(initialMonth.from);
  const [toInput, setToInput] = useState(initialMonth.to);

  const dayQ = useAttendanceBoard(date);
  const rangeQ = useAttendanceRange(fromDate, toDate, mode === 'range');
  const canGoForward = date < today;

  const dayItems = (dayQ.data?.items ?? []).filter((it) => {
    if (filter === 'present') return it.day.status === 'PRESENT';
    if (filter === 'absent') return it.day.status === 'ABSENT';
    if (filter === 'missingOut') return it.day.missingOut;
    return true;
  });

  const applyDateJump = () => {
    const clean = dateInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean) || clean > today) return;
    setDate(clean);
    setDateJumpOpen(false);
  };

  const applyCustomRange = () => {
    const f = fromInput.trim();
    const t = toInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t) || f > t || t > today) {
      return;
    }
    setFromDate(f);
    setToDate(t);
    setRangeOpen(false);
  };

  const applyPreset = (preset: '7d' | 'thisMonth' | 'lastMonth') => {
    if (preset === '7d') {
      setFromDate(addDays(today, -6));
      setToDate(today);
    } else if (preset === 'thisMonth') {
      const r = monthBounds(today.slice(0, 7), today);
      setFromDate(r.from);
      setToDate(r.to);
    } else {
      const prev = addMonths(today.slice(0, 7), -1);
      const r = monthBounds(prev, today);
      setFromDate(r.from);
      setToDate(r.to);
    }
  };

  const header = (
    <View style={{ gap: space[3], paddingBottom: space[2] }}>
      {!standalone ? (
        <View style={styles.titleBar}>
          <View style={{ flex: 1 }}>
            <Text variant="title">Attendance</Text>
            <Text variant="caption" muted>
              {mode === 'day' ? 'Daily staff board' : 'Range summary'}
            </Text>
          </View>
          {user ? (
            <Avatar name={user.name} size={36} accent onPress={() => router.push('/profile' as Href)} />
          ) : null}
        </View>
      ) : null}

      {!standalone ? <CheckInCard /> : null}

      <SlidingSwitch
        options={[
          { value: 'day' as const, label: 'Day' },
          { value: 'range' as const, label: 'Range' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'day' ? (
        <>
          <Card style={styles.stepperCard}>
            <PressableScale
              onPress={() => setDate((d) => addDays(d, -1))}
              accessibilityLabel="Previous day"
              style={styles.stepBtn}
            >
              <Feather name="chevron-left" size={20} color={colors.foreground} />
            </PressableScale>

            <PressableScale
              onPress={() => {
                setDateInput(date);
                setDateJumpOpen(true);
              }}
              accessibilityLabel="Pick date"
              style={{ alignItems: 'center', flex: 1 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text variant="section" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatDay(date)}
                </Text>
                <Feather name="calendar" size={14} color={colors.inkMuted} />
              </View>
              <Text variant="caption" color={dayQ.data?.offDay ? tone.warning.fg : colors.mutedForeground}>
                {date === today
                  ? dayQ.data?.offDay
                    ? 'Today · Weekly off'
                    : 'Today'
                  : dayQ.data?.offDay
                    ? 'Weekly off'
                    : 'Tap to change date'}
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

          {date !== today ? (
            <PressableScale onPress={() => setDate(today)} style={styles.todayChip}>
              <Text variant="caption" color={colors.primary} style={{ fontFamily: font.semibold }}>
                Jump to Today
              </Text>
            </PressableScale>
          ) : null}

          {dayQ.data ? (
            <View style={styles.countersRow}>
              <Card style={styles.counterTile}>
                <Text variant="caption" muted>
                  Present
                </Text>
                <Text variant="counter" color={colors.primary} style={styles.tabular}>
                  {dayQ.data.counts.present}
                </Text>
              </Card>
              <Card style={styles.counterTile}>
                <Text variant="caption" muted>
                  Absent
                </Text>
                <Text variant="counter" style={styles.tabular}>
                  {dayQ.data.counts.absent}
                </Text>
              </Card>
              <Card style={styles.counterTile}>
                <Text variant="caption" muted>
                  No out
                </Text>
                <Text variant="counter" style={styles.tabular}>
                  {dayQ.data.counts.missingOut}
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
        </>
      ) : (
        <>
          <Card style={{ gap: space[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text variant="label" style={styles.tabular}>
                  {formatDay(fromDate)} – {formatDay(toDate)}
                </Text>
                {rangeQ.data ? (
                  <Text variant="caption" muted style={styles.tabular}>
                    {rangeQ.data.workingDays} working day{rangeQ.data.workingDays === 1 ? '' : 's'}
                  </Text>
                ) : null}
              </View>
              <Button
                title="Custom"
                variant="outline"
                size="sm"
                onPress={() => {
                  setFromInput(fromDate);
                  setToInput(toDate);
                  setRangeOpen(true);
                }}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
              <PressableScale onPress={() => applyPreset('7d')} style={styles.chip}>
                <Text variant="caption" color={colors.inkDeep}>
                  Last 7 days
                </Text>
              </PressableScale>
              <PressableScale onPress={() => applyPreset('thisMonth')} style={styles.chip}>
                <Text variant="caption" color={colors.inkDeep}>
                  This month
                </Text>
              </PressableScale>
              <PressableScale onPress={() => applyPreset('lastMonth')} style={styles.chip}>
                <Text variant="caption" color={colors.inkDeep}>
                  Last month
                </Text>
              </PressableScale>
            </ScrollView>
          </Card>
        </>
      )}
    </View>
  );

  const activeQ = mode === 'day' ? dayQ : rangeQ;
  let empty: React.ReactElement | undefined;
  if (activeQ.isPending) {
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
  } else if (activeQ.isError) {
    empty = (
      <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[8] }}>
        <Text muted style={{ textAlign: 'center' }}>
          {activeQ.error instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : activeQ.error.message}
        </Text>
        <Button title="Retry" variant="outline" onPress={() => void activeQ.refetch()} />
      </View>
    );
  } else {
    empty = <EmptyState icon="users" message="No staff match this filter." />;
  }

  return (
    <>
      {mode === 'day' ? (
        <FlatList
          style={styles.root}
          contentContainerStyle={{
            paddingTop: standalone ? space[2] : insets.top + space[4],
            paddingHorizontal: space[4],
            paddingBottom: insets.bottom + space[8],
            gap: space[3],
          }}
          data={dayItems}
          keyExtractor={(it) => it.userId}
          renderItem={({ item }) => (
            <BoardRow
              item={item}
              date={date}
              canEdit={canEdit}
              onEdit={() =>
                setCorrectTarget({
                  userId: item.userId,
                  name: item.name,
                  date,
                  day: item.day,
                })
              }
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          refreshControl={
            <RefreshControl
              refreshing={dayQ.isRefetching}
              onRefresh={() => void dayQ.refetch()}
              tintColor={colors.primary}
            />
          }
        />
      ) : (
        <FlatList
          style={styles.root}
          contentContainerStyle={{
            paddingTop: standalone ? space[2] : insets.top + space[4],
            paddingHorizontal: space[4],
            paddingBottom: insets.bottom + space[8],
            gap: space[3],
          }}
          data={rangeQ.data?.items ?? []}
          keyExtractor={(it) => it.userId}
          renderItem={({ item }) => <RangeRow item={item} toMonth={toDate.slice(0, 7)} />}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          refreshControl={
            <RefreshControl
              refreshing={rangeQ.isRefetching}
              onRefresh={() => void rangeQ.refetch()}
              tintColor={colors.primary}
            />
          }
        />
      )}

      <BottomSheet
        visible={dateJumpOpen}
        onClose={() => setDateJumpOpen(false)}
        title="Jump to date"
        footer={<Button title="Go to date" onPress={applyDateJump} fullWidth />}
      >
        <View style={{ gap: space[2] }}>
          <Input
            label="Date (YYYY-MM-DD)"
            value={dateInput}
            onChangeText={setDateInput}
            placeholder={today}
          />
          <Button
            title="Today"
            variant="outline"
            onPress={() => {
              setDate(today);
              setDateJumpOpen(false);
            }}
            fullWidth
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={rangeOpen}
        onClose={() => setRangeOpen(false)}
        title="Custom date range"
        subtitle="Up to 92 days (inclusive)"
        footer={<Button title="Apply range" onPress={applyCustomRange} fullWidth />}
      >
        <View style={{ gap: space[3] }}>
          <Input label="From (YYYY-MM-DD)" value={fromInput} onChangeText={setFromInput} placeholder={today} />
          <Input label="To (YYYY-MM-DD)" value={toInput} onChangeText={setToInput} placeholder={today} />
        </View>
      </BottomSheet>

      <CorrectDaySheet target={correctTarget} onClose={() => setCorrectTarget(null)} />
    </>
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
  todayChip: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: space[3],
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
    gap: space[2],
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
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
  rangeStats: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space[2],
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
