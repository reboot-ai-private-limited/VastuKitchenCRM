import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { DocFileDto, FolderDto, ProjectDto, TodoDto, TodoListDto } from '@vastu/contracts';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space, tone } from '@/constants/theme';
import { usePendingTodoDone, useToggleTodo } from '@/features/todos/use-todos';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { businessDate, formatBytes, formatDate, formatDay } from '@/lib/format';
import { softTick } from '@/lib/haptics';
import { BottomBar } from './bottom-bar';
import { dayLabel } from './chat-stream';
import { ComplaintCard } from './complaint-card';
import { DocUploadBar } from './doc-upload-bar';
import type { ViewerPhoto } from './photo-viewer';
import { SlidingSwitch } from './sliding-switch';
import { DaySeparator, TimelineEntryRow } from './timeline-item';
import {
  useCreateFolder,
  useCreateTodo,
  useCreateTodoList,
  useDeleteFile,
  useDeleteFolder,
  useDeleteTodo,
  useProjectComplaints,
  useProjectFiles,
  useProjectFolders,
  useProjectTodoLists,
  useProjectTodos,
  useUpdateFile,
  useUpdateFolder,
  useUpdateTodo,
  useUpdateTodoList,
} from './use-projects';

const pad = { padding: space[4], flexGrow: 1 } as const;

const fail = (title: string) => (e: unknown) =>
  Alert.alert(title, e instanceof ApiError ? e.message : 'Something went wrong. Try again.');

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[8] }}>
      <Text muted>Could not load this. Check your connection.</Text>
      <Button title="Try again" variant="outline" onPress={onRetry} />
    </View>
  );
}

function Loading() {
  return (
    <View style={{ gap: space[3] }}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={70} width={i % 2 ? '70%' : '85%'} />
      ))}
    </View>
  );
}

/** Takes the bottom bar's place of an action on a closed project, as the chat does. */
function ClosedNotice({ text }: { text: string }) {
  return (
    <Text variant="caption" muted style={{ textAlign: 'center', paddingVertical: space[1] }}>
      {text}
    </Text>
  );
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ── To-dos ─────────────────────────────────────────────────────────────────── */

const TODO_FILTERS = [
  { value: 'open', label: 'Open', icon: 'circle' },
  { value: 'done', label: 'Done', icon: 'check-circle' },
] as const;

type TodoModalState =
  | { kind: 'new-list' }
  | { kind: 'rename-list'; list: TodoListDto }
  | { kind: 'create-todo'; listId: string | null }
  | { kind: 'edit-todo'; todo: TodoDto }
  | { kind: 'todo-actions'; todo: TodoDto }
  | null;

function TodoRow({
  todo,
  closed,
  onOpen,
  onToggle,
  onMenu,
}: {
  todo: TodoDto;
  closed: boolean;
  onOpen: () => void;
  onToggle: (done: boolean) => void;
  onMenu: () => void;
}) {
  const pendingDone = usePendingTodoDone(todo.id);
  const done = pendingDone !== null ? pendingDone : !!todo.completed;
  const meta = [
    todo.assignees.length > 0 ? todo.assignees.map((a) => a.name).join(', ') : 'Unassigned',
    todo.completed
      ? `Done ${formatDate(todo.completed.at)}`
      : todo.dueOn
        ? `Due ${formatDay(todo.dueOn)}`
        : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.todoRow}>
      <PressableScale
        disabled={closed}
        onPress={() => {
          softTick();
          onToggle(!done);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: closed }}
        accessibilityLabel={done ? 'Mark open' : 'Mark done'}
        style={styles.checkHit}
      >
        <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
          {done ? <Feather name="check" size={13} color={colors.primaryForeground} /> : null}
        </View>
      </PressableScale>

      <PressableScale onPress={onOpen} style={styles.todoMain} accessibilityLabel="Open to-do">
        <Text
          color={done ? colors.inkMuted : colors.inkDeep}
          numberOfLines={2}
          style={[styles.todoTitle, done && styles.todoTitleDone]}
        >
          {todo.title}
        </Text>
        <View style={styles.tagRow}>
          {!done && todo.isOverdue ? <Badge label="Overdue" t="danger" /> : null}
          <Text variant="caption" color={colors.inkMuted} numberOfLines={1} style={{ flex: 1 }}>
            {meta}
          </Text>
          {todo.commentCount > 0 ? (
            <View style={styles.comments}>
              <Feather name="message-circle" size={12} color={colors.inkMuted} />
              <Text variant="caption" color={colors.inkMuted}>
                {todo.commentCount}
              </Text>
            </View>
          ) : null}
        </View>
      </PressableScale>

      {!closed ? (
        <PressableScale
          onPress={onMenu}
          accessibilityRole="button"
          accessibilityLabel="To-do actions"
          style={styles.moreBtn}
        >
          <Feather name="more-horizontal" size={18} color={colors.inkMuted} />
        </PressableScale>
      ) : null}
    </View>
  );
}

export function TodosSegment({ project }: { project: ProjectDto }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useSession();
  const closed = project.stage === 'CLOSED';
  const [status, setStatus] = useState<'open' | 'done'>('open');
  const [assignedToMe, setAssignedToMe] = useState(false);

  const listsQ = useProjectTodoLists(project.id);
  const todosQ = useProjectTodos(project.id, status, assignedToMe);
  const toggleMut = useToggleTodo();
  const createListMut = useCreateTodoList(project.id);
  const updateListMut = useUpdateTodoList(project.id);
  const createTodoMut = useCreateTodo(project.id);
  const updateTodoMut = useUpdateTodo(project.id);
  const deleteTodoMut = useDeleteTodo(project.id);

  const [modal, setModal] = useState<TodoModalState>(null);
  const [listName, setListName] = useState('');
  const [todoListId, setTodoListId] = useState<string>('');
  const [todoTitle, setTodoTitle] = useState('');
  const [todoNotes, setTodoNotes] = useState('');
  const [todoDue, setTodoDue] = useState('');
  const [todoAssignees, setTodoAssignees] = useState<string[]>([]);
  const [todoNotify, setTodoNotify] = useState<string[]>([]);

  const lists = useMemo(() => (listsQ.data ?? []).filter((l) => !l.archived), [listsQ.data]);
  const todos = useMemo(() => todosQ.data ?? [], [todosQ.data]);

  const sections = useMemo(() => {
    const byList = new Map<string, TodoDto[]>();
    for (const t of todos) {
      const arr = byList.get(t.listId) ?? [];
      arr.push(t);
      byList.set(t.listId, arr);
    }
    const out: { list: TodoListDto; items: TodoDto[] }[] = lists.map((list) => ({
      list,
      items: byList.get(list.id) ?? [],
    }));
    return out.filter((s) => s.items.length > 0 || (status === 'open' && !assignedToMe));
  }, [lists, todos, status, assignedToMe]);

  const openCreateTodo = (listId?: string) => {
    setTodoListId(listId ?? lists[0]?.id ?? '');
    setTodoTitle('');
    setTodoNotes('');
    setTodoDue('');
    setTodoAssignees([]);
    setTodoNotify([]);
    setModal({ kind: 'create-todo', listId: listId ?? lists[0]?.id ?? null });
  };

  const openEditTodo = (todo: TodoDto) => {
    setTodoListId(todo.listId);
    setTodoTitle(todo.title);
    setTodoNotes(todo.notes ?? '');
    setTodoDue(todo.dueOn ?? '');
    setTodoAssignees(todo.assignees.map((a) => a.id));
    setTodoNotify(todo.notifyOnDone.map((a) => a.id));
    setModal({ kind: 'edit-todo', todo });
  };

  const toggleId = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const handleToggleTodo = (todo: TodoDto, done: boolean) => {
    toggleMut.mutate(
      { id: todo.id, done },
      {
        onSuccess: () => {
          setTimeout(() => {
            void qc.invalidateQueries({ queryKey: ['projects', 'todos', project.id] });
            void qc.invalidateQueries({ queryKey: ['projects', 'todo-lists', project.id] });
          }, 400);
        },
      },
    );
  };

  const submitList = () => {
    const name = listName.trim();
    if (!name) return;
    if (modal?.kind === 'new-list') {
      createListMut.mutate(name, {
        onSuccess: () => setModal(null),
        onError: fail('Could not create list'),
      });
    } else if (modal?.kind === 'rename-list') {
      updateListMut.mutate(
        { id: modal.list.id, name },
        {
          onSuccess: () => setModal(null),
          onError: fail('Could not rename list'),
        },
      );
    }
  };

  const submitTodo = async () => {
    const title = todoTitle.trim();
    if (!title) {
      Alert.alert('Title required', 'Enter a title for this to-do.');
      return;
    }
    const due = todoDue.trim();
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
      Alert.alert('Invalid due date', 'Use YYYY-MM-DD (e.g. 2026-12-05).');
      return;
    }
    if (modal?.kind === 'edit-todo') {
      updateTodoMut.mutate(
        {
          id: modal.todo.id,
          title,
          notes: todoNotes.trim() || null,
          dueOn: due || null,
          assigneeIds: todoAssignees,
          notifyOnDoneIds: todoNotify,
          ...(todoListId && todoListId !== modal.todo.listId ? { listId: todoListId } : {}),
        },
        {
          onSuccess: () => setModal(null),
          onError: fail('Could not update to-do'),
        },
      );
      return;
    }

    let targetListId = todoListId || lists[0]?.id;
    if (!targetListId) {
      try {
        const createdList = await createListMut.mutateAsync('General');
        targetListId = createdList.id;
      } catch (e) {
        fail('Could not create to-do list')(e);
        return;
      }
    }
    createTodoMut.mutate(
      {
        listId: targetListId,
        title,
        ...(todoNotes.trim() ? { notes: todoNotes.trim() } : {}),
        ...(due ? { dueOn: due } : {}),
        images: [],
        assigneeIds: todoAssignees,
        notifyOnDoneIds: todoNotify,
      },
      {
        onSuccess: () => setModal(null),
        onError: fail('Could not create to-do'),
      },
    );
  };

  const confirmDeleteTodo = (todo: TodoDto) => {
    setModal(null);
    Alert.alert('Delete to-do?', `"${todo.title}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteTodoMut.mutate(todo.id, { onError: fail('Could not delete to-do') }),
      },
    ]);
  };

  const isPending = listsQ.isPending || todosQ.isPending;
  const isError = listsQ.isError || todosQ.isError;
  const refetch = () => {
    void listsQ.refetch();
    void todosQ.refetch();
  };

  return (
    <View style={styles.root}>
      <View style={styles.topControls}>
        <View style={styles.controlRow}>
          <PressableScale
            onPress={() => {
              softTick();
              setAssignedToMe((v) => !v);
            }}
            style={[styles.filterPill, assignedToMe && styles.filterPillActive]}
          >
            <Feather
              name="user"
              size={14}
              color={assignedToMe ? colors.primaryForeground : colors.inkDeep}
            />
            <Text
              variant="caption"
              color={assignedToMe ? colors.primaryForeground : colors.inkDeep}
              style={{ fontFamily: assignedToMe ? font.semibold : font.medium }}
            >
              Assigned to me
            </Text>
          </PressableScale>
          <View style={{ flex: 1 }} />
          {!closed ? (
            <View style={styles.actionBtnGroup}>
              <PressableScale
                onPress={() => {
                  setListName('');
                  setModal({ kind: 'new-list' });
                }}
                style={styles.secondaryChipBtn}
              >
                <Feather name="folder-plus" size={14} color={colors.inkDeep} />
                <Text variant="caption" color={colors.inkDeep} style={{ fontFamily: font.semibold }}>
                  List
                </Text>
              </PressableScale>
              <PressableScale onPress={() => openCreateTodo()} style={styles.primaryChipBtn}>
                <Feather name="plus" size={14} color={colors.primaryForeground} />
                <Text
                  variant="caption"
                  color={colors.primaryForeground}
                  style={{ fontFamily: font.semibold }}
                >
                  To-do
                </Text>
              </PressableScale>
            </View>
          ) : null}
        </View>
      </View>

      <FlatList
        data={sections}
        keyExtractor={(s) => s.list.id}
        contentContainerStyle={[pad, { gap: space[3] }]}
        refreshControl={
          <RefreshControl
            refreshing={todosQ.isRefetching || listsQ.isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          isPending ? (
            <Loading />
          ) : isError ? (
            <Failed onRetry={refetch} />
          ) : (
            <EmptyState
              icon="check-square"
              message={
                assignedToMe
                  ? `No ${status} to-dos assigned to you`
                  : status === 'open'
                    ? 'No open to-dos'
                    : 'Nothing done yet'
              }
            />
          )
        }
        renderItem={({ item: section }) => (
          <View style={styles.listCard}>
            <View style={styles.listHeader}>
              <Text variant="label" color={colors.inkDeep} style={{ flex: 1, fontFamily: font.semibold }}>
                {section.list.name}
              </Text>
              <Text variant="caption" color={colors.inkMuted} style={styles.tabular}>
                {section.list.doneCount}/{section.list.openCount + section.list.doneCount}
              </Text>
              {!closed ? (
                <>
                  <PressableScale
                    onPress={() => {
                      setListName(section.list.name);
                      setModal({ kind: 'rename-list', list: section.list });
                    }}
                    accessibilityLabel="Rename list"
                    style={styles.smallIconBtn}
                  >
                    <Feather name="edit-2" size={14} color={colors.inkMuted} />
                  </PressableScale>
                  <PressableScale
                    onPress={() => openCreateTodo(section.list.id)}
                    accessibilityLabel="Add to-do to list"
                    style={styles.smallIconBtn}
                  >
                    <Feather name="plus" size={16} color={colors.tealStrong} />
                  </PressableScale>
                </>
              ) : null}
            </View>
            {section.items.length === 0 ? (
              <Text variant="caption" muted style={{ paddingHorizontal: space[3], paddingBottom: space[3] }}>
                No open to-dos in this list
              </Text>
            ) : (
              section.items.map((todo, idx) => (
                <View key={todo.id} style={idx > 0 ? styles.rowDivider : undefined}>
                  <TodoRow
                    todo={todo}
                    closed={closed}
                    onOpen={() => router.push({ pathname: '/todos/[id]', params: { id: todo.id } })}
                    onToggle={(done) => handleToggleTodo(todo, done)}
                    onMenu={() => setModal({ kind: 'todo-actions', todo })}
                  />
                </View>
              ))
            )}
          </View>
        )}
      />

      <BottomBar>
        <SlidingSwitch options={TODO_FILTERS} value={status} onChange={setStatus} />
      </BottomBar>

      <BottomSheet
        visible={!!modal}
        onClose={() => setModal(null)}
        title={
          modal?.kind === 'new-list'
            ? 'New to-do list'
            : modal?.kind === 'rename-list'
              ? 'Rename list'
              : modal?.kind === 'create-todo'
                ? 'New to-do'
                : modal?.kind === 'edit-todo'
                  ? 'Edit to-do'
                  : modal?.todo.title ?? 'To-do'
        }
        footer={
          modal?.kind === 'new-list' || modal?.kind === 'rename-list' ? (
            <Button
              title={modal.kind === 'new-list' ? 'Create list' : 'Save name'}
              onPress={submitList}
              loading={createListMut.isPending || updateListMut.isPending}
              disabled={!listName.trim()}
              fullWidth
            />
          ) : modal?.kind === 'create-todo' || modal?.kind === 'edit-todo' ? (
            <Button
              title={modal.kind === 'create-todo' ? 'Add to-do' : 'Save changes'}
              onPress={() => void submitTodo()}
              loading={createTodoMut.isPending || updateTodoMut.isPending || createListMut.isPending}
              disabled={!todoTitle.trim()}
              fullWidth
            />
          ) : undefined
        }
      >
        {modal?.kind === 'new-list' || modal?.kind === 'rename-list' ? (
          <Input
            label="List name"
            value={listName}
            onChangeText={setListName}
            placeholder="e.g. Site preparation, Electrical"
            autoFocus
          />
        ) : modal?.kind === 'todo-actions' ? (
          <View style={{ gap: space[1] }}>
            <PressableScale
              onPress={() => openEditTodo(modal.todo)}
              style={styles.sheetActionRow}
            >
              <Feather name="edit-2" size={18} color={colors.inkDeep} />
              <Text variant="label" color={colors.inkDeep}>
                Edit to-do
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => {
                const id = modal.todo.id;
                setModal(null);
                router.push({ pathname: '/todos/[id]', params: { id } });
              }}
              style={styles.sheetActionRow}
            >
              <Feather name="message-circle" size={18} color={colors.inkDeep} />
              <Text variant="label" color={colors.inkDeep}>
                Open details & comments
              </Text>
            </PressableScale>
            {modal.todo.canDelete ? (
              <PressableScale
                onPress={() => confirmDeleteTodo(modal.todo)}
                style={styles.sheetActionRow}
              >
                <Feather name="trash-2" size={18} color={colors.destructive} />
                <Text variant="label" color={colors.destructive}>
                  Delete to-do
                </Text>
              </PressableScale>
            ) : null}
          </View>
        ) : modal?.kind === 'create-todo' || modal?.kind === 'edit-todo' ? (
          <View style={{ gap: space[3] }}>
            {lists.length > 0 ? (
              <View style={{ gap: space[2] }}>
                <Text variant="label" color={colors.inkDeep}>
                  List
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: space[2] }}>
                    {lists.map((l) => {
                      const active = todoListId === l.id;
                      return (
                        <PressableScale
                          key={l.id}
                          onPress={() => setTodoListId(l.id)}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text
                            variant="caption"
                            color={active ? colors.primaryForeground : colors.inkDeep}
                            style={{ fontFamily: active ? font.semibold : font.medium }}
                          >
                            {l.name}
                          </Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            ) : null}

            <Input
              label="Title"
              value={todoTitle}
              onChangeText={setTodoTitle}
              placeholder="What needs to be done?"
            />
            <Input
              label="Notes (optional)"
              value={todoNotes}
              onChangeText={setTodoNotes}
              placeholder="Extra details"
              multiline
            />
            <View style={{ gap: space[2] }}>
              <Input
                label="Due date (optional)"
                value={todoDue}
                onChangeText={setTodoDue}
                placeholder="YYYY-MM-DD"
              />
              <View style={styles.chipWrap}>
                <PressableScale onPress={() => setTodoDue(addDaysIso(0))} style={styles.chip}>
                  <Text variant="caption" color={colors.inkDeep}>
                    Today
                  </Text>
                </PressableScale>
                <PressableScale onPress={() => setTodoDue(addDaysIso(1))} style={styles.chip}>
                  <Text variant="caption" color={colors.inkDeep}>
                    Tomorrow
                  </Text>
                </PressableScale>
                <PressableScale onPress={() => setTodoDue(addDaysIso(7))} style={styles.chip}>
                  <Text variant="caption" color={colors.inkDeep}>
                    In 1 week
                  </Text>
                </PressableScale>
                {todoDue ? (
                  <PressableScale onPress={() => setTodoDue('')} style={styles.chip}>
                    <Text variant="caption" color={colors.destructive}>
                      Clear
                    </Text>
                  </PressableScale>
                ) : null}
              </View>
            </View>

            {project.members.length > 0 ? (
              <>
                <View style={{ gap: space[2] }}>
                  <Text variant="label" color={colors.inkDeep}>
                    Assign to
                  </Text>
                  <View style={styles.chipWrap}>
                    {project.members.map((m) => {
                      const active = todoAssignees.includes(m.id);
                      return (
                        <PressableScale
                          key={m.id}
                          onPress={() => setTodoAssignees((prev) => toggleId(prev, m.id))}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text
                            variant="caption"
                            color={active ? colors.primaryForeground : colors.inkDeep}
                            style={{ fontFamily: active ? font.semibold : font.medium }}
                          >
                            {m.id === user?.id ? `${m.name} (You)` : m.name}
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
                    {project.members.map((m) => {
                      const active = todoNotify.includes(m.id);
                      return (
                        <PressableScale
                          key={m.id}
                          onPress={() => setTodoNotify((prev) => toggleId(prev, m.id))}
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
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

/* ── Complaints ─────────────────────────────────────────────────────────────── */

export function ComplaintsSegment({ project, active }: { project: ProjectDto; active: boolean }) {
  const router = useRouter();
  const { user } = useSession();
  const q = useProjectComplaints(project.id, active);
  const closed = project.stage === 'CLOSED';
  // Newest first, so each day's complaints sit together under one separator.
  const items = useMemo(
    () => [...(q.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [q.data],
  );
  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={pad}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => void q.refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          q.isPending ? (
            <Loading />
          ) : q.isError ? (
            <Failed onRetry={() => void q.refetch()} />
          ) : (
            <EmptyState icon="life-buoy" message="No complaints on this project" />
          )
        }
        renderItem={({ item, index }) => {
          const previous = items[index - 1];
          const newDay =
            !previous || businessDate(previous.createdAt) !== businessDate(item.createdAt);
          const author = item.raisedBy?.name ?? item.customer.name;
          return (
            <View>
              {newDay ? <DaySeparator label={dayLabel(item.createdAt)} /> : null}
              <View style={styles.item}>
                <TimelineEntryRow authorName={author} accentAvatar={item.raisedBy?.id === user?.id}>
                  <ComplaintCard
                    complaint={item}
                    mine={item.raisedBy?.id === user?.id}
                    onPress={() =>
                      router.push({ pathname: '/complaints/[id]', params: { id: item.id } })
                    }
                  />
                </TimelineEntryRow>
              </View>
            </View>
          );
        }}
      />
      <BottomBar>
        {closed ? (
          <ClosedNotice text="This project is closed. It takes no new complaints." />
        ) : (
          <Button
            title="Raise complaint"
            onPress={() =>
              router.push({ pathname: '/complaints/new', params: { projectId: project.id } })
            }
            fullWidth
          />
        )}
      </BottomBar>
    </View>
  );
}

/* ── Docs ───────────────────────────────────────────────────────────────────── */

type DocModalState =
  | { kind: 'new-folder' }
  | { kind: 'folder-actions'; folder: FolderDto }
  | { kind: 'rename-folder'; folder: FolderDto }
  | { kind: 'file-actions'; file: DocFileDto }
  | { kind: 'rename-file'; file: DocFileDto }
  | { kind: 'move-file'; file: DocFileDto }
  | null;

type DocListItem =
  | { type: 'folder'; key: string; folder: FolderDto }
  | { type: 'file'; key: string; file: DocFileDto };

export function DocsSegment({
  project,
  targetFileId,
  onOpenPhotos,
}: {
  project: ProjectDto;
  /** `?file=` deep link: open this file once the list is loaded. */
  targetFileId?: string;
  onOpenPhotos: (photos: ViewerPhoto[], index: number) => void;
}) {
  const { user } = useSession();
  const isStaff = !!user && user.role !== 'CUSTOMER';
  const closed = project.stage === 'CLOSED';

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sharedOnly, setSharedOnly] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const isSearching = !!debouncedSearch || sharedOnly;

  const foldersQ = useProjectFolders(project.id, isStaff);
  const filesQ = useProjectFiles(project.id, {
    ...(isStaff && !isSearching ? { folderId: activeFolderId ?? 'root' } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(sharedOnly ? { shared: true } : {}),
  });

  const createFolderMut = useCreateFolder(project.id);
  const updateFolderMut = useUpdateFolder(project.id);
  const deleteFolderMut = useDeleteFolder(project.id);
  const updateFileMut = useUpdateFile(project.id);
  const deleteFileMut = useDeleteFile(project.id);

  const [modal, setModal] = useState<DocModalState>(null);
  const [nameInput, setNameInput] = useState('');
  const [highlight, setHighlight] = useState<string | null>(null);
  const handled = useRef<string | null>(null);

  const allFolders = useMemo(() => foldersQ.data ?? [], [foldersQ.data]);
  const folderById = useMemo(() => new Map(allFolders.map((f) => [f.id, f])), [allFolders]);

  const breadcrumbs = useMemo(() => {
    const chain: FolderDto[] = [];
    let cur = activeFolderId ? folderById.get(activeFolderId) : undefined;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      chain.unshift(cur);
      cur = cur.parentId ? folderById.get(cur.parentId) : undefined;
    }
    return chain;
  }, [activeFolderId, folderById]);

  const rows = useMemo<DocListItem[]>(() => {
    const out: DocListItem[] = [];
    if (isStaff && !isSearching) {
      const children = allFolders
        .filter((f) => f.parentId === activeFolderId)
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const folder of children) {
        out.push({ type: 'folder', key: `folder:${folder.id}`, folder });
      }
    }
    const files = [...(filesQ.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const file of files) {
      out.push({ type: 'file', key: `file:${file.id}`, file });
    }
    return out;
  }, [isStaff, isSearching, allFolders, activeFolderId, filesQ.data]);

  const openFile = (f: DocFileDto) => {
    if (f.kind === 'IMAGE') {
      onOpenPhotos(
        [{ publicId: f.id, url: f.previewUrl ?? f.url, thumbUrl: f.thumbUrl ?? f.url }],
        0,
      );
    } else {
      void Linking.openURL(f.downloadUrl).catch(() => undefined);
    }
  };

  useEffect(() => {
    if (!targetFileId || handled.current === targetFileId || !filesQ.data) return;
    handled.current = targetFileId;
    const f = filesQ.data.find((x) => x.id === targetFileId);
    if (!f) return;
    setTimeout(() => setHighlight(f.id), 0);
    setTimeout(() => setHighlight(null), 2500);
    if (f.kind === 'IMAGE') {
      onOpenPhotos(
        [{ publicId: f.id, url: f.previewUrl ?? f.url, thumbUrl: f.thumbUrl ?? f.url }],
        0,
      );
    } else {
      void Linking.openURL(f.downloadUrl).catch(() => undefined);
    }
  }, [targetFileId, filesQ.data, onOpenPhotos]);

  const submitFolderName = () => {
    const name = nameInput.trim();
    if (!name) return;
    if (modal?.kind === 'new-folder') {
      createFolderMut.mutate(
        { name, ...(activeFolderId ? { parentId: activeFolderId } : {}) },
        {
          onSuccess: () => setModal(null),
          onError: fail('Could not create folder'),
        },
      );
    } else if (modal?.kind === 'rename-folder') {
      updateFolderMut.mutate(
        { id: modal.folder.id, name },
        {
          onSuccess: () => setModal(null),
          onError: fail('Could not rename folder'),
        },
      );
    }
  };

  const confirmDeleteFolder = (folder: FolderDto) => {
    setModal(null);
    Alert.alert(
      'Delete folder?',
      `Delete "${folder.name}"? Any files inside must be moved or deleted first.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteFolderMut.mutate(folder.id, {
              onSuccess: () => {
                if (activeFolderId === folder.id) setActiveFolderId(folder.parentId);
              },
              onError: fail('Could not delete folder'),
            }),
        },
      ],
    );
  };

  const submitFileName = () => {
    const name = nameInput.trim();
    if (!name || modal?.kind !== 'rename-file') return;
    updateFileMut.mutate(
      { id: modal.file.id, name },
      {
        onSuccess: () => setModal(null),
        onError: fail('Could not rename file'),
      },
    );
  };

  const toggleFileVisibility = (file: DocFileDto) => {
    const next = file.visibility === 'CLIENT' ? 'TEAM' : 'CLIENT';
    setModal(null);
    updateFileMut.mutate(
      { id: file.id, visibility: next },
      { onError: fail('Could not change visibility') },
    );
  };

  const moveFileTo = (file: DocFileDto, folderId: string | null) => {
    setModal(null);
    updateFileMut.mutate(
      { id: file.id, folderId },
      { onError: fail('Could not move file') },
    );
  };

  const confirmDeleteFile = (file: DocFileDto) => {
    setModal(null);
    Alert.alert('Delete file?', `"${file.name}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteFileMut.mutate(file.id, { onError: fail('Could not delete file') }),
      },
    ]);
  };

  const refetch = () => {
    void filesQ.refetch();
    if (isStaff) void foldersQ.refetch();
  };

  return (
    <View style={styles.root}>
      <View style={styles.topControls}>
        <View style={styles.controlRow}>
          <View style={styles.docSearch}>
            <Feather name="search" size={15} color={colors.inkMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search documents"
              placeholderTextColor={colors.placeholder}
              returnKeyType="search"
              style={styles.docSearchInput}
            />
            {search ? (
              <PressableScale onPress={() => setSearch('')} accessibilityLabel="Clear search">
                <Feather name="x" size={15} color={colors.inkMuted} />
              </PressableScale>
            ) : null}
          </View>
          {isStaff ? (
            <PressableScale
              onPress={() => {
                softTick();
                setSharedOnly((v) => !v);
              }}
              style={[styles.filterPill, sharedOnly && styles.filterPillActive]}
            >
              <Feather
                name="users"
                size={14}
                color={sharedOnly ? colors.primaryForeground : colors.inkDeep}
              />
              <Text
                variant="caption"
                color={sharedOnly ? colors.primaryForeground : colors.inkDeep}
                style={{ fontFamily: sharedOnly ? font.semibold : font.medium }}
              >
                Shared
              </Text>
            </PressableScale>
          ) : null}
          {isStaff && !closed ? (
            <PressableScale
              onPress={() => {
                setNameInput('');
                setModal({ kind: 'new-folder' });
              }}
              accessibilityLabel="New folder"
              style={styles.secondaryChipBtn}
            >
              <Feather name="folder-plus" size={15} color={colors.inkDeep} />
            </PressableScale>
          ) : null}
        </View>

        {isStaff && !isSearching && breadcrumbs.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.breadcrumbRow}>
              <PressableScale onPress={() => setActiveFolderId(null)} style={styles.crumb}>
                <Text variant="caption" color={colors.tealStrong} style={{ fontFamily: font.semibold }}>
                  All files
                </Text>
              </PressableScale>
              {breadcrumbs.map((f, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <View key={f.id} style={styles.crumbWrap}>
                    <Feather name="chevron-right" size={13} color={colors.inkMuted} />
                    <PressableScale
                      disabled={isLast}
                      onPress={() => setActiveFolderId(f.id)}
                      style={styles.crumb}
                    >
                      <Text
                        variant="caption"
                        color={isLast ? colors.inkDeep : colors.tealStrong}
                        style={{ fontFamily: font.semibold }}
                      >
                        {f.name}
                      </Text>
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        ) : null}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        contentContainerStyle={[pad, { gap: space[2] }]}
        refreshControl={
          <RefreshControl
            refreshing={filesQ.isRefetching || foldersQ.isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          filesQ.isPending ? (
            <Loading />
          ) : filesQ.isError ? (
            <Failed onRetry={refetch} />
          ) : (
            <EmptyState
              icon="folder"
              message={
                isSearching
                  ? 'No matching documents'
                  : activeFolderId
                    ? 'This folder is empty'
                    : 'No documents yet'
              }
            />
          )
        }
        renderItem={({ item }) => {
          if (item.type === 'folder') {
            const f = item.folder;
            return (
              <View style={styles.docCard}>
                <PressableScale
                  onPress={() => {
                    softTick();
                    setActiveFolderId(f.id);
                  }}
                  style={styles.docMain}
                >
                  <View style={styles.folderIcon}>
                    <Feather name="folder" size={18} color={colors.tealStrong} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label" color={colors.inkDeep} numberOfLines={1}>
                      {f.name}
                    </Text>
                    <Text variant="caption" color={colors.inkMuted} style={styles.tabular}>
                      {f.fileCount} {f.fileCount === 1 ? 'file' : 'files'}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.inkMuted} />
                </PressableScale>
                {!closed ? (
                  <PressableScale
                    onPress={() => setModal({ kind: 'folder-actions', folder: f })}
                    accessibilityLabel="Folder actions"
                    style={styles.moreBtn}
                  >
                    <Feather name="more-horizontal" size={18} color={colors.inkMuted} />
                  </PressableScale>
                ) : null}
              </View>
            );
          }

          const f = item.file;
          const meta = [
            f.format?.toUpperCase(),
            f.bytes != null ? formatBytes(f.bytes) : null,
            formatDate(f.createdAt),
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <View style={[styles.docCard, highlight === f.id && styles.docCardHighlight]}>
              <PressableScale onPress={() => openFile(f)} style={styles.docMain}>
                {f.thumbUrl ? (
                  <Image source={{ uri: f.thumbUrl }} style={styles.fileThumb} contentFit="cover" />
                ) : (
                  <View style={styles.fileIcon}>
                    <Feather
                      name={f.kind === 'IMAGE' ? 'image' : 'file-text'}
                      size={18}
                      color={colors.inkMuted}
                    />
                  </View>
                )}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text variant="label" color={colors.inkDeep} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <View style={styles.tagRow}>
                    {isStaff ? (
                      <Badge
                        label={f.visibility === 'CLIENT' ? 'Client' : 'Team'}
                        t={f.visibility === 'CLIENT' ? 'success' : 'neutral'}
                      />
                    ) : null}
                    <Text variant="caption" color={colors.inkMuted} numberOfLines={1} style={{ flex: 1 }}>
                      {meta}
                    </Text>
                  </View>
                </View>
              </PressableScale>
              {isStaff && !closed ? (
                <PressableScale
                  onPress={() => setModal({ kind: 'file-actions', file: f })}
                  accessibilityLabel="File actions"
                  style={styles.moreBtn}
                >
                  <Feather name="more-horizontal" size={18} color={colors.inkMuted} />
                </PressableScale>
              ) : null}
            </View>
          );
        }}
      />

      <BottomBar>
        {closed ? (
          <ClosedNotice text="This project is closed. It takes no new documents." />
        ) : (
          <DocUploadBar projectId={project.id} isCustomer={!isStaff} folderId={activeFolderId} />
        )}
      </BottomBar>

      <BottomSheet
        visible={!!modal}
        onClose={() => setModal(null)}
        title={
          modal?.kind === 'new-folder'
            ? 'New folder'
            : modal?.kind === 'rename-folder'
              ? 'Rename folder'
              : modal?.kind === 'folder-actions'
                ? modal.folder.name
                : modal?.kind === 'rename-file'
                  ? 'Rename file'
                  : modal?.kind === 'move-file'
                    ? 'Move to folder'
                    : modal?.file.name ?? 'Document'
        }
        footer={
          modal?.kind === 'new-folder' || modal?.kind === 'rename-folder' ? (
            <Button
              title={modal.kind === 'new-folder' ? 'Create folder' : 'Save name'}
              onPress={submitFolderName}
              loading={createFolderMut.isPending || updateFolderMut.isPending}
              disabled={!nameInput.trim()}
              fullWidth
            />
          ) : modal?.kind === 'rename-file' ? (
            <Button
              title="Save name"
              onPress={submitFileName}
              loading={updateFileMut.isPending}
              disabled={!nameInput.trim()}
              fullWidth
            />
          ) : undefined
        }
      >
        {modal?.kind === 'new-folder' || modal?.kind === 'rename-folder' ? (
          <Input
            label="Folder name"
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="e.g. 3D Renders, Site Drawings"
            autoFocus
          />
        ) : modal?.kind === 'folder-actions' ? (
          <View style={{ gap: space[1] }}>
            <PressableScale
              onPress={() => {
                setNameInput(modal.folder.name);
                setModal({ kind: 'rename-folder', folder: modal.folder });
              }}
              style={styles.sheetActionRow}
            >
              <Feather name="edit-2" size={18} color={colors.inkDeep} />
              <Text variant="label" color={colors.inkDeep}>
                Rename folder
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => confirmDeleteFolder(modal.folder)}
              style={styles.sheetActionRow}
            >
              <Feather name="trash-2" size={18} color={colors.destructive} />
              <Text variant="label" color={colors.destructive}>
                Delete folder
              </Text>
            </PressableScale>
          </View>
        ) : modal?.kind === 'file-actions' ? (
          <View style={{ gap: space[1] }}>
            <PressableScale
              onPress={() => toggleFileVisibility(modal.file)}
              style={styles.sheetActionRow}
            >
              <Feather
                name={modal.file.visibility === 'CLIENT' ? 'lock' : 'users'}
                size={18}
                color={colors.inkDeep}
              />
              <Text variant="label" color={colors.inkDeep}>
                {modal.file.visibility === 'CLIENT' ? 'Make team-only' : 'Share with client'}
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => {
                setNameInput(modal.file.name);
                setModal({ kind: 'rename-file', file: modal.file });
              }}
              style={styles.sheetActionRow}
            >
              <Feather name="edit-2" size={18} color={colors.inkDeep} />
              <Text variant="label" color={colors.inkDeep}>
                Rename file
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => setModal({ kind: 'move-file', file: modal.file })}
              style={styles.sheetActionRow}
            >
              <Feather name="folder" size={18} color={colors.inkDeep} />
              <Text variant="label" color={colors.inkDeep}>
                Move to folder
              </Text>
            </PressableScale>
            {modal.file.canDelete ? (
              <PressableScale
                onPress={() => confirmDeleteFile(modal.file)}
                style={styles.sheetActionRow}
              >
                <Feather name="trash-2" size={18} color={colors.destructive} />
                <Text variant="label" color={colors.destructive}>
                  Delete file
                </Text>
              </PressableScale>
            ) : null}
          </View>
        ) : modal?.kind === 'rename-file' ? (
          <Input
            label="File name"
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="Document name"
            autoFocus
          />
        ) : modal?.kind === 'move-file' ? (
          <View style={{ gap: space[1] }}>
            <PressableScale
              onPress={() => moveFileTo(modal.file, null)}
              style={styles.sheetActionRow}
            >
              <Feather name="home" size={18} color={colors.inkDeep} />
              <Text variant="label" color={colors.inkDeep} style={{ flex: 1 }}>
                All files (top level)
              </Text>
              {modal.file.folderId === null ? (
                <Feather name="check" size={16} color={colors.tealStrong} />
              ) : null}
            </PressableScale>
            {allFolders.map((f) => (
              <PressableScale
                key={f.id}
                onPress={() => moveFileTo(modal.file, f.id)}
                style={styles.sheetActionRow}
              >
                <Feather name="folder" size={18} color={colors.tealStrong} />
                <Text variant="label" color={colors.inkDeep} style={{ flex: 1 }}>
                  {f.name}
                </Text>
                {modal.file.folderId === f.id ? (
                  <Feather name="check" size={16} color={colors.tealStrong} />
                ) : null}
              </PressableScale>
            ))}
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageSoft },
  item: { marginVertical: space[2] },
  topControls: {
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[2],
    gap: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.pageSoft,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  actionBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  filterPillActive: {
    backgroundColor: colors.tealStrong,
    borderColor: colors.tealStrong,
  },
  secondaryChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: space[3],
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  primaryChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: space[3],
    borderRadius: 10,
    backgroundColor: colors.tealStrong,
  },
  listCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    backgroundColor: colors.pageSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  smallIconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: space[2],
    minHeight: hit,
  },
  checkHit: {
    width: hit,
    height: hit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 1.75,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: {
    backgroundColor: tone.success.fg,
    borderColor: tone.success.fg,
  },
  todoMain: {
    flex: 1,
    paddingVertical: space[3],
    gap: 4,
  },
  todoTitle: {
    fontFamily: font.medium,
  },
  todoTitleDone: {
    textDecorationLine: 'line-through',
  },
  moreBtn: {
    width: 40,
    height: hit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' },
  comments: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabular: { fontVariant: ['tabular-nums'] },
  sheetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: hit,
    paddingHorizontal: space[2],
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  chip: {
    minHeight: 36,
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
  docSearch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    height: 36,
    paddingHorizontal: space[3],
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  docSearchInput: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.inkDeep,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  crumbWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  crumb: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingLeft: space[3],
    paddingRight: space[1],
    minHeight: 60,
  },
  docCardHighlight: {
    borderColor: colors.tealStrong,
    backgroundColor: colors.primarySoft,
  },
  docMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
  },
  folderIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.pageSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileThumb: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.pageSoft,
  },
});
