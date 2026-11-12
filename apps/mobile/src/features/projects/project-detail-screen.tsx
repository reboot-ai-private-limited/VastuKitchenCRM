import { useEffect, useState } from 'react';
import { Keyboard, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CreatePostBodyDto, PostDto, PostVisibility } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, radius, space, tone } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { formatINR, timeAgo } from '@/lib/format';
import { AUDIENCE_LABEL, AUDIENCE_TONE, DESIGN_LABEL, DESIGN_TONE, STAGE_LABEL, STAGE_TONE } from './project-meta';
import { PostComposer } from './post-composer';
import { useCreateComment, useCreatePost, useProjectDetail, useProjectPosts } from './use-projects';

type PendingPost = { key: string; body: CreatePostBodyDto; status: 'sending' | 'failed' };

function PhotoGrid({ images }: { images: PostDto['images'] }) {
  const shown = images.slice(0, 4);
  const single = shown.length === 1;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {shown.map((img, i) => (
        <View key={img.publicId} style={{ width: single ? '100%' : '49.5%', aspectRatio: single ? 4 / 3 : 1 }}>
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
        </View>
      ))}
    </View>
  );
}

function AudienceChip({ v }: { v: PostVisibility }) {
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

function PostCard({ post, projectId, mine }: { post: PostDto; projectId: string; mine: boolean }) {
  const [replying, setReplying] = useState(false);
  const reply = useCreateComment(projectId, post.id);
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: space[1] }}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {!mine ? (
          <Text variant="label" color={colors.primary} numberOfLines={1}>
            {post.author.name}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space[1], flexWrap: 'wrap' }}>
          <AudienceChip v={post.visibility} />
          {post.kind === 'FINAL_DELIVERY' ? <Badge label="Final delivery" t="success" /> : null}
          {post.approval ? <Badge label="Approved" t="success" /> : null}
        </View>
        {post.images.length > 0 ? <PhotoGrid images={post.images} /> : null}
        {post.text ? <Text>{post.text}</Text> : null}
        <Text variant="caption" muted style={{ alignSelf: 'flex-end' }}>
          {timeAgo(post.createdAt)}
        </Text>
      </View>

      {post.commentCount > post.recentComments.length ? (
        <Text variant="caption" muted style={styles.indent}>
          Showing the latest {post.recentComments.length} of {post.commentCount} replies
        </Text>
      ) : null}
      {post.recentComments.map((c) => (
        <View key={c.id} style={[styles.bubble, styles.replyBubble, styles.indent]}>
          <Text variant="caption" color={colors.primary}>
            {c.author.name}
          </Text>
          {c.images.length > 0 ? <PhotoGrid images={c.images} /> : null}
          {c.text ? <Text>{c.text}</Text> : null}
          <Text variant="caption" muted style={{ alignSelf: 'flex-end' }}>
            {timeAgo(c.createdAt)}
          </Text>
        </View>
      ))}
      {replying ? (
        <View style={[styles.indent, { alignSelf: 'stretch' }]}>
          <PostComposer
            projectId={projectId}
            kind="reply"
            placeholder="Write a reply"
            onCancel={() => setReplying(false)}
            onSubmit={async (body) => {
              // TODO(outbox): enqueue the reply instead of sending directly.
              await reply.mutateAsync({
                ...(body.text ? { text: body.text } : {}),
                ...(body.images?.length ? { images: body.images } : {}),
              });
              setReplying(false);
            }}
          />
        </View>
      ) : (
        <PressableScale onPress={() => setReplying(true)} accessibilityLabel="Reply" style={styles.indent} hitSlop={8}>
          <Text variant="caption" color={colors.primary}>
            Reply
          </Text>
        </PressableScale>
      )}
    </View>
  );
}

function PendingBubble({
  item,
  onRetry,
  onDiscard,
}: {
  item: PendingPost;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const photoCount = item.body.images?.length ?? 0;
  return (
    <View style={{ alignItems: 'flex-end', gap: space[1] }}>
      <View style={[styles.bubble, styles.mine, { opacity: item.status === 'sending' ? 0.7 : 1 }]}>
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

export function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const q = useProjectDetail(id);
  const posts = useProjectPosts(id);
  const createPost = useCreatePost(id);
  const { user } = useSession();
  const [pending, setPending] = useState<PendingPost[]>([]);
  // TODO(outbox): enqueue the post (with its uploaded images) instead of sending directly.
  const sendPending = (item: PendingPost) => {
    setPending((cur) => cur.map((x) => (x.key === item.key ? { ...x, status: 'sending' } : x)));
    createPost
      .mutateAsync(item.body)
      .then(() => setPending((cur) => cur.filter((x) => x.key !== item.key)))
      .catch(() => setPending((cur) => cur.map((x) => (x.key === item.key ? { ...x, status: 'failed' } : x))));
  };
  const p = q.data;
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKbOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  let content;
  if (q.isPending) {
    content = (
      <View style={{ gap: space[3] }}>
        <Skeleton height={28} width="65%" />
        <Skeleton height={140} />
      </View>
    );
  } else if (q.isError || !p) {
    const notFound = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    content = (
      <View style={{ gap: space[3], alignItems: 'center', paddingVertical: space[8] }}>
        <Text muted>{notFound ? 'This project could not be found.' : 'Could not load this project.'}</Text>
        {!notFound ? <Button title="Retry" variant="outline" onPress={() => void q.refetch()} /> : null}
      </View>
    );
  } else {
    const rows: [string, string | null | undefined][] = [
      ['Customer', p.customer.name],
      ['Site address', p.siteAddress],
      ['Value', p.value != null ? formatINR(p.value) : null],
      ['Designer', p.designer?.name],
      ['Team', p.members.map((m) => m.name).join(', ') || null],
    ];
    content = (
      <>
        <Reveal>
          <Text variant="title">{p.name}</Text>
          <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[2], flexWrap: 'wrap' }}>
            <Badge label={STAGE_LABEL[p.stage]} t={STAGE_TONE[p.stage]} />
            {p.stage === 'DESIGN' ? (
              <Badge label={DESIGN_LABEL[p.designStage]} t={DESIGN_TONE[p.designStage]} />
            ) : null}
          </View>
        </Reveal>

        <Reveal>
          <Button
            title={`Call ${p.customer.name}`}
            size="lg"
            onPress={() => void Linking.openURL(`tel:${p.customer.phone}`)}
            fullWidth
          />
        </Reveal>

        <Reveal>
          <Card style={{ gap: space[3] }}>
            {rows
              .filter(([, v]) => !!v)
              .map(([k, v]) => (
                <View key={k}>
                  <Text variant="caption" muted>
                    {k}
                  </Text>
                  <Text>{v}</Text>
                </View>
              ))}
          </Card>
        </Reveal>

        <View style={{ gap: space[3] }}>
          <Text variant="section">Updates</Text>
          {posts.isPending ? (
            <Skeleton height={100} />
          ) : posts.isError ? (
            <View style={{ gap: space[2], alignItems: 'flex-start' }}>
              <Text muted>Could not load updates.</Text>
              <Button title="Retry" variant="outline" size="sm" onPress={() => void posts.refetch()} />
            </View>
          ) : posts.data.length === 0 ? (
            <Text muted>No updates yet.</Text>
          ) : (
            posts.data.map((post) => (
              <Reveal key={post.id}>
                <PostCard post={post} projectId={p.id} mine={post.author.id === user?.id} />
              </Reveal>
            ))
          )}
          {pending.map((item) => (
            <PendingBubble
              key={item.key}
              item={item}
              onRetry={() => sendPending(item)}
              onDiscard={() => setPending((cur) => cur.filter((x) => x.key !== item.key))}
            />
          ))}
          {posts.hasNextPage ? (
            <Button
              title="Load older updates"
              variant="outline"
              loading={posts.isFetchingNextPage}
              onPress={() => void posts.fetchNextPage()}
              fullWidth
            />
          ) : null}
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: '', headerShadowVisible: false, headerTintColor: colors.primary }}
      />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space[4], paddingTop: space[1], paddingBottom: space[6], gap: space[5] }}
        >
          {content}
        </ScrollView>
        {p && p.stage !== 'CLOSED' ? (
          <View
            style={{
              padding: space[3],
              paddingBottom: (kbOpen ? 0 : insets.bottom) + space[3],
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            }}
          >
            <PostComposer
              projectId={p.id}
              kind="post"
              placeholder="Post an update"
              onSubmit={async (body) => {
                const item: PendingPost = { key: String(Date.now()), body, status: 'sending' };
                setPending((cur) => [...cur, item]);
                sendPending(item);
              }}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </>
  );
}
