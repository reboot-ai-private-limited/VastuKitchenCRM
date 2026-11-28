import { useCallback, useState } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { MAX_MEDIA_PER_VISIT, type VisitMediaInputDto } from '@vastu/contracts';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { PhotoGrid } from '@/components/ui/photo-grid';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { signVisitMedia } from '@/lib/api/endpoints/leads';
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, postToTicket } from '@/lib/api/upload';
import { timeAgo } from '@/lib/format';
import { PendingSyncBadge } from '@/offline';
import { formatDuration } from './lead-meta';
import { useLeadVisits, usePendingForLead, useRecordVisit } from './use-leads';

type Fix = { latitude: number; longitude: number; accuracy: number | null };
type FixState =
  | { s: 'idle' }
  | { s: 'locating' }
  | { s: 'ok'; fix: Fix }
  | { s: 'denied' }
  | { s: 'failed' };

type MediaDraft = {
  key: string;
  kind: 'IMAGE' | 'VIDEO';
  uri: string;
  name: string;
  mimeType: string;
  durationSec?: number;
  status: 'uploading' | 'done' | 'error';
  result?: VisitMediaInputDto;
  error?: string;
};

const num = (v: string) => (v.trim() === '' ? NaN : Number(v));

/** Visits on a lead: list (photos + videos), plus a "Check in" sheet with optional GPS and up to 10 photos/videos. */
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
  const [items, setItems] = useState<MediaDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const patchItem = useCallback((key: string, patch: Partial<MediaDraft>) => {
    setItems((cur) => cur.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }, []);

  const uploadDraft = useCallback(
    async (draft: MediaDraft) => {
      patchItem(draft.key, { status: 'uploading', error: undefined });
      try {
        const ticket = await signVisitMedia(leadId);
        const r = await postToTicket(
          ticket,
          { uri: draft.uri, name: draft.name, type: draft.mimeType },
          () => undefined,
        );
        const result: VisitMediaInputDto = {
          kind: draft.kind,
          publicId: r.public_id,
          ...(r.width ? { width: r.width } : {}),
          ...(r.height ? { height: r.height } : {}),
          ...(r.bytes ? { bytes: r.bytes } : {}),
          ...(draft.durationSec != null ? { durationSec: draft.durationSec } : {}),
        };
        patchItem(draft.key, { status: 'done', result });
      } catch (e) {
        patchItem(draft.key, {
          status: 'error',
          error: e instanceof Error ? e.message : 'Upload failed',
        });
      }
    },
    [leadId, patchItem],
  );

  const addAssets = useCallback(
    (assets: ImagePicker.ImagePickerAsset[]) => {
      setError(null);
      const room = Math.max(0, MAX_MEDIA_PER_VISIT - items.length);
      if (assets.length > room) {
        setError(`You can attach up to ${MAX_MEDIA_PER_VISIT} photos or videos.`);
      }
      const next: MediaDraft[] = [];
      for (const a of assets.slice(0, room)) {
        const isVideo = a.type === 'video' || (a.mimeType ?? '').startsWith('video/');
        const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        if (a.fileSize && a.fileSize > limit) {
          setError(isVideo ? 'Videos must be under 60 MB.' : 'Photos must be under 10 MB.');
          continue;
        }
        next.push({
          key: `${Date.now()}-${Math.random()}`,
          kind: isVideo ? 'VIDEO' : 'IMAGE',
          uri: a.uri,
          name: a.fileName ?? `${isVideo ? 'video' : 'photo'}-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
          mimeType: a.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
          durationSec: isVideo && a.duration ? Math.round(a.duration / 1000) : undefined,
          status: 'uploading',
        });
      }
      if (next.length === 0) return;
      setItems((cur) => [...cur, ...next]);
      next.forEach((d) => void uploadDraft(d));
    },
    [items.length, uploadDraft],
  );

  const pickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError('Allow media access in Settings to attach photos or videos.');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_MEDIA_PER_VISIT - items.length),
      quality: 0.7,
      exif: false,
    });
    if (!res.canceled) addAssets(res.assets);
  };

  const captureCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError('Allow camera access in Settings to capture media.');
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
      exif: false,
    });
    if (!res.canceled) addAssets(res.assets);
  };

  const locate = useCallback(async () => {
    setFix({ s: 'locating' });
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return setFix({ s: 'denied' });
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>((r) => setTimeout(() => r(null), 15_000)),
      ]);
      if (!pos) return setFix({ s: 'failed' });
      const { latitude, longitude, accuracy } = pos.coords;
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
    setItems([]);
    setError(null);
    setManual(false);
    setFix({ s: 'idle' });
    record.reset();
    setOpen(true);
    void locate();
  };

  const busy = items.some((x) => x.status === 'uploading');
  const uploadsDone = items.every((x) => x.status === 'done');

  const save = () => {
    let coords: { latitude: number; longitude: number } | undefined;
    if (manual && (lat.trim() || lng.trim())) {
      const latitude = num(lat);
      const longitude = num(lng);
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180 ||
        (latitude === 0 && longitude === 0)
      ) {
        return setError('Enter valid coordinates, e.g. 22.5726 and 88.3639.');
      }
      coords = { latitude, longitude };
    } else if (!manual && fix.s === 'ok') {
      coords = { latitude: fix.fix.latitude, longitude: fix.fix.longitude };
    }

    if (busy || !uploadsDone) {
      return setError('Wait for uploads to finish, or remove failed items.');
    }

    const media = items.flatMap((x) => (x.result ? [x.result] : []));
    const trimmed = note.trim();
    if (!trimmed && media.length === 0) {
      return setError('Add a note or attach at least one photo or video.');
    }

    setError(null);
    record.mutate(
      {
        at: new Date(),
        ...(coords ?? {}),
        ...(trimmed ? { note: trimmed } : {}),
        ...(media.length > 0 ? { media } : {}),
      },
      {
        onSuccess: () => setOpen(false),
        onError: (e) => setError(e instanceof Error ? e.message : 'Could not save the visit'),
      },
    );
  };

  let gpsStatus: React.ReactNode = null;
  if (!manual) {
    if (fix.s === 'locating' || fix.s === 'idle') {
      gpsStatus = <Text variant="caption" muted>Getting GPS (optional)...</Text>;
    } else if (fix.s === 'ok') {
      gpsStatus = (
        <Text variant="caption" color={colors.inkDeep}>
          Location captured{fix.fix.accuracy != null ? ` (±${Math.round(fix.fix.accuracy)} m)` : ''}
        </Text>
      );
    } else if (fix.s === 'denied') {
      gpsStatus = (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
          <Text variant="caption" muted>GPS off (optional).</Text>
          <Text variant="caption" color={colors.primary} onPress={() => void Linking.openSettings()}>
            Open settings
          </Text>
        </View>
      );
    } else {
      gpsStatus = (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
          <Text variant="caption" muted>GPS unavailable (optional).</Text>
          <Text variant="caption" color={colors.primary} onPress={() => void locate()}>
            Retry GPS
          </Text>
        </View>
      );
    }
  }

  return (
    <View style={{ gap: space[2] }}>
      <View style={styles.sectionHead}>
        <Text variant="section" color={colors.inkDeep} style={{ flex: 1 }}>
          Visits
        </Text>
        {canAdd ? <Button title="Log visit" size="sm" variant="outline" onPress={begin} /> : null}
      </View>

      {pending.length > 0 ? (
        <View style={styles.group}>
          {pending.map((p, i) => (
            <View key={p.id} style={[styles.item, i > 0 && styles.divider]}>
              <Text variant="caption" color={colors.inkMuted}>
                You · {timeAgo(new Date(p.capturedAt).toISOString())}
              </Text>
              <PendingSyncBadge filter={(item) => item.id === p.id} />
            </View>
          ))}
        </View>
      ) : null}

      {visits.isPending ? (
        <Text variant="caption" muted>
          Loading visits...
        </Text>
      ) : visits.isError ? (
        <Text variant="caption" muted onPress={() => void visits.refetch()}>
          Could not load visits. Tap to retry.
        </Text>
      ) : visits.data.length === 0 ? (
        pending.length > 0 ? null : (
          <Text variant="caption" muted>
            No visits yet.{canAdd ? ' Log a visit with notes, photos or videos.' : ''}
          </Text>
        )
      ) : (
        <View style={styles.group}>
          {visits.data.map((v, i) => {
            const images = v.media.filter((m) => m.kind === 'IMAGE');
            const videos = v.media.filter((m) => m.kind === 'VIDEO');
            return (
              <View key={v.id} style={[styles.item, i > 0 && styles.divider]}>
                <View style={styles.visitTop}>
                  <Text variant="caption" color={colors.inkMuted}>
                    {v.user.name} · {timeAgo(v.at)}
                  </Text>
                  {v.latitude != null && v.longitude != null ? (
                    <Text
                      variant="caption"
                      color={colors.primaryPressed}
                      accessibilityRole="link"
                      onPress={() => void Linking.openURL(`https://maps.google.com/?q=${v.latitude},${v.longitude}`)}
                    >
                      Maps
                    </Text>
                  ) : null}
                </View>
                {v.note ? <Text color={colors.inkDeep}>{v.note}</Text> : null}
                {images.length > 0 ? <PhotoGrid images={images} label="Visit photo" /> : null}
                {videos.length > 0 ? (
                  <View style={styles.videoList}>
                    {videos.map((m, idx) => (
                      <PressableScale
                        key={m.publicId}
                        onPress={() => void Linking.openURL(m.url)}
                        accessibilityRole="link"
                        style={styles.videoChip}
                      >
                        <Feather name="play-circle" size={15} color={colors.primaryPressed} />
                        <Text variant="caption" color={colors.inkDeep} style={{ fontFamily: font.medium }}>
                          Video {idx + 1}
                          {m.durationSec ? ` · ${formatDuration(Math.round(m.durationSec))}` : ''}
                        </Text>
                      </PressableScale>
                    ))}
                  </View>
                ) : null}
                {v.photoUrl && images.length === 0 ? (
                  <Image
                    source={{ uri: v.photoUrl }}
                    style={{ width: 120, height: 120, borderRadius: radius.md }}
                    contentFit="cover"
                    accessibilityLabel="Visit photo"
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {canAdd ? (
        <BottomSheet
          visible={open}
          onClose={() => setOpen(false)}
          title="Log visit"
          footer={<Button title="Save visit" size="lg" loading={record.isPending} onPress={save} fullWidth />}
        >
          <View style={{ gap: space[3] }}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Measurement notes or site observations"
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={1000}
              style={[styles.input, { minHeight: 76, textAlignVertical: 'top' }]}
            />

            <View style={{ gap: space[2] }}>
              <View style={styles.attachActions}>
                <Button
                  title="Camera"
                  variant="outline"
                  size="sm"
                  disabled={items.length >= MAX_MEDIA_PER_VISIT}
                  onPress={() => void captureCamera()}
                />
                <Button
                  title="Photos / Videos"
                  variant="outline"
                  size="sm"
                  disabled={items.length >= MAX_MEDIA_PER_VISIT}
                  onPress={() => void pickGallery()}
                />
                <Text variant="caption" muted style={{ marginLeft: 'auto', fontVariant: ['tabular-nums'] }}>
                  {items.length}/{MAX_MEDIA_PER_VISIT}
                </Text>
              </View>

              {items.length > 0 ? (
                <View style={styles.draftGrid}>
                  {items.map((item) => (
                    <View key={item.key} style={styles.draftRow}>
                      <Feather
                        name={item.kind === 'VIDEO' ? 'video' : 'image'}
                        size={16}
                        color={colors.inkMuted}
                      />
                      <Text variant="caption" color={colors.inkDeep} numberOfLines={1} style={{ flex: 1 }}>
                        {item.name}
                      </Text>
                      {item.status === 'uploading' ? (
                        <Text variant="caption" muted>
                          Uploading...
                        </Text>
                      ) : item.status === 'error' ? (
                        <Text
                          variant="caption"
                          color={colors.primary}
                          onPress={() => void uploadDraft(item)}
                        >
                          Retry
                        </Text>
                      ) : (
                        <Feather name="check" size={15} color={colors.primary} />
                      )}
                      <PressableScale
                        onPress={() => setItems((cur) => cur.filter((x) => x.key !== item.key))}
                        accessibilityLabel={`Remove ${item.name}`}
                        hitSlop={8}
                      >
                        <Feather name="x" size={16} color={colors.inkMuted} />
                      </PressableScale>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={{ gap: space[2] }}>
              {gpsStatus}
              {manual ? (
                <View style={{ flexDirection: 'row', gap: space[2] }}>
                  <TextInput
                    value={lat}
                    onChangeText={setLat}
                    placeholder="Latitude (optional)"
                    keyboardType="numbers-and-punctuation"
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, { flex: 1 }]}
                  />
                  <TextInput
                    value={lng}
                    onChangeText={setLng}
                    placeholder="Longitude (optional)"
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
                {manual ? 'Use device GPS instead' : 'Enter coordinates manually'}
              </Text>
            </View>

            {error ? (
              <Text variant="caption" color={colors.destructive}>
                {error}
              </Text>
            ) : null}
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  group: {
    backgroundColor: colors.pageSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingHorizontal: space[3],
  },
  item: {
    paddingVertical: space[3],
    gap: 6,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  visitTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  videoList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  videoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  attachActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  draftGrid: {
    backgroundColor: colors.pageSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingHorizontal: space[3],
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
  },
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
