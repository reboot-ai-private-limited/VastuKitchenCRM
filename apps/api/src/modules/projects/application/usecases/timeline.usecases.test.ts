import { describe, expect, it } from 'vitest';
import { GetTimelineUseCase, ProjectContractUseCases } from './timeline.usecases.js';
import { admin, cust1, designer, designer2, seedProject, tech, world } from '../testing/fakes.js';

async function setup() {
  const w = world();
  const p = await seedProject(w);
  const timeline = new GetTimelineUseCase(
    w.access,
    w.posts,
    w.activities,
    w.directory,
    w.feedViews,
  );
  // Posts are one minute apart from 10:01; activities fall BETWEEN them.
  const post = (text: string, visibility: 'CLIENT' | 'TEAM') =>
    w.posts.create({
      projectId: p.id,
      authorId: 'designer1',
      visibility,
      kind: 'UPDATE',
      text,
      images: [],
    });
  const activity = (minute: string, title: string) =>
    w.activities.add({
      projectId: p.id,
      type: 'TODO_COMPLETED',
      actorId: 'tech1',
      at: new Date(`2026-11-01T10:${minute}Z`),
      data: { todoTitle: title },
    });

  await post('p1', 'CLIENT'); //            10:01:00
  await activity('01:30', 'a1');
  await post('p2 (team)', 'TEAM'); //       10:02:00
  await activity('02:30', 'a2');
  await post('p3', 'CLIENT'); //            10:03:00
  return { w, p, timeline };
}
const labels = (r: Awaited<ReturnType<GetTimelineUseCase['execute']>>) =>
  r.items.map((i) =>
    i.kind === 'POST' ? (i.post.post.text ?? '') : String(i.activity.data['todoTitle']),
  );

describe('project timeline', () => {
  it('merges posts and team activity into ONE stream, newest first', async () => {
    const { p, timeline } = await setup();
    expect(labels(await timeline.execute(designer, p.id, { limit: 20 }))).toEqual([
      'p3',
      'a2',
      'p2 (team)',
      'a1',
      'p1',
    ]);
    expect(labels(await timeline.execute(admin, p.id, { limit: 20 }))).toHaveLength(5);
  });

  it('pages with a time cursor, with no gaps or repeats across the two sources', async () => {
    const { p, timeline } = await setup();
    const first = await timeline.execute(tech, p.id, { limit: 2 });
    expect(labels(first)).toEqual(['p3', 'a2']);
    const second = await timeline.execute(tech, p.id, { limit: 2, before: first.nextCursor! });
    expect(labels(second)).toEqual(['p2 (team)', 'a1']);
    const third = await timeline.execute(tech, p.id, { limit: 2, before: second.nextCursor! });
    expect(labels(third)).toEqual(['p1']);
    expect(third.nextCursor).toBeNull();
  });

  it("gives the customer only the Client tab's posts: no team posts, no activity lines", async () => {
    const { p, timeline } = await setup();
    const r = await timeline.execute(cust1, p.id, { limit: 20 });
    expect(labels(r)).toEqual(['p3', 'p1']);
    expect(r.items.every((i) => i.kind === 'POST')).toBe(true);
  });

  it('is not found for outsiders, and refuses a malformed cursor', async () => {
    const { p, timeline } = await setup();
    await expect(timeline.execute(designer2, p.id, { limit: 20 })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      timeline.execute(admin, p.id, { limit: 20, before: 'nope' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('names the person behind each activity line', async () => {
    const { p, timeline } = await setup();
    const r = await timeline.execute(admin, p.id, { limit: 20 });
    const line = r.items.find((i) => i.kind === 'ACTIVITY');
    expect(line?.kind === 'ACTIVITY' && line.actorName).toBe('Tarun');
  });
});

describe('what the to-dos module may do to a project (public contract)', () => {
  it('knows members and the Admin, never the customer or an outsider', async () => {
    const { w, p } = await setup();
    const contract = new ProjectContractUseCases(w.access, w.projects, w.activities);
    expect((await contract.getMembership(tech, p.id)).memberIds.sort()).toEqual([
      'designer1',
      'tech1',
    ]);
    await expect(contract.getMembership(admin, p.id)).resolves.toBeDefined();
    await expect(contract.getMembership(cust1, p.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(contract.getMembership(designer2, p.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('records activity, and lists only the projects an actor may use as staff (with names)', async () => {
    const { w, p } = await setup();
    const contract = new ProjectContractUseCases(w.access, w.projects, w.activities);
    await contract.recordActivity(p.id, {
      type: 'TODO_CREATED',
      actorId: 'tech1',
      data: { todoTitle: 'x' },
    });
    expect(w.activities.rows.at(-1)).toMatchObject({ type: 'TODO_CREATED', projectId: p.id });

    expect(await contract.filterAccessible(tech, [p.id, 'nope'])).toEqual([
      { id: p.id, name: "Mrs Rao's project" },
    ]);
    expect(await contract.filterAccessible(designer2, [p.id])).toEqual([]);
    expect(await contract.filterAccessible(cust1, [p.id])).toEqual([]);
    expect(await contract.filterAccessible(admin, [p.id])).toHaveLength(1);
    expect(await contract.names([p.id])).toEqual([{ id: p.id, name: "Mrs Rao's project" }]);
  });
});
