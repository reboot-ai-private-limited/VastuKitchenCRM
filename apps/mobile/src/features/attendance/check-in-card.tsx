import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, radius, space, tone } from '@/constants/theme';
import { ApiError, NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { businessDate, businessMonth, formatTime } from '@/lib/format';
import { useMyAttendanceMonth, usePunchAttendance } from './use-attendance';

export function CheckInCard({ showHistoryLink = true }: { showHistoryLink?: boolean }) {
  const { user } = useSession();
  const router = useRouter();
  const isGpsStaff = !!user && user.role !== 'CUSTOMER' && user.attendanceType === 'GPS';
  const month = businessMonth();
  const todayStr = businessDate();
  const q = useMyAttendanceMonth(month, isGpsStaff);
  const punch = usePunchAttendance();

  if (!isGpsStaff) return null;

  if (q.isPending) {
    return (
      <Card style={{ gap: space[2] }}>
        <Skeleton height={18} width="45%" />
        <Skeleton height={44} />
      </Card>
    );
  }

  if (q.isError && q.error instanceof ApiError && q.error.status === 404) {
    return null;
  }

  const today = q.data?.days.find((d) => d.date === todayStr);
  const checkedIn = !!today?.inAt;
  const checkedOut = !!today?.outAt;

  const statusTone = checkedOut ? 'neutral' : checkedIn ? 'success' : 'warning';
  const statusLabel = checkedOut
    ? 'Shift complete'
    : checkedIn
      ? 'Checked in'
      : 'Not checked in';

  const subtitle = checkedOut
    ? `In ${formatTime(today.inAt!)}  ·  Out ${formatTime(today.outAt!)}`
    : checkedIn
      ? `Checked in at ${formatTime(today.inAt!)}`
      : today?.offDay
        ? 'Weekly off today · check-in still counts as present'
        : 'Record your GPS attendance for today';

  const punchError = punch.error
    ? punch.error instanceof NetworkError
      ? 'Connection lost. Check your internet and try again.'
      : punch.error.message
    : null;

  return (
    <Card style={{ gap: space[3] }}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: tone[statusTone].bg }]}>
          <Feather name="map-pin" size={18} color={tone[statusTone].fg} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.titleRow}>
            <Text variant="label">Attendance</Text>
            <Badge label={statusLabel} t={statusTone} />
          </View>
          <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
            {subtitle}
          </Text>
        </View>
        {showHistoryLink ? (
          <PressableScale
            onPress={() => router.push('/attendance' as Href)}
            accessibilityLabel="Open my attendance month"
            style={styles.linkBtn}
          >
            <Text variant="caption" color={colors.primary}>
              Month
            </Text>
            <Feather name="chevron-right" size={14} color={colors.primary} />
          </PressableScale>
        ) : null}
      </View>

      {!checkedIn ? (
        <Button
          title="Check in"
          size="md"
          loading={punch.isPending}
          onPress={() => punch.mutate('in')}
          fullWidth
        />
      ) : !checkedOut ? (
        <Button
          title="Check out"
          variant="outline"
          size="md"
          loading={punch.isPending}
          onPress={() => punch.mutate('out')}
          fullWidth
        />
      ) : (
        <Button
          title="Update check-out time"
          variant="ghost"
          size="sm"
          loading={punch.isPending}
          onPress={() => punch.mutate('out')}
          fullWidth
        />
      )}

      {punchError ? (
        <Text variant="caption" color={colors.destructive}>
          {punchError}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexWrap: 'wrap',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: space[1],
    gap: 2,
  },
});
