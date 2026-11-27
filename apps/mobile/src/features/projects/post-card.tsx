import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { CommentDto, ImageDto, PostDto, PostVisibility } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space, tone } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { formatDate, formatTime } from '@/lib/format';
import { softTick } from '@/lib/haptics';
import { AUDIENCE_LABEL, AUDIENCE_TONE } from './project-meta';
import { TimelineEntryRow } from './timeline-item';
import { useApprovePost, useCreateComment, useDeletePost, useSaveToDocs } from './use-projects';

export type OpenPhotos = (images: ImageDto[], index: number) => void;

/** A single photo keeps its own shape (so the whole picture shows); extreme panoramas / tall strips are limited. */
function ratioOf(img: ImageDto): number {
  if (!img.width || !img.height) return 4 / 3;
  return Math.min(2, Math.max(0.5, img.width / img.height));
}

export function PhotoGrid({ images, onOpen }: { images: ImageDto[]; onOpen: OpenPhotos }) {
  const shown = images.slice(0, 4);
  const single = shown.length === 1;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {shown.map((img, i) => (
        <PressableScale
          key={img.publicId}
          onPress={() => onOpen(images, i)}
          accessibilityLabel={`Open photo ${i + 1} of ${images.length}`}
          style={{ width: single ? '100%' : '49.5%', aspectRatio: single ? ratioOf(img) : 1 }}
        >
          <Image
            source={{ uri: single ? img.url : img.thumbUrl }}
            style={{ flex: 1, borderRadius: radius.md, backgroundColor: colors.muted }}
            contentFit={single ? 'contain' : 'cover'}
          />
          {i === 3 && images.length > 4 ? (
            <View style={styles.more}>
              <Text variant="label" color={colors.primaryForeground}>
                +{images.length - 4}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      ))}
    </View>
  );
}

export function AudienceChip({ v }: { v: PostVisibility }) {
  const t = tone[AUDIENCE_TONE[v]];
  return (
    <View style={[styles.audience, { backgroundColor: t.bg }]}>
      <Feather name={v === 'TEAM' ? 'lock' : 'eye'} size={11} color={t.fg} />
      <Text variant="caption" color={t.fg}>
        {AUDIENCE_LABEL[v]}
      </Text>
    </View>
  );
}

export function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Something went wrong. Try again.';
}

export function CommentBubble({
  comment,
  onOpen,
  onDelete,
}: {
  comment: CommentDto;
  onOpen: OpenPhotos;
  onDelete?: () => void;
}) {
  return (
    <PressableScale
      disabled={!comment.canDelete || !onDelete}
      onLongPress={onDelete}
      accessibilityHint={comment.canDelete ? 'Long press to delete' : undefined}
      style={[styles.bubble, styles.replyBubble]}
    >
      <Text variant="caption" color={colors.primary}>
        {comment.author.name}
        {comment.author.isCustomer ? ' · Customer' : ''}
      </Text>
      {comment.images.length > 0 ? <PhotoGrid images={comment.images} onOpen={onOpen} /> : null}
      {comment.text ? <Text>{comment.text}</Text> : null}
      <Text variant="caption" muted style={{ alignSelf: 'flex-end' }}>
        {formatTime(comment.createdAt)}
      </Text>
    </PressableScale>
  );
}

/** A one-line reply box that opens right under the post, like the website. */
function InlineReply({ projectId, postId, onDone }: { projectId: string; postId: string; onDone: () => void }) {
  const [text, setText] = useState('');
  const reply = useCreateComment(projectId, postId);
  const canSend = text.trim().length > 0 && !reply.isPending;
  const send = () =>
    reply.mutate(
      { text: text.trim() },
      { onSuccess: onDone, onError: (e) => Alert.alert('Could not send', errorMessage(e)) },
    );
  return (
    <View style={styles.inlineReply}>
      <TextInput
        autoFocus
        value={text}
        onChangeText={setText}
        placeholder="Add a comment here..."
        placeholderTextColor={colors.placeholder}
        multiline
        maxLength={2000}
        style={styles.inlineInput}
      />
      <PressableScale onPress={onDone} accessibilityLabel="Cancel reply" style={styles.inlineBtn}>
        <Feather name="x" size={20} color={colors.mutedForeground} />
      </PressableScale>
      <PressableScale
        onPress={send}
        disabled={!canSend}
        accessibilityLabel="Send reply"
        style={[styles.inlineBtn, styles.inlineSend, { opacity: canSend ? 1 : 0.4 }]}
      >
        {reply.isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Feather name="send" size={18} color={colors.primaryForeground} />
        )}
      </PressableScale>
    </View>
  );
}

type Props = {
  post: PostDto;
  projectId: string;
  mine: boolean;
  highlighted?: boolean;
  selected?: boolean;
  pinned?: boolean;
  closed: boolean;
  onOpenPhotos: OpenPhotos;
  /** Opens the thread. Omitted inside the thread itself. */
  onReply?: () => void;
  /** WhatsApp-style slide-to-reply: targets this post in the main bottom composer. */
  onSwipeReply?: (post: PostDto) => void;
  /** Long-press action menu (reply, copy, pin/unpin, delete). */
  onLongPress?: (post: PostDto) => void;
  /** The inline reply box just opened: the list scrolls this post into view. */
  onReplyOpen?: () => void;
  /** Customer app: every message is already client-side, so the audience chip is noise. */
  hideAudience?: boolean;
  onDeleted?: () => void;
};

const SWIPE_THRESHOLD = 48;
const SWIPE_MAX = 72;

export function PostCard({ post, projectId, mine, highlighted, selected, pinned, closed, onOpenPhotos, onReply, onSwipeReply, onLongPress, onReplyOpen, hideAudience, onDeleted }: Props) {
  const del = useDeletePost(projectId);
  const approve = useApprovePost(projectId);
  const saveDocs = useSaveToDocs(projectId);
  const [replying, setReplying] = useState(false);
  const final = post.kind === 'FINAL_DELIVERY';
  const canSwipeReply = Boolean((onSwipeReply || onReply) && !closed);

  const dragX = useSharedValue(0);
  const armed = useSharedValue(false);

  const triggerReply = useCallback(() => {
    if (onSwipeReply) {
      onSwipeReply(post);
    } else {
      setReplying(true);
      onReplyOpen?.();
    }
  }, [onSwipeReply, post, onReplyOpen]);

  // Strict rightward-only pan: fails immediately on any vertical (±8px) or leftward (-8px) drift
  // so vertical FlatList scrolling is never stalled.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canSwipeReply)
        .activeOffsetX(20)
        .failOffsetX(-8)
        .failOffsetY([-8, 8])
        .onUpdate((e) => {
          const x = Math.max(0, Math.min(e.translationX * 0.85, SWIPE_MAX));
          dragX.value = x;
          if (x >= SWIPE_THRESHOLD && !armed.value) {
            armed.value = true;
            runOnJS(softTick)();
          } else if (x < SWIPE_THRESHOLD && armed.value) {
            armed.value = false;
          }
        })
        .onEnd(() => {
          if (armed.value) {
            runOnJS(triggerReply)();
          }
        })
        .onFinalize(() => {
          armed.value = false;
          dragX.value = withSpring(0, { damping: 24, stiffness: 280, mass: 0.85 });
        }),
    [canSwipeReply, dragX, armed, triggerReply],
  );

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
  }));

  const replyCueStyle = useAnimatedStyle(() => {
    const progress = interpolate(dragX.value, [0, SWIPE_THRESHOLD], [0, 1], 'clamp');
    const scale = interpolate(dragX.value, [0, SWIPE_THRESHOLD, SWIPE_MAX], [0.5, 1, 1.12], 'clamp');
    return {
      opacity: progress,
      transform: [{ scale }],
    };
  });

  const confirmDelete = () => {
    Alert.alert('Delete this post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          del.mutate(post.id, {
            onSuccess: onDeleted,
            onError: (e) => Alert.alert('Could not delete', errorMessage(e)),
          }),
      },
    ]);
  };

  const authorLabel = mine ? 'You' : post.author.name;
  const roleSuffix = post.author.isCustomer
    ? 'Customer'
    : post.author.designation ?? null;
  const hasText = Boolean(post.text && post.text.trim().length > 0);

  return (
    <View style={styles.swipeWrap}>
      {canSwipeReply ? (
        <Animated.View pointerEvents="none" style={[styles.replyCue, replyCueStyle]}>
          <Feather name="corner-up-left" size={15} color={colors.primary} />
        </Animated.View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={slideStyle}>
          <TimelineEntryRow authorName={post.author.name} accentAvatar={mine}>
            <PressableScale
              disabled={!onLongPress && !post.canDelete}
              delayLongPress={280}
              onLongPress={() => {
                if (onLongPress) {
                  softTick();
                  onLongPress(post);
                } else if (post.canDelete) {
                  confirmDelete();
                }
              }}
              accessibilityHint={
                onLongPress
                  ? 'Long press for message options'
                  : post.canDelete
                    ? 'Long press to delete'
                    : undefined
              }
              style={[
                styles.entryCard,
                mine && styles.entryMine,
                post.visibility === 'TEAM' && styles.team,
                final && styles.final,
                highlighted && styles.highlight,
                selected && styles.entrySelected,
              ]}
            >
              {/* Header: author name + role + timestamp (+ pin) */}
              <View style={styles.headerRow}>
                <View style={styles.authorWrap}>
                  <Text variant="label" color={colors.inkDeep} numberOfLines={1} style={styles.authorName}>
                    {authorLabel}
                  </Text>
                  {roleSuffix ? (
                    <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
                      · {roleSuffix}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.timeWrap}>
                  {pinned ? <Feather name="bookmark" size={11} color={colors.primary} /> : null}
                  <Text variant="caption" muted style={styles.timeText}>
                    {formatTime(post.createdAt)}
                  </Text>
                </View>
              </View>

              {/* Message body — omitted cleanly for photo-only posts */}
              {hasText ? (
                <Text color={colors.inkDeep} style={{ lineHeight: 21 }}>
                  {post.text}
                </Text>
              ) : null}

              {/* Photo attachments */}
              {post.images.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <View style={styles.photoFrame}>
                    <PhotoGrid images={post.images} onOpen={onOpenPhotos} />
                  </View>
                  <PressableScale
                    disabled={saveDocs.isPending}
                    onPress={() =>
                      saveDocs.mutate(
                        { items: post.images.slice(0, 20).map((i) => ({ publicId: i.publicId })), visibility: post.visibility },
                        {
                          onSuccess: (r) =>
                            Alert.alert(
                              r.every((x) => !x.created) ? 'Already in Docs' : 'Saved to Docs',
                              r.every((x) => !x.created) ? undefined : `${r.filter((x) => x.created).length} file(s) added.`,
                            ),
                          onError: (e) => Alert.alert('Could not save', errorMessage(e)),
                        },
                      )
                    }
                    accessibilityLabel="Save photos to Docs"
                    hitSlop={6}
                    style={styles.saveDocs}
                  >
                    <Feather name="folder-plus" size={13} color={colors.inkMuted} />
                    <Text variant="caption" color={colors.inkMuted}>
                      {saveDocs.isPending ? 'Saving...' : 'Save to Docs'}
                    </Text>
                  </PressableScale>
                </View>
              ) : null}

              {post.approval ? (
                <Badge label={`Approved by ${post.approval.by.name} · ${formatDate(post.approval.at)}`} t="success" />
              ) : null}

              {/* Footer: explicit audience label, compact in-context thread link, and Reply action */}
              {(!hideAudience || final || (onReply && post.commentCount > 0) || (onReply && !closed)) ? (
                <View style={styles.footerRow}>
                  <View style={styles.footerLeft}>
                    {hideAudience ? null : <AudienceChip v={post.visibility} />}
                    {final ? <Badge label="Final delivery" t="success" /> : null}
                  </View>
                  <View style={styles.footerRight}>
                    {onReply && post.commentCount > 0 ? (
                      <PressableScale onPress={onReply} hitSlop={8}>
                        <Text variant="caption" color={colors.primary} style={{ fontFamily: font.medium }}>
                          {post.commentCount} {post.commentCount === 1 ? 'reply' : 'replies'}
                          {post.recentComments.length > 0
                            ? ` · Last by ${post.recentComments[post.recentComments.length - 1]!.author.name.split(' ')[0]}`
                            : ''}
                        </Text>
                      </PressableScale>
                    ) : onReply && !closed ? (
                      <PressableScale onPress={triggerReply} accessibilityLabel="Reply" hitSlop={8}>
                        <Text variant="caption" color={colors.primary} style={{ fontFamily: font.semibold }}>
                          Reply
                        </Text>
                      </PressableScale>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </PressableScale>

            {post.canApprove ? (
              <View style={{ alignSelf: 'flex-start' }}>
                <Button
                  title="Approve design"
                  size="sm"
                  loading={approve.isPending}
                  onPress={() =>
                    Alert.alert('Approve this design?', 'The team will be told you approved the design in this post.', [
                      { text: 'Not yet', style: 'cancel' },
                      {
                        text: 'Approve',
                        onPress: () =>
                          approve.mutate(post.id, { onError: (e) => Alert.alert('Could not approve', errorMessage(e)) }),
                      },
                    ])
                  }
                />
              </View>
            ) : null}

            {onReply && !onSwipeReply
              ? post.recentComments.map((c) => (
                  <CommentBubble key={c.id} comment={c} onOpen={onOpenPhotos} />
                ))
              : null}
            {onReply && !closed && !onSwipeReply && replying ? (
              <InlineReply projectId={projectId} postId={post.id} onDone={() => setReplying(false)} />
            ) : null}
          </TimelineEntryRow>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}


const styles = StyleSheet.create({
  swipeWrap: {
    width: '100%',
    justifyContent: 'center',
  },
  replyCue: {
    position: 'absolute',
    left: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: space[3],
    gap: space[2],
  },
  entryMine: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
  },
  entrySelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  photoFrame: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  authorWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  authorName: {
    fontFamily: font.semibold,
    flexShrink: 1,
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  timeText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    paddingTop: 2,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '88%',
    padding: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius['2xl'],
    gap: space[1],
  },
  mine: { backgroundColor: colors.primarySoft, borderBottomRightRadius: radius.sm },
  theirs: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: radius.sm },
  team: { borderWidth: 1, borderColor: tone.orange.bg },
  final: { borderLeftWidth: 4, borderLeftColor: tone.success.fg },
  highlight: { borderWidth: 2, borderColor: colors.primary },
  replyBubble: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  indent: { marginLeft: space[5] },
  metaLeft: { alignSelf: 'flex-start', paddingLeft: space[1] },
  metaRight: { alignSelf: 'flex-end', paddingRight: space[1] },
  saveDocs: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  inlineReply: { flexDirection: 'row', alignItems: 'flex-end', gap: space[1] },
  inlineInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.input,
    backgroundColor: colors.background,
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.foreground,
  },
  inlineBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  inlineSend: { borderRadius: 20, backgroundColor: colors.primary },
  audience: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  more: {
    ...(StyleSheet.absoluteFill as object),
    borderRadius: radius.md,
    backgroundColor: 'rgba(15, 28, 26, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
