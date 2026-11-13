import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { CommentDto, ImageDto, PostDto, PostVisibility } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space, tone } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { formatDate, formatTime } from '@/lib/format';
import { AUDIENCE_LABEL, AUDIENCE_TONE } from './project-meta';
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
  closed: boolean;
  onOpenPhotos: OpenPhotos;
  /** Opens the thread. Omitted inside the thread itself. */
  onReply?: () => void;
  /** The inline reply box just opened: the list scrolls this post into view. */
  onReplyOpen?: () => void;
  /** Customer app: every message is already client-side, so the audience chip is noise. */
  hideAudience?: boolean;
  onDeleted?: () => void;
};

export function PostCard({ post, projectId, mine, highlighted, closed, onOpenPhotos, onReply, onReplyOpen, hideAudience, onDeleted }: Props) {
  const del = useDeletePost(projectId);
  const approve = useApprovePost(projectId);
  const saveDocs = useSaveToDocs(projectId);
  const [replying, setReplying] = useState(false);
  const final = post.kind === 'FINAL_DELIVERY';

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

  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: space[1] }}>
      <PressableScale
        disabled={!post.canDelete}
        onLongPress={confirmDelete}
        accessibilityHint={post.canDelete ? 'Long press to delete' : undefined}
        style={[
          styles.bubble,
          mine ? styles.mine : styles.theirs,
          post.visibility === 'TEAM' && styles.team,
          final && styles.final,
          highlighted && styles.highlight,
        ]}
      >
        <Text variant="label" color={colors.primary} numberOfLines={1}>
          {mine ? 'You' : post.author.name}
          {post.author.isCustomer ? ' · Customer' : post.author.designation ? ` · ${post.author.designation}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: space[1], flexWrap: 'wrap' }}>
          {hideAudience ? null : <AudienceChip v={post.visibility} />}
          {final ? <Badge label="Final delivery" t="success" /> : null}
        </View>
        {post.images.length > 0 ? <PhotoGrid images={post.images} onOpen={onOpenPhotos} /> : null}
        {post.images.length > 0 ? (
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
            <Feather name="folder-plus" size={13} color={colors.mutedForeground} />
            <Text variant="caption" muted>
              {saveDocs.isPending ? 'Saving...' : 'Save to Docs'}
            </Text>
          </PressableScale>
        ) : null}
        {post.text ? <Text>{post.text}</Text> : null}
        {post.approval ? (
          <Badge label={`Approved by ${post.approval.by.name} · ${formatDate(post.approval.at)}`} t="success" />
        ) : null}
        <Text variant="caption" muted style={{ alignSelf: 'flex-end' }}>
          {formatTime(post.createdAt)}
        </Text>
      </PressableScale>

      {post.canApprove ? (
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
      ) : null}

      {post.commentCount > post.recentComments.length && onReply ? (
        <PressableScale onPress={onReply} style={styles.indent} hitSlop={8}>
          <Text variant="caption" color={colors.primary}>
            Show all {post.commentCount} comments
          </Text>
        </PressableScale>
      ) : null}
      {onReply
        ? post.recentComments.map((c) => (
            <View key={c.id} style={styles.indent}>
              <CommentBubble comment={c} onOpen={onOpenPhotos} />
            </View>
          ))
        : null}
      {onReply && !closed ? (
        replying ? (
          <View style={[styles.indent, { alignSelf: 'stretch', marginRight: space[2] }]}>
            <InlineReply projectId={projectId} postId={post.id} onDone={() => setReplying(false)} />
          </View>
        ) : (
          <PressableScale onPress={() => {
              setReplying(true);
              onReplyOpen?.();
            }}
            accessibilityLabel="Reply" style={styles.indent} hitSlop={8}>
            <Text variant="caption" color={colors.primary}>
              Reply{post.commentCount > 0 ? ` · ${post.commentCount}` : ''}
            </Text>
          </PressableScale>
        )
      ) : null}
    </View>
  );
}


const styles = StyleSheet.create({
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
