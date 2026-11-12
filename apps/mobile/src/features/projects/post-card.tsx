import { Alert, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { CommentDto, ImageDto, PostDto, PostVisibility } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, radius, space, tone } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { formatDate, formatTime } from '@/lib/format';
import { AUDIENCE_LABEL, AUDIENCE_TONE } from './project-meta';
import { useApprovePost, useDeletePost } from './use-projects';

export type OpenPhotos = (images: ImageDto[], index: number) => void;

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
          style={{ width: single ? '100%' : '49.5%', aspectRatio: single ? 4 / 3 : 1 }}
        >
          <Image
            source={{ uri: img.thumbUrl }}
            style={{ flex: 1, borderRadius: radius.md, backgroundColor: colors.muted }}
            contentFit="cover"
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

type Props = {
  post: PostDto;
  projectId: string;
  mine: boolean;
  highlighted?: boolean;
  closed: boolean;
  onOpenPhotos: OpenPhotos;
  /** Opens the thread. Omitted inside the thread itself. */
  onReply?: () => void;
  onDeleted?: () => void;
};

export function PostCard({ post, projectId, mine, highlighted, closed, onOpenPhotos, onReply, onDeleted }: Props) {
  const del = useDeletePost(projectId);
  const approve = useApprovePost(projectId);
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
          <AudienceChip v={post.visibility} />
          {final ? <Badge label="Final delivery" t="success" /> : null}
        </View>
        {post.images.length > 0 ? <PhotoGrid images={post.images} onOpen={onOpenPhotos} /> : null}
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
        <PressableScale onPress={onReply} accessibilityLabel="Reply" style={styles.indent} hitSlop={8}>
          <Text variant="caption" color={colors.primary}>
            Reply{post.commentCount > 0 ? ` · ${post.commentCount}` : ''}
          </Text>
        </PressableScale>
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
  theirs: { backgroundColor: colors.muted, borderBottomLeftRadius: radius.sm },
  team: { borderWidth: 1, borderColor: tone.orange.bg },
  final: { borderLeftWidth: 4, borderLeftColor: tone.success.fg },
  highlight: { borderWidth: 2, borderColor: colors.primary },
  replyBubble: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  indent: { marginLeft: space[5] },
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
