import { useCallback, useState } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { timeAgo } from '@/lib/format';
import { PhotoAttachBar } from '@/components/ui/photo-attach-bar';
import { signVisitPhoto } from '@/lib/api/endpoints/leads';
import { PendingSyncBadge } from '@/offline';
import { useSignedAttachments } from '@/features/complaints/use-signed-attachments';
import { useLeadVisits, usePendingForLead, useRecordVisit } from './use-leads';

type Fix = { latitude: number; longitude: number; accuracy: number | null };
type FixState =
  | { s: 'idle' }
  | { s: 'locating' }
  | { s: 'ok'; fix: Fix }
  | { s: 'denied' }
  | { s: 'failed' };

const num = (v: string) => (v.trim() === '' ? NaN : Number(v));

/** Visits on a lead: list, plus a "Check in" sheet taking one GPS fix (manual coordinates as a fallback). */
export function VisitLog({ leadId, canAdd }: { leadId: string; canAdd: boolean }) {
  const visits = useLeadVisits(leadId);
  const record = useRecordVisit(leadId);
  const pending = usePendingForLead(leadId, 'visit.log');
  const [open, setOpen] = useState(false);
  const [fix, setFix] = useState<FixState>({ s: 'idle' });
  const [manual, setManual] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sign = useCallback(() => signVisitPhoto(leadId), [leadId]);
  const photo = useSignedAttachments(sign, 1);

  const locate = useCallback(async () => {
    setFix({ s: 'locating' });
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return setFix({ s: 'denied' });
      // One explicit foreground fix, 15 s cap. No background tracking.
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>((r) => setTimeout(() => r(null), 15_000)),
      ]);
      if (!pos) return setFix({ s: 'failed' });
      const { latitude, longitude, accuracy } = pos.coords;
      // Never send 0,0 (a device with no real fix).
      if (latitude === 0 && longitude === 0) return setFix({ s: 'failed' });
      setFix({ s: 'ok', fix: { latitude, longitude, accuracy } });
    } catch {
      setFix({ s: 'failed' });
    }
  }, []);


  const begin = () => {
    setNote('');
    setLat('');
    setLng('');
    setError(null);
    setManual(false);
    setFix({ s: 'idle' });
    photo.clear();
    record.reset();
    setOpen(true);
    void locate();
  };

  const save = () => {
    let latitude: number;
    let longitude: number;
    if (manual) {
      latitude = num(lat);
      longitude = num(lng);
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180 ||
        (latitude === 0 && longitude === 0)
      ) {
        return setError('Enter valid coordinates, e.g. 22.5726 and 88.3639.');
      }
    } else if (fix.s === 'ok') {
      ({ latitude, longitude } = fix.fix);
    } else {
      return setError('Wait for the location, or enter it manually.');
    }
    if (photo.busy || !photo.uploadsDone) {
      return setError('Wait for the photo to finish uploading, or remove it.');
    }
    const photoPublicId = photo.images[0]?.publicId;
    setError(null);
    // Queued with the time of the tap (`at`); never auto-retried if the outcome is unknown.
    record.mutate(
      { at: new Date(), latitude, longitude, ...(note.trim() ? { note: note.trim() } : {}), ...(photoPublicId ? { photoPublicId } : {}) },
      { onSuccess: () => setOpen(false), onError: (e) => setError(e instanceof Error ? e.message : 'Could not save the visit') },
    );
  };

  let status: React.ReactNode = null;
  if (!manual) {
    if (fix.s === 'locating' || fix.s === 'idle') status = <Text muted>Getting your location...</Text>;
    else if (fix.s === 'ok')
      status = (
        <Text>Location found{fix.fix.accuracy != null ? ` (within ${Math.round(fix.fix.accuracy)} m)` : ''}</Text>
      );
    else if (fix.s === 'denied')
      status = (
        <View style={{ gap: space[2], alignItems: 'flex-start' }}>
          <Text muted>Location is off. Allow it in Settings, or enter it manually.</Text>
          <Button title="Open settings" variant="outline" size="sm" onPress={() => void Linking.openSettings()} />
        </View>
      );
    else
      status = (
        <View style={{ gap: space[2], alignItems: 'flex-start' }}>
          <Text muted>We could not get your location.</Text>
          <Button title="Try again" variant="outline" size="sm" onPress={() => void locate()} />
        </View>
      );
  }

  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text variant="section" style={{ flex: 1 }}>
          Visits
        </Text>
        {canAdd ? <Button title="Check in" size="sm" onPress={begin} /> : null}
      </View>
      {pending.length > 0 ? (
        <Card style={{ gap: space[3] }}>
          {pending.map((p) => (
            <View key={p.id} style={{ gap: 2 }}>
              <Text variant="caption" muted>
                You · {timeAgo(new Date(p.capturedAt).toISOString())}
              </Text>
              <PendingSyncBadge filter={(i) => i.id === p.id} />
            </View>
          ))}
        </Card>
      ) : null}
      {visits.isPending ? (
        <Text muted>Loading visits...</Text>
      ) : visits.isError ? (
        <Text muted onPress={() => void visits.refetch()}>Could not load visits. Tap to retry.</Text>
      ) : visits.data.length === 0 ? (
        pending.length > 0 ? null : (
          <Text muted>No visits yet.{canAdd ? ' Check in when you reach the site.' : ''}</Text>
        )
      ) : (
        <Card style={{ gap: space[3] }}>
          {visits.data.map((v) => (
            <View key={v.id} style={{ gap: 2 }}>
              <Text variant="caption" muted>
                {v.user.name} · {timeAgo(v.at)}
              </Text>
              {v.note ? <Text>{v.note}</Text> : null}
              {v.photoUrl ? (
                <Image
                  source={{ uri: v.photoUrl }}
                  style={{ width: 120, height: 120, borderRadius: radius.md }}
                  contentFit="cover"
                  accessibilityLabel="Visit photo"
                />
              ) : null}
              <Text
                variant="caption"
                color={colors.primary}
                onPress={() => void Linking.openURL(`https://maps.google.com/?q=${v.latitude},${v.longitude}`)}
              >
                Open in maps
              </Text>
            </View>
          ))}
        </Card>
      )}

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Check in at site"
        footer={<Button title="Save visit" size="lg" loading={record.isPending} onPress={save} fullWidth />}
      >
        <View style={{ gap: space[3] }}>
          {status}
          {manual ? (
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <TextInput
                value={lat}
                onChangeText={setLat}
                placeholder="Latitude"
                keyboardType="numbers-and-punctuation"
                placeholderTextColor={colors.placeholder}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                value={lng}
                onChangeText={setLng}
                placeholder="Longitude"
                keyboardType="numbers-and-punctuation"
                placeholderTextColor={colors.placeholder}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
          ) : null}
          <Text
            variant="caption"
            color={colors.primary}
            onPress={() => {
              if (manual) void locate();
              setManual((m) => !m);
              setError(null);
            }}
          >
            {manual ? 'Use my location instead' : 'Enter location manually'}
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note (optional)"
            placeholderTextColor={colors.placeholder}
            multiline
            maxLength={1000}
            style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
          />
          <PhotoAttachBar
            items={photo.items}
            problem={photo.problem}
            onCamera={() => void photo.takePhoto()}
            onGallery={() => void photo.pickFromGallery()}
            onRemove={photo.remove}
            onRetry={photo.retry}
            disabled={photo.items.length >= 1}
          />
          {error ? (
            <Text variant="caption" color={colors.destructive}>
              {error}
            </Text>
          ) : null}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 44,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.foreground,
  },
});
