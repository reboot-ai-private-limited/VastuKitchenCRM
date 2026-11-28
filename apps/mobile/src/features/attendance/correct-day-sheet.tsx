import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { AttendanceDayDto } from '@vastu/contracts';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { formatDay } from '@/lib/format';
import { useRemoveAttendanceDay, useSetAttendanceDay } from './use-attendance';

const CLOCK_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Format an ISO instant to `HH:mm` in IST (+05:30). */
function instantToClock(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const ist = new Date(ms + 330 * 60_000);
  const hh = String(ist.getUTCHours()).padStart(2, '0');
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function clockToInstant(date: string, hhmm: string): string {
  return `${date}T${hhmm}:00+05:30`;
}

export type CorrectDayTarget = {
  userId: string;
  name: string;
  date: string;
  day: AttendanceDayDto | null;
};

export function CorrectDaySheet({
  target,
  onClose,
}: {
  target: CorrectDayTarget | null;
  onClose: () => void;
}) {
  if (!target) {
    return <BottomSheet visible={false} onClose={onClose} title="Enter attendance">{null}</BottomSheet>;
  }
  return (
    <CorrectDayForm
      key={`${target.userId}:${target.date}:${target.day?.inAt ?? ''}`}
      target={target}
      onClose={onClose}
    />
  );
}

function CorrectDayForm({
  target,
  onClose,
}: {
  target: CorrectDayTarget;
  onClose: () => void;
}) {
  const setMut = useSetAttendanceDay();
  const removeMut = useRemoveAttendanceDay();

  const [inAt, setInAt] = useState(target.day?.inAt ? instantToClock(target.day.inAt) : '09:30');
  const [outAt, setOutAt] = useState(target.day?.outAt ? instantToClock(target.day.outAt) : '');
  const [note, setNote] = useState(target.day?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const hasRecord = !!target.day?.inAt;

  const save = () => {
    const cleanIn = inAt.trim();
    const cleanOut = outAt.trim();
    const cleanNote = note.trim();
    if (!CLOCK_RE.test(cleanIn)) {
      setError('Enter check-in time in 24h HH:mm format (e.g. 09:30).');
      return;
    }
    if (cleanOut && !CLOCK_RE.test(cleanOut)) {
      setError('Enter check-out time in 24h HH:mm format (e.g. 18:30), or leave empty.');
      return;
    }
    if (cleanOut && cleanOut <= cleanIn) {
      setError('Check-out time must be after check-in time.');
      return;
    }
    if (!cleanNote) {
      setError('Enter a short reason for this entry or correction.');
      return;
    }
    setError(null);
    setMut.mutate(
      {
        userId: target.userId,
        date: target.date,
        inAt: clockToInstant(target.date, cleanIn),
        outAt: cleanOut ? clockToInstant(target.date, cleanOut) : null,
        note: cleanNote,
      },
      {
        onSuccess: () => onClose(),
        onError: (e) =>
          setError(e instanceof ApiError ? e.message : 'Could not save attendance. Try again.'),
      },
    );
  };

  const confirmRemove = () => {
    Alert.alert(
      'Remove attendance record?',
      `Remove ${target.name}'s attendance for ${formatDay(target.date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            removeMut.mutate(
              { userId: target.userId, date: target.date },
              {
                onSuccess: () => onClose(),
                onError: (e) =>
                  setError(e instanceof ApiError ? e.message : 'Could not remove record.'),
              },
            ),
        },
      ],
    );
  };

  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={hasRecord ? 'Correct day' : 'Enter attendance'}
      subtitle={`${target.name} · ${formatDay(target.date)}`}
      footer={
        <View style={{ gap: space[2] }}>
          <Button
            title={hasRecord ? 'Save correction' : 'Save attendance'}
            onPress={save}
            loading={setMut.isPending}
            disabled={removeMut.isPending}
            fullWidth
          />
          {hasRecord ? (
            <Button
              title="Remove day record"
              variant="ghost"
              onPress={confirmRemove}
              loading={removeMut.isPending}
              disabled={setMut.isPending}
              fullWidth
            />
          ) : null}
        </View>
      }
    >
      <View style={{ gap: space[3] }}>
        <View style={{ gap: space[2] }}>
          <Input
            label="Check-in time (IST, 24h HH:mm)"
            value={inAt}
            onChangeText={setInAt}
            placeholder="09:30"
          />
          <View style={styles.chipRow}>
            {['09:00', '09:30', '10:00', '10:30'].map((t) => (
              <PressableScale key={t} onPress={() => setInAt(t)} style={styles.chip}>
                <Text variant="caption" color={colors.inkDeep} style={styles.tabular}>
                  {t}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>

        <View style={{ gap: space[2] }}>
          <Input
            label="Check-out time (optional, 24h HH:mm)"
            value={outAt}
            onChangeText={setOutAt}
            placeholder="18:30"
          />
          <View style={styles.chipRow}>
            {['18:00', '18:30', '19:00', '19:30'].map((t) => (
              <PressableScale key={t} onPress={() => setOutAt(t)} style={styles.chip}>
                <Text variant="caption" color={colors.inkDeep} style={styles.tabular}>
                  {t}
                </Text>
              </PressableScale>
            ))}
            {outAt ? (
              <PressableScale onPress={() => setOutAt('')} style={styles.chip}>
                <Text variant="caption" color={colors.destructive}>
                  Clear
                </Text>
              </PressableScale>
            ) : null}
          </View>
        </View>

        <Input
          label="Reason / note (required)"
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Forgot to punch out, biometric entry"
          maxLength={200}
        />

        {error ? (
          <Text variant="caption" color={colors.destructive}>
            {error}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  chip: {
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.pageSoft,
  },
  tabular: {
    fontFamily: font.medium,
    fontVariant: ['tabular-nums'],
  },
});
