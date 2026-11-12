import { describe, expect, it } from 'vitest';
import {
  CreateTodoCommentUseCase,
  DeleteTodoCommentUseCase,
  ListTodoCommentsUseCase,
} from './comments.usecases.js';
import {
  CreateTodoListUseCase,
  ListTodoListsUseCase,
  UpdateTodoListUseCase,
} from './lists.usecases.js';
import { MyTodosUseCase, bucketOf } from './mine.usecase.js';
import { FindOverdueTodosUseCase } from './overdue.usecase.js';
import {
  CompleteTodoUseCase,
  CreateTodoUseCase,
  DeleteTodoUseCase,
  ListTodosUseCase,
  ReopenTodoUseCase,
  UpdateTodoUseCase,
} from './todos.usecases.js';
import {
  NOW,
  admin,
  cust,
  designer,
  designer2,
  office,
  tech,
  today,
  world,
} from '../testing/fakes.js';
import { isOverdue } from '../services/todoViews.js';

function setup() {
  const w = world();
  const now = () => NOW;
  return {
    w,
    createList: new CreateTodoListUseCase(w.access, w.lists),
    updateList: new UpdateTodoListUseCase(w.access, w.lists, w.todos),
    listLists: new ListTodoListsUseCase(w.access, w.lists, w.todos),
    create: new CreateTodoUseCase(
      w.access,
      w.todos,
      w.projects,
      w.directory,
      w.storage,
      w.alerts,
      w.views,
    ),
    update: new UpdateTodoUseCase(
      w.access,
      w.todos,
      w.lists,
      w.projects,
      w.directory,
      w.storage,
      w.alerts,
      w.views,
    ),
    complete: new CompleteTodoUseCase(
      w.access,
      w.todos,
      w.projects,
      w.directory,
      w.alerts,
      w.views,
      now,
    ),
    reopen: new ReopenTodoUseCase(w.access, w.todos, w.projects, w.views),
    del: new DeleteTodoUseCase(w.access, w.todos),
    listTodos: new ListTodosUseCase(w.access, w.todos, w.views),
    comment: new CreateTodoCommentUseCase(
      w.access,
      w.comments,
      w.todos,
      w.directory,
      w.alerts,
      w.storage,
    ),
    comments: new ListTodoCommentsUseCase(w.access, w.comments, w.directory, w.storage),
    delComment: new DeleteTodoCommentUseCase(w.access, w.comments, w.todos),
    mine: new MyTodosUseCase(w.todos, w.lists, w.projects, w.views, today, now),
    overdue: new FindOverdueTodosUseCase(w.todos, w.projects, today, now),
  };
}
const input = (over = {}) => ({
  title: 'Order the chimney',
  images: [],
  assigneeIds: [],
  notifyOnDoneIds: [],
  ...over,
});
async function withList() {
  const s = setup();
  const { list } = await s.createList.execute(admin, 'proj1', { name: 'Procurement' });
  return { ...s, list };
}

describe('lists', () => {
  it('shows "3/8 completed", hides archived lists, and blocks adding to one', async () => {
    const { w, list, create, complete, updateList, listLists } = await withList();
    const a = await create.execute(designer, list.id, input({ title: 'a' }));
    await create.execute(designer, list.id, input({ title: 'b' }));
    await complete.execute(designer, a.todo.id);

    expect((await listLists.execute(tech, 'proj1', false))[0]).toMatchObject({
      openCount: 1,
      doneCount: 1,
    });
    await updateList.execute(admin, list.id, { archived: true });
    expect(await listLists.execute(tech, 'proj1', false)).toHaveLength(0);
    expect(await listLists.execute(tech, 'proj1', true)).toHaveLength(1);
    await expect(create.execute(designer, list.id, input())).rejects.toMatchObject({
      statusCode: 409,
    });
    await updateList.execute(admin, list.id, { name: 'Purchasing', archived: false });
    expect(w.lists.rows[0]?.name).toBe('Purchasing');
  });
});

describe('who can use to-dos (team only)', () => {
  it('hides everything from the customer and from outsiders as not found', async () => {
    const { w, list, create, createList, listLists, complete, del, comment, mine } =
      await withList();
    const t = await create.execute(designer, list.id, input({ assigneeIds: ['tech1'] }));
    for (const who of [cust, designer2]) {
      await expect(listLists.execute(who, 'proj1', false)).rejects.toMatchObject({
        statusCode: 404,
      });
      await expect(createList.execute(who, 'proj1', { name: 'x' })).rejects.toMatchObject({
        statusCode: 404,
      });
      await expect(create.execute(who, list.id, input())).rejects.toMatchObject({
        statusCode: 404,
      });
      await expect(complete.execute(who, t.todo.id)).rejects.toMatchObject({ statusCode: 404 });
      await expect(comment.execute(who, t.todo.id, { text: 'hi' })).rejects.toMatchObject({
        statusCode: 404,
      });
      await expect(del.execute(who, t.todo.id)).rejects.toMatchObject({ statusCode: 404 });
      expect(await mine.execute(who, { status: 'all', scope: 'mine' })).toEqual([]);
    }
    expect(w.todos.rows).toHaveLength(1);
  });
});

describe('adding a to-do', () => {
  it('tells the assignees (not the creator), writes the timeline, and stores the date', async () => {
    const { w, list, create } = await withList();
    const v = await create.execute(
      designer,
      list.id,
      input({ assigneeIds: ['tech1', 'designer1'], dueOn: '2026-11-14', notes: 'Hafele, 90cm' }),
    );
    expect(v.todo).toMatchObject({
      dueOn: '2026-11-14',
      notes: 'Hafele, 90cm',
      createdById: 'designer1',
    });
    expect(v.assignees.map((a) => a.name).sort()).toEqual(['Dev', 'Tarun']);
    expect(w.sender.ofType('TODO_ASSIGNED')[0]).toMatchObject({
      userIds: ['tech1'],
      alert: {
        title: 'Assigned to you: Order the chimney',
        body: "Dev · Mrs Rao's project · due 2026-11-14",
        ref: { kind: 'TODO', id: v.todo.id, projectId: 'proj1' },
      },
    });
    expect(w.projects.activities[0]).toMatchObject({
      type: 'TODO_CREATED',
      actorId: 'designer1',
      data: {
        todoTitle: 'Order the chimney',
        listName: 'Procurement',
        assigneeNames: ['Tarun', 'Dev'],
      },
    });
  });

  it('accepts only people who can open it: active members or an Admin, never a customer or outsider', async () => {
    const { list, create } = await withList();
    await expect(
      create.execute(admin, list.id, input({ assigneeIds: ['admin1', 'office1'] })),
    ).resolves.toBeDefined();
    for (const bad of ['designer2', 'cust1', 'gone1', 'nobody']) {
      await expect(
        create.execute(admin, list.id, input({ assigneeIds: [bad] })),
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        create.execute(admin, list.id, input({ notifyOnDoneIds: [bad] })),
      ).rejects.toMatchObject({ statusCode: 400 });
    }
  });

  it("accepts photos only from this project's folder", async () => {
    const { list, create } = await withList();
    await expect(
      create.execute(
        admin,
        list.id,
        input({ images: [{ publicId: 'vastu-test/projects/proj1/a' }] }),
      ),
    ).resolves.toBeDefined();
    await expect(
      create.execute(
        admin,
        list.id,
        input({ images: [{ publicId: 'vastu-test/projects/proj2/a' }] }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('editing', () => {
  async function one() {
    const s = await withList();
    const v = await s.create.execute(
      admin,
      s.list.id,
      input({ assigneeIds: ['tech1'], dueOn: '2026-11-14' }),
    );
    s.w.sender.sent.length = 0;
    s.w.projects.activities.length = 0;
    return { ...s, id: v.todo.id };
  }

  it('tells only NEWLY added assignees, and logs who was added and removed', async () => {
    const { w, update, id } = await one();
    await update.execute(admin, id, { assigneeIds: ['tech1', 'office1'] });
    expect(w.sender.ofType('TODO_ASSIGNED')[0]?.userIds).toEqual(['office1']);
    expect(w.projects.activities[0]).toMatchObject({
      type: 'TODO_ASSIGNED',
      data: { addedNames: ['Rita'], removedNames: [] },
    });

    w.sender.sent.length = 0;
    await update.execute(admin, id, { assigneeIds: ['office1'] });
    expect(w.sender.ofType('TODO_ASSIGNED')).toHaveLength(0); // nobody new: no alert at all
    expect(w.projects.activities.at(-1)).toMatchObject({
      data: { addedNames: [], removedNames: ['Tarun'] },
    });
  });

  it('tells the assignees when the due date moves or goes, and nothing when it is unchanged', async () => {
    const { w, update, id } = await one();
    await update.execute(admin, id, { dueOn: '2026-11-20' });
    expect(w.sender.ofType('TODO_DUE_CHANGED')[0]).toMatchObject({
      userIds: ['tech1'],
      alert: { body: "Owner · Mrs Rao's project · now due 2026-11-20" },
    });
    expect(w.projects.activities[0]).toMatchObject({
      type: 'TODO_DUE_CHANGED',
      data: { from: '2026-11-14', to: '2026-11-20' },
    });

    await update.execute(admin, id, { dueOn: '2026-11-20' }); // same again
    expect(w.sender.ofType('TODO_DUE_CHANGED')).toHaveLength(1);
    await update.execute(admin, id, { dueOn: null });
    expect(w.sender.ofType('TODO_DUE_CHANGED')[1]?.alert.body).toContain('due date removed');
  });

  it('edits notes without any alert or timeline entry, and clears them with null', async () => {
    const { w, update, id } = await one();
    expect((await update.execute(tech, id, { notes: 'see photo' })).todo.notes).toBe('see photo');
    expect((await update.execute(tech, id, { notes: null })).todo.notes).toBeNull();
    expect(w.sender.sent).toHaveLength(0);
    expect(w.projects.activities).toHaveLength(0);
  });

  it('moves to another list of the same project only, and not into an archived one', async () => {
    const { w, update, createList, updateList, id } = await one();
    const { list: other } = await createList.execute(admin, 'proj1', { name: 'Site' });
    expect((await update.execute(admin, id, { listId: other.id })).todo.listId).toBe(other.id);

    w.lists.rows.push({
      id: 'foreign',
      projectId: 'proj2',
      name: 'x',
      archived: false,
      createdById: 'a',
      createdAt: new Date(),
    });
    await expect(update.execute(admin, id, { listId: 'foreign' })).rejects.toMatchObject({
      statusCode: 400,
    });

    const { list: oldList } = await createList.execute(admin, 'proj1', { name: 'Old' });
    await updateList.execute(admin, oldList.id, { archived: true });
    await expect(update.execute(admin, id, { listId: oldList.id })).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('completing', () => {
  it('tells the creator and the notify-when-done people, not the one who completed it, once', async () => {
    const { w, list, create, complete } = await withList();
    const v = await create.execute(
      designer,
      list.id,
      input({ assigneeIds: ['tech1'], notifyOnDoneIds: ['admin1', 'office1', 'tech1'] }),
    );
    w.sender.sent.length = 0;
    w.projects.activities.length = 0;

    const done = await complete.execute(tech, v.todo.id);
    expect(done.todo.completedById).toBe('tech1');
    expect(done.completedByName).toBe('Tarun');
    expect(w.sender.ofType('TODO_COMPLETED')[0]).toMatchObject({
      userIds: ['admin1', 'designer1', 'office1'], // the creator + the list, minus Tarun who did it
      alert: { body: `Tarun completed "Order the chimney" in Mrs Rao's project` },
    });
    expect(w.projects.types()).toEqual(['TODO_COMPLETED']);

    await complete.execute(tech, v.todo.id); // again: nothing new
    await complete.execute(admin, v.todo.id);
    expect(w.sender.ofType('TODO_COMPLETED')).toHaveLength(1);
    expect(w.projects.types()).toEqual(['TODO_COMPLETED']);
    expect(w.todos.rows[0]?.completedById).toBe('tech1'); // the first completion stands
  });

  it('reopens (logged), and reopening an open to-do does nothing', async () => {
    const { w, list, create, complete, reopen } = await withList();
    const v = await create.execute(admin, list.id, input());
    w.projects.activities.length = 0;
    await reopen.execute(admin, v.todo.id);
    expect(w.projects.activities).toHaveLength(0);
    await complete.execute(admin, v.todo.id);
    expect((await reopen.execute(admin, v.todo.id)).todo.completedAt).toBeNull();
    expect(w.projects.types()).toEqual(['TODO_COMPLETED', 'TODO_REOPENED']);
  });
});

describe('deleting', () => {
  it('is for the creator or an Admin only', async () => {
    const { list, create, del } = await withList();
    const v = await create.execute(designer, list.id, input());
    await expect(del.execute(tech, v.todo.id)).rejects.toMatchObject({ statusCode: 403 });
    await del.execute(designer, v.todo.id);
    await expect(del.execute(admin, v.todo.id)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('listing', () => {
  it('filters by status, list and assignee ("me")', async () => {
    const { list, create, createList, complete, listTodos } = await withList();
    const { list: second } = await createList.execute(admin, 'proj1', { name: 'Site' });
    const a = await create.execute(admin, list.id, input({ title: 'a', assigneeIds: ['tech1'] }));
    await create.execute(admin, list.id, input({ title: 'b', assigneeIds: ['office1'] }));
    await create.execute(admin, second.id, input({ title: 'c', assigneeIds: ['tech1'] }));
    await complete.execute(admin, a.todo.id);

    const titles = async (who: typeof tech, q: Record<string, unknown>) =>
      (await listTodos.execute(who, 'proj1', { status: 'open', ...q } as never))
        .map((v) => v.todo.title)
        .sort();
    expect(await titles(tech, {})).toEqual(['b', 'c']);
    expect(await titles(tech, { status: 'done' })).toEqual(['a']);
    expect(await titles(tech, { status: 'all' })).toEqual(['a', 'b', 'c']);
    expect(await titles(tech, { listId: second.id })).toEqual(['c']);
    expect(await titles(tech, { assignee: 'me' })).toEqual(['c']);
    expect(await titles(tech, { assignee: 'office1' })).toEqual(['b']);
  });
});

describe('comments', () => {
  it('tells the assignees, the creator and earlier commenters — except the author — and counts them', async () => {
    const { w, list, create, comment, comments } = await withList();
    const v = await create.execute(designer, list.id, input({ assigneeIds: ['tech1'] }));
    w.sender.sent.length = 0;

    await comment.execute(office, v.todo.id, { text: 'Is the 90cm one in stock?' });
    expect(w.sender.ofType('TODO_COMMENT')[0]?.userIds).toEqual(['designer1', 'tech1']);
    await comment.execute(tech, v.todo.id, { text: 'Checking with the supplier today' });
    expect(w.sender.ofType('TODO_COMMENT')[1]?.userIds).toEqual(['designer1', 'office1']); // creator + earlier commenter
    expect(w.todos.rows[0]?.commentCount).toBe(2);
    expect((await comments.execute(designer, v.todo.id)).map((c) => c.comment.text)).toEqual([
      'Is the 90cm one in stock?',
      'Checking with the supplier today',
    ]);
    await expect(comment.execute(cust, v.todo.id, { text: 'hi' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('can be deleted by their author or an Admin, and the count follows', async () => {
    const { w, list, create, comment, delComment } = await withList();
    const v = await create.execute(admin, list.id, input());
    const mine = await comment.execute(tech, v.todo.id, { text: 'mine' });
    const theirs = await comment.execute(office, v.todo.id, { text: 'theirs' });
    await expect(delComment.execute(tech, v.todo.id, theirs.comment.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    await delComment.execute(tech, v.todo.id, mine.comment.id);
    await delComment.execute(admin, v.todo.id, theirs.comment.id);
    expect(w.todos.rows[0]?.commentCount).toBe(0);
  });
});

describe('due dates use the business calendar', () => {
  it('is overdue only when open and strictly before today', () => {
    const open = { completedAt: null };
    expect(isOverdue({ ...open, dueOn: '2026-11-09' }, '2026-11-10')).toBe(true);
    expect(isOverdue({ ...open, dueOn: '2026-11-10' }, '2026-11-10')).toBe(false); // due today
    expect(isOverdue({ ...open, dueOn: null }, '2026-11-10')).toBe(false);
    expect(isOverdue({ completedAt: new Date(), dueOn: '2026-11-01' }, '2026-11-10')).toBe(false);
  });

  it('buckets: overdue, today, upcoming, no date (completed ones have no urgency)', () => {
    expect(bucketOf({ dueOn: '2026-11-09', completedAt: null }, '2026-11-10')).toBe('OVERDUE');
    expect(bucketOf({ dueOn: '2026-11-10', completedAt: null }, '2026-11-10')).toBe('TODAY');
    expect(bucketOf({ dueOn: '2026-11-11', completedAt: null }, '2026-11-10')).toBe('UPCOMING');
    expect(bucketOf({ dueOn: null, completedAt: null }, '2026-11-10')).toBe('NO_DATE');
    expect(bucketOf({ dueOn: '2026-11-01', completedAt: new Date() }, '2026-11-10')).toBe(
      'NO_DATE',
    );
  });
});

describe('my assignments', () => {
  it('lists mine across the project, most urgent first, and leaves out what is not mine', async () => {
    const { w, list, create, complete, mine } = await withList();
    await create.execute(admin, list.id, input({ title: 'no date', assigneeIds: ['tech1'] }));
    await create.execute(
      admin,
      list.id,
      input({ title: 'next week', assigneeIds: ['tech1'], dueOn: '2026-11-17' }),
    );
    await create.execute(
      admin,
      list.id,
      input({ title: 'today', assigneeIds: ['tech1'], dueOn: '2026-11-10' }),
    );
    await create.execute(
      admin,
      list.id,
      input({ title: 'late', assigneeIds: ['tech1'], dueOn: '2026-11-03' }),
    );
    await create.execute(
      admin,
      list.id,
      input({ title: 'not mine', assigneeIds: ['office1'], dueOn: '2026-11-01' }),
    );
    const finished = await create.execute(
      admin,
      list.id,
      input({ title: 'finished', assigneeIds: ['tech1'], dueOn: '2026-11-02' }),
    );
    await complete.execute(tech, finished.todo.id);

    const open = await mine.execute(tech, { status: 'open', scope: 'mine' });
    expect(open.map((m) => [m.view.todo.title, m.bucket])).toEqual([
      ['late', 'OVERDUE'],
      ['today', 'TODAY'],
      ['next week', 'UPCOMING'],
      ['no date', 'NO_DATE'],
    ]);
    expect(open[0]).toMatchObject({
      project: { id: 'proj1', name: "Mrs Rao's project" },
      listName: 'Procurement',
    });
    expect(
      (await mine.execute(tech, { status: 'done', scope: 'mine' })).map((m) => m.view.todo.title),
    ).toEqual(['finished']);
    expect(await mine.execute(designer, { status: 'all', scope: 'mine' })).toEqual([]);

    // The Admin can ask for everyone's; nobody else gets more than their own.
    expect(
      (await mine.execute(admin, { status: 'open', scope: 'all' })).map((m) => m.view.todo.title),
    ).toContain('not mine');
    expect(await mine.execute(admin, { status: 'open', scope: 'mine' })).toEqual([]);
    expect(
      (await mine.execute(tech, { status: 'open', scope: 'all' })).map((m) => m.view.todo.title),
    ).not.toContain('not mine');

    // Removed from the project: its to-dos disappear from "my assignments".
    w.projects.members = w.projects.members.filter((m) => m !== 'tech1');
    expect(await mine.execute(tech, { status: 'all', scope: 'mine' })).toEqual([]);
  });
});

describe('overdue to-dos for the reminders module', () => {
  it('returns open to-dos past due within the look-back, with the project name', async () => {
    const { list, create, complete, overdue } = await withList();
    await create.execute(
      admin,
      list.id,
      input({ title: 'late', assigneeIds: ['tech1'], dueOn: '2026-11-05' }),
    );
    await create.execute(admin, list.id, input({ title: 'due today', dueOn: '2026-11-10' }));
    await create.execute(admin, list.id, input({ title: 'ancient', dueOn: '2026-08-01' }));
    const done = await create.execute(
      admin,
      list.id,
      input({ title: 'done late', dueOn: '2026-11-02' }),
    );
    await complete.execute(admin, done.todo.id);

    expect(await overdue.execute({ lookbackDays: 30, limit: 100 })).toEqual([
      {
        id: 'todo1',
        title: 'late',
        projectId: 'proj1',
        projectName: "Mrs Rao's project",
        dueOn: '2026-11-05',
        assigneeIds: ['tech1'],
        createdById: 'admin1',
      },
    ]);
  });
});

describe('photos on to-do comments', () => {
  it('lets a comment be just a photo, from this project only', async () => {
    const { w, list, create, comment, comments } = await withList();
    const v = await create.execute(designer, list.id, input({ assigneeIds: ['tech1'] }));
    w.sender.sent.length = 0;

    const c = await comment.execute(tech, v.todo.id, {
      images: [{ publicId: 'vastu-test/projects/proj1/site1' }],
    });
    expect(c.comment.text).toBeNull();
    expect(c.images[0]?.url).toBe('https://img.test/vastu-test/projects/proj1/site1');
    expect(w.sender.ofType('TODO_COMMENT')[0]?.alert.body).toBe('Tarun: sent a photo');
    expect((await comments.execute(designer, v.todo.id))[0]?.images).toHaveLength(1);
    await expect(
      comment.execute(tech, v.todo.id, { images: [{ publicId: 'vastu-test/projects/proj2/x' }] }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
