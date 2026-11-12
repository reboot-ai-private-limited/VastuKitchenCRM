import type { MyTodoDto, TodoDto, TodoListDto } from '@vastu/contracts';
import { addDays, businessDate, formatDay } from '@/lib/format';

export type TodoStatusFilter = 'open' | 'done' | 'all';

/** "3/8 done": done of everything in the list. */
export const progressLabel = (l: Pick<TodoListDto, 'openCount' | 'doneCount'>): string =>
  `${l.doneCount}/${l.openCount + l.doneCount} done`;
export const progressPercent = (l: Pick<TodoListDto, 'openCount' | 'doneCount'>): number => {
  const total = l.openCount + l.doneCount;
  return total === 0 ? 0 : Math.round((l.doneCount / total) * 100);
};

export const isDone = (t: Pick<TodoDto, 'completed'>): boolean => t.completed !== null;

export function filterByStatus<T extends Pick<TodoDto, 'completed'>>(
  todos: T[],
  status: TodoStatusFilter,
): T[] {
  return status === 'all' ? todos : todos.filter((t) => (status === 'done') === isDone(t));
}

export interface ListGroup {
  list: TodoListDto;
  todos: TodoDto[];
}

/**
 * Lists in their order, each with the to-dos that pass the filter. A list with no matching to-dos is kept
 * (so it can still receive new ones) unless a status filter is hiding everything and the list is archived.
 */
export function groupByList(
  lists: TodoListDto[],
  todos: TodoDto[],
  status: TodoStatusFilter,
): ListGroup[] {
  const shown = filterByStatus(todos, status);
  return lists.map((list) => ({ list, todos: shown.filter((t) => t.listId === list.id) }));
}

export interface DueChip {
  label: string;
  tone: 'danger' | 'warning' | 'info' | 'neutral';
}

/** The due-date chip. Judged on the business calendar, never the browser's day. Completed items show a plain date. */
export function dueChip(
  t: Pick<TodoDto, 'dueOn' | 'completed' | 'isOverdue'>,
  today: string = businessDate(),
): DueChip | null {
  if (!t.dueOn) return null;
  if (t.completed) return { label: formatDay(t.dueOn), tone: 'neutral' };
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${t.dueOn}T00:00:00Z`)) / 86_400_000,
  );
  if (t.isOverdue || days > 0)
    return {
      label: days === 1 ? 'Overdue · yesterday' : `Overdue · ${Math.max(days, 1)} days`,
      tone: 'danger',
    };
  if (days === 0) return { label: 'Due today', tone: 'warning' };
  if (days === -1) return { label: 'Due tomorrow', tone: 'info' };
  return { label: formatDay(t.dueOn), tone: 'neutral' };
}

export const MINE_GROUPS = ['Overdue', 'Today', 'This week', 'Later', 'No date'] as const;
export type MineGroupName = (typeof MINE_GROUPS)[number];

/** The API's buckets, with UPCOMING split into "this week" (next 7 days) and "later". Empty groups are dropped. */
export function groupMine(
  todos: MyTodoDto[],
  today: string = businessDate(),
): Array<{ name: MineGroupName; todos: MyTodoDto[] }> {
  const weekEnd = addDays(today, 7);
  const name = (t: MyTodoDto): MineGroupName => {
    if (t.bucket === 'OVERDUE') return 'Overdue';
    if (t.bucket === 'TODAY') return 'Today';
    if (t.bucket === 'NO_DATE' || !t.dueOn) return 'No date';
    return t.dueOn <= weekEnd ? 'This week' : 'Later';
  };
  const out = MINE_GROUPS.map((n) => ({ name: n, todos: [] as MyTodoDto[] }));
  for (const t of todos) out.find((g) => g.name === name(t))!.todos.push(t);
  return out.filter((g) => g.todos.length > 0);
}

/**
 * To-dos grouped under their project. The API already sorts everything most urgent first, so the
 * projects come out with the most urgent one first, and inside each project overdue comes before
 * due-soon before undated.
 */
export function groupByProject(
  todos: MyTodoDto[],
): Array<{ project: MyTodoDto['project']; todos: MyTodoDto[]; overdue: number }> {
  const out = new Map<
    string,
    { project: MyTodoDto['project']; todos: MyTodoDto[]; overdue: number }
  >();
  for (const t of todos) {
    const g = out.get(t.project.id) ?? { project: t.project, todos: [], overdue: 0 };
    g.todos.push(t);
    if (t.bucket === 'OVERDUE' && !t.completed) g.overdue++;
    out.set(t.project.id, g);
  }
  return [...out.values()];
}

/** Optimistic complete/reopen on one to-do inside any cached array. Other to-dos are returned untouched. */
export function withCompletion<T extends Pick<TodoDto, 'id' | 'completed'>>(
  todos: T[],
  id: string,
  completed: TodoDto['completed'],
): T[] {
  return todos.map((t) => (t.id === id ? { ...t, completed } : t));
}

/** The same change on a list's counters. */
export function withListCounts(lists: TodoListDto[], listId: string, done: boolean): TodoListDto[] {
  return lists.map((l) =>
    l.id === listId
      ? {
          ...l,
          openCount: Math.max(0, l.openCount + (done ? -1 : 1)),
          doneCount: Math.max(0, l.doneCount + (done ? 1 : -1)),
        }
      : l,
  );
}

export const assigneeNames = (t: Pick<TodoDto, 'assignees'>): string =>
  t.assignees.map((a) => a.name).join(', ');
