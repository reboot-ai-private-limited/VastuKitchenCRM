import type React from 'react';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TODO_BUCKETS, type MyTodoDto, type TodoBucket } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, hit, radius, space, type Tone } from '@/constants/theme';
import { NetworkError } from '@/lib/api/client';
import { formatDay } from '@/lib/format';
import { useMyTodos, useToggleTodo } from './use-todos';

const BUCKET_META: Record<TodoBucket, { label: string; tone: Tone }> = {
  OVERDUE: { label: 'Overdue', tone: 'danger' },
  TODAY: { label: 'Due today', tone: 'warning' },
  UPCOMING: { label: 'Upcoming', tone: 'info' },
  NO_DATE: { label: 'No due date', tone: 'neutral' },
};

export function CompactTodoRow({ todo }: { todo: MyTodoDto }) {
  const router = useRouter();
  const toggle = useToggleTodo();
  const isDone = todo.completed !== null;

  let dueBadge: { label: string; tone: Tone } | null = null;
  if (!isDone && todo.dueOn) {
    if (todo.isOverdue || todo.bucket === 'OVERDUE') {
      dueBadge = { label: `Overdue · ${formatDay(todo.dueOn)}`, tone: 'danger' };
    } else if (todo.bucket === 'TODAY') {
      dueBadge = { label: 'Today', tone: 'warning' };
    } else {
      dueBadge = { label: formatDay(todo.dueOn), tone: 'neutral' };
    }
  }

  return (
    <Card style={styles.todoCard}>
      <PressableScale
        onPress={() => toggle.mutate({ id: todo.id, done: !isDone })}
        disabled={toggle.isPending}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isDone }}
        accessibilityLabel={isDone ? `Reopen ${todo.title}` : `Complete ${todo.title}`}
        style={styles.checkHit}
      >
        <View
          style={[
            styles.checkbox,
            isDone && { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
        >
          {isDone ? <Feather name="check" size={14} color={colors.primaryForeground} /> : null}
        </View>
      </PressableScale>

      <PressableScale
        onPress={() => router.push({ pathname: '/todos/[id]', params: { id: todo.id } } as Href)}
        style={styles.todoBody}
      >
        <Text
          variant="label"
          numberOfLines={2}
          color={isDone ? colors.mutedForeground : colors.foreground}
          style={isDone ? { textDecorationLine: 'line-through' } : undefined}
        >
          {todo.title}
        </Text>
        <View style={styles.metaRow}>
          <Text variant="caption" muted numberOfLines={1} style={{ flexShrink: 1 }}>
            {todo.project.name} · {todo.listName}
          </Text>
          {dueBadge ? <Badge label={dueBadge.label} t={dueBadge.tone} /> : null}
          {todo.commentCount > 0 ? (
            <View style={styles.commentCount}>
              <Feather name="message-square" size={12} color={colors.mutedForeground} />
              <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
                {todo.commentCount}
              </Text>
            </View>
          ) : null}
        </View>
      </PressableScale>
    </Card>
  );
}

export function TodosScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'open' | 'done'>('open');
  const q = useMyTodos(filter);

  const grouped = useMemo(() => {
    const items = q.data ?? [];
    if (filter === 'done') return [];
    return TODO_BUCKETS.map((bucket) => ({
      bucket,
      meta: BUCKET_META[bucket],
      items: items.filter((t) => t.bucket === bucket),
    })).filter((g) => g.items.length > 0);
  }, [q.data, filter]);

  let content: React.ReactElement;
  if (q.isPending) {
    content = (
      <View style={{ gap: space[3] }}>
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} style={{ gap: space[2] }}>
            <Skeleton height={18} width="65%" />
            <Skeleton width="45%" />
          </Card>
        ))}
      </View>
    );
  } else if (q.isError) {
    content = (
      <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[8] }}>
        <Text muted style={{ textAlign: 'center' }}>
          {q.error instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : q.error.message}
        </Text>
        <Button title="Retry" variant="outline" onPress={() => void q.refetch()} />
      </View>
    );
  } else if ((q.data ?? []).length === 0) {
    content = (
      <EmptyState
        icon="check-square"
        message={filter === 'open' ? 'No open to-dos assigned to you.' : 'No completed to-dos yet.'}
      />
    );
  } else if (filter === 'done') {
    content = (
      <View style={{ gap: space[3] }}>
        {(q.data ?? []).map((todo, idx) => (
          <Reveal key={todo.id} index={idx}>
            <CompactTodoRow todo={todo} />
          </Reveal>
        ))}
      </View>
    );
  } else {
    content = (
      <View style={{ gap: space[5] }}>
        {grouped.map((group) => (
          <View key={group.bucket} style={{ gap: space[2] }}>
            <View style={styles.sectionHeader}>
              <Text variant="caption" muted style={styles.eyebrow}>
                {group.meta.label.toUpperCase()}
              </Text>
              <Badge label={String(group.items.length)} t={group.meta.tone} />
            </View>
            <View style={{ gap: space[2] }}>
              {group.items.map((todo, idx) => (
                <Reveal key={todo.id} index={idx}>
                  <CompactTodoRow todo={todo} />
                </Reveal>
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + space[4],
        paddingHorizontal: space[4],
        paddingBottom: insets.bottom + space[8],
        gap: space[4],
      }}
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <View style={{ gap: space[3] }}>
        <Text variant="title">To-dos</Text>
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          {(['open', 'done'] as const).map((tab) => {
            const active = filter === tab;
            return (
              <PressableScale
                key={tab}
                onPress={() => setFilter(tab)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text variant="caption" color={active ? colors.primaryForeground : colors.mutedForeground}>
                  {tab === 'open' ? 'Open' : 'Completed'}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  todoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[2],
    paddingLeft: space[1],
    paddingRight: space[3],
    gap: space[1],
  },
  checkHit: {
    width: hit,
    height: hit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.mutedForeground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todoBody: {
    flex: 1,
    paddingVertical: space[1],
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  commentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    letterSpacing: 0.6,
  },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary },
});
