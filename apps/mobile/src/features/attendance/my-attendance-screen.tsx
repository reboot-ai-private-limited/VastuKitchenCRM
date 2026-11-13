import { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AttendanceDayDto } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, hit, space, type Tone } from '@/constants/theme';
import { ApiError, NetworkError } from '@/lib/api/client';
import { addMonths, businessMonth, formatDay, formatMonthLabel, formatTime } from '@/lib/format';
import { CheckInCard } from './check-in-card';
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
}) {
  const notTracked = isError && error instanceof ApiError && error.status === 404;

  return (
    <View style={{ gap: space[4] }}>
      {showCheckIn ? <CheckInCard showHistoryLink={false} /> : null}

      <Card style={styles.stepper}>
        <PressableScale onPress={onPrev} accessibilityLabel="Previous month" style={styles.stepBtn}>
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </PressableScale>
        <Text variant="section" style={{ flex: 1, textAlign: 'center' }}>
          {formatMonthLabel(month)}
        </Text>
        <PressableScale
          onPress={onNext}
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
          <Skeleton height={64} />
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

          <View style={{ gap: space[2] }}>
            {data.days
              .filter((d) => d.status !== 'FUTURE')
              .slice()
              .reverse()
              .map((d) => (
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
                          : 'No check-in recorded'}
                    </Text>
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
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge label={STATUS_LABEL[d.status]} t={STATUS_TONE[d.status]} />
                    {d.missingOut ? <Badge label="Missing out" t="warning" /> : null}
                    {d.corrected ? <Badge label="Corrected" t="info" /> : null}
                  </View>
                </Card>
              ))}
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
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'My attendance',
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
          showCheckIn
        />
      </ScrollView>
    </>
  );
}

export function PersonAttendanceScreen({ userId }: { userId: string }) {
  const insets = useSafeAreaInsets();
  const current = businessMonth();
  const [month, setMonth] = useState(current);
  const q = useUserAttendanceMonth(userId, month);

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
        />
      </ScrollView>
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
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
});
