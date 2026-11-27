import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Fragment, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PhotoGrid } from '@/components/ui/photo-grid';
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
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { businessDate, formatDay, formatTime } from '@/lib/format';
import { PendingSyncBadge } from '@/offline';
import { useAddTodoComment, useTodoComments, usePendingTodoDone, useTodoDetail, useToggleTodo } from './use-todos';

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
  const comments = useTodoComments(id);
  const toggle = useToggleTodo();
  const addComment = useAddTodoComment(id);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollViewInstance>(null);

  const todo = q.data;
  const pendingDone = usePendingTodoDone(id);
  const isDone = pendingDone ?? !!todo?.completed;

  const submitComment = () => {
    const trimmed = draft.trim();
    if (!trimmed || addComment.isPending) return;
    addComment.mutate(trimmed, {
      onSuccess: () => {
        setDraft('');
        // The new comment lands at the end of the timeline.
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
      },
    });
  };

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
    // Comments and the completion, oldest first. A tick not yet synced has no time to place it at.
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
          caption="Chat, to-dos, complaints and docs"
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
      <DetailHeader title="To-do" onBack={goBack}>
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
          <MessageBar
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a comment…"
            onSend={submitComment}
            canSend={!!draft.trim()}
            sending={addComment.isPending}
            error={addComment.error?.message ?? null}
          />
        </BottomBar>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageSoft },
  item: { marginVertical: space[2] },
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
});
