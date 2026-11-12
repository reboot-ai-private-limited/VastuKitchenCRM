import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { type ComponentRef, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PostDto, ProjectDto } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space, tone } from '@/constants/theme';
import { NetworkError } from '@/lib/api/client';
import { approvePost, createPost, listPosts } from '@/lib/api/endpoints/projects';
import { formatDate, timeAgo } from '@/lib/format';
import { CustomerHeader, useActiveCustomerProject } from './customer-shell-shared';

function stageGuidance(project: ProjectDto): { title: string; detail: string; icon: keyof typeof Feather.glyphMap } {
  if (project.stage === 'CLOSED') {
    return {
      title: 'Project completed',
      detail: 'Your kitchen handover is complete. Shared drawings and warranties stay available in Docs.',
      icon: 'check-circle',
    };
  }
  if (project.stage === 'SITE') {
    return {
      title: 'Site installation underway',
      detail: 'Our site team is working on your kitchen. Progress photos and updates appear below.',
      icon: 'tool',
    };
  }
  switch (project.designStage) {
    case 'APPROVED':
      return {
        title: 'Design approved',
        detail: 'Thank you for approving the design. Production and site preparation are getting started.',
        icon: 'check-circle',
      };
    case 'SHARED':
      return {
        title: 'Design shared for review',
        detail: 'Check the latest renders below and message your designer if you would like any tweaks.',
        icon: 'eye',
      };
    default:
      return {
        title: 'Design in progress',
        detail: project.designer
          ? `${project.designer.name} is preparing your layout and 3D views.`
          : 'Our design team is preparing your kitchen layout and 3D views.',
        icon: 'compass',
      };
  }
}

function ClientPostCard({
  post,
  highlighted,
  onApprovePress,
}: {
  post: PostDto;
  highlighted: boolean;
  onApprovePress: (post: PostDto) => void;
}) {
  return (
    <Card
      style={[
        { gap: space[3] },
        highlighted && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
      ]}
    >
      <View style={styles.postHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" numberOfLines={1}>
            {post.author.name}
          </Text>
          <Text variant="caption" muted>
            {post.author.isCustomer ? 'You' : (post.author.designation ?? 'Vastu Kitchen')} ·{' '}
            {timeAgo(post.createdAt)}
          </Text>
        </View>
        {post.kind === 'FINAL_DELIVERY' ? <Badge label="Final delivery" t="success" /> : null}
        {post.approval ? <Badge label="Approved ✓" t="success" /> : null}
      </View>

      {post.text ? <Text>{post.text}</Text> : null}

      {post.images.length > 0 ? (
        <View style={styles.photoGrid}>
          {post.images.map((img) => (
            <PressableScale
              key={img.publicId}
              onPress={() => void Linking.openURL(img.url)}
              style={styles.photoCell}
            >
              <Image source={{ uri: img.thumbUrl }} style={styles.photo} contentFit="cover" />
            </PressableScale>
          ))}
        </View>
      ) : null}

      {post.approval ? (
        <Text variant="caption" color={tone.accent.fg}>
          Approved by {post.approval.by.name} on {formatDate(post.approval.at)}
        </Text>
      ) : null}

      {post.canApprove ? (
        <Button
          title="Approve this design"
          size="md"
          onPress={() => onApprovePress(post)}
          fullWidth
        />
      ) : null}

      {post.recentComments.length > 0 ? (
        <View style={styles.commentsBox}>
          {post.recentComments.map((c) => (
            <View key={c.id} style={{ gap: 2 }}>
              <Text variant="caption">
                <Text variant="caption" color={colors.foreground} style={{ fontFamily: font.semibold }}>
                  {c.author.name}:{' '}
                </Text>
                {c.text ?? '(photo)'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function CustomerProjectScreen() {
  const params = useLocalSearchParams<{ projectId?: string; post?: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const {
    projects,
    project,
    setProjectId,
    isPending: projectsPending,
    isError: projectsError,
    error: projectsErrObj,
    refetch: refetchProjects,
  } = useActiveCustomerProject(params.projectId);

  const [message, setMessage] = useState('');
  const [confirmPost, setConfirmPost] = useState<PostDto | null>(null);

  const postsQ = useInfiniteQuery({
    queryKey: ['customer', 'posts', project?.id],
    queryFn: ({ pageParam, signal }) => listPosts(project!.id, pageParam, signal, 'CLIENT', 20),
    enabled: !!project?.id,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: (d) => {
      const seen = new Set<string>();
      return d.pages.flatMap((p) => p.items).filter((p) => !seen.has(p.id) && seen.add(p.id));
    },
  });

  const sendPost = useMutation({
    mutationFn: (text: string) =>
      createPost(project!.id, {
        text,
        visibility: 'CLIENT',
        kind: 'UPDATE',
        images: [],
      }),
    onSuccess: () => {
      setMessage('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void qc.invalidateQueries({ queryKey: ['customer', 'posts', project?.id] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (postId: string) => approvePost(project!.id, postId),
    onSuccess: () => {
      setConfirmPost(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void qc.invalidateQueries({ queryKey: ['customer', 'posts', project?.id] });
      void qc.invalidateQueries({ queryKey: ['customer', 'projects'] });
    },
  });

  const posts = postsQ.data ?? [];
  const approvablePost = posts.find((p) => p.canApprove) ?? null;

  const focusAskChange = () => {
    if (!message.trim()) {
      setMessage('Could we adjust ');
    }
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || !project || sendPost.isPending) return;
    sendPost.mutate(trimmed);
  };

  const refreshing = postsQ.isRefetching;
  const onRefresh = () => {
    void refetchProjects();
    if (project) void postsQ.refetch();
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + space[4],
          paddingHorizontal: space[4],
          paddingBottom: space[8],
          gap: space[5],
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <CustomerHeader
          project={project}
          projects={projects}
          onSelectProject={setProjectId}
        />

        {projectsPending ? (
          <View style={{ gap: space[3] }}>
            <Skeleton height={130} />
            <Skeleton height={180} />
          </View>
        ) : projectsError ? (
          <Card style={{ alignItems: 'center', gap: space[3], paddingVertical: space[6] }}>
            <Text muted style={{ textAlign: 'center' }}>
              {projectsErrObj instanceof NetworkError
                ? 'Connection lost. Check your internet and try again.'
                : projectsErrObj?.message ?? 'Could not load your project.'}
            </Text>
            <Button title="Retry" variant="outline" onPress={() => void refetchProjects()} />
          </Card>
        ) : !project ? (
          <EmptyState
            icon="home"
            message="Your kitchen workspace is being set up. You will see updates here as soon as your project starts."
          />
        ) : (
          <>
            {/* WHAT'S NEXT CARD (01-personas-and-navigation.md §2.7) */}
            <Reveal>
              <View style={{ gap: space[2] }}>
                <Text variant="caption" muted style={styles.eyebrow}>
                  WHAT&apos;S NEXT
                </Text>
                {approvablePost ? (
                  <Card style={styles.actionNextCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
                        <Feather name="check-circle" size={20} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="section">Approve the design</Text>
                        <Text variant="caption" muted>
                          Shared by {approvablePost.author.name} · {timeAgo(approvablePost.createdAt)}
                        </Text>
                      </View>
                    </View>
                    {approvablePost.text ? (
                      <Text numberOfLines={2} muted>
                        {approvablePost.text}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: space[3] }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          title="Approve"
                          size="md"
                          onPress={() => setConfirmPost(approvablePost)}
                          fullWidth
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          title="Ask a change"
                          variant="outline"
                          size="md"
                          onPress={focusAskChange}
                          fullWidth
                        />
                      </View>
                    </View>
                  </Card>
                ) : (
                  (() => {
                    const g = stageGuidance(project);
                    return (
                      <Card style={styles.guidanceCard}>
                        <View style={[styles.iconWrap, { backgroundColor: tone.accent.bg }]}>
                          <Feather name={g.icon} size={20} color={tone.accent.fg} />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text variant="section">{g.title}</Text>
                          <Text variant="caption" muted>
                            {g.detail}
                          </Text>
                        </View>
                      </Card>
                    );
                  })()
                )}
              </View>
            </Reveal>

            {/* UPDATES FEED */}
            <View style={{ gap: space[3] }}>
              <Text variant="caption" muted style={styles.eyebrow}>
                UPDATES & MESSAGES
              </Text>
              {postsQ.isPending ? (
                <Skeleton height={160} />
              ) : postsQ.isError ? (
                <Card style={{ gap: space[2], alignItems: 'flex-start' }}>
                  <Text muted>Could not load updates.</Text>
                  <Button title="Retry" variant="outline" size="sm" onPress={() => void postsQ.refetch()} />
                </Card>
              ) : posts.length === 0 ? (
                <Card>
                  <Text muted>
                    No updates shared yet. Feel free to send a message below if you have a question for the team.
                  </Text>
                </Card>
              ) : (
                posts.map((post, idx) => (
                  <Reveal key={post.id} index={idx}>
                    <ClientPostCard
                      post={post}
                      highlighted={params.post === post.id}
                      onApprovePress={(p) => setConfirmPost(p)}
                    />
                  </Reveal>
                ))
              )}

              {postsQ.hasNextPage ? (
                <Button
                  title="Load older updates"
                  variant="outline"
                  loading={postsQ.isFetchingNextPage}
                  onPress={() => void postsQ.fetchNextPage()}
                  fullWidth
                />
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      {/* MESSAGE COMPOSER */}
      {project ? (
        project.stage === 'CLOSED' ? (
          <View style={styles.closedBar}>
            <Feather name="lock" size={14} color={colors.mutedForeground} />
            <Text variant="caption" muted>
              This project is closed. Use Complaints if you need service support.
            </Text>
          </View>
        ) : (
          <View style={styles.composer}>
            <TextInput
              ref={inputRef}
              value={message}
              onChangeText={setMessage}
              placeholder="Message your Vastu Kitchen team..."
              placeholderTextColor={colors.placeholder}
              multiline
              style={styles.composerInput}
            />
            <Button
              title="Send"
              size="sm"
              loading={sendPost.isPending}
              disabled={!message.trim()}
              onPress={handleSend}
            />
          </View>
        )
      ) : null}

      {/* DESIGN APPROVAL CONFIRMATION SHEET */}
      <BottomSheet
        visible={confirmPost !== null}
        onClose={() => setConfirmPost(null)}
        title="Approve this design?"
        subtitle="Approving locks in the shared layout so our team can move forward with production."
        footer={
          <Button
            title="Confirm approval"
            size="lg"
            loading={approveMutation.isPending}
            onPress={() => confirmPost && approveMutation.mutate(confirmPost.id)}
            fullWidth
          />
        }
      >
        <View style={{ gap: space[2] }}>
          <Text muted>
            Your name and approval timestamp will be recorded on this design update. If you still want any changes, close this sheet and tap &ldquo;Ask a change&rdquo;.
          </Text>
          {approveMutation.isError ? (
            <Text variant="caption" color={colors.destructive}>
              {approveMutation.error.message}
            </Text>
          ) : null}
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  eyebrow: { letterSpacing: 0.6 },
  actionNextCard: {
    gap: space[3],
    borderColor: colors.primary,
  },
  guidanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  photoCell: {
    width: '48%',
    aspectRatio: 1.25,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  commentsBox: {
    gap: space[2],
    paddingTop: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 96,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.foreground,
  },
  closedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.muted,
  },
});
