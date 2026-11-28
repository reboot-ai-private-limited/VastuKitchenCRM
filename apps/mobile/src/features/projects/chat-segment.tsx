import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  RefreshControl,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useKeyboardAvoid } from '@/hooks/use-keyboard-avoid';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CommentDto, ComplaintDto, PostDto, ProjectDto } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space, tone } from '@/constants/theme';
import { formatTime } from '@/lib/format';
import { softTick } from '@/lib/haptics';
import { buildStream, activityText, withoutActor, type StreamItem } from './chat-stream';
import { ComplaintCard } from './complaint-card';
import { PostThread } from './post-thread';
import { AudienceChip, PhotoGrid, PostCard, type OpenPhotos } from './post-card';
import { PostComposer, type ReplyTarget } from './post-composer';
import { DaySeparator, TimelineEntryHeader, TimelineEntryRow, TimelineFileRows } from './timeline-item';
import { usePostSender, type PendingPost } from './use-post-sender';
import { useChatFeed, useCreateComment, useProjectComplaints, useSaveToDocs, type FeedMode } from './use-projects';

type Props = {
  project: ProjectDto;
  userId: string;
  /** Staff-only filter: everything (timeline) or exactly what the customer sees. */
  mode: FeedMode;
  onChangeMode?: (next: FeedMode) => void;
  isStaff: boolean;
  /** The customer app: same chat, but the customer can post and always sees the client feed. */
  isCustomer?: boolean;
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

function ReplyBubble({
  comment,
  parent,
  mine,
  userId,
  onJumpToParent,
  onLongPress,
  onOpenPhotos,
}: {
  comment: CommentDto;
  parent: PostDto;
  mine: boolean;
  userId: string;
  onJumpToParent: () => void;
  onLongPress: () => void;
  onOpenPhotos: OpenPhotos;
}) {
  const parentAuthor = parent.author.id === userId ? 'You' : parent.author.name;
  const photoCount = parent.images.length;
  const parentThumb = parent.images[0]?.thumbUrl;
  const quoteAccent = parent.visibility === 'TEAM' ? tone.orange.fg : tone.violet.fg;

  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
      <PressableScale
        onLongPress={() => {
          softTick();
          onLongPress();
        }}
        accessibilityHint="Long press for message options"
        style={[styles.replyBubble, mine ? styles.replyMine : styles.replyTheirs]}
      >
        {!mine ? (
          <Text variant="caption" color={colors.primary} style={{ fontFamily: font.semibold }}>
            {comment.author.name}
            {comment.author.isCustomer ? ' · Customer' : ''}
          </Text>
        ) : null}

        <PressableScale
          onPress={onJumpToParent}
          accessibilityRole="button"
          accessibilityLabel={`Jump to ${parentAuthor}'s message`}
          style={[
            styles.quoteBox,
            {
              borderLeftColor: quoteAccent,
              backgroundColor: mine ? 'rgba(14, 143, 120, 0.12)' : colors.muted,
            },
          ]}
        >
          <View style={{ flex: 1, gap: 2, paddingVertical: 6, paddingLeft: space[2], paddingRight: space[2] }}>
            <Text variant="caption" color={quoteAccent} numberOfLines={1} style={{ fontFamily: font.semibold }}>
              {parentAuthor}
            </Text>
            {parent.text ? (
              <Text variant="caption" muted numberOfLines={2}>
                {parent.text}
              </Text>
            ) : photoCount > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="image" size={12} color={colors.mutedForeground} />
                <Text variant="caption" muted>
                  {photoCount === 1 ? 'Photo' : `${photoCount} photos`}
                </Text>
              </View>
            ) : (
              <Text variant="caption" muted>
                Message
              </Text>
            )}
          </View>
          {parentThumb ? (
            <Image source={{ uri: parentThumb }} style={styles.quoteThumb} contentFit="cover" />
          ) : null}
        </PressableScale>

        {comment.images.length > 0 ? <PhotoGrid images={comment.images} onOpen={onOpenPhotos} /> : null}
        {comment.text ? <Text>{comment.text}</Text> : null}
        <Text variant="caption" muted style={{ alignSelf: 'flex-end', fontSize: 11 }}>
          {formatTime(comment.createdAt)}
        </Text>
      </PressableScale>
    </View>
  );
}

const TODO_ACTION_LABEL: Record<string, string> = {
  TODO_CREATED: 'Added',
  TODO_ASSIGNED: 'Assigned',
  TODO_DUE_CHANGED: 'Due date',
  TODO_COMPLETED: 'Completed',
  TODO_REOPENED: 'Reopened',
};

function TodoEventCard({
  activity,
  mine,
  at,
  onPress,
}: {
  mine: boolean;
  activity: Extract<StreamItem, { type: 'activity' }>['activity'];
  at: string;
  onPress?: () => void;
}) {
  const actor = activity.actor?.name ?? 'Someone';
  const title =
    (typeof activity.data['todoTitle'] === 'string' && activity.data['todoTitle']) ||
    (typeof activity.data['title'] === 'string' && activity.data['title']) ||
    withoutActor(activityText(activity), actor);
  const action = TODO_ACTION_LABEL[activity.type] ?? 'Updated';

  return (
    <PressableScale disabled={!onPress} onPress={onPress} accessibilityLabel="Open to-do">
      <View style={[styles.eventCard, { backgroundColor: tone.violet.bg }]}>
        <View style={styles.eventCardHeader}>
          <Text variant="label" color={colors.inkDeep} numberOfLines={1} style={styles.eventAuthor}>
            {mine ? 'You' : actor}
          </Text>
          <Text variant="caption" color={tone.violet.fg} style={{ fontFamily: font.semibold }}>
            TO-DO · {action.toUpperCase()}
          </Text>
        </View>
        <Text color={colors.inkDeep} numberOfLines={2}>
          {title}
        </Text>
        <Text variant="caption" color={colors.inkMuted}>
          {formatTime(at)}
        </Text>
      </View>
    </PressableScale>
  );
}

const UPDATE_KIND_META: Record<
  'ASSIGNED' | 'RESOLVED' | 'REOPENED' | 'CLOSED' | 'COMMENT',
  { label: string; t: keyof typeof tone }
> = {
  ASSIGNED: { label: 'ASSIGNED', t: 'accent' },
  RESOLVED: { label: 'RESOLVED', t: 'success' },
  REOPENED: { label: 'REOPENED', t: 'warning' },
  CLOSED: { label: 'CLOSED', t: 'neutral' },
  COMMENT: { label: 'COMPLAINT REPLY', t: 'orange' },
};

function ComplaintUpdateCard({
  updateKind,
  text,
  actorName,
  mine,
  at,
  photos,
  complaint,
  onPress,
  onOpenComplaint,
  onOpenPhotos,
}: {
  updateKind: 'ASSIGNED' | 'RESOLVED' | 'REOPENED' | 'CLOSED' | 'COMMENT';
  text: string;
  actorName: string;
  mine: boolean;
  at: string;
  photos: ComplaintDto['resolutionImages'];
  complaint: ComplaintDto;
  onPress: () => void;
  onOpenComplaint: () => void;
  onOpenPhotos: OpenPhotos;
}) {
  const meta = UPDATE_KIND_META[updateKind];
  const palette = tone[meta.t];
  const commentCount = updateKind === 'RESOLVED' ? complaint.comments.length : 0;
  const lastComment = commentCount > 0 ? complaint.comments[commentCount - 1] : null;

  return (
    <View style={[styles.eventCard, { backgroundColor: palette.bg }]}>
      <PressableScale onPress={onPress} accessibilityLabel="Jump to complaint" style={{ gap: space[2] }}>
        <View style={styles.eventCardHeader}>
          <Text variant="label" color={colors.inkDeep} numberOfLines={1} style={styles.eventAuthor}>
            {mine ? 'You' : actorName}
          </Text>
          <Text variant="caption" color={palette.fg} style={{ fontFamily: font.semibold }}>
            {meta.label}
          </Text>
        </View>
        {text ? (
          <Text color={colors.inkDeep} numberOfLines={updateKind === 'COMMENT' ? 4 : 2}>
            {updateKind === 'COMMENT' ? text : withoutActor(text, actorName)}
          </Text>
        ) : null}
      </PressableScale>
      {photos.length > 0 ? (
        <View style={styles.updatePhotoWrap}>
          <PhotoGrid images={photos} onOpen={onOpenPhotos} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
        <Text variant="caption" color={colors.inkMuted}>
          {formatTime(at)}
        </Text>
        {commentCount > 0 ? (
          <PressableScale onPress={onOpenComplaint} hitSlop={8}>
            <Text variant="caption" color={colors.primary} style={{ fontFamily: font.medium }}>
              {commentCount} {commentCount === 1 ? 'reply' : 'replies'}
              {lastComment ? ` · Last by ${lastComment.author.name.split(' ')[0]}` : ''}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

export function ChatSegment({
  project,
  userId,
  mode,
  onChangeMode,
  isStaff,
  isCustomer = false,
  active,
  targetPostId,
  finalDeliveryRequest,
  onOpenPhotos,
  onOpenDocs,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardAvoid();
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
    const mine =
      (head.type === 'post' && head.post.author.id === userId) ||
      (head.type === 'reply' && head.comment.author.id === userId);
    if (offsetY.current > 300 && !mine) setNewBelow(true);
    else if (mine) listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [stream, userId]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetY.current = e.nativeEvent.contentOffset.y;
    if (offsetY.current < 120) setNewBelow(false);
  };

  const [threadPostId, setThreadPostId] = useState<string | null>(null);
  const saveToDocsMut = useSaveToDocs(project.id);
  const savedScrollRef = useRef<{ offset: number; postId: string } | null>(null);
  const openThread = useCallback((postId: string) => {
    savedScrollRef.current = { offset: offsetY.current, postId };
    setThreadPostId(postId);
  }, []);
  const closeThread = useCallback(() => {
    const saved = savedScrollRef.current;
    savedScrollRef.current = null;
    setThreadPostId(null);
    if (!saved) return;
    // Restore the exact scroll position and briefly highlight the post so the admin can carry on smoothly.
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: saved.offset, animated: false });
      flash(`p:${saved.postId}`);
    });
  }, [flash]);
  const [replyTarget, setReplyTarget] = useState<PostDto | null>(null);
  const [pinnedPostId, setPinnedPostId] = useState<string | null>(null);
  const [holdItem, setHoldItem] = useState<
    | { kind: 'post'; post: PostDto }
    | { kind: 'reply'; comment: CommentDto; parent: PostDto }
    | null
  >(null);
  const [toast, setToast] = useState<string | null>(null);
  const replyMut = useCreateComment(project.id, replyTarget?.id ?? '');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 1800);
  }, []);

  const pinStorageKey = `vk:pinned-post:${project.id}`;
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(pinStorageKey)
      .then((val) => {
        if (alive) setPinnedPostId(val || null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pinStorageKey]);

  const togglePin = useCallback(
    (postId: string) => {
      const next = pinnedPostId === postId ? null : postId;
      setPinnedPostId(next);
      if (next) {
        void AsyncStorage.setItem(pinStorageKey, next).catch(() => undefined);
        showToast('Message pinned');
      } else {
        void AsyncStorage.removeItem(pinStorageKey).catch(() => undefined);
        showToast('Message unpinned');
      }
    },
    [pinnedPostId, pinStorageKey, showToast],
  );

  const pinnedPost = useMemo(() => {
    if (!pinnedPostId) return null;
    for (const s of stream) if (s.type === 'post' && s.post.id === pinnedPostId) return s.post;
    return null;
  }, [stream, pinnedPostId]);

  const threadPost = useMemo(() => {
    for (const s of stream) if (s.type === 'post' && s.post.id === threadPostId) return s.post;
    return null;
  }, [stream, threadPostId]);
  const replyTo: ReplyTarget | null = replyTarget
    ? {
        id: replyTarget.id,
        authorName: replyTarget.author.id === userId ? 'You' : replyTarget.author.name,
        text: replyTarget.text,
        thumbUrl: replyTarget.images[0]?.thumbUrl ?? null,
        visibility: replyTarget.visibility,
      }
    : null;

  const openComplaint = useCallback(
    (id: string) => router.push({ pathname: '/complaints/[id]', params: { id } }),
    [router],
  );
  const jumpToPost = useCallback(
    (postId: string) => {
      const idx = stream.findIndex((s) => s.key === `p:${postId}`);
      if (idx < 0) return;
      listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5, animated: true });
      flash(`p:${postId}`);
    },
    [stream, flash],
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

  const isRelatedGroup = (a: StreamItem | undefined, b: StreamItem | undefined): boolean => {
    if (!a || !b || a.type === 'day' || b.type === 'day') return false;
    const complaintIdOf = (x: StreamItem) =>
      x.type === 'complaint' || x.type === 'update' ? x.complaint.id : null;
    const ca = complaintIdOf(a);
    const cb = complaintIdOf(b);
    if (ca && cb && ca === cb) return true;
    if (a.type === 'activity' && b.type === 'activity') return true;
    if ((a.type === 'files' && b.type === 'activity') || (a.type === 'activity' && b.type === 'files')) return true;
    return false;
  };

  const renderItem = ({ item, index }: { item: StreamItem; index: number }) => {
    // Inverted FlatList: index + 1 is visually ABOVE, index - 1 is visually BELOW.
    const above = stream[index + 1];
    const below = stream[index - 1];
    const connectAbove = isRelatedGroup(item, above);
    const connectBelow = isRelatedGroup(item, below);
    switch (item.type) {
      case 'day':
        return <DaySeparator label={item.label} />;
      case 'post':
        return (
          <View style={styles.item}>
            <PostCard
              post={item.post}
              projectId={project.id}
              mine={item.post.author.id === userId}
              highlighted={highlightKey === item.key}
              selected={holdItem?.kind === 'post' && holdItem.post.id === item.post.id}
              pinned={pinnedPostId === item.post.id}
              hideAudience={isCustomer}
              closed={closed}
              onOpenPhotos={onOpenPhotos}
              onReply={() => openThread(item.post.id)}
              onSwipeReply={(p) => setReplyTarget(p)}
              onLongPress={(p) => setHoldItem({ kind: 'post', post: p })}
              onReplyOpen={() =>
                setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0, viewOffset: 16, animated: true }), 120)
              }
            />
          </View>
        );
      case 'reply':
        return (
          <View style={styles.item}>
            <ReplyBubble
              comment={item.comment}
              parent={item.parent}
              mine={item.comment.author.id === userId}
              userId={userId}
              onJumpToParent={() => jumpToPost(item.parent.id)}
              onLongPress={() => setHoldItem({ kind: 'reply', comment: item.comment, parent: item.parent })}
              onOpenPhotos={onOpenPhotos}
            />
          </View>
        );
      case 'activity': {
        const todoId = typeof item.activity.data['todoId'] === 'string' ? (item.activity.data['todoId'] as string) : null;
        const fileId = typeof item.activity.data['fileId'] === 'string' ? (item.activity.data['fileId'] as string) : null;
        const isFile = item.activity.type.startsWith('FILE');
        if (item.activity.type === 'FILE_SHARED') {
          const actorName = item.activity.actor?.name ?? 'Someone';
          const rawName =
            (typeof item.activity.data['fileName'] === 'string' && item.activity.data['fileName']) ||
            (typeof item.activity.data['name'] === 'string' && item.activity.data['name']) ||
            (typeof item.activity.data['title'] === 'string' && item.activity.data['title']) ||
            'Document';
          return (
            <View style={styles.item}>
              <TimelineEntryRow
                authorName={actorName}
                accentAvatar={item.activity.actor?.id === userId}
                connectAbove={connectAbove}
                connectBelow={connectBelow}
              >
                <TimelineEntryHeader text={`${item.activity.actor?.id === userId ? 'You' : actorName} shared a file`} meta={formatTime(item.at)} />
                <TimelineFileRows
                  files={[{ activityId: item.activity.id, fileId, name: rawName }]}
                  onOpenFile={onOpenDocs}
                />
              </TimelineEntryRow>
            </View>
          );
        }
        if (item.activity.type.startsWith('TODO_')) {
          const actorName = item.activity.actor?.name ?? 'Someone';
          return (
            <View style={styles.item}>
              <TimelineEntryRow
                authorName={actorName}
                accentAvatar={item.activity.actor?.id === userId}
                connectAbove={connectAbove}
                connectBelow={connectBelow}
              >
                <TodoEventCard
                  activity={item.activity}
                  mine={item.activity.actor?.id === userId}
                  at={item.at}
                  onPress={
                    todoId
                      ? () => router.push({ pathname: '/todos/[id]', params: { id: todoId } })
                      : undefined
                  }
                />
              </TimelineEntryRow>
            </View>
          );
        }
        const actorName = item.activity.actor?.name ?? 'Someone';
        const isDocs = item.activity.type === 'FILES_SAVED' || isFile;
        const palette = isDocs ? tone.info : tone.neutral;
        const tag = isDocs ? 'DOCS' : 'UPDATE';
        return (
          <View style={styles.item}>
            <TimelineEntryRow
              authorName={actorName}
              accentAvatar={item.activity.actor?.id === userId}
              connectAbove={connectAbove}
              connectBelow={connectBelow}
            >
              <PressableScale
                disabled={!todoId && !isFile}
                onPress={
                  todoId || isFile
                    ? () =>
                        todoId
                          ? router.push({ pathname: '/todos/[id]', params: { id: todoId } })
                          : onOpenDocs(fileId ?? undefined)
                    : undefined
                }
              >
                <View style={[styles.eventCard, { backgroundColor: palette.bg }]}>
                  <View style={styles.eventCardHeader}>
                    <Text variant="label" color={colors.inkDeep} numberOfLines={1} style={styles.eventAuthor}>
                      {item.activity.actor?.id === userId ? 'You' : actorName}
                    </Text>
                    <Text variant="caption" color={palette.fg} style={{ fontFamily: font.semibold }}>
                      {tag}
                    </Text>
                  </View>
                  <Text color={colors.inkDeep} numberOfLines={2}>
                    {withoutActor(activityText(item.activity), actorName)}
                  </Text>
                  <Text variant="caption" color={colors.inkMuted}>
                    {formatTime(item.at)}
                  </Text>
                </View>
              </PressableScale>
            </TimelineEntryRow>
          </View>
        );
      }
      case 'files': {
        const heading =
          item.files.length === 1
            ? `${item.actorName} added a file`
            : `${item.actorName} added ${item.files.length} files`;
        return (
          <View style={styles.item}>
            <TimelineEntryRow
              authorName={item.actorName}
              connectAbove={connectAbove}
              connectBelow={connectBelow}
            >
              <TimelineEntryHeader text={heading} meta={formatTime(item.at)} />
              <TimelineFileRows files={item.files} onOpenFile={onOpenDocs} />
            </TimelineEntryRow>
          </View>
        );
      }
      case 'complaint':
        return (
          <View style={[styles.item, highlightKey === item.key && styles.highlight]}>
            <TimelineEntryRow
              authorName={item.complaint.raisedBy?.name ?? item.complaint.customer.name}
              accentAvatar={item.complaint.raisedBy?.id === userId}
              connectAbove={connectAbove}
              connectBelow={connectBelow}
            >
              <ComplaintCard
                complaint={item.complaint}
                mine={item.complaint.raisedBy?.id === userId}
                onPress={() => openComplaint(item.complaint.id)}
              />
            </TimelineEntryRow>
          </View>
        );
      case 'update': {
        return (
          <View style={styles.item}>
            <TimelineEntryRow
              authorName={item.actorName}
              accentAvatar={item.actorId === userId}
              connectAbove={connectAbove}
              connectBelow={connectBelow}
            >
              <ComplaintUpdateCard
                updateKind={item.updateKind}
                text={item.text}
                actorName={item.actorName}
                mine={item.actorId === userId}
                at={item.at}
                photos={item.photos}
                complaint={item.complaint}
                onPress={() => jumpToCard(item.complaint)}
                onOpenComplaint={() => openComplaint(item.complaint.id)}
                onOpenPhotos={onOpenPhotos}
              />
            </TimelineEntryRow>
          </View>
        );
      }
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

  const showComposer = isCustomer || isStaff;


  return (
    <View ref={kb.ref} collapsable={false} style={{ flex: 1, paddingBottom: kb.pad }}>
      {pinnedPost ? (
        <View style={styles.pinnedBar}>
          <PressableScale
            onPress={() => jumpToPost(pinnedPost.id)}
            style={styles.pinnedMain}
            accessibilityRole="button"
            accessibilityLabel="Jump to pinned message"
          >
            <Feather name="bookmark" size={14} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={colors.primary} numberOfLines={1} style={{ fontFamily: font.semibold }}>
                Pinned · {pinnedPost.author.id === userId ? 'You' : pinnedPost.author.name}
              </Text>
              <Text variant="caption" muted numberOfLines={1}>
                {pinnedPost.text ?? (pinnedPost.images.length > 0 ? 'Photo' : 'Message')}
              </Text>
            </View>
          </PressableScale>
          <PressableScale
            onPress={() => togglePin(pinnedPost.id)}
            accessibilityLabel="Unpin message"
            hitSlop={8}
            style={styles.pinnedClose}
          >
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </PressableScale>
        </View>
      ) : null}
      <View style={{ flex: 1, backgroundColor: colors.pageSoft }}>
        <FlatList
          ref={listRef}
          inverted
          removeClippedSubviews={false}
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
        {toast ? (
          <View pointerEvents="none" style={styles.toastPill}>
            <Text variant="caption" color={colors.primaryForeground}>
              {toast}
            </Text>
          </View>
        ) : null}
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
          <View style={[styles.composer, { paddingBottom: (kb.open ? 0 : insets.bottom) + space[2] }]}>
            <PostComposer
              projectId={project.id}
              kind="post"
              placeholder="Post an update…"
              allowFinalDelivery={!isCustomer}
              fixedClient={isCustomer}
              defaultVisibility={mode === 'CLIENT' ? 'CLIENT' : 'TEAM'}
              onVisibilityChange={(v) => onChangeMode?.(v === 'CLIENT' ? 'CLIENT' : 'ALL')}
              finalDeliveryRequest={finalDeliveryRequest}
              replyTo={replyTo}
              onCancelReply={() => setReplyTarget(null)}
              onSubmit={async (body) => {
                if (replyTarget) {
                  await replyMut.mutateAsync({
                    ...(body.text ? { text: body.text } : {}),
                    ...(body.images?.length ? { images: body.images } : {}),
                  });
                  setReplyTarget(null);
                  return;
                }
                sender.send(body);
              }}
            />
          </View>
        )
      ) : null}

      <BottomSheet
        visible={!!holdItem}
        onClose={() => setHoldItem(null)}
        title="Message"
      >
        {holdItem ? (
          <View style={{ gap: space[1] }}>
            {!closed ? (
              <PressableScale
                onPress={() => {
                  const target = holdItem.kind === 'post' ? holdItem.post : holdItem.parent;
                  setHoldItem(null);
                  setReplyTarget(target);
                }}
                style={styles.holdRow}
              >
                <Feather name="corner-up-left" size={19} color={colors.foreground} />
                <Text variant="label">Reply</Text>
              </PressableScale>
            ) : null}

            {(holdItem.kind === 'post' ? holdItem.post.text : holdItem.comment.text) ? (
              <PressableScale
                onPress={() => {
                  const copyText = holdItem.kind === 'post' ? holdItem.post.text : holdItem.comment.text;
                  setHoldItem(null);
                  if (copyText) {
                    void Clipboard.setStringAsync(copyText).then(() => showToast('Copied'));
                  }
                }}
                style={styles.holdRow}
              >
                <Feather name="copy" size={19} color={colors.foreground} />
                <Text variant="label">Copy</Text>
              </PressableScale>
            ) : null}

            {holdItem.kind === 'post' ? (
              <PressableScale
                onPress={() => {
                  const pid = holdItem.post.id;
                  setHoldItem(null);
                  togglePin(pid);
                }}
                style={styles.holdRow}
              >
                <Feather name="bookmark" size={19} color={colors.primary} />
                <Text variant="label" color={colors.primary}>
                  {pinnedPostId === holdItem.post.id ? 'Unpin' : 'Pin'}
                </Text>
              </PressableScale>
            ) : null}

            {holdItem.kind === 'post' &&
            holdItem.post.images.length > 0 &&
            !isCustomer &&
            !closed ? (
              <PressableScale
                onPress={() => {
                  const post = holdItem.post;
                  setHoldItem(null);
                  saveToDocsMut.mutate(
                    {
                      items: post.images.map((img) => ({ publicId: img.publicId })),
                      visibility: post.visibility,
                    },
                    {
                      onSuccess: (res) => {
                        const created = res.filter((r) => r.created).length;
                        showToast(
                          created > 0
                            ? `Saved ${created} ${created === 1 ? 'photo' : 'photos'} to Docs`
                            : 'Already saved in Docs',
                        );
                      },
                      onError: () =>
                        Alert.alert('Could not save photos', 'Try again in a moment.'),
                    },
                  );
                }}
                style={styles.holdRow}
              >
                <Feather name="folder-plus" size={19} color={colors.foreground} />
                <Text variant="label">Save photos to Docs</Text>
              </PressableScale>
            ) : null}
          </View>
        ) : null}
      </BottomSheet>

      <PostThread
        projectId={project.id}
        post={threadPost}
        mine={threadPost?.author.id === userId}
        hideAudience={isCustomer}
        closed={closed}
        onClose={closeThread}
        onOpenPhotos={onOpenPhotos}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  item: { marginVertical: space[2] },
  eventCard: {
    borderRadius: 14,
    padding: space[3],
    gap: space[2],
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  eventAuthor: {
    flex: 1,
    fontFamily: font.semibold,
  },
  eventWrap: { marginVertical: 4 },
  activity: {
    alignSelf: 'center',
    alignItems: 'center',
    marginVertical: space[1],
    maxWidth: '90%',
    paddingVertical: 4,
    paddingHorizontal: space[3],
  },
  updateCard: {
    alignSelf: 'center',
    width: 224,
    marginVertical: space[2],
    padding: space[2],
    gap: space[2],
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  updateHeader: {
    paddingHorizontal: space[1],
  },
  updatePhotoWrap: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  filesCard: {
    alignSelf: 'center',
    width: '92%',
    marginVertical: space[2],
    padding: space[3],
    gap: space[2],
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filesHeading: {
    paddingHorizontal: space[1],
  },
  filesList: {
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    overflow: 'hidden',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[2],
    paddingVertical: 9,
  },
  fileRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  fileIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfTag: {
    fontSize: 10,
    letterSpacing: 0.4,
  },
  replyBubble: {
    maxWidth: '84%',
    minWidth: 160,
    padding: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius['2xl'],
    gap: 6,
  },
  replyMine: {
    backgroundColor: colors.primarySoft,
    borderBottomRightRadius: radius.sm,
  },
  replyTheirs: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.sm,
  },
  quoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderLeftWidth: 3,
    overflow: 'hidden',
  },
  quoteThumb: {
    width: 48,
    height: 48,
    backgroundColor: colors.border,
  },
  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: space[3],
    paddingVertical: 8,
    gap: space[2],
  },
  pinnedMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  pinnedClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: hit,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
  },
  toastPill: {
    position: 'absolute',
    top: space[3],
    alignSelf: 'center',
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.foreground,
  },
  pending: {
    maxWidth: '88%',
    padding: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius['2xl'],
    backgroundColor: colors.primarySoft,
    gap: space[1],
  },
  highlight: { borderWidth: 2, borderColor: colors.primary, borderRadius: radius.xl },
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
