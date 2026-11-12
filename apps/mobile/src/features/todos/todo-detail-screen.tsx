import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { formatDate, timeAgo } from '@/lib/format';
import { PendingSyncBadge } from '@/offline';
import { useAddTodoComment, useTodoComments, usePendingTodoDone, useTodoDetail, useToggleTodo } from './use-todos';

export function TodoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const q = useTodoDetail(id);
  const comments = useTodoComments(id);
  const toggle = useToggleTodo();
  const addComment = useAddTodoComment(id);
  const [draft, setDraft] = useState('');

  const todo = q.data;
  const pendingDone = usePendingTodoDone(id);
  const isDone = pendingDone ?? !!todo?.completed;

  const submitComment = () => {
    const trimmed = draft.trim();
    if (!trimmed || addComment.isPending) return;
    addComment.mutate(trimmed, {
      onSuccess: () => setDraft(''),
    });
  };

  let body;
  if (q.isPending) {
    body = (
      <View style={{ gap: space[3] }}>
        <Skeleton height={28} width="70%" />
        <Skeleton height={120} />
      </View>
    );
  } else if (q.isError || !todo) {
    const notFound = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    body = (
      <View style={{ gap: space[3], alignItems: 'center', paddingVertical: space[8] }}>
        <Text muted>{notFound ? 'This to-do could not be found.' : 'Could not load this to-do.'}</Text>
        {!notFound ? <Button title="Retry" variant="outline" onPress={() => void q.refetch()} /> : null}
      </View>
    );
  } else {
    body = (
      <>
        <Reveal>
          <View style={{ gap: space[2] }}>
            <Text variant="title">{todo.title}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              {isDone ? (
                <Badge label={todo.completed ? `Completed by ${todo.completed.by.name}` : 'Completed'} t="success" />
              ) : todo.isOverdue ? (
                <Badge label="Overdue" t="danger" />
              ) : (
                <Badge label="Open" t="info" />
              )}
              {pendingDone !== null ? <PendingSyncBadge filter={(i) => i.entityKey === `todo:${id}`} /> : null}
              {todo.dueOn ? <Badge label={`Due ${formatDate(todo.dueOn)}`} t="neutral" /> : null}
            </View>
          </View>
        </Reveal>

        <Reveal index={1}>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <View style={{ flex: 1 }}>
              <Button
                title={isDone ? 'Reopen to-do' : 'Mark complete'}
                variant={isDone ? 'outline' : 'default'}
                size="lg"
                loading={toggle.isPending}
                onPress={() => toggle.mutate({ id: todo.id, done: !isDone })}
                fullWidth
              />
            </View>
            <PressableScale
              onPress={() =>
                router.push({ pathname: '/projects/[id]', params: { id: todo.projectId } } as Href)
              }
              style={styles.projectBtn}
              accessibilityLabel="Open project"
            >
              <Feather name="layers" size={18} color={colors.primary} />
              <Text variant="label" color={colors.primary}>
                Project
              </Text>
            </PressableScale>
          </View>
        </Reveal>

        <Reveal index={2}>
          <Card style={{ gap: space[3] }}>
            {todo.notes ? (
              <View style={{ gap: 4 }}>
                <Text variant="caption" muted>
                  Notes
                </Text>
                <Text>{todo.notes}</Text>
              </View>
            ) : null}

            <View style={{ gap: 4 }}>
              <Text variant="caption" muted>
                Assigned to
              </Text>
              <Text>
                {todo.assignees.length > 0 ? todo.assignees.map((a) => a.name).join(', ') : 'Unassigned'}
              </Text>
            </View>

            {todo.notifyOnDone.length > 0 ? (
              <View style={{ gap: 4 }}>
                <Text variant="caption" muted>
                  Notify when done
                </Text>
                <Text>{todo.notifyOnDone.map((p) => p.name).join(', ')}</Text>
              </View>
            ) : null}

            {todo.createdBy ? (
              <View style={{ gap: 4 }}>
                <Text variant="caption" muted>
                  Created
                </Text>
                <Text>
                  {todo.createdBy.name} · {timeAgo(todo.createdAt)}
                </Text>
              </View>
            ) : null}

            {todo.images.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                {todo.images.map((img) => (
                  <Image
                    key={img.publicId}
                    source={{ uri: img.thumbUrl }}
                    style={styles.photo}
                    contentFit="cover"
                  />
                ))}
              </View>
            ) : null}
          </Card>
        </Reveal>

        <View style={{ gap: space[3] }}>
          <Text variant="section">Comments</Text>
          {comments.isPending ? (
            <Skeleton height={80} />
          ) : comments.isError ? (
            <Button title="Retry comments" variant="outline" size="sm" onPress={() => void comments.refetch()} />
          ) : (comments.data ?? []).length === 0 ? (
            <Text muted>No comments yet.</Text>
          ) : (
            (comments.data ?? []).map((c) => (
              <Card key={c.id} style={{ gap: space[1] }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
                  <Text variant="label">{c.author.name}</Text>
                  <Text variant="caption" muted>
                    {timeAgo(c.createdAt)}
                  </Text>
                </View>
                {c.text ? <Text>{c.text}</Text> : null}
              </Card>
            ))
          )}
        </View>
      </>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior="padding"
      keyboardVerticalOffset={88}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'To-do',
          headerShadowVisible: false,
          headerTintColor: colors.primary,
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space[4], paddingTop: space[1], paddingBottom: space[8], gap: space[5] }}
        keyboardShouldPersistTaps="handled"
      >
        {body}
      </ScrollView>

      {todo ? (
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, space[3]) }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a comment..."
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            multiline
          />
          <Button
            title="Send"
            size="sm"
            loading={addComment.isPending}
            disabled={!draft.trim()}
            onPress={submitComment}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  projectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    height: 52,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  photo: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
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
});
