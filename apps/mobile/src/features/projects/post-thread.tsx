import { Alert, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useKeyboardAvoid } from '@/hooks/use-keyboard-avoid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PostDto } from '@vastu/contracts';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, hit, space } from '@/constants/theme';
import { CommentBubble, PostCard, errorMessage, type OpenPhotos } from './post-card';
import { PostComposer } from './post-composer';
import { useCreateComment, useDeleteComment, usePostComments } from './use-projects';

type Props = {
  projectId: string;
  post: PostDto | null;
  mine: boolean;
  closed: boolean;
  onClose: () => void;
  onOpenPhotos: OpenPhotos;
};

/** "Reply": the post, its whole thread (oldest first) and a reply composer (hidden on a closed project). */
export function PostThread({ projectId, post, mine, closed, onClose, onOpenPhotos }: Props) {
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
        style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: kb.pad }}
      >
        <View style={styles.header}>
          <Text variant="section" style={{ flex: 1 }}>
            Replies
          </Text>
          <PressableScale onPress={onClose} accessibilityLabel="Close replies" style={styles.close}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
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
              closed={closed}
              onOpenPhotos={onOpenPhotos}
              onDeleted={onClose}
            />
          ) : null}
          {comments.isPending ? (
            <Skeleton height={60} />
          ) : comments.isError ? (
            <Text muted>Could not load the replies.</Text>
          ) : comments.data.length === 0 ? (
            <Text muted>No replies yet.</Text>
          ) : (
            comments.data.map((c) => (
              <CommentBubble
                key={c.id}
                comment={c}
                onOpen={onOpenPhotos}
                onDelete={() =>
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
              />
            ))
          )}
        </ScrollView>
        {!closed ? (
          <View style={[styles.composer, { paddingBottom: (kb.open ? 0 : insets.bottom) + space[3] }]}>
            <PostComposer
              projectId={projectId}
              kind="reply"
              placeholder="Write a reply"
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: { width: hit, height: hit, alignItems: 'center', justifyContent: 'center' },
  composer: {
    padding: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
