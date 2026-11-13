import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space, tone } from '@/constants/theme';
import { AUDIENCE_LABEL, AUDIENCE_TONE } from './project-meta';
import { ApiError, NetworkError } from '@/lib/api/client';
import { usePhotoAttachments } from './use-photo-attachments';

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
  /** Changing this number switches the composer into Final delivery mode (used by the Close flow). */
  finalDeliveryRequest?: number;
  /** Resolves when the server accepted it; the composer then clears itself. */
  onSubmit: (body: CreatePostBodyDto & CreateCommentBodyDto) => Promise<unknown>;
};

function describe(e: unknown): string {
  if (e instanceof NetworkError) return 'Connection lost. Check your internet and try again.';
  if (e instanceof ApiError) return e.message;
  return 'Something went wrong. Try again.';
}

export function PostComposer({
  projectId,
  placeholder,
  kind,
  onSubmit,
  onCancel,
  allowFinalDelivery,
  fixedClient,
  finalDeliveryRequest,
}: Props) {
  const photos = usePhotoAttachments(
    projectId,
    kind === 'post' ? MAX_IMAGES_PER_POST : MAX_IMAGES_PER_COMMENT,
  );
  const [text, setText] = useState('');
  const [pickedVisibility, setVisibility] = useState<PostVisibility>(fixedClient ? 'CLIENT' : 'TEAM');
  const [final, setFinal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibility: PostVisibility = final ? 'CLIENT' : pickedVisibility;

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
  const tinted = kind === 'post' && visibility === 'CLIENT' && !fixedClient;

  return (
    <View style={[styles.wrap, tinted && styles.clientTint]}>
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

      {kind === 'post' && !fixedClient ? (
        <View style={styles.visibilityRow}>
          {(['TEAM', 'CLIENT'] as const).map((v) => {
            const active = visibility === v;
            const t = tone[AUDIENCE_TONE[v]];
            return (
              <PressableScale
                key={v}
                disabled={final}
                onPress={() => setVisibility(v)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? t.bg : colors.muted,
                    borderColor: active ? t.fg : 'transparent',
                  },
                ]}
              >
                <Feather
                  name={v === 'TEAM' ? 'lock' : 'eye'}
                  size={13}
                  color={active ? t.fg : colors.mutedForeground}
                />
                <Text
                  variant="caption"
                  numberOfLines={1}
                  color={active ? t.fg : colors.mutedForeground}
                >
                  {AUDIENCE_LABEL[v]}
                </Text>
              </PressableScale>
            );
          })}
          {allowFinalDelivery ? (
            <PressableScale
              onPress={() => setFinal((f) => !f)}
              accessibilityRole="button"
              accessibilityState={{ selected: final }}
              style={[
                styles.chip,
                {
                  backgroundColor: final ? tone.success.bg : colors.muted,
                  borderColor: final ? tone.success.fg : 'transparent',
                },
              ]}
            >
              <Feather
                name="check-circle"
                size={13}
                color={final ? tone.success.fg : colors.mutedForeground}
              />
              <Text
                variant="caption"
                numberOfLines={1}
                color={final ? tone.success.fg : colors.mutedForeground}
              >
                Final delivery
              </Text>
            </PressableScale>
          ) : null}
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
          <PressableScale onPress={() => void photos.takePhoto()} accessibilityLabel="Take a photo" style={styles.icon}>
            <Feather name="camera" size={22} color={colors.mutedForeground} />
          </PressableScale>
          <PressableScale onPress={() => void photos.pickFromGallery()} accessibilityLabel="Attach photos" style={styles.icon}>
            <Feather name="image" size={22} color={colors.mutedForeground} />
          </PressableScale>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={
              final
                ? 'Add a photo to post'
                : tinted
                  ? 'Message customer'
                  : placeholder
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
              <Feather name="send" size={20} color={colors.primaryForeground} />
            )}
          </PressableScale>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  clientTint: { backgroundColor: tone.success.bg, borderRadius: radius.lg, padding: space[2] },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space[1] },
  replyActions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  icon: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
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
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 8,
    flexShrink: 1,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
