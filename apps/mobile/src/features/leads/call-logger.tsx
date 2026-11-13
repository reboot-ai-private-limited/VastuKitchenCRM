import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, TextInput, View } from 'react-native';
import { CALL_OUTCOMES, type CallOutcome } from '@vastu/contracts';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { useRecordCall } from './use-leads';

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  INTERESTED: 'Interested',
  CALL_BACK: 'Call back',
  NOT_INTERESTED: 'Not interested',
  NO_ANSWER: 'No answer',
  WRONG_NUMBER: 'Wrong number',
};

/** Rough talk time, chosen by the caller (the app cannot read the phone's call log). */
const DURATIONS = [
  { label: 'Under 1 min', sec: 30 },
  { label: '1-5 min', sec: 180 },
  { label: '5-15 min', sec: 600 },
  { label: '15+ min', sec: 1200 },
] as const;

/** For a manual log: when the call happened, as minutes ago. */
const WHEN = [
  { label: 'Just now', min: 0 },
  { label: '15 min ago', min: 15 },
  { label: '1 hour ago', min: 60 },
  { label: '3 hours ago', min: 180 },
] as const;

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipOn]}
    >
      <Text variant="caption" color={active ? colors.primaryForeground : colors.foreground}>
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * Dial with a tel: link, remember when we left, and open a "How did the call go?" sheet when the app
 * comes back to the foreground. Returns `startCall` for the Call button, `logManually` for the
 * "Log a call" fallback (a call made another way, or the sheet was dismissed) and the sheet element.
 * The save is queued in the offline outbox, so it works without a connection.
 */
export function useCallLogger(leadId: string, phone: string) {
  const record = useRecordCall(leadId);
  const startedAt = useRef<Date | null>(null);
  const wentBackground = useRef(false);
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [whenMin, setWhenMin] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (!startedAt.current) return;
      if (next === 'background' || next === 'inactive') wentBackground.current = true;
      else if (next === 'active' && wentBackground.current) {
        wentBackground.current = false;
        setOpen(true);
      }
    });
    return () => sub.remove();
  }, []);

  const startCall = useCallback(() => {
    startedAt.current = new Date();
    wentBackground.current = false;
    setManual(false);
    setOutcome(null);
    setDurationSec(null);
    setNote('');
    setError(null);
    void Linking.openURL(`tel:${phone}`).catch(() => {
      startedAt.current = null;
    });
  }, [phone]);

  const logManually = useCallback(() => {
    startedAt.current = null;
    setManual(true);
    setWhenMin(0);
    setOutcome(null);
    setDurationSec(null);
    setNote('');
    setError(null);
    setOpen(true);
  }, []);

  const close = () => {
    setOpen(false);
    startedAt.current = null;
  };

  const save = () => {
    if (!outcome) return setError('Pick how the call went.');
    const unanswered = outcome === 'NO_ANSWER' || outcome === 'WRONG_NUMBER';
    const sec = unanswered ? 0 : durationSec;
    if (sec === null) return setError('Pick roughly how long you talked.');
    // The API rejects a start time in the future; never send one.
    const started = manual
      ? new Date(Date.now() - whenMin * 60_000)
      : startedAt.current && startedAt.current.getTime() <= Date.now()
        ? startedAt.current
        : new Date();
    setError(null);
    record.mutate(
      {
        startedAt: started,
        durationSec: sec,
        answered: !unanswered,
        outcome,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      { onSuccess: close, onError: (e) => setError(e instanceof Error ? e.message : 'Could not save the call') },
    );
  };

  const unanswered = outcome === 'NO_ANSWER' || outcome === 'WRONG_NUMBER';
  const sheet = (
    <BottomSheet
      visible={open}
      onClose={close}
      title={manual ? 'Log a call' : 'How did the call go?'}
      subtitle="Log it so the lead history stays complete"
      footer={<Button title="Save call" size="lg" loading={record.isPending} onPress={save} fullWidth />}
    >
      <View style={{ gap: space[4] }}>
        {manual ? (
          <View style={{ gap: space[2] }}>
            <Text variant="label">When</Text>
            <View style={styles.chips}>
              {WHEN.map((w) => (
                <Chip key={w.min} label={w.label} active={whenMin === w.min} onPress={() => setWhenMin(w.min)} />
              ))}
            </View>
          </View>
        ) : null}
        <View style={{ gap: space[2] }}>
          <Text variant="label">Outcome</Text>
          <View style={styles.chips}>
            {CALL_OUTCOMES.map((o) => (
              <Chip key={o} label={OUTCOME_LABEL[o]} active={outcome === o} onPress={() => setOutcome(o)} />
            ))}
          </View>
        </View>
        {!unanswered ? (
          <View style={{ gap: space[2] }}>
            <Text variant="label">Talk time</Text>
            <View style={styles.chips}>
              {DURATIONS.map((d) => (
                <Chip
                  key={d.sec}
                  label={d.label}
                  active={durationSec === d.sec}
                  onPress={() => setDurationSec(d.sec)}
                />
              ))}
            </View>
          </View>
        ) : null}
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          placeholderTextColor={colors.placeholder}
          multiline
          maxLength={1000}
          style={styles.note}
        />
        {error ? (
          <Text variant="caption" color={colors.destructive}>
            {error}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );

  return { startCall, logManually, sheet };
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.primary },
  note: {
    minHeight: 72,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.foreground,
    textAlignVertical: 'top',
  },
});
