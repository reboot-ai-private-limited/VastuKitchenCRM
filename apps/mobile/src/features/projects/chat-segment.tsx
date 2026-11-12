import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  RefreshControl,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComplaintDto, ProjectDto } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, radius, space, tone } from '@/constants/theme';
import { formatTime } from '@/lib/format';
import { buildStream, activityText, type StreamItem } from './chat-stream';
import { COMPLAINT_STATUS_LABEL, COMPLAINT_STATUS_TONE } from './project-meta';
import { PostThread } from './post-thread';
import { AudienceChip, PhotoGrid, PostCard, type OpenPhotos } from './post-card';
import { PostComposer } from './post-composer';
import { usePostSender, type PendingPost } from './use-post-sender';
import { useChatFeed, useProjectComplaints, type FeedMode } from './use-projects';

type Props = {
  project: ProjectDto;
  userId: string;
  /** Staff-only filter: everything (timeline) or exactly what the customer sees. */
  mode: FeedMode;
  isStaff: boolean;
  active: boolean;
  /** `?post=` deep link: scroll to and highlight this post. */
  targetPostId?: string;
  /** Switches the composer to Final delivery when this changes (Close flow). */
  finalDeliveryRequest: number;
  onOpenPhotos: OpenPhotos;
  onOpenDocs: (fileId?: string) => void;
};

function PendingBubble({ item, onRetry, onDiscard }: { item: PendingPost; onRetry: () => void; onDiscard: () => void }) {
  const photoCount = item.body.images?.length ?? 0;
  return (
    <View style={{ alignItems: 'flex-end', gap: space[1], marginBottom: space[3] }}>
      <View style={[styles.pending, { opacity: item.status === 'sending' ? 0.7 : 1 }]}>
        <AudienceChip v={item.body.visibility ?? 'TEAM'} />
        {photoCount > 0 ? (
          <Text variant="caption" muted>
            {photoCount} photo{photoCount > 1 ? 's' : ''}
          </Text>
        ) : null}
        {item.body.text ? <Text>{item.body.text}</Text> : null}
      </View>
      {item.status === 'sending' ? (
        <Text variant="caption" muted>
          Sending...
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <Text variant="caption" color={colors.destructive}>
            Not sent
          </Text>
          <Text variant="caption" color={colors.primary} onPress={onRetry}>
            Retry
          </Text>
          <Text variant="caption" muted onPress={onDiscard}>
            Discard
          </Text>
        </View>
      )}
    </View>
  );
}

function ComplaintCard({ complaint, onPress }: { complaint: ComplaintDto; onPress: () => void }) {
  const thumb = complaint.images[0];
  return (
    <PressableScale onPress={onPress} accessibilityLabel="Open complaint">
      <Card style={{ gap: space[2], borderColor: tone.danger.fg }}>
        <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center', flexWrap: 'wrap' }}>
          <Text variant="caption" color={tone.danger.fg}>
            COMPLAINT
          </Text>
          <Badge label={COMPLAINT_STATUS_LABEL[complaint.status]} t={COMPLAINT_STATUS_TONE[complaint.status]} />
          {complaint.reopenCount > 0 ? <Badge label={`Reopened x${complaint.reopenCount}`} t="warning" /> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Text numberOfLines={2} style={{ flex: 1 }}>
            {complaint.description}
          </Text>
          {thumb ? <Image source={{ uri: thumb.thumbUrl }} style={styles.thumb} contentFit="cover" /> : null}
        </View>
        <Text variant="caption" muted>
          {complaint.assignedTo ? `Assigned to ${complaint.assignedTo.name} · ` : 'Not assigned · '}
          {formatTime(complaint.createdAt)}
        </Text>
      </Card>
    </PressableScale>
  );
}

export function ChatSegment({
  project,
  userId,
  mode,
  isStaff,
  active,
  targetPostId,
  finalDeliveryRequest,
  onOpenPhotos,
  onOpenDocs,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const feed = useChatFeed(project.id, mode, active);
  const complaintsQ = useProjectComplaints(project.id, active);
  const sender = usePostSender(project.id);
  const listRef = useRef<FlatList<StreamItem>>(null);
  const closed = project.stage === 'CLOSED';

  const stream = useMemo(
    () => buildStream(feed.items, complaintsQ.data ?? [], !!feed.hasNextPage),
    [feed.items, complaintsQ.data, feed.hasNextPage],
  );

  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const flash = useCallback((key: string) => {
    setHighlightKey(key);
    setTimeout(() => setHighlightKey((cur) => (cur === key ? null : cur)), 2500);
  }, []);

  // `?post=<id>`: scroll to the post, loading older pages until it is found.
  const handledTarget = useRef<string | null>(null);
  useEffect(() => {
    if (!targetPostId || handledTarget.current === targetPostId || feed.isPending) return;
    const idx = stream.findIndex((s) => s.key === `p:${targetPostId}`);
    if (idx >= 0) {
      handledTarget.current = targetPostId;
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5, animated: true });
        flash(`p:${targetPostId}`);
      }, 150);
    } else if (feed.hasNextPage && !feed.isFetchingNextPage) {
      feed.fetchNextPage();
    } else if (!feed.hasNextPage) {
      handledTarget.current = targetPostId; // not in this feed (deleted or hidden): give up quietly
    }
  }, [targetPostId, stream, feed, flash]);

  // "New messages" pill when new items arrive while scrolled up.
  const offsetY = useRef(0);
  const [newBelow, setNewBelow] = useState(false);
  const headKey = useRef<string | null>(null);
  useEffect(() => {
    const head = stream.find((s) => s.type !== 'day');
    const prev = headKey.current;
    headKey.current = head?.key ?? null;
    if (!head || !prev || prev === head.key) return;
    const mine = head.type === 'post' && head.post.author.id === userId;
    if (offsetY.current > 300 && !mine) setNewBelow(true);
    else if (mine) listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [stream, userId]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetY.current = e.nativeEvent.contentOffset.y;
    if (offsetY.current < 120) setNewBelow(false);
  };

  const [threadPostId, setThreadPostId] = useState<string | null>(null);
  const threadPost = useMemo(() => {
    for (const s of stream) if (s.type === 'post' && s.post.id === threadPostId) return s.post;
    return null;
  }, [stream, threadPostId]);

  const openComplaint = useCallback(
    (id: string) => router.push({ pathname: '/complaints/[id]', params: { id } }),
    [router],
  );
  const jumpToCard = useCallback(
    (complaint: ComplaintDto) => {
      const idx = stream.findIndex((s) => s.key === `c:${complaint.id}`);
      if (idx < 0) return openComplaint(complaint.id);
      listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5, animated: true });
      flash(`c:${complaint.id}`);
    },
    [stream, openComplaint, flash],
  );

  const renderItem = ({ item }: { item: StreamItem }) => {
    switch (item.type) {
      case 'day':
        return (
          <View style={styles.day}>
            <Text variant="caption" muted>
              {item.label}
            </Text>
          </View>
        );
      case 'post':
        return (
          <View style={styles.item}>
            <PostCard
              post={item.post}
              projectId={project.id}
              mine={item.post.author.id === userId}
              highlighted={highlightKey === item.key}
              closed={closed}
              onOpenPhotos={onOpenPhotos}
              onReply={() => setThreadPostId(item.post.id)}
            />
          </View>
        );
      case 'activity': {
        const todoId = typeof item.activity.data['todoId'] === 'string' ? (item.activity.data['todoId'] as string) : null;
        const fileId = typeof item.activity.data['fileId'] === 'string' ? (item.activity.data['fileId'] as string) : null;
        const isFile = item.activity.type.startsWith('FILE');
        return (
          <PressableScale
            disabled={!todoId && !isFile}
            onPress={() => (todoId ? router.push({ pathname: '/todos/[id]', params: { id: todoId } }) : onOpenDocs(fileId ?? undefined))}
            style={styles.activity}
          >
            <Text variant="caption" muted style={{ textAlign: 'center' }}>
              {activityText(item.activity)}
            </Text>
          </PressableScale>
        );
      }
      case 'complaint':
        return (
          <View style={[styles.item, highlightKey === item.key && styles.highlight]}>
            <ComplaintCard complaint={item.complaint} onPress={() => openComplaint(item.complaint.id)} />
          </View>
        );
      case 'update':
        return (
          <PressableScale onPress={() => jumpToCard(item.complaint)} style={styles.activity}>
            <Text variant="caption" muted style={{ textAlign: 'center' }}>
              {item.text}
            </Text>
            {item.photos.length > 0 ? (
              <View style={{ width: 180 }}>
                <PhotoGrid images={item.photos} onOpen={onOpenPhotos} />
              </View>
            ) : null}
          </PressableScale>
        );
    }
  };

  const pendingNodes = sender.pending.map((p) => (
    <PendingBubble key={p.key} item={p} onRetry={() => sender.retry(p)} onDiscard={() => sender.discard(p)} />
  ));

  let empty = null;
  if (feed.isPending) {
    empty = (
      <View style={{ gap: space[3] }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={70} width={i % 2 ? '70%' : '85%'} />
        ))}
      </View>
    );
  } else if (feed.isError) {
    empty = (
      <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[8] }}>
        <Text muted>Couldn&apos;t load the chat.</Text>
        <Button title="Try again" variant="outline" onPress={() => void feed.refetch()} />
      </View>
    );
  } else {
    empty = (
      <View style={{ alignItems: 'center', gap: space[1], paddingVertical: space[8] }}>
        <Text muted>{mode === 'CLIENT' ? 'Nothing shared with the customer yet.' : 'No posts yet'}</Text>
        {mode === 'ALL' && !closed ? <Text variant="caption" muted>Share an update or a photo to get started.</Text> : null}
      </View>
    );
  }

  const showComposer = mode === 'ALL' && isStaff;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      {mode === 'CLIENT' ? (
        <View style={styles.banner}>
          <Feather name="eye" size={14} color={tone.success.fg} />
          <Text variant="caption" color={tone.success.fg}>
            This is what the customer sees.
          </Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          inverted
          data={stream}
          keyExtractor={(s) => s.key}
          renderItem={renderItem}
          onScroll={onScroll}
          scrollEventThrottle={64}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          contentContainerStyle={{ padding: space[4], flexGrow: 1 }}
          ListHeaderComponent={<View>{pendingNodes}</View>}
          ListEmptyComponent={stream.length === 0 ? empty : undefined}
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <View style={styles.older}>
                <ActivityIndicator color={colors.primary} />
                <Text variant="caption" muted>
                  Loading older messages...
                </Text>
              </View>
            ) : !feed.hasNextPage && stream.length > 0 ? (
              <Text variant="caption" muted style={{ textAlign: 'center', padding: space[3] }}>
                Start of the conversation
              </Text>
            ) : undefined
          }
          onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
          onEndReachedThreshold={0.4}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
            setTimeout(
              () => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true }),
              250,
            );
          }}
          refreshControl={
            <RefreshControl refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()} tintColor={colors.primary} />
          }
        />
        {newBelow ? (
          <PressableScale
            onPress={() => {
              listRef.current?.scrollToOffset({ offset: 0, animated: true });
              setNewBelow(false);
            }}
            style={styles.pill}
          >
            <Feather name="arrow-down" size={14} color={colors.primaryForeground} />
            <Text variant="caption" color={colors.primaryForeground}>
              New messages
            </Text>
          </PressableScale>
        ) : null}
      </View>

      {showComposer ? (
        closed ? (
          <View style={[styles.closedBar, { paddingBottom: insets.bottom + space[3] }]}>
            <Text variant="caption" muted style={{ textAlign: 'center' }}>
              This project is closed. It takes no new posts or comments. Reopen it to continue.
            </Text>
          </View>
        ) : (
          <View style={[styles.composer, { paddingBottom: insets.bottom + space[2] }]}>
            <PostComposer
              projectId={project.id}
              kind="post"
              placeholder="Message..."
              allowFinalDelivery
              finalDeliveryRequest={finalDeliveryRequest}
              onSubmit={async (body) => {
                sender.send(body);
              }}
            />
          </View>
        )
      ) : null}

      <PostThread
        projectId={project.id}
        post={threadPost}
        mine={threadPost?.author.id === userId}
        closed={closed}
        onClose={() => setThreadPostId(null)}
        onOpenPhotos={onOpenPhotos}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  item: { marginVertical: space[2] },
  day: { alignItems: 'center', paddingVertical: space[2] },
  activity: { alignItems: 'center', paddingVertical: space[1], paddingHorizontal: space[4], gap: space[1] },
  pending: {
    maxWidth: '88%',
    padding: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius['2xl'],
    backgroundColor: colors.primarySoft,
    gap: space[1],
  },
  highlight: { borderWidth: 2, borderColor: colors.primary, borderRadius: radius.xl },
  thumb: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.muted },
  older: { flexDirection: 'row', gap: space[2], justifyContent: 'center', alignItems: 'center', padding: space[3] },
  banner: {
    flexDirection: 'row',
    gap: space[2],
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[2],
    backgroundColor: tone.success.bg,
  },
  composer: {
    paddingHorizontal: space[3],
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  closedBar: {
    padding: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.muted,
  },
  pill: {
    position: 'absolute',
    bottom: space[3],
    alignSelf: 'center',
    flexDirection: 'row',
    gap: space[1],
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
});
