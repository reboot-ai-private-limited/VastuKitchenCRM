import { describe, expect, it } from 'vitest';
import {
  ChangeDesignStageUseCase,
  ChangeStageUseCase,
  CloseProjectUseCase,
  CreateProjectFromWonLeadUseCase,
  CreateProjectUseCase,
  GetProjectUseCase,
  ListProjectsUseCase,
  SetMembersUseCase,
} from './projects.usecases.js';
import { GetJourneyUseCase } from './feed.usecases.js';
import {
  admin,
  cust1,
  cust2,
  designer,
  designer2,
  sales1,
  seedProject,
  tech,
  world,
} from '../testing/fakes.js';

function setup() {
  const w = world();
  return {
    w,
    fromWon: new CreateProjectFromWonLeadUseCase(
      w.projects,
      w.leads,
      w.proposals,
      w.settings,
      w.alerts,
    ),
    create: new CreateProjectUseCase(
      w.projects,
      w.leads,
      w.proposals,
      w.directory,
      w.alerts,
      w.projectViews,
    ),
    list: new ListProjectsUseCase(w.projects, w.leads, w.projectViews),
    get: new GetProjectUseCase(w.access, w.projectViews),
    setMembers: new SetMembersUseCase(w.access, w.projects, w.directory, w.alerts, w.projectViews),
    designStage: new ChangeDesignStageUseCase(w.access, w.projects, w.projectViews),
    stage: new ChangeStageUseCase(w.access, w.projects, w.projectViews),
    close: new CloseProjectUseCase(
      w.access,
      w.projects,
      w.posts,
      w.leads,
      w.alerts,
      w.projectViews,
    ),
    journey: new GetJourneyUseCase(w.access, w.leads),
  };
}
const won = { leadId: 'lead1', customerId: 'cust1', name: 'Mrs Rao', byUserId: 'sales1' };

describe('creating a project when a lead is won', () => {
  it('creates it with the proposal total as value, tells the lead, and alerts every Admin', async () => {
    const { w, fromWon } = setup();
    await fromWon.execute(won);
    expect(w.projects.rows).toHaveLength(1);
    expect(w.projects.rows[0]).toMatchObject({
      name: "Mrs Rao's project",
      customerId: 'cust1',
      leadId: 'lead1',
      wonLeadId: 'lead1',
      value: 450_000,
      stage: 'DESIGN',
      designStage: 'NOT_STARTED',
    });
    expect(w.leads.events).toEqual([
      {
        leadId: 'lead1',
        type: 'PROJECT_CREATED',
        projectName: "Mrs Rao's project",
        byUserId: 'sales1',
      },
    ]);
    expect(w.sender.ofType('PROJECT_CREATED')[0]?.userIds).toEqual(['admin1', 'admin2']);
  });

  it('is idempotent: a replayed lead.won creates nothing and announces nothing', async () => {
    const { w, fromWon } = setup();
    await fromWon.execute(won);
    await fromWon.execute(won);
    expect(w.projects.rows).toHaveLength(1);
    expect(w.leads.events).toHaveLength(1);
    expect(w.sender.ofType('PROJECT_CREATED')).toHaveLength(1);
  });
});

describe('the "create automatically" setting', () => {
  it('creates nothing when switched off, and alerts every Admin instead — once per lead', async () => {
    const { w, fromWon } = setup();
    w.settings.autoCreate = false;
    await fromWon.execute(won);

    expect(w.projects.rows).toHaveLength(0);
    expect(w.leads.events).toHaveLength(0);
    const alerts = w.sender.ofType('LEAD_WON');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.userIds).toEqual(['admin1', 'admin2']);
    expect(alerts[0]?.alert).toMatchObject({
      ref: { kind: 'LEAD', id: 'lead1' },
      dedupeKey: 'lead-won-no-project:lead1',
    });
  });

  it('does not alert the Admin who marked the lead won', async () => {
    const { w, fromWon } = setup();
    w.settings.autoCreate = false;
    await fromWon.execute({ ...won, byUserId: 'admin1' });
    expect(w.sender.ofType('LEAD_WON')[0]?.userIds).toEqual(['admin2']);
  });

  it('applies from the next win: turning it back on does not create projects for earlier wins', async () => {
    const { w, fromWon } = setup();
    w.settings.autoCreate = false;
    await fromWon.execute(won);
    w.settings.autoCreate = true;
    expect(w.projects.rows).toHaveLength(0); // nothing back-filled
    await fromWon.execute({ ...won, leadId: 'lead2', name: 'Mr Das', customerId: 'cust2' });
    expect(w.projects.rows).toHaveLength(1);
    expect(w.projects.rows[0]?.wonLeadId).toBe('lead2');
  });
});

describe('creating a project by hand', () => {
  it('lets a customer have many projects', async () => {
    const { w, create } = setup();
    await create.execute(admin, { customerId: 'cust1', name: 'Kitchen' });
    await create.execute(admin, { customerId: 'cust1', name: 'Wardrobes' });
    expect(w.projects.rows.filter((p) => p.customerId === 'cust1')).toHaveLength(2);
    expect(w.projects.rows.every((p) => p.leadId === null && p.wonLeadId === null)).toBe(true);
  });

  it('from a lead: finds the customer, links the lead, seeds the value, logs it — and can sit beside the auto project', async () => {
    const { w, create, fromWon } = setup();
    await fromWon.execute(won);
    const view = await create.execute(admin, { leadId: 'lead1', name: 'Extra: wardrobes' });
    expect(view.project).toMatchObject({
      customerId: 'cust1',
      leadId: 'lead1',
      wonLeadId: null,
      value: 450_000,
    });
    expect(w.projects.rows).toHaveLength(2);
    expect(w.leads.events).toHaveLength(2);
  });

  it('refuses a customerId that is not an active customer', async () => {
    const { create } = setup();
    await expect(
      create.execute(admin, { customerId: 'designer1', name: 'x' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(create.execute(admin, { customerId: 'nobody', name: 'x' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('an explicit value wins over the proposal total', async () => {
    const { create } = setup();
    expect(
      (await create.execute(admin, { leadId: 'lead1', name: 'x', value: 5 })).project.value,
    ).toBe(5);
  });
});

describe('members and stages', () => {
  it('adds only active staff, never a customer; the designer becomes a member; only NEW members are alerted', async () => {
    const { w, setMembers } = setup();
    const p = await seedProject(w, { memberIds: [], designerId: null });

    await expect(
      setMembers.execute(admin, p.id, { memberIds: ['cust1'], designerId: null }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      setMembers.execute(admin, p.id, { memberIds: ['gone1'], designerId: null }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await setMembers.execute(admin, p.id, { memberIds: ['tech1'], designerId: 'designer1' });
    expect(w.projects.rows[0]?.memberIds.sort()).toEqual(['designer1', 'tech1']);
    expect(w.sender.ofType('PROJECT_ASSIGNED')[0]?.userIds).toEqual(['designer1', 'tech1']);

    await setMembers.execute(admin, p.id, {
      memberIds: ['tech1', 'office1'],
      designerId: 'designer1',
    });
    expect(w.sender.ofType('PROJECT_ASSIGNED')[1]?.userIds).toEqual(['office1']); // not the two already in
  });

  it("lets the Admin or the project's own designer set the design stage, nobody else", async () => {
    const { w, designStage } = setup();
    const p = await seedProject(w);
    await expect(designStage.execute(designer, p.id, 'IN_DESIGN')).resolves.toBeDefined();
    await expect(designStage.execute(admin, p.id, 'SHARED')).resolves.toBeDefined();
    await expect(designStage.execute(tech, p.id, 'APPROVED')).rejects.toMatchObject({
      statusCode: 403,
    }); // a member, not the designer
    await expect(designStage.execute(designer2, p.id, 'APPROVED')).rejects.toMatchObject({
      statusCode: 404,
    }); // not even a member
    expect(w.projects.rows[0]?.designStage).toBe('SHARED');
  });
});

describe('who can see a project', () => {
  it('hides it from outsiders as not found, but shows members, the customer and the Admin', async () => {
    const { w, get } = setup();
    const p = await seedProject(w, { leadId: null });
    for (const who of [admin, designer, tech, cust1])
      await expect(get.execute(who, p.id)).resolves.toBeDefined();
    for (const who of [designer2, cust2, sales1])
      await expect(get.execute(who, p.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("gives the lead's owner a summary (and the journey) without membership", async () => {
    const { w, get, journey } = setup();
    const p = await seedProject(w); // lead1 belongs to sales1
    await expect(get.execute(sales1, p.id)).resolves.toBeDefined();
    const entries = await journey.execute(sales1, p.id);
    expect(entries.map((e) => e.type)).toEqual(['CREATED', 'STATUS_CHANGED']); // oldest first
    // A designer is a member but does not own the lead: the journey is NOT theirs to read.
    await expect(journey.execute(designer, p.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(journey.execute(admin, p.id)).resolves.toHaveLength(2);
  });

  it('has an empty journey for a project with no lead (a repeat customer)', async () => {
    const { w, journey } = setup();
    const p = await seedProject(w, { leadId: null });
    await expect(journey.execute(admin, p.id)).resolves.toEqual([]);
  });

  it("lists: Admin everything, others only their own projects, and a lead's projects for whoever owns the lead", async () => {
    const { w, list } = setup();
    await seedProject(w, { name: 'A' });
    await seedProject(w, {
      name: 'B',
      customerId: 'cust2',
      leadId: null,
      memberIds: [],
      designerId: null,
    });
    const q = { page: 1, pageSize: 20 };

    expect((await list.execute(admin, q)).total).toBe(2);
    expect((await list.execute(cust1, q)).items.map((v) => v.project.name)).toEqual(['A']);
    expect((await list.execute(tech, q)).items.map((v) => v.project.name)).toEqual(['A']);
    expect((await list.execute(designer2, q)).total).toBe(0);
    expect((await list.execute(sales1, q)).total).toBe(0); // no general list for Sales…
    expect(
      (await list.execute(sales1, { ...q, leadId: 'lead1' })).items.map((v) => v.project.name),
    ).toEqual(['A']); // …but their lead's projects
    expect((await list.execute(designer2, { ...q, leadId: 'lead1' })).total).toBe(0);
  });
});

describe('closing', () => {
  it('needs a Final Delivery post, then closes, tells the lead and alerts everyone (customer included)', async () => {
    const { w, close } = setup();
    const p = await seedProject(w);
    await expect(close.execute(admin, p.id)).rejects.toMatchObject({ statusCode: 409 });

    await w.posts.create({
      projectId: p.id,
      authorId: 'tech1',
      visibility: 'CLIENT',
      kind: 'FINAL_DELIVERY',
      text: null,
      images: [{ publicId: 'x', width: null, height: null, bytes: null }],
    });
    const view = await close.execute(admin, p.id);
    expect(view.project.stage).toBe('CLOSED');
    expect(view.project.closedAt).not.toBeNull();
    expect(w.leads.events.at(-1)).toMatchObject({ type: 'PROJECT_CLOSED', leadId: 'lead1' });
    expect(w.sender.ofType('PROJECT_CLOSED')[0]?.userIds).toEqual([
      'admin2',
      'cust1',
      'designer1',
      'tech1',
    ]); // not the closer
    await expect(close.execute(admin, p.id)).rejects.toMatchObject({ statusCode: 409 }); // already closed
  });

  it('reopens through the stage endpoint, clearing closedAt', async () => {
    const { w, stage } = setup();
    const p = await seedProject(w, { stage: 'CLOSED', closedAt: new Date() });
    const view = await stage.execute(admin, p.id, 'SITE');
    expect(view.project).toMatchObject({ stage: 'SITE', closedAt: null });
  });
});
