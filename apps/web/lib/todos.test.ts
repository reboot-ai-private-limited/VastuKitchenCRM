import type { MyTodoDto, TodoDto, TodoListDto } from '@vastu/contracts';
import { describe, expect, it } from 'vitest';
import {
  dueChip,
  filterByStatus,
  groupByList,
  groupMine,
  progressLabel,
  progressPercent,
  withCompletion,
  withListCounts,
} from './todos';

const person = { id: 'u1', name: 'A' };
const todo = (over: Partial<TodoDto> = {}): TodoDto => ({
  id: 't1',
  projectId: 'p',
  listId: 'l1',
  title: 'T',
  notes: null,
  images: [],
  assignees: [],
  notifyOnDone: [],
  dueOn: null,
  isOverdue: false,
  completed: null,
  createdBy: person,
  commentCount: 0,
  canDelete: true,
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});
const mine = (over: Partial<MyTodoDto> = {}): MyTodoDto => ({
  ...todo(),
  project: { id: 'p', name: 'P' },
  listName: 'L',
  bucket: 'NO_DATE',
  ...over,
});
const list = (over: Partial<TodoListDto> = {}): TodoListDto => ({
  id: 'l1',
  projectId: 'p',
  name: 'L',
  archived: false,
  openCount: 5,
  doneCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});
const done = { by: person, at: '2026-01-02T00:00:00Z' };

describe('progress', () => {
  it('says 3/8 done', () => {
    expect(progressLabel(list())).toBe('3/8 done');
    expect(progressPercent(list())).toBe(38);
    expect(progressPercent(list({ openCount: 0, doneCount: 0 }))).toBe(0);
  });
});

describe('filters and grouping', () => {
  const ts = [
    todo({ id: 'a' }),
    todo({ id: 'b', completed: done }),
    todo({ id: 'c', listId: 'l2' }),
  ];
  it('filters by status', () => {
    expect(filterByStatus(ts, 'open').map((t) => t.id)).toEqual(['a', 'c']);
    expect(filterByStatus(ts, 'done').map((t) => t.id)).toEqual(['b']);
    expect(filterByStatus(ts, 'all')).toHaveLength(3);
  });
  it('groups to-dos under their lists, keeping empty lists', () => {
    const g = groupByList([list(), list({ id: 'l2' }), list({ id: 'l3' })], ts, 'open');
    expect(g.map((x) => x.todos.map((t) => t.id))).toEqual([['a'], ['c'], []]);
  });
});

describe('dueChip', () => {
  const today = '2026-11-11';
  it('judges on the given business day', () => {
    expect(dueChip(todo({ dueOn: null }), today)).toBeNull();
    expect(dueChip(todo({ dueOn: '2026-11-11' }), today)).toMatchObject({
      label: 'Due today',
      tone: 'warning',
    });
    expect(dueChip(todo({ dueOn: '2026-11-12' }), today)).toMatchObject({ label: 'Due tomorrow' });
    expect(dueChip(todo({ dueOn: '2026-11-10', isOverdue: true }), today)).toMatchObject({
      label: 'Overdue · yesterday',
      tone: 'danger',
    });
    expect(dueChip(todo({ dueOn: '2026-11-08', isOverdue: true }), today)).toMatchObject({
      label: 'Overdue · 3 days',
    });
  });
  it('a completed to-do is never shown as overdue', () => {
    expect(dueChip(todo({ dueOn: '2026-11-01', completed: done }), today)?.tone).toBe('neutral');
  });
});

describe('groupMine', () => {
  it('splits upcoming into this week and later and drops empty groups', () => {
    const g = groupMine(
      [
        mine({ id: '1', bucket: 'OVERDUE', dueOn: '2026-11-01' }),
        mine({ id: '2', bucket: 'TODAY', dueOn: '2026-11-11' }),
        mine({ id: '3', bucket: 'UPCOMING', dueOn: '2026-11-15' }),
        mine({ id: '4', bucket: 'UPCOMING', dueOn: '2026-12-25' }),
        mine({ id: '5', bucket: 'NO_DATE' }),
      ],
      '2026-11-11',
    );
    expect(g.map((x) => [x.name, x.todos.map((t) => t.id)])).toEqual([
      ['Overdue', ['1']],
      ['Today', ['2']],
      ['This week', ['3']],
      ['Later', ['4']],
      ['No date', ['5']],
    ]);
    expect(groupMine([mine({ bucket: 'TODAY' })], '2026-11-11').map((x) => x.name)).toEqual([
      'Today',
    ]);
  });
});

describe('optimistic helpers', () => {
  it('completes only the target to-do', () => {
    const out = withCompletion([todo({ id: 'a' }), todo({ id: 'b' })], 'a', done);
    expect(out[0]!.completed).toEqual(done);
    expect(out[1]!.completed).toBeNull();
  });
  it('moves the list counters both ways and never goes below zero', () => {
    expect(withListCounts([list()], 'l1', true)[0]).toMatchObject({ openCount: 4, doneCount: 4 });
    expect(withListCounts([list()], 'l1', false)[0]).toMatchObject({ openCount: 6, doneCount: 2 });
    expect(withListCounts([list({ openCount: 0 })], 'l1', true)[0]!.openCount).toBe(0);
  });
});
