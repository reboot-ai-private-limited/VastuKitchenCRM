import { useCallback, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
import { MAX_MEDIA_PER_VISIT, type DesignMediaInputDto } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { PhotoGrid } from '@/components/ui/photo-grid';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { signDesignMedia } from '@/lib/api/endpoints/leads';
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, postToTicket } from '@/lib/api/upload';
import { formatDate, formatINR, formatTime, timeAgo } from '@/lib/format';
import { PendingSyncBadge } from '@/offline';
import { describeActivity, formatDuration, OUTCOME_LABEL } from './lead-meta';
import {
  useCompleteLeadDesign,
  useLeadCalls,
  useLeadDesigns,
  useLeadProposals,
  useLeadTimeline,
  usePendingForLead,
} from './use-leads';

const DESIGN_FILE_EXTS = new Set(['pdf', 'dwg', 'dxf', 'zip']);
const MAX_DESIGN_DOC_BYTES = 25 * 1024 * 1024;
const extOf = (name: string) => (name.split('.').pop() ?? '').toLowerCase();

type DesignDraft = {
  key: string;
  kind: 'IMAGE' | 'VIDEO' | 'FILE';
  uri: string;
  name: string;
  mimeType: string;
  durationSec?: number;
  status: 'uploading' | 'done' | 'error';
  result?: DesignMediaInputDto;
  error?: string;
};

function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <Text variant="section" color={colors.inkDeep} style={{ flex: 1 }}>
        {title}
      </Text>
      {action}
    </View>
  );
}

function Failed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <View style={{ gap: space[2], alignItems: 'flex-start' }}>
      <Text muted>Could not load {what}.</Text>
      <Button title="Retry" size="sm" variant="outline" onPress={onRetry} />
    </View>
  );
}

export function CallsSection({ leadId, onLog }: { leadId: string; onLog?: () => void }) {
  const q = useLeadCalls(leadId);
  const pending = usePendingForLead(leadId, 'call.record');
  return (
    <View style={{ gap: space[2] }}>
      <SectionHead
        title="Calls"
        action={onLog ? <Button title="Log call" size="sm" variant="outline" onPress={onLog} /> : null}
      />
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
      {q.isPending ? (
        <Text variant="caption" muted>
          Loading calls...
        </Text>
      ) : q.isError ? (
        <Failed what="calls" onRetry={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        pending.length > 0 ? null : (
          <Text variant="caption" muted>
            No calls logged yet.
          </Text>
        )
      ) : (
        <View style={styles.group}>
          {q.data.map((c, i) => (
            <View key={c.id} style={[styles.item, i > 0 && styles.divider]}>
              <Text variant="label" color={colors.inkDeep}>
                {c.answered ? `Answered (${formatDuration(c.durationSec)})` : 'Not answered'}
                {c.outcome ? ` · ${OUTCOME_LABEL[c.outcome] ?? c.outcome}` : ''}
              </Text>
              <Text variant="caption" color={colors.inkMuted} style={styles.tabular}>
                {c.user.name} · {formatDate(c.startedAt)} {formatTime(c.startedAt)}
              </Text>
              {c.note ? <Text color={colors.inkDeep}>{c.note}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function ProposalsSection({ leadId, canCreate }: { leadId: string; canCreate: boolean }) {
  const router = useRouter();
  const q = useLeadProposals(leadId);
  return (
    <View style={{ gap: space[2] }}>
      <SectionHead
        title="Proposals"
        action={
          canCreate ? (
            <Button
              title="+ Proposal"
              size="sm"
              variant="outline"
              onPress={() => router.push(`/proposals/new?leadId=${encodeURIComponent(leadId)}` as Href)}
            />
          ) : null
        }
      />
      {q.isPending ? (
        <Text variant="caption" muted>
          Loading proposals...
        </Text>
      ) : q.isError ? (
        <Failed what="proposals" onRetry={() => void q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <Text variant="caption" muted>
          No proposals yet.
        </Text>
      ) : (
        <View style={styles.group}>
          {q.data.items.map((p, i) => (
            <PressableScale
              key={p.id}
              onPress={() => router.push({ pathname: '/proposals/[id]', params: { id: p.id } } as Href)}
              style={[styles.item, i > 0 && styles.divider]}
            >
              <View style={styles.proposalTop}>
                <Text variant="label" color={colors.inkDeep} style={{ flex: 1 }} numberOfLines={1}>
                  {p.number} · {p.title}
                </Text>
                <Badge label={p.status === 'SENT' ? 'Sent' : 'Draft'} t={p.status === 'SENT' ? 'accent' : 'neutral'} />
                <Feather name="chevron-right" size={16} color={colors.inkMuted} />
              </View>
              <Text variant="caption" color={colors.inkMuted} style={styles.tabular}>
                {formatINR(p.total)}
                {p.sentAt ? ` · sent ${timeAgo(p.sentAt)}` : ''}
              </Text>
            </PressableScale>
          ))}
        </View>
      )}
    </View>
  );
}

export function DesignsSection({ leadId, canComplete }: { leadId: string; canComplete: boolean }) {
  const q = useLeadDesigns(leadId);
  const complete = useCompleteLeadDesign(leadId);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [items, setItems] = useState<DesignDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const patchItem = useCallback((key: string, patch: Partial<DesignDraft>) => {
    setItems((cur) => cur.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }, []);

  const uploadDraft = useCallback(
    async (draft: DesignDraft) => {
      patchItem(draft.key, { status: 'uploading', error: undefined });
      try {
        const ticket = await signDesignMedia(leadId);
        const r = await postToTicket(
          ticket,
          { uri: draft.uri, name: draft.name, type: draft.mimeType },
          () => undefined,
        );
        const rt =
          r.resource_type === 'image' || r.resource_type === 'video' || r.resource_type === 'raw'
            ? r.resource_type
            : undefined;
        const result: DesignMediaInputDto = {
          kind: draft.kind,
          publicId: r.public_id,
          fileName: draft.name,
          ...(r.width ? { width: r.width } : {}),
          ...(r.height ? { height: r.height } : {}),
          ...(r.bytes ? { bytes: r.bytes } : {}),
          ...(draft.durationSec != null ? { durationSec: draft.durationSec } : {}),
          ...(rt ? { resourceType: rt } : {}),
          ...(r.format ? { format: r.format.slice(0, 20) } : {}),
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

  const pushDrafts = useCallback(
    (incoming: DesignDraft[]) => {
      if (incoming.length === 0) return;
      setItems((cur) => [...cur, ...incoming]);
      incoming.forEach((d) => void uploadDraft(d));
    },
    [uploadDraft],
  );

  const pickMedia = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError('Allow media access in Settings to attach photos or videos.');
    const room = Math.max(0, MAX_MEDIA_PER_VISIT - items.length);
    if (room === 0) return setError(`You can attach up to ${MAX_MEDIA_PER_VISIT} files.`);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.75,
      exif: false,
    });
    if (res.canceled) return;
    const next: DesignDraft[] = [];
    for (const a of res.assets.slice(0, room)) {
      const isVideo = a.type === 'video' || (a.mimeType ?? '').startsWith('video/');
      const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (a.fileSize && a.fileSize > limit) {
        setError(isVideo ? 'Videos must be under 60 MB.' : 'Images must be under 10 MB.');
        continue;
      }
      next.push({
        key: `${Date.now()}-${Math.random()}`,
        kind: isVideo ? 'VIDEO' : 'IMAGE',
        uri: a.uri,
        name: a.fileName ?? `${isVideo ? 'video' : 'design'}-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        mimeType: a.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
        durationSec: isVideo && a.duration ? Math.round(a.duration / 1000) : undefined,
        status: 'uploading',
      });
    }
    pushDrafts(next);
  };

  const pickFiles = async () => {
    setError(null);
    const room = Math.max(0, MAX_MEDIA_PER_VISIT - items.length);
    if (room === 0) return setError(`You can attach up to ${MAX_MEDIA_PER_VISIT} files.`);
    const res = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
      type: '*/*',
    });
    if (res.canceled) return;
    const next: DesignDraft[] = [];
    for (const a of res.assets.slice(0, room)) {
      const ext = extOf(a.name);
      const mime = a.mimeType ?? 'application/octet-stream';
      const isImg = mime.startsWith('image/');
      const isVid = mime.startsWith('video/');
      if (!isImg && !isVid && !DESIGN_FILE_EXTS.has(ext)) {
        setError('Allowed files: images, videos, PDF, DWG, DXF, or ZIP.');
        continue;
      }
      const limit = isVid ? MAX_VIDEO_BYTES : isImg ? MAX_IMAGE_BYTES : MAX_DESIGN_DOC_BYTES;
      if (a.size && a.size > limit) {
        setError(`${a.name} exceeds the file size limit.`);
        continue;
      }
      next.push({
        key: `${Date.now()}-${Math.random()}`,
        kind: isVid ? 'VIDEO' : isImg ? 'IMAGE' : 'FILE',
        uri: a.uri,
        name: a.name,
        mimeType: mime,
        status: 'uploading',
      });
    }
    pushDrafts(next);
  };

  const begin = () => {
    setNote('');
    setItems([]);
    setError(null);
    complete.reset();
    setOpen(true);
  };

  const busy = items.some((x) => x.status === 'uploading');
  const uploadsDone = items.every((x) => x.status === 'done');

  const submit = () => {
    if (busy || !uploadsDone) {
      return setError('Wait for uploads to finish, or remove failed files.');
    }
    const media = items.flatMap((x) => (x.result ? [x.result] : []));
    const trimmed = note.trim();
    if (!trimmed && media.length === 0) {
      return setError('Add a note or attach at least one design file.');
    }
    setError(null);
    complete.mutate(
      { ...(trimmed ? { note: trimmed } : {}), ...(media.length > 0 ? { media } : {}) },
      {
        onSuccess: () => setOpen(false),
        onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not submit design.'),
      },
    );
  };

  return (
    <View style={{ gap: space[2] }}>
      <SectionHead
        title="Designs"
        action={canComplete ? <Button title="Upload design" size="sm" onPress={begin} /> : null}
      />
      {q.isPending ? (
        <Text variant="caption" muted>
          Loading designs...
        </Text>
      ) : q.isError ? (
        <Failed what="designs" onRetry={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <Text variant="caption" muted>
          No designs uploaded yet.
        </Text>
      ) : (
        <View style={styles.group}>
          {q.data.map((d, i) => {
            const images = d.media.filter((m) => m.kind === 'IMAGE');
            const videos = d.media.filter((m) => m.kind === 'VIDEO');
            const files = d.media.filter((m) => m.kind === 'FILE');
            return (
              <View key={d.id} style={[styles.item, i > 0 && styles.divider]}>
                <Text variant="caption" color={colors.inkMuted} style={styles.tabular}>
                  {d.user.name} · {timeAgo(d.at)}
                </Text>
                {d.note ? <Text color={colors.inkDeep}>{d.note}</Text> : null}
                {images.length > 0 ? (
                  <PhotoGrid
                    images={images.map((m) => ({
                      publicId: m.publicId,
                      url: m.url,
                      thumbUrl: m.thumbUrl ?? m.url,
                    }))}
                    label="Design deliverable"
                  />
                ) : null}
                {videos.length > 0 || files.length > 0 ? (
                  <View style={styles.fileList}>
                    {videos.map((m, idx) => (
                      <PressableScale
                        key={m.publicId}
                        onPress={() => void Linking.openURL(m.url)}
                        accessibilityRole="link"
                        style={styles.fileChip}
                      >
                        <Feather name="play-circle" size={15} color={colors.primaryPressed} />
                        <Text variant="caption" color={colors.inkDeep} numberOfLines={1} style={{ maxWidth: 200 }}>
                          {m.fileName ?? `Video ${idx + 1}`}
                        </Text>
                      </PressableScale>
                    ))}
                    {files.map((m, idx) => (
                      <PressableScale
                        key={m.publicId}
                        onPress={() => void Linking.openURL(m.downloadUrl || m.url)}
                        accessibilityRole="link"
                        style={styles.fileChip}
                      >
                        <Feather name="download" size={14} color={colors.primaryPressed} />
                        <Text variant="caption" color={colors.inkDeep} numberOfLines={1} style={{ maxWidth: 200 }}>
                          {m.fileName ?? `File ${idx + 1}`}
                        </Text>
                      </PressableScale>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {canComplete ? (
        <BottomSheet
          visible={open}
          onClose={() => setOpen(false)}
          title="Upload design"
          subtitle="Moves open leads to Design estimate scheduled"
          footer={
            <Button
              title="Upload & schedule estimate"
              size="lg"
              loading={complete.isPending}
              onPress={submit}
              fullWidth
            />
          }
        >
          <View style={{ gap: space[3] }}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Design notes or revision summary (optional)"
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={2000}
              style={styles.input}
            />
            <View style={styles.attachActions}>
              <Button
                title="Photos / Videos"
                variant="outline"
                size="sm"
                disabled={items.length >= MAX_MEDIA_PER_VISIT}
                onPress={() => void pickMedia()}
              />
              <Button
                title="PDF / CAD / ZIP"
                variant="outline"
                size="sm"
                disabled={items.length >= MAX_MEDIA_PER_VISIT}
                onPress={() => void pickFiles()}
              />
              <Text variant="caption" muted style={{ marginLeft: 'auto', fontVariant: ['tabular-nums'] }}>
                {items.length}/{MAX_MEDIA_PER_VISIT}
              </Text>
            </View>
            {items.length > 0 ? (
              <View style={styles.draftList}>
                {items.map((item) => (
                  <View key={item.key} style={styles.draftRow}>
                    <Feather
                      name={item.kind === 'VIDEO' ? 'video' : item.kind === 'FILE' ? 'file' : 'image'}
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
                      <Text variant="caption" color={colors.primary} onPress={() => void uploadDraft(item)}>
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

export function TimelineSection({ leadId }: { leadId: string }) {
  const { user } = useSession();
  const q = useLeadTimeline(leadId);
  return (
    <View style={{ gap: space[2] }}>
      <SectionHead title="Timeline" />
      {q.isPending ? (
        <Text variant="caption" muted>
          Loading timeline...
        </Text>
      ) : q.isError ? (
        <Failed what="the timeline" onRetry={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <Text variant="caption" muted>
          Nothing has happened on this lead yet.
        </Text>
      ) : (
        <View>
          {q.data.map((a, i) => {
            const { title, detail } = describeActivity(a);
            const actor = a.by?.name ?? 'System';
            const cleanedDetail = detail
              ? detail
                  .split(' · ')
                  .filter((part) => !a.by?.name || part !== `By ${a.by.name}`)
                  .join(' · ')
              : '';
            const isLast = i === q.data.length - 1;
            return (
              <View key={a.id} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <Avatar name={actor} size={32} accent={a.by?.id === user?.id} />
                  {!isLast ? <View style={styles.timelineBar} /> : null}
                </View>
                <View style={[styles.timelineBody, !isLast && styles.timelineBodyGap]}>
                  <Text variant="label" color={colors.inkDeep} style={{ fontFamily: font.medium }}>
                    {title}
                  </Text>
                  <Text variant="caption" color={colors.inkMuted} style={styles.tabular}>
                    {actor} · {formatDate(a.at)} · {formatTime(a.at)}
                  </Text>
                  {cleanedDetail ? (
                    <Text variant="caption" color={colors.inkDeep}>
                      {cleanedDetail}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
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
    gap: 5,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  proposalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space[3],
  },
  timelineRail: {
    width: 32,
    alignItems: 'center',
  },
  timelineBar: {
    flex: 1,
    width: 2,
    minHeight: 16,
    marginVertical: 4,
    borderRadius: 1,
    backgroundColor: colors.border,
  },
  timelineBody: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
  },
  timelineBodyGap: {
    paddingBottom: space[4],
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  fileList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  fileChip: {
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
  draftList: {
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
    minHeight: 80,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
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
