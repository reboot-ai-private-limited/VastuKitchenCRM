import { Alert, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useKeyboardAvoid } from '@/hooks/use-keyboard-avoid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PostDto } from '@vastu/contracts';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space } from '@/constants/theme';
import { formatTime } from '@/lib/format';
import { AudienceChip, PhotoGrid, PostCard, errorMessage, type OpenPhotos } from './post-card';
import { PostComposer } from './post-composer';
import { TimelineEntryRow } from './timeline-item';
import { useCreateComment, useDeleteComment, usePostComments } from './use-projects';

type Props = {
  projectId: string;
  post: PostDto | null;
  mine: boolean;
  hideAudience?: boolean;
  closed: boolean;
  onClose: () => void;
  onOpenPhotos: OpenPhotos;
};

/** Thread modal: original post at the top, chronological replies, and inherited-audience reply composer. */
export function PostThread({ projectId, post, mine, hideAudience = false, closed, onClose, onOpenPhotos }: Props) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardAvoid();
  const comments = usePostComments(projectId, post?.id ?? null);
  const reply = useCreateComment(projectId, post?.id ?? '');
  const del = useDeleteComment(projectId, post?.id ?? '');

  return (
    <Modal visible={!!post} animationType="slide" onRequestClose={onClose}>
      <View
        ref={kb.ref}
        collapsable={false}
        style={{ flex: 1, backgroundColor: colors.pageSoft, paddingTop: insets.top, paddingBottom: kb.pad }}
      >
        <View style={styles.header}>
          <Text variant="section" color={colors.inkDeep} style={{ flex: 1 }}>
            Discussion
          </Text>
          <PressableScale onPress={onClose} accessibilityLabel="Close discussion" style={styles.close}>
            <Feather name="x" size={22} color={colors.inkMuted} />
          </PressableScale>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space[4], gap: space[3] }}
        >
          {post ? (
            <PostCard
              post={post}
              projectId={projectId}
              mine={mine}
              hideAudience={hideAudience}
              closed={closed}
              onOpenPhotos={onOpenPhotos}
              onDeleted={onClose}
            />
          ) : null}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text variant="caption" muted>
              {comments.isPending
                ? 'Loading replies…'
                : comments.data
                  ? `${comments.data.length} ${comments.data.length === 1 ? 'reply' : 'replies'}`
                  : 'Replies'}
            </Text>
            <View style={styles.dividerLine} />
          </View>

          {comments.isPending ? (
            <Skeleton height={60} />
          ) : comments.isError ? (
            <Text muted>Could not load the replies.</Text>
          ) : comments.data.length === 0 ? (
            <Text muted style={{ textAlign: 'center', paddingVertical: space[3] }}>
              No replies yet. Start the discussion below.
            </Text>
          ) : (
            comments.data.map((c, idx) => (
              <TimelineEntryRow
                key={c.id}
                authorName={c.author.name}
                connectAbove={idx > 0}
                connectBelow={idx < comments.data.length - 1}
              >
                <PressableScale
                  disabled={!c.canDelete}
                  onLongPress={() =>
                    Alert.alert('Delete this reply?', undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () =>
                          del.mutate(c.id, { onError: (e) => Alert.alert('Could not delete', errorMessage(e)) }),
                      },
                    ])
                  }
                  style={styles.replyCard}
                >
                  <View style={styles.replyHeader}>
                    <Text variant="label" color={colors.inkDeep} numberOfLines={1} style={{ flex: 1, fontFamily: font.semibold }}>
                      {c.author.name}
                      {c.author.isCustomer ? ' · Customer' : ''}
                    </Text>
                    <Text variant="caption" muted style={styles.replyTime}>
                      {formatTime(c.createdAt)}
                    </Text>
                  </View>
                  {c.text ? (
                    <Text color={colors.inkDeep} style={{ lineHeight: 20 }}>
                      {c.text}
                    </Text>
                  ) : null}
                  {c.images.length > 0 ? (
                    <View style={styles.photoFrame}>
                      <PhotoGrid images={c.images} onOpen={onOpenPhotos} />
                    </View>
                  ) : null}
                </PressableScale>
              </TimelineEntryRow>
            ))
          )}
        </ScrollView>
        {!closed && post ? (
          <View style={[styles.composer, { paddingBottom: (kb.open ? 0 : insets.bottom) + space[3] }]}>
            {!hideAudience ? (
              <View style={styles.inheritedRow}>
                <AudienceChip v={post.visibility} />
                <Text variant="caption" muted>
                  {post.visibility === 'TEAM'
                    ? 'Inherited from post · staff only'
                    : 'Inherited from post · visible to client'}
                </Text>
              </View>
            ) : null}
            <PostComposer
              projectId={projectId}
              kind="reply"
              placeholder="Write a reply…"
              onSubmit={async (body) => {
                await reply.mutateAsync({
                  ...(body.text ? { text: body.text } : {}),
                  ...(body.images?.length ? { images: body.images } : {}),
                });
              }}
            />
          </View>
        ) : (
          <View style={[styles.composer, { paddingBottom: insets.bottom + space[3] }]}>
            <Text variant="caption" muted>
              This project is closed. It takes no new posts or comments.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  close: { width: hit, height: hit, alignItems: 'center', justifyContent: 'center' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[1],
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
  },
  replyCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: space[3],
    gap: 6,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  replyTime: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  photoFrame: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  inheritedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[2],
  },
  composer: {
    padding: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
});
