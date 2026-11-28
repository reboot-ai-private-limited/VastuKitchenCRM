import { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AttendanceDayDto } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space, tone, type Tone } from '@/constants/theme';
import { ApiError, NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { addMonths, businessDate, businessMonth, formatDay, formatMonthLabel, formatTime } from '@/lib/format';
import { CheckInCard } from './check-in-card';
import { CorrectDaySheet, type CorrectDayTarget } from './correct-day-sheet';
import { useMyAttendanceMonth, useUserAttendanceMonth } from './use-attendance';

const STATUS_TONE: Record<AttendanceDayDto['status'], Tone> = {
  PRESENT: 'success',
  ABSENT: 'danger',
  OFF: 'neutral',
  FUTURE: 'neutral',
};

const STATUS_LABEL: Record<AttendanceDayDto['status'], string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  OFF: 'Weekly off',
  FUTURE: 'Upcoming',
};

const METHOD_LABEL: Record<NonNullable<AttendanceDayDto['method']>, string> = {
  GPS: 'GPS check-in',
  BIOMETRIC_SIM: 'Biometric punch',
  MANUAL: 'Entered by HR',
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function MonthCalendarGrid({
  month,
  days,
  selectedDate,
  onSelect,
}: {
  month: string;
  days: AttendanceDayDto[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const [y, m] = month.split('-').map(Number);
  const firstDow = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, 1)).getUTCDay();
  const leadingBlanks = (firstDow + 6) % 7; // Mon = 0 .. Sun = 6

  const cells: (AttendanceDayDto | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Card style={{ gap: space[2], padding: space[3] }}>
      <View style={styles.calRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} variant="caption" muted style={styles.calHead}>
            {w}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, rowIdx) => (
        <View key={rowIdx} style={styles.calRow}>
          {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((d, colIdx) => {
            if (!d) return <View key={colIdx} style={styles.calCell} />;
            const dayNum = Number(d.date.slice(8, 10));
            const selected = selectedDate === d.date;
            const cellBg =
              d.status === 'PRESENT'
                ? tone.success.bg
                : d.status === 'ABSENT'
                  ? tone.danger.bg
                  : d.status === 'OFF'
                    ? colors.muted
                    : 'transparent';
            const cellFg =
              d.status === 'PRESENT'
                ? tone.success.fg
                : d.status === 'ABSENT'
                  ? tone.danger.fg
                  : d.status === 'FUTURE'
                    ? colors.placeholder
                    : colors.inkMuted;

            return (
              <PressableScale
                key={d.date}
                onPress={() => onSelect(d.date)}
                style={[
                  styles.calCell,
                  { backgroundColor: cellBg },
                  d.missingOut && styles.calMissingOut,
                  selected && styles.calSelected,
                ]}
              >
                <Text
                  variant="caption"
                  color={cellFg}
                  style={{ fontFamily: selected ? font.semibold : font.medium, fontVariant: ['tabular-nums'] }}
                >
                  {dayNum}
                </Text>
                {d.corrected ? <View style={styles.correctedDot} /> : null}
              </PressableScale>
            );
          })}
        </View>
      ))}
    </Card>
  );
}

function MonthBody({
  month,
  onPrev,
  onNext,
  canNext,
  isPending,
  isError,
  error,
  onRetry,
  data,
  showCheckIn,
  canEdit,
  onEditDay,
}: {
  month: string;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
  data?: {
    name: string;
    workingDays: number;
    presentDays: number;
    missingOutDays: number;
    days: AttendanceDayDto[];
  };
  showCheckIn?: boolean;
  canEdit?: boolean;
  onEditDay?: (day: AttendanceDayDto) => void;
}) {
  const today = businessDate();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const notTracked = isError && error instanceof ApiError && error.status === 404;

  const visibleDays = (data?.days ?? [])
    .filter((d) => (selectedDate ? d.date === selectedDate : d.status !== 'FUTURE'))
    .slice()
    .reverse();

  return (
    <View style={{ gap: space[4] }}>
      {showCheckIn ? <CheckInCard showHistoryLink={false} /> : null}

      <Card style={styles.stepper}>
        <PressableScale
          onPress={() => {
            setSelectedDate(null);
            onPrev();
          }}
          accessibilityLabel="Previous month"
          style={styles.stepBtn}
        >
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </PressableScale>
        <Text variant="section" style={{ flex: 1, textAlign: 'center' }}>
          {formatMonthLabel(month)}
        </Text>
        <PressableScale
          onPress={() => {
            setSelectedDate(null);
            onNext();
          }}
          disabled={!canNext}
          accessibilityLabel="Next month"
          style={[styles.stepBtn, !canNext && { opacity: 0.35 }]}
        >
          <Feather name="chevron-right" size={20} color={colors.foreground} />
        </PressableScale>
      </Card>

      {isPending ? (
        <View style={{ gap: space[3] }}>
          <Skeleton height={80} />
          <Skeleton height={180} />
          <Skeleton height={64} />
        </View>
      ) : notTracked ? (
        <EmptyState icon="calendar" message="Attendance is not tracked for this account." />
      ) : isError || !data ? (
        <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[8] }}>
          <Text muted style={{ textAlign: 'center' }}>
            {error instanceof NetworkError
              ? 'Connection lost. Check your internet and try again.'
              : (error?.message ?? 'Could not load attendance.')}
          </Text>
          <Button title="Retry" variant="outline" onPress={onRetry} />
        </View>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <Card style={styles.summaryTile}>
              <Text variant="caption" muted>
                Present
              </Text>
              <Text variant="counter" color={colors.primary} style={{ fontVariant: ['tabular-nums'] }}>
                {data.presentDays}
              </Text>
            </Card>
            <Card style={styles.summaryTile}>
              <Text variant="caption" muted>
                Working
              </Text>
              <Text variant="counter" style={{ fontVariant: ['tabular-nums'] }}>
                {data.workingDays}
              </Text>
            </Card>
            <Card style={styles.summaryTile}>
              <Text variant="caption" muted>
                No out
              </Text>
              <Text variant="counter" style={{ fontVariant: ['tabular-nums'] }}>
                {data.missingOutDays}
              </Text>
            </Card>
          </View>

          <MonthCalendarGrid
            month={month}
            days={data.days}
            selectedDate={selectedDate}
            onSelect={(d) => setSelectedDate((cur) => (cur === d ? null : d))}
          />

          {selectedDate ? (
            <PressableScale onPress={() => setSelectedDate(null)} style={{ alignSelf: 'flex-end' }}>
              <Text variant="caption" color={colors.primary} style={{ fontFamily: font.semibold }}>
                Show all days
              </Text>
            </PressableScale>
          ) : null}

          <View style={{ gap: space[2] }}>
            {visibleDays.map((d) => {
              const editable = !!canEdit && d.status !== 'FUTURE' && d.date <= today;
              return (
                <Card key={d.date} style={styles.dayCard}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label" style={{ fontVariant: ['tabular-nums'] }}>
                      {formatDay(d.date)}
                    </Text>
                    <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
                      {d.inAt
                        ? `In ${formatTime(d.inAt)}${d.outAt ? `  ·  Out ${formatTime(d.outAt)}` : ''}`
                        : d.offDay
                          ? 'Weekly off'
                          : d.status === 'FUTURE'
                            ? 'Upcoming'
                            : 'No check-in recorded'}
                    </Text>
                    {d.method ? (
                      <Text variant="caption" muted>
                        {METHOD_LABEL[d.method]}
                      </Text>
                    ) : null}
                    {d.note ? (
                      <Text variant="caption" muted>
                        Note: {d.note}
                      </Text>
                    ) : null}
                    {d.inLocation ? (
                      <PressableScale
                        onPress={() =>
                          void Linking.openURL(
                            `https://www.google.com/maps/search/?api=1&query=${d.inLocation!.lat},${d.inLocation!.lng}`,
                          )
                        }
                        style={{ paddingVertical: 4, alignSelf: 'flex-start' }}
                      >
                        <Text variant="caption" color={colors.primary}>
                          Open check-in location in Maps
                        </Text>
                      </PressableScale>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Badge label={STATUS_LABEL[d.status]} t={STATUS_TONE[d.status]} />
                    {d.missingOut ? <Badge label="Missing out" t="warning" /> : null}
                    {d.corrected ? <Badge label="Corrected" t="info" /> : null}
                    {editable && onEditDay ? (
                      <PressableScale
                        onPress={() => onEditDay(d)}
                        style={styles.editLink}
                      >
                        <Feather name="edit-2" size={12} color={colors.primary} />
                        <Text variant="caption" color={colors.primary} style={{ fontFamily: font.semibold }}>
                          {d.inAt ? 'Correct' : 'Enter'}
                        </Text>
                      </PressableScale>
                    ) : null}
                  </View>
                </Card>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

export function MyAttendanceScreen() {
  const insets = useSafeAreaInsets();
  const current = businessMonth();
  const [month, setMonth] = useState(current);
  const q = useMyAttendanceMonth(month, true);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          paddingTop: insets.top + space[4],
          paddingHorizontal: space[4],
          paddingBottom: insets.bottom + space[8],
          gap: space[4],
        }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => void q.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <Text variant="title" color={colors.inkDeep} style={{ textAlign: 'center' }}>
          My attendance
        </Text>
        <MonthBody
          month={month}
          onPrev={() => setMonth((m) => addMonths(m, -1))}
          onNext={() => month < current && setMonth((m) => addMonths(m, 1))}
          canNext={month < current}
          isPending={q.isPending}
          isError={q.isError}
          error={q.error}
          onRetry={() => void q.refetch()}
          data={q.data}
          showCheckIn
        />
      </ScrollView>
    </>
  );
}

export function PersonAttendanceScreen({ userId }: { userId: string }) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { month: monthParam } = useLocalSearchParams<{ month?: string }>();
  const current = businessMonth();
  const initialMonth =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) && monthParam <= current ? monthParam : current;
  const [month, setMonth] = useState(initialMonth);
  const [correctTarget, setCorrectTarget] = useState<CorrectDayTarget | null>(null);
  const q = useUserAttendanceMonth(userId, month);
  const canEdit = user?.role === 'ADMIN' || user?.role === 'HR';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: q.data?.name ?? 'Attendance',
          headerShadowVisible: false,
          headerTintColor: colors.primary,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: space[4], paddingBottom: insets.bottom + space[8] }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => void q.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <MonthBody
          month={month}
          onPrev={() => setMonth((m) => addMonths(m, -1))}
          onNext={() => month < current && setMonth((m) => addMonths(m, 1))}
          canNext={month < current}
          isPending={q.isPending}
          isError={q.isError}
          error={q.error}
          onRetry={() => void q.refetch()}
          data={q.data}
          canEdit={canEdit}
          onEditDay={(day) =>
            setCorrectTarget({
              userId,
              name: q.data?.name ?? 'Employee',
              date: day.date,
              day,
            })
          }
        />
      </ScrollView>

      <CorrectDaySheet target={correctTarget} onClose={() => setCorrectTarget(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[1],
    paddingHorizontal: space[2],
  },
  stepBtn: {
    width: hit,
    height: hit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  summaryTile: {
    flex: 1,
    padding: space[3],
    gap: 2,
  },
  calRow: {
    flexDirection: 'row',
    gap: 4,
  },
  calHead: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font.semibold,
  },
  calCell: {
    flex: 1,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  calMissingOut: {
    borderWidth: 1.5,
    borderColor: tone.warning.fg,
  },
  calSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  correctedDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: tone.info.fg,
  },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
});
