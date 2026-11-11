import { describe, expect, it } from 'vitest';
import {
  ApprovePostUseCase,
  CreateCommentUseCase,
  CreatePostUseCase,
  DeleteCommentUseCase,
  DeletePostUseCase,
  ListCommentsUseCase,
  ListPostsUseCase,
  SignUploadUseCase,
} from './feed.usecases.js';
import {
  admin,
  cust1,
  cust2,
  designer,
  designer2,
  seedProject,
  tech,
  world,
} from '../testing/fakes.js';

function setup() {
  const w = world();
  return {
    w,
    list: new ListPostsUseCase(w.access, w.posts, w.feedViews),
    post: new CreatePostUseCase(w.access, w.posts, w.storage, w.alerts, w.directory, w.feedViews),
    del: new DeletePostUseCase(w.access, w.posts),
    approve: new ApprovePostUseCase(
      w.access,
      w.posts,
      w.alerts,
      w.directory,
      w.feedViews,
      () => new Date('2026-11-10T10:00:00Z'),
    ),
    comment: new CreateCommentUseCase(
      w.access,
      w.posts,
      w.comments,
      w.alerts,
      w.directory,
      w.feedViews,
      w.storage,
    ),
    comments: new ListCommentsUseCase(w.access, w.posts, w.comments, w.feedViews),
    delComment: new DeleteCommentUseCase(w.access, w.posts, w.comments),
    sign: new SignUploadUseCase(w.access, w.storage),
  };
}
const photo = (projectId: string, name = 'a1') => ({
  publicId: `vastu-test/projects/${projectId}/${name}`,
});
const body = (over = {}) => ({
  images: [],
  visibility: 'TEAM' as const,
  kind: 'UPDATE' as const,
  ...over,
});
const q = { limit: 20 };

describe('posting', () => {
  it('defaults to the TEAM tab, with photos, and resolves display URLs', async () => {
    const { w, post } = setup();
    const p = await seedProject(w);
    const view = await post.execute(
      designer,
      p.id,
      body({ text: 'First render', images: [photo(p.id, 'r1'), photo(p.id, 'r2')] }),
    );
    expect(view.post.visibility).toBe('TEAM');
    expect(view.images).toHaveLength(2);
    expect(view.images[0]).toMatchObject({
      url: `https://img.test/vastu-test/projects/${p.id}/r1`,
      thumbUrl: expect.stringContaining('thumb'),
    });
    expect(view.authorName).toBe('Dev');
  });

  it("accepts photos only from THIS project's folder, and ignores a repeated photo", async () => {
    const { w, post } = setup();
    const a = await seedProject(w);
    const b = await seedProject(w, { name: 'B' });
    for (const bad of [
      photo(b.id),
      { publicId: 'somewhere/else/x' },
      { publicId: `vastu-test/projects/${a.id}/../${b.id}/x` },
      { publicId: `vastu-test/projects/${a.id}/sub/x` },
    ]) {
      await expect(post.execute(designer, a.id, body({ images: [bad] }))).rejects.toMatchObject({
        statusCode: 400,
      });
    }
    const view = await post.execute(designer, a.id, body({ images: [photo(a.id), photo(a.id)] }));
    expect(view.images).toHaveLength(1);
  });

  it('lets the customer post, but only to the CLIENT tab and never as a final delivery', async () => {
    const { w, post } = setup();
    const p = await seedProject(w);
    const view = await post.execute(
      cust1,
      p.id,
      body({ text: 'I would like the island bigger', visibility: 'TEAM' }),
    );
    expect(view.post.visibility).toBe('CLIENT'); // forced, whatever they asked for
    expect(view.authorIsCustomer).toBe(true);
    await expect(
      post.execute(cust1, p.id, body({ images: [photo(p.id)], kind: 'FINAL_DELIVERY' })),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('makes a final delivery always visible to the customer', async () => {
    const { w, post } = setup();
    const p = await seedProject(w);
    const view = await post.execute(
      tech,
      p.id,
      body({ images: [photo(p.id)], kind: 'FINAL_DELIVERY', visibility: 'TEAM' }),
    );
    expect(view.post).toMatchObject({ kind: 'FINAL_DELIVERY', visibility: 'CLIENT' });
  });

  it('refuses outsiders (not found) and any post once the project is closed', async () => {
    const { w, post } = setup();
    const p = await seedProject(w);
    await expect(post.execute(designer2, p.id, body({ text: 'hi' }))).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(post.execute(cust2, p.id, body({ text: 'hi' }))).rejects.toMatchObject({
      statusCode: 404,
    });
    w.projects.rows[0]!.stage = 'CLOSED';
    await expect(post.execute(designer, p.id, body({ text: 'late' }))).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('who sees which tab', () => {
  async function feed() {
    const s = setup();
    const p = await seedProject(s.w);
    const team = await s.post.execute(
      tech,
      p.id,
      body({ text: 'Electric board is in the way', visibility: 'TEAM' }),
    );
    const client = await s.post.execute(
      designer,
      p.id,
      body({ text: 'Render v1', visibility: 'CLIENT', images: [photo(p.id)] }),
    );
    return { ...s, p, team, client };
  }

  it('shows the customer only CLIENT posts, and refuses to open the TEAM tab for them', async () => {
    const { list, p, client } = await feed();
    expect((await list.execute(cust1, p.id, q)).items.map((i) => i.post.id)).toEqual([
      client.post.id,
    ]);
    await expect(list.execute(cust1, p.id, { ...q, visibility: 'TEAM' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('shows staff both tabs (newest first) or one tab on request', async () => {
    const { list, p, team, client } = await feed();
    expect((await list.execute(designer, p.id, q)).items.map((i) => i.post.id)).toEqual([
      client.post.id,
      team.post.id,
    ]);
    expect(
      (await list.execute(admin, p.id, { ...q, visibility: 'TEAM' })).items.map((i) => i.post.id),
    ).toEqual([team.post.id]);
  });

  it('hides a TEAM post from the customer even when they know its id (comment, thread, approve, delete)', async () => {
    const { comment, comments, approve, del, p, team } = await feed();
    await expect(
      comment.execute(cust1, p.id, team.post.id, { text: 'hello' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(comments.execute(cust1, p.id, team.post.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(approve.execute(cust1, p.id, team.post.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(del.execute(cust1, p.id, team.post.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('pages with a cursor, newest first, and says when there is no more', async () => {
    const { w, post, list } = setup();
    const p = await seedProject(w);
    for (let i = 1; i <= 5; i++) await post.execute(designer, p.id, body({ text: `post ${i}` }));

    const first = await list.execute(designer, p.id, { limit: 2 });
    expect(first.items.map((i) => i.post.text)).toEqual(['post 5', 'post 4']);
    const second = await list.execute(designer, p.id, { limit: 2, before: first.nextCursor! });
    expect(second.items.map((i) => i.post.text)).toEqual(['post 3', 'post 2']);
    const last = await list.execute(designer, p.id, { limit: 2, before: second.nextCursor! });
    expect(last.items.map((i) => i.post.text)).toEqual(['post 1']);
    expect(last.nextCursor).toBeNull();
    await expect(
      list.execute(designer, p.id, { limit: 2, before: 'not-a-date' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('alerts: everyone who may see it, except the author; Admins always', () => {
  it('a CLIENT post reaches admins + members + the customer; a TEAM post never the customer', async () => {
    const { w, post } = setup();
    const p = await seedProject(w);
    await post.execute(designer, p.id, body({ text: 'Render', visibility: 'CLIENT' }));
    await post.execute(designer, p.id, body({ text: 'Internal', visibility: 'TEAM' }));
    const [clientPost, teamPost] = w.sender.ofType('PROJECT_POST');
    expect(clientPost?.userIds).toEqual(['admin1', 'admin2', 'cust1', 'tech1']); // not designer1: the author
    expect(teamPost?.userIds).toEqual(['admin1', 'admin2', 'tech1']);
    expect(clientPost?.alert.body).toBe('Dev: Render');
    expect(clientPost?.alert.ref).toMatchObject({ kind: 'PROJECT', id: p.id });
  });

  it("a customer's post and comment reach the team and the Admins, not the customer themselves", async () => {
    const { w, post, comment } = setup();
    const p = await seedProject(w);
    const v = await post.execute(cust1, p.id, body({ text: 'Can we change the colour?' }));
    await comment.execute(cust1, p.id, v.post.id, { text: 'Maybe teal' });
    for (const s of [...w.sender.ofType('PROJECT_POST'), ...w.sender.ofType('PROJECT_COMMENT')]) {
      expect(s.userIds).toEqual(['admin1', 'admin2', 'designer1', 'tech1']);
    }
  });

  it('describes a photo-only post by its photos', async () => {
    const { w, post } = setup();
    const p = await seedProject(w);
    await post.execute(designer, p.id, body({ images: [photo(p.id, 'a'), photo(p.id, 'b')] }));
    expect(w.sender.ofType('PROJECT_POST')[0]?.alert.body).toBe('Dev: sent 2 photos');
  });
});

describe('approval', () => {
  async function shared() {
    const s = setup();
    const p = await seedProject(s.w);
    const render = await s.post.execute(
      designer,
      p.id,
      body({ text: 'Render', visibility: 'CLIENT', images: [photo(p.id)] }),
    );
    return { ...s, p, render };
  }

  it("is the customer's alone, once, and announces to the team only the first time", async () => {
    const { w, approve, p, render } = await shared();
    await expect(approve.execute(designer, p.id, render.post.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(approve.execute(admin, p.id, render.post.id)).rejects.toMatchObject({
      statusCode: 403,
    });

    const first = await approve.execute(cust1, p.id, render.post.id);
    expect(first.post.approvedById).toBe('cust1');
    expect(first.canApprove).toBe(false);
    const again = await approve.execute(cust1, p.id, render.post.id);
    expect(again.post.approvedAt).toEqual(first.post.approvedAt);

    const alerts = w.sender.ofType('PROJECT_APPROVED');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.userIds).toEqual(['admin1', 'admin2', 'designer1', 'tech1']); // not the customer
    expect(alerts[0]?.alert.body).toBe("Mrs Rao approved a design in Mrs Rao's project");
  });

  it('needs a design to approve: a photo, on a CLIENT post from the team', async () => {
    const { w, post, approve, p } = await shared();
    const textOnly = await post.execute(
      designer,
      p.id,
      body({ text: 'just words', visibility: 'CLIENT' }),
    );
    const theirs = await post.execute(
      cust1,
      p.id,
      body({ text: 'my own idea', images: [photo(p.id, 'mine')] }),
    );
    await expect(approve.execute(cust1, p.id, textOnly.post.id)).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(approve.execute(cust1, p.id, theirs.post.id)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(w.sender.ofType('PROJECT_APPROVED')).toHaveLength(0);
  });

  it('only offers the Approve button to the customer, on an unapproved design', async () => {
    const { list, p, render } = await shared();
    expect((await list.execute(cust1, p.id, q)).items[0]?.canApprove).toBe(true);
    expect((await list.execute(designer, p.id, q)).items[0]?.canApprove).toBe(false);
    expect(render.canApprove).toBe(false);
  });
});

describe('comments', () => {
  it('counts them, shows the latest three oldest-first on the post, and the whole thread on request', async () => {
    const { w, post, comment, comments, list } = setup();
    const p = await seedProject(w);
    const v = await post.execute(designer, p.id, body({ text: 'Render', visibility: 'CLIENT' }));
    for (const [who, text] of [
      [cust1, 'one'],
      [designer, 'two'],
      [admin, 'three'],
      [cust1, 'four'],
    ] as const) {
      await comment.execute(who, p.id, v.post.id, { text });
    }
    const shown = (await list.execute(cust1, p.id, q)).items[0]!;
    expect(shown.post.commentCount).toBe(4);
    expect(shown.recentComments.map((c) => c.comment.text)).toEqual(['two', 'three', 'four']);
    expect(shown.recentComments.map((c) => c.authorIsCustomer)).toEqual([false, false, true]);
    expect((await comments.execute(cust1, p.id, v.post.id)).map((c) => c.comment.text)).toEqual([
      'one',
      'two',
      'three',
      'four',
    ]);
  });

  it('can be deleted by their author or an Admin only, and the count follows', async () => {
    const { w, post, comment, delComment, comments } = setup();
    const p = await seedProject(w);
    const v = await post.execute(designer, p.id, body({ text: 'Render', visibility: 'CLIENT' }));
    const mine = await comment.execute(cust1, p.id, v.post.id, { text: 'mine' });
    const theirs = await comment.execute(designer, p.id, v.post.id, { text: 'theirs' });

    await expect(
      delComment.execute(cust1, p.id, v.post.id, theirs.comment.id),
    ).rejects.toMatchObject({ statusCode: 403 });
    await delComment.execute(cust1, p.id, v.post.id, mine.comment.id);
    await delComment.execute(admin, p.id, v.post.id, theirs.comment.id);
    expect(w.posts.rows[0]?.commentCount).toBe(0);
    expect(await comments.execute(admin, p.id, v.post.id)).toEqual([]);
  });
});

describe('deleting a post', () => {
  it('is for its author or an Admin, and removes it from the feed', async () => {
    const { w, post, del, list } = setup();
    const p = await seedProject(w);
    const v = await post.execute(designer, p.id, body({ text: 'oops' }));
    await expect(del.execute(tech, p.id, v.post.id)).rejects.toMatchObject({ statusCode: 403 });
    await del.execute(designer, p.id, v.post.id);
    expect((await list.execute(admin, p.id, q)).items).toHaveLength(0);
    await expect(del.execute(admin, p.id, v.post.id)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('upload tickets', () => {
  it("are scoped to the project's own folder, for members and the customer", async () => {
    const { w, sign } = setup();
    const p = await seedProject(w);
    for (const who of [designer, tech, cust1, admin]) {
      expect((await sign.execute(who, p.id)).fields['folder']).toBe(`vastu-test/projects/${p.id}`);
    }
    await expect(sign.execute(cust2, p.id)).rejects.toMatchObject({ statusCode: 404 });
    w.projects.rows[0]!.stage = 'CLOSED';
    await expect(sign.execute(designer, p.id)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('photos on comments', () => {
  it('lets a reply be just a photo (or text and photos), shown with its URLs', async () => {
    const { w, post, comment, list } = setup();
    const p = await seedProject(w);
    const v = await post.execute(designer, p.id, body({ text: 'Render', visibility: 'CLIENT' }));
    const reply = await comment.execute(cust1, p.id, v.post.id, { images: [photo(p.id, 'c1')] });
    expect(reply.comment.text).toBeNull();
    expect(reply.images).toEqual([
      expect.objectContaining({
        url: `https://img.test/vastu-test/projects/${p.id}/c1`,
        thumbUrl: expect.stringContaining('thumb'),
      }),
    ]);
    await comment.execute(designer, p.id, v.post.id, {
      text: 'Like this?',
      images: [photo(p.id, 'c2'), photo(p.id, 'c2')],
    });
    const shown = (await list.execute(cust1, p.id, q)).items[0]!;
    expect(shown.recentComments.map((c) => [c.comment.text, c.images.length])).toEqual([
      [null, 1],
      ['Like this?', 1],
    ]); // repeat kept once
  });

  it("accepts only this project's photos, and alerts describe a photo-only comment", async () => {
    const { w, post, comment } = setup();
    const a = await seedProject(w);
    const b = await seedProject(w, { name: 'B' });
    const v = await post.execute(designer, a.id, body({ text: 'Render', visibility: 'CLIENT' }));
    await expect(
      comment.execute(cust1, a.id, v.post.id, { images: [photo(b.id)] }),
    ).rejects.toMatchObject({ statusCode: 400 });
    w.sender.sent.length = 0;
    await comment.execute(cust1, a.id, v.post.id, {
      images: [photo(a.id, 'c1'), photo(a.id, 'c2')],
    });
    expect(w.sender.ofType('PROJECT_COMMENT')[0]?.alert.body).toBe('Mrs Rao: sent 2 photos');
  });
});
