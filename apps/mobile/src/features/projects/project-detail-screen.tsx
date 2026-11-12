import { useEffect, useState } from 'react';
import { Keyboard, Linking, ScrollView, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PostDto } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, radius, space } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { formatINR, timeAgo } from '@/lib/format';
import { DESIGN_LABEL, DESIGN_TONE, STAGE_LABEL, STAGE_TONE } from './project-meta';
import { PostComposer } from './post-composer';
import { useCreateComment, useCreatePost, useProjectDetail, useProjectPosts } from './use-projects';

function PostCard({ post, projectId }: { post: PostDto; projectId: string }) {
  const [replying, setReplying] = useState(false);
  const reply = useCreateComment(projectId, post.id);
  return (
    <Card style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
          {post.author.name}
        </Text>
        <Text variant="caption" muted>
          {timeAgo(post.createdAt)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        {post.kind === 'FINAL_DELIVERY' ? <Badge label="Final delivery" t="success" /> : null}
        {post.visibility === 'TEAM' ? <Badge label="Team only" t="neutral" /> : null}
        {post.approval ? <Badge label="Approved" t="success" /> : null}
      </View>
      {post.text ? <Text>{post.text}</Text> : null}
      {post.images.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] }}>
          {post.images.slice(0, 6).map((img) => (
            <Image
              key={img.publicId}
              source={{ uri: img.thumbUrl }}
              style={{ width: '32%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.muted }}
              contentFit="cover"
            />
          ))}
        </View>
      ) : null}
      {post.commentCount > post.recentComments.length ? (
        <Text variant="caption" muted>
          Showing the latest {post.recentComments.length} of {post.commentCount} comments
        </Text>
      ) : null}
      {post.recentComments.map((c) => (
        <View key={c.id} style={{ gap: 2, paddingLeft: space[3], borderLeftWidth: 2, borderLeftColor: colors.border }}>
          <Text variant="caption" muted>
            {c.author.name} · {timeAgo(c.createdAt)}
          </Text>
          {c.text ? <Text>{c.text}</Text> : null}
          {c.images.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] }}>
              {c.images.map((img) => (
                <Image
                  key={img.publicId}
                  source={{ uri: img.thumbUrl }}
                  style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.muted }}
                  contentFit="cover"
                />
              ))}
            </View>
          ) : null}
        </View>
      ))}
      {replying ? (
        <PostComposer
          projectId={projectId}
          kind="reply"
          placeholder="Write a reply"
          onCancel={() => setReplying(false)}
          onSubmit={async (body) => {
            await reply.mutateAsync({
              ...(body.text ? { text: body.text } : {}),
              ...(body.images?.length ? { images: body.images } : {}),
            });
            setReplying(false);
          }}
        />
      ) : (
        <Button title="Reply" variant="ghost" size="sm" onPress={() => setReplying(true)} />
      )}
    </Card>
  );
}

export function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const q = useProjectDetail(id);
  const posts = useProjectPosts(id);
  const createPost = useCreatePost(id);
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
                <PostCard post={post} projectId={p.id} />
              </Reveal>
            ))
          )}
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
              onSubmit={(body) => createPost.mutateAsync(body)}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </>
  );
}
