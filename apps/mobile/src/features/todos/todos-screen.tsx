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
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space, tone, type Tone } from '@/constants/theme';
import { SlidingSwitch } from '@/features/projects/sliding-switch';
import { NetworkError } from '@/lib/api/client';
import { formatDay } from '@/lib/format';
import { softTick } from '@/lib/haptics';
import { useMyTodos, usePendingTodoDone, useToggleTodo } from './use-todos';

const BUCKET_META: Record<TodoBucket, { label: string; tone: Tone }> = {
  OVERDUE: { label: 'Overdue', tone: 'danger' },
  TODAY: { label: 'Due today', tone: 'warning' },
  UPCOMING: { label: 'Upcoming', tone: 'info' },
  NO_DATE: { label: 'No due date', tone: 'neutral' },
};

export function CompactTodoRow({
  todo,
  flat = false,
  divider = false,
}: {
  todo: MyTodoDto;
  flat?: boolean;
  divider?: boolean;
}) {
  const router = useRouter();
  const toggle = useToggleTodo();
  const pendingDone = usePendingTodoDone(todo.id);
  const isDone = pendingDone ?? todo.completed !== null;

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

  const inner = (
    <>
      <PressableScale
        onPress={() => {
          softTick();
          toggle.mutate({ id: todo.id, done: !isDone });
        }}
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
          color={isDone ? colors.inkMuted : colors.inkDeep}
          style={[styles.todoTitle, isDone && { textDecorationLine: 'line-through' }]}
        >
          {todo.title}
        </Text>
        <View style={styles.metaRow}>
          <Text variant="caption" color={colors.inkMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
            {todo.project.name} · {todo.listName}
          </Text>
          {dueBadge ? <Badge label={dueBadge.label} t={dueBadge.tone} /> : null}
          {todo.commentCount > 0 ? (
            <View style={styles.commentCount}>
              <Feather name="message-square" size={12} color={colors.inkMuted} />
              <Text variant="caption" color={colors.inkMuted} style={{ fontVariant: ['tabular-nums'] }}>
                {todo.commentCount}
              </Text>
            </View>
          ) : null}
        </View>
      </PressableScale>
    </>
  );

  if (flat) {
    return <View style={[styles.flatRow, divider && styles.rowDivider]}>{inner}</View>;
  }
  return <Card style={styles.todoCard}>{inner}</Card>;
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
      <View>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.skeletonRow, i > 0 && styles.rowDivider]}>
            <Skeleton height={18} width="65%" />
            <Skeleton height={14} width="45%" />
          </View>
        ))}
      </View>
    );
  } else if (q.isError) {
    content = (
      <View style={styles.errorWrap}>
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
      <View>
        {(q.data ?? []).map((todo, idx) => (
          <CompactTodoRow key={todo.id} todo={todo} flat divider={idx > 0} />
        ))}
      </View>
    );
  } else {
    content = (
      <View style={{ gap: space[4] }}>
        {grouped.map((group) => (
          <View key={group.bucket}>
            <View style={styles.sectionHeader}>
              <Text
                variant="label"
                color={group.bucket === 'OVERDUE' ? tone.danger.fg : colors.inkDeep}
                style={styles.sectionTitle}
              >
                {group.meta.label}
              </Text>
              <Text
                variant="caption"
                color={group.bucket === 'OVERDUE' ? tone.danger.fg : colors.inkMuted}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {group.items.length}
              </Text>
            </View>
            {group.items.map((todo, idx) => (
              <CompactTodoRow key={todo.id} todo={todo} flat divider={idx > 0} />
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.stickyHeader, { paddingTop: insets.top + space[4] }]}>
        <Text variant="title" color={colors.inkDeep}>
          To-dos
        </Text>
        <SlidingSwitch
          options={[
            { value: 'open', label: 'Open' },
            { value: 'done', label: 'Completed' },
          ]}
          value={filter}
          onChange={setFilter}
          style={{ maxWidth: 240 }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space[8], flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => void q.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {content}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card },
  stickyHeader: {
    backgroundColor: colors.card,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    gap: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  segmentedBar: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 3,
    gap: 2,
  },
  segment: {
    minHeight: 34,
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontFamily: font.medium },
  segmentTextActive: { fontFamily: font.semibold },
  todoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[2],
    paddingLeft: space[1],
    paddingRight: space[3],
    gap: space[1],
  },
  flatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: space[2],
    paddingLeft: space[2],
    paddingRight: space[4],
    gap: space[1],
    minHeight: hit,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
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
    borderColor: colors.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todoBody: {
    flex: 1,
    paddingVertical: space[1],
    gap: 4,
  },
  todoTitle: {
    fontFamily: font.medium,
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
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[2],
    backgroundColor: colors.pageSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontFamily: font.semibold,
  },
  skeletonRow: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[2],
  },
  errorWrap: {
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[8],
    paddingHorizontal: space[4],
  },
});
