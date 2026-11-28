import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Fragment, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { MAX_IMAGES_PER_COMMENT, MAX_TODO_IMAGES, type ImageDto } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhotoAttachBar } from '@/components/ui/photo-attach-bar';
import { PhotoGrid } from '@/components/ui/photo-grid';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space, tone } from '@/constants/theme';
import { BottomBar } from '@/features/projects/bottom-bar';
import { dayLabel } from '@/features/projects/chat-stream';
import { CommentCard } from '@/features/projects/comment-card';
import { DetailHeader, headerMutedText } from '@/features/projects/detail-header';
import { MessageBar } from '@/features/projects/message-bar';
import { SheetRow } from '@/features/projects/sheet-row';
import {
  DaySeparator,
  TimelineEntryHeader,
  TimelineEntryRow,
  TimelineEventRow,
} from '@/features/projects/timeline-item';
import { usePhotoAttachments } from '@/features/projects/use-photo-attachments';
import { useProjectDetail } from '@/features/projects/use-projects';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { businessDate, formatDay, formatTime } from '@/lib/format';
import { PendingSyncBadge } from '@/offline';
import {
  useAddTodoComment,
  useDeleteTodoComment,
  useDeleteTodoDetail,
  usePendingTodoDone,
  useTodoComments,
  useTodoDetail,
  useToggleTodo,
  useUpdateTodoDetail,
} from './use-todos';

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A titled line of people in the details card. */
function People({ label, people }: { label: string; people: { id: string; name: string }[] }) {
  return (
    <View style={{ gap: space[2], paddingVertical: space[2] }}>
      <Text variant="caption" color={colors.inkMuted} style={{ fontFamily: font.semibold }}>
        {label}
      </Text>
      {people.length === 0 ? (
        <Text muted>Unassigned</Text>
      ) : (
        people.map((p) => (
          <View key={p.id} style={styles.person}>
            <Avatar name={p.name} size={32} />
            <Text variant="label" color={colors.inkDeep} style={{ flex: 1 }}>
              {p.name}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

export function TodoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const q = useTodoDetail(id);
  const todo = q.data;
  const projectQ = useProjectDetail(todo?.projectId ?? '');
  const comments = useTodoComments(id);
  const toggle = useToggleTodo();
  const addComment = useAddTodoComment(id);
  const delComment = useDeleteTodoComment(id);
  const updateMut = useUpdateTodoDetail(id, todo?.projectId);
  const deleteMut = useDeleteTodoDetail(todo?.projectId);

  const [draft, setDraft] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editAssignees, setEditAssignees] = useState<string[]>([]);
  const [editNotify, setEditNotify] = useState<string[]>([]);
  const [keptImages, setKeptImages] = useState<ImageDto[]>([]);

  const scrollRef = useRef<ScrollViewInstance>(null);

  const commentPhotos = usePhotoAttachments(todo?.projectId ?? '', MAX_IMAGES_PER_COMMENT);
  const editPhotos = usePhotoAttachments(
    todo?.projectId ?? '',
    Math.max(0, MAX_TODO_IMAGES - keptImages.length),
  );

  const pendingDone = usePendingTodoDone(id);
  const isDone = pendingDone ?? !!todo?.completed;
  const members = projectQ.data?.members ?? [];

  const canSendComment =
    !commentPhotos.busy &&
    commentPhotos.uploadsDone &&
    (draft.trim().length > 0 || commentPhotos.images.length > 0);

  const submitComment = () => {
    if (!canSendComment || addComment.isPending) return;
    const trimmed = draft.trim();
    addComment.mutate(
      {
        ...(trimmed ? { text: trimmed } : {}),
        ...(commentPhotos.images.length > 0 ? { images: commentPhotos.images } : {}),
      },
      {
        onSuccess: () => {
          setDraft('');
          commentPhotos.clear();
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
        },
      },
    );
  };

  const openEdit = () => {
    if (!todo) return;
    setEditTitle(todo.title);
    setEditNotes(todo.notes ?? '');
    setEditDue(todo.dueOn ?? '');
    setEditAssignees(todo.assignees.map((a) => a.id));
    setEditNotify(todo.notifyOnDone.map((a) => a.id));
    setKeptImages(todo.images);
    editPhotos.clear();
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!todo) return;
    const title = editTitle.trim();
    if (!title) {
      Alert.alert('Title required', 'Enter a title for this to-do.');
      return;
    }
    const due = editDue.trim();
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
      Alert.alert('Invalid due date', 'Use YYYY-MM-DD (e.g. 2026-12-05).');
      return;
    }
    if (editPhotos.busy || !editPhotos.uploadsDone) {
      Alert.alert('Photos still uploading', 'Wait for uploads to finish before saving.');
      return;
    }
    const images = [
      ...keptImages.map((img) => ({ publicId: img.publicId })),
      ...editPhotos.images,
    ];
    updateMut.mutate(
      {
        title,
        notes: editNotes.trim() || null,
        dueOn: due || null,
        assigneeIds: editAssignees,
        notifyOnDoneIds: editNotify,
        images,
      },
      {
        onSuccess: () => {
          editPhotos.clear();
          setEditOpen(false);
        },
        onError: (err) =>
          Alert.alert('Could not update to-do', err instanceof ApiError ? err.message : 'Try again.'),
      },
    );
  };

  const confirmDelete = () => {
    if (!todo) return;
    Alert.alert('Delete to-do?', `"${todo.title}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteMut.mutate(todo.id, {
            onSuccess: () => (router.canGoBack() ? router.back() : router.replace('/')),
            onError: (err) =>
              Alert.alert('Could not delete to-do', err instanceof ApiError ? err.message : 'Try again.'),
          }),
      },
    ]);
  };

  const toggleId = (arr: string[], uid: string) =>
    arr.includes(uid) ? arr.filter((x) => x !== uid) : [...arr, uid];

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  let body;
  if (q.isPending) {
    body = (
      <View style={{ gap: space[3] }}>
        <Skeleton height={70} width="85%" />
        <Skeleton height={140} />
      </View>
    );
  } else if (q.isError || !todo) {
    const notFound = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    body = (
      <View style={{ gap: space[3], alignItems: 'center', paddingVertical: space[8] }}>
        <Text muted>{notFound ? 'This to-do could not be found.' : 'Could not load this to-do.'}</Text>
        {!notFound ? <Button title="Try again" variant="outline" onPress={() => void q.refetch()} /> : null}
      </View>
    );
  } else {
    const author = todo.createdBy?.name ?? 'Someone';
    const completed = isDone ? todo.completed : null;
    const items = [
      ...(comments.data ?? []).map((c) => ({ key: c.id, at: c.createdAt, comment: c })),
      ...(completed ? [{ key: 'completed', at: completed.at, comment: null }] : []),
    ].sort((a, b) => a.at.localeCompare(b.at));

    body = (
      <>
        <Reveal>
          <View style={styles.details}>
            <People label="ASSIGNED TO" people={todo.assignees} />
            {todo.notifyOnDone.length > 0 ? (
              <People label="NOTIFY WHEN DONE" people={todo.notifyOnDone} />
            ) : null}
          </View>
        </Reveal>

        <SheetRow
          icon="layers"
          label="Open project"
          surface
          showChevron
          onPress={() =>
            router.push({ pathname: '/projects/[id]', params: { id: todo.projectId } } as Href)
          }
        />

        <Reveal index={1}>
          <DaySeparator label={dayLabel(todo.createdAt)} />
          <View style={styles.item}>
            <TimelineEntryRow authorName={author} accentAvatar={todo.createdBy?.id === user?.id}>
              <TimelineEntryHeader text={`${author} added a to-do`} meta={formatTime(todo.createdAt)} />
              <View style={styles.todoCard}>
                <Text variant="caption" color={tone.violet.fg} style={{ fontFamily: font.semibold }}>
                  TO-DO
                </Text>
                <Text variant="section" color={colors.inkDeep}>
                  {todo.title}
                </Text>
                {todo.notes ? <Text color={colors.inkDeep}>{todo.notes}</Text> : null}
                <PhotoGrid images={todo.images} label="To-do photo" />
              </View>
            </TimelineEntryRow>
          </View>

          {items.map((item, i) => {
            const previousAt = items[i - 1]?.at ?? todo.createdAt;
            const newDay = businessDate(previousAt) !== businessDate(item.at);
            const c = item.comment;
            return (
              <Fragment key={item.key}>
                {newDay ? <DaySeparator label={dayLabel(item.at)} /> : null}
                <View style={styles.item}>
                  {c ? (
                    <TimelineEntryRow authorName={c.author.name} accentAvatar={c.author.id === user?.id}>
                      <CommentCard
                        author={c.author.name}
                        at={c.createdAt}
                        text={c.text}
                        {...(c.canDelete ? { onDelete: () => delComment.mutate(c.id) } : {})}
                        deleting={delComment.isPending}
                      >
                        <PhotoGrid images={c.images} label={`Photo from ${c.author.name}`} />
                      </CommentCard>
                    </TimelineEntryRow>
                  ) : (
                    <TimelineEventRow
                      text={`${completed?.by.name ?? 'Someone'} completed this to-do`}
                      at={item.at}
                      highlighted
                      highlightTone="success"
                    />
                  )}
                </View>
              </Fragment>
            );
          })}

          {comments.isPending ? (
            <Skeleton height={70} width="85%" />
          ) : comments.isError ? (
            <Button title="Retry comments" variant="outline" size="sm" onPress={() => void comments.refetch()} />
          ) : (comments.data ?? []).length === 0 ? (
            <Text variant="caption" muted style={{ textAlign: 'center', paddingVertical: space[3] }}>
              No comments yet.
            </Text>
          ) : null}
        </Reveal>
      </>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <Stack.Screen options={{ headerShown: false }} />
      <DetailHeader
        title="To-do"
        onBack={goBack}
        right={
          todo ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <PressableScale
                onPress={openEdit}
                accessibilityRole="button"
                accessibilityLabel="Edit to-do"
                style={styles.headerIconBtn}
              >
                <Feather name="edit-2" size={16} color={colors.primaryForeground} />
              </PressableScale>
              {todo.canDelete ? (
                <PressableScale
                  onPress={confirmDelete}
                  accessibilityRole="button"
                  accessibilityLabel="Delete to-do"
                  style={styles.headerIconBtn}
                >
                  <Feather name="trash-2" size={16} color={colors.primaryForeground} />
                </PressableScale>
              ) : null}
            </View>
          ) : undefined
        }
      >
        {todo ? (
          <>
            {isDone ? (
              <Badge label="Done" t="success" />
            ) : todo.isOverdue ? (
              <Badge label="Overdue" t="danger" />
            ) : (
              <Badge label="Open" t="violet" />
            )}
            {todo.dueOn ? (
              <Text variant="caption" color={headerMutedText}>
                Due {formatDay(todo.dueOn)}
              </Text>
            ) : null}
            {pendingDone !== null ? (
              <PendingSyncBadge filter={(i) => i.entityKey === `todo:${id}`} />
            ) : null}
          </>
        ) : null}
      </DetailHeader>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space[4], paddingBottom: space[6], gap: space[3] }}
        keyboardShouldPersistTaps="handled"
      >
        {body}
      </ScrollView>

      {todo ? (
        <BottomBar>
          <Button
            title={isDone ? 'Reopen to-do' : 'Mark complete'}
            variant={isDone ? 'outline' : 'default'}
            loading={toggle.isPending}
            onPress={() => toggle.mutate({ id: todo.id, done: !isDone })}
            fullWidth
          />
          <PhotoAttachBar
            items={commentPhotos.items}
            problem={commentPhotos.problem}
            onCamera={() => void commentPhotos.takePhoto()}
            onGallery={() => void commentPhotos.pickFromGallery()}
            onRemove={commentPhotos.remove}
            onRetry={commentPhotos.retry}
            hideActions
          />
          <MessageBar
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a comment…"
            onAttach={() => setAttachOpen(true)}
            onSend={submitComment}
            canSend={canSendComment}
            sending={addComment.isPending}
            error={addComment.error?.message ?? null}
          />
        </BottomBar>
      ) : null}

      <BottomSheet visible={attachOpen} onClose={() => setAttachOpen(false)} title="Add photo">
        <View>
          <SheetRow
            icon="camera"
            label="Take photo"
            onPress={() => {
              setAttachOpen(false);
              void commentPhotos.takePhoto();
            }}
          />
          <SheetRow
            icon="image"
            label="Choose from gallery"
            divider
            onPress={() => {
              setAttachOpen(false);
              void commentPhotos.pickFromGallery();
            }}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit to-do"
        footer={
          <Button
            title="Save changes"
            onPress={saveEdit}
            loading={updateMut.isPending}
            disabled={!editTitle.trim() || editPhotos.busy}
            fullWidth
          />
        }
      >
        <View style={{ gap: space[3] }}>
          <Input label="Title" value={editTitle} onChangeText={setEditTitle} placeholder="To-do title" />
          <Input
            label="Notes (optional)"
            value={editNotes}
            onChangeText={setEditNotes}
            placeholder="Extra details"
            multiline
          />
          <View style={{ gap: space[2] }}>
            <Input
              label="Due date (optional)"
              value={editDue}
              onChangeText={setEditDue}
              placeholder="YYYY-MM-DD"
            />
            <View style={styles.chipWrap}>
              <PressableScale onPress={() => setEditDue(addDaysIso(0))} style={styles.chip}>
                <Text variant="caption" color={colors.inkDeep}>
                  Today
                </Text>
              </PressableScale>
              <PressableScale onPress={() => setEditDue(addDaysIso(1))} style={styles.chip}>
                <Text variant="caption" color={colors.inkDeep}>
                  Tomorrow
                </Text>
              </PressableScale>
              {editDue ? (
                <PressableScale onPress={() => setEditDue('')} style={styles.chip}>
                  <Text variant="caption" color={colors.destructive}>
                    Clear
                  </Text>
                </PressableScale>
              ) : null}
            </View>
          </View>

          {members.length > 0 ? (
            <>
              <View style={{ gap: space[2] }}>
                <Text variant="label" color={colors.inkDeep}>
                  Assign to
                </Text>
                <View style={styles.chipWrap}>
                  {members.map((m) => {
                    const active = editAssignees.includes(m.id);
                    return (
                      <PressableScale
                        key={m.id}
                        onPress={() => setEditAssignees((prev) => toggleId(prev, m.id))}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text
                          variant="caption"
                          color={active ? colors.primaryForeground : colors.inkDeep}
                          style={{ fontFamily: active ? font.semibold : font.medium }}
                        >
                          {m.name}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: space[2] }}>
                <Text variant="label" color={colors.inkDeep}>
                  Notify when done
                </Text>
                <View style={styles.chipWrap}>
                  {members.map((m) => {
                    const active = editNotify.includes(m.id);
                    return (
                      <PressableScale
                        key={m.id}
                        onPress={() => setEditNotify((prev) => toggleId(prev, m.id))}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text
                          variant="caption"
                          color={active ? colors.primaryForeground : colors.inkDeep}
                          style={{ fontFamily: active ? font.semibold : font.medium }}
                        >
                          {m.name}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            </>
          ) : null}

          <View style={{ gap: space[2] }}>
            <Text variant="label" color={colors.inkDeep}>
              Photos
            </Text>
            {keptImages.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: space[2] }}>
                  {keptImages.map((img) => (
                    <View key={img.publicId} style={styles.keptThumbWrap}>
                      <Image
                        source={{ uri: img.thumbUrl ?? img.url }}
                        style={styles.keptThumb}
                        contentFit="cover"
                      />
                      <PressableScale
                        onPress={() =>
                          setKeptImages((prev) => prev.filter((x) => x.publicId !== img.publicId))
                        }
                        accessibilityLabel="Remove photo"
                        style={styles.removePhotoBtn}
                      >
                        <Feather name="x" size={12} color={colors.primaryForeground} />
                      </PressableScale>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : null}
            <PhotoAttachBar
              items={editPhotos.items}
              problem={editPhotos.problem}
              onCamera={() => void editPhotos.takePhoto()}
              onGallery={() => void editPhotos.pickFromGallery()}
              onRemove={editPhotos.remove}
              onRetry={editPhotos.retry}
            />
          </View>
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageSoft },
  item: { marginVertical: space[2] },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  todoCard: {
    backgroundColor: tone.violet.bg,
    borderRadius: radius.xl,
    padding: space[3],
    gap: space[2],
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  chip: {
    minHeight: 34,
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.pageSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.tealStrong,
    borderColor: colors.tealStrong,
  },
  keptThumbWrap: { position: 'relative' },
  keptThumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.muted },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.inkDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
