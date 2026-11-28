import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  MAX_IMAGES_PER_COMMENT,
  MAX_IMAGES_PER_POST,
  type CreateCommentBodyDto,
  type CreatePostBodyDto,
  type PostVisibility,
} from '@vastu/contracts';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space, tone } from '@/constants/theme';
import { AUDIENCE_LABEL, AUDIENCE_TONE } from './project-meta';
import { ApiError, NetworkError } from '@/lib/api/client';
import { softTick } from '@/lib/haptics';
import { SheetRow } from './sheet-row';
import { SlidingSwitch } from './sliding-switch';
import { useDocUpload } from './use-doc-upload';
import { usePhotoAttachments } from './use-photo-attachments';

export type ReplyTarget = {
  id: string;
  authorName: string;
  text: string | null;
  thumbUrl?: string | null;
  visibility: PostVisibility;
};

type Props = {
  projectId: string;
  placeholder: string;
  /** A new post (can choose who sees it) or a reply on a post. */
  kind: 'post' | 'reply';
  onCancel?: () => void;
  /** Staff on an open project may post a Final delivery (photos required, always client-visible). */
  allowFinalDelivery?: boolean;
  /** A customer posting: always visible to the customer side, so the audience chips are hidden. */
  fixedClient?: boolean;
  /** Syncs the audience switch when the parent chat tab switches between Team and Client view. */
  defaultVisibility?: PostVisibility;
  /** Called when the user switches between Team only and Client can see. */
  onVisibilityChange?: (next: PostVisibility) => void;
  /** Changing this number switches the composer into Final delivery mode (used by the Close flow). */
  finalDeliveryRequest?: number;
  /** WhatsApp-style quoted reply target rendered above the main input. */
  replyTo?: ReplyTarget | null;
  onCancelReply?: () => void;
  /** Resolves when the server accepted it; the composer then clears itself. */
  onSubmit: (body: CreatePostBodyDto & CreateCommentBodyDto) => Promise<unknown>;
};

function describe(e: unknown): string {
  if (e instanceof NetworkError) return 'Connection lost. Check your internet and try again.';
  if (e instanceof ApiError) return e.message;
  return 'Something went wrong. Try again.';
}

const AUDIENCE_OPTIONS = [
  { value: 'TEAM', label: AUDIENCE_LABEL.TEAM, icon: 'lock' },
  { value: 'CLIENT', label: AUDIENCE_LABEL.CLIENT, icon: 'eye' },
] as const;

/** Sliding pill audience switch: smoothly glides between Team only and Client can see. */
export function AudienceSwitch(props: {
  value: PostVisibility;
  onChange: (next: PostVisibility) => void;
  disabled?: boolean;
}) {
  return <SlidingSwitch<PostVisibility> options={AUDIENCE_OPTIONS} {...props} />;
}

export function PostComposer({
  projectId,
  placeholder,
  kind,
  onSubmit,
  onCancel,
  allowFinalDelivery: _allowFinalDelivery,
  fixedClient,
  defaultVisibility,
  onVisibilityChange,
  finalDeliveryRequest,
  replyTo,
  onCancelReply,
}: Props) {
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const photos = usePhotoAttachments(
    projectId,
    kind === 'post' && !replyTo ? MAX_IMAGES_PER_POST : MAX_IMAGES_PER_COMMENT,
  );
  const [text, setText] = useState('');
  const [pickedVisibility, setVisibility] = useState<PostVisibility>(
    fixedClient ? 'CLIENT' : (defaultVisibility ?? 'TEAM'),
  );
  const [attachOpen, setAttachOpen] = useState(false);
  const [final, setFinal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibility: PostVisibility = replyTo ? replyTo.visibility : final ? 'CLIENT' : pickedVisibility;
  const canAttachDoc = !!projectId;
  const docUpload = useDocUpload(projectId, fixedClient ? 'CLIENT' : visibility);

  const pickDocs = async () => {
    setError(null);
    const problem = await docUpload.pickAndUpload();
    if (problem) setError(problem);
  };

  useEffect(() => {
    if (!fixedClient && defaultVisibility) {
      setVisibility(defaultVisibility);
    }
  }, [defaultVisibility, fixedClient]);

  useEffect(() => {
    if (replyTo) {
      setFinal(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [replyTo?.id]);

  const [seenRequest, setSeenRequest] = useState(finalDeliveryRequest ?? 0);
  if ((finalDeliveryRequest ?? 0) !== seenRequest) {
    setSeenRequest(finalDeliveryRequest ?? 0);
    setFinal(true);
  }

  const hasContent = final
    ? photos.images.length > 0
    : text.trim().length > 0 || photos.images.length > 0;
  const canSend = hasContent && photos.uploadsDone && !photos.busy && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const trimmed = text.trim();
      await onSubmit({
        ...(trimmed ? { text: trimmed } : {}),
        images: photos.images,
        visibility,
        kind: final ? 'FINAL_DELIVERY' : 'UPDATE',
      });
      setText('');
      photos.clear();
      // The audience is never sticky: every new post starts as Team only.
      setVisibility(fixedClient ? 'CLIENT' : 'TEAM');
      setFinal(false);
    } catch (e) {
      setError(describe(e));
    } finally {
      setSending(false);
    }
  };

  const shownError = error ?? photos.problem;

  return (
    <View style={styles.wrap}>
      {photos.items.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space[2] }}
        >
          {photos.items.map((a) => (
            <View key={a.key} style={styles.thumbBox}>
              <Image source={{ uri: a.image.uri }} style={styles.thumb} contentFit="cover" />
              {a.status === 'uploading' ? (
                <View style={styles.overlay}>
                  <ActivityIndicator color={colors.primaryForeground} />
                  <Text variant="caption" color={colors.primaryForeground}>
                    {Math.round(a.progress * 100)}%
                  </Text>
                </View>
              ) : null}
              {a.status === 'error' ? (
                <PressableScale
                  onPress={() => photos.retry(a.key)}
                  style={styles.overlay}
                  accessibilityLabel="Retry upload"
                >
                  <Feather name="refresh-cw" size={18} color={colors.primaryForeground} />
                  <Text variant="caption" color={colors.primaryForeground}>
                    Retry
                  </Text>
                </PressableScale>
              ) : null}
              <PressableScale
                onPress={() => photos.remove(a.key)}
                accessibilityLabel="Remove photo"
                hitSlop={8}
                style={styles.remove}
              >
                <Feather name="x" size={14} color={colors.primaryForeground} />
              </PressableScale>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {kind === 'post' && replyTo ? (
        <View
          style={[
            styles.replyPreview,
            { borderLeftColor: replyTo.visibility === 'TEAM' ? tone.orange.fg : colors.primary },
          ]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              variant="caption"
              color={replyTo.visibility === 'TEAM' ? tone.orange.fg : colors.primary}
              numberOfLines={1}
              style={{ fontFamily: font.semibold }}
            >
              Replying to {replyTo.authorName}
              {!fixedClient ? ` · ${AUDIENCE_LABEL[replyTo.visibility]}` : ''}
            </Text>
            <Text variant="caption" muted numberOfLines={1}>
              {replyTo.text ?? (replyTo.thumbUrl ? 'Photo' : 'Message')}
            </Text>
          </View>
          {replyTo.thumbUrl ? (
            <Image source={{ uri: replyTo.thumbUrl }} style={styles.replyThumb} contentFit="cover" />
          ) : null}
          {onCancelReply ? (
            <PressableScale
              onPress={onCancelReply}
              accessibilityLabel="Cancel reply"
              hitSlop={8}
              style={styles.replyClose}
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </PressableScale>
          ) : null}
        </View>
      ) : kind === 'post' && !fixedClient ? (
        final ? (
          <View style={styles.finalBanner}>
            <Feather name="check-circle" size={14} color={tone.success.fg} />
            <Text variant="caption" color={tone.success.fg} style={{ flex: 1, fontFamily: font.semibold }}>
              Final delivery · Visible to client (photo required)
            </Text>
            <PressableScale
              onPress={() => setFinal(false)}
              accessibilityLabel="Cancel final delivery mode"
              hitSlop={8}
            >
              <Feather name="x" size={16} color={tone.success.fg} />
            </PressableScale>
          </View>
        ) : (
          <AudienceSwitch
            value={visibility}
            onChange={(next) => {
              setVisibility(next);
              onVisibilityChange?.(next);
            }}
          />
        )
      ) : null}

      {docUpload.busy ? (
        <View style={styles.docProgress}>
          <ActivityIndicator size="small" color={colors.tealStrong} />
          <Text variant="caption" color={colors.tealStrong} style={{ fontFamily: font.semibold }}>
            {docUpload.progress ?? 'Uploading document...'}
          </Text>
        </View>
      ) : null}

      {shownError ? (
        <Text variant="caption" color={colors.destructive}>
          {shownError}
        </Text>
      ) : null}

      {kind === 'reply' ? (
        <>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholder}
            multiline
            style={[styles.input, { flex: 0, minHeight: 72, textAlignVertical: 'top' }]}
          />
          <View style={styles.replyActions}>
            <PressableScale
              onPress={() => void photos.takePhoto()}
              accessibilityLabel="Take a photo"
              style={styles.icon}
            >
              <Feather name="camera" size={20} color={colors.mutedForeground} />
            </PressableScale>
            <PressableScale
              onPress={() => void photos.pickFromGallery()}
              accessibilityLabel="Attach photos"
              style={styles.icon}
            >
              <Feather name="image" size={20} color={colors.mutedForeground} />
            </PressableScale>
            <View style={{ flex: 1 }} />
            {onCancel ? (
              <Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} />
            ) : null}
            <PressableScale
              onPress={() => void send()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send reply"
              style={[styles.sendBtn, { opacity: canSend ? 1 : 0.4 }]}
            >
              {sending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Feather name="send" size={20} color={colors.primaryForeground} />
              )}
            </PressableScale>
          </View>
        </>
      ) : (
        <View style={styles.row}>
          <PressableScale
            onPress={() => {
              softTick();
              setAttachOpen(true);
            }}
            disabled={docUpload.busy}
            accessibilityRole="button"
            accessibilityLabel="Add attachment"
            style={[styles.plusBtn, { opacity: docUpload.busy ? 0.5 : 1 }]}
          >
            <Feather name="plus" size={20} color={colors.inkDeep} />
          </PressableScale>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={
              replyTo
                ? `Reply to ${replyTo.authorName}…`
                : final
                  ? 'Add a photo for final delivery…'
                  : 'Post an update…'
            }
            placeholderTextColor={colors.placeholder}
            multiline
            style={styles.input}
          />
          <PressableScale
            onPress={() => void send()}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={final ? 'Post final delivery' : 'Send'}
            style={[styles.sendBtn, { opacity: canSend ? 1 : 0.4 }]}
          >
            {sending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Feather name="send" size={19} color={colors.primaryForeground} />
            )}
          </PressableScale>
        </View>
      )}

      <BottomSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        title="Add attachment"
      >
        <View>
          <SheetRow
            icon="camera"
            label="Take photo"
            onPress={() => {
              setAttachOpen(false);
              void photos.takePhoto();
            }}
          />
          <SheetRow
            icon="image"
            label="Choose from gallery"
            divider
            onPress={() => {
              setAttachOpen(false);
              void photos.pickFromGallery();
            }}
          />
          {canAttachDoc ? (
            <SheetRow
              icon="file-text"
              label="Upload document"
              caption={
                fixedClient
                  ? 'PDF, Word, Excel, CAD'
                  : `PDF, Word, Excel, CAD · ${AUDIENCE_LABEL[visibility]}`
              }
              divider
              onPress={() => {
                setAttachOpen(false);
                void pickDocs();
              }}
            />
          ) : null}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  clientTint: { backgroundColor: tone.success.bg, borderRadius: radius.lg, padding: space[2] },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  replyActions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  icon: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  plusBtn: {
    width: 40,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
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
  thumbBox: { width: 72, height: 72, borderRadius: radius.md, overflow: 'hidden' },
  thumb: { width: 72, height: 72, backgroundColor: colors.muted },
  overlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(15, 28, 26, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 28, 26, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.md,
    backgroundColor: tone.success.bg,
    borderWidth: 1,
    borderColor: `${tone.success.fg}55`,
  },
  docProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingLeft: space[3],
    paddingRight: space[2],
    paddingVertical: space[2],
    borderRadius: radius.md,
    borderLeftWidth: 3,
    backgroundColor: colors.muted,
  },
  replyThumb: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  replyClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
