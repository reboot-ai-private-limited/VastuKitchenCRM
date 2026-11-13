/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from 'mongoose';
import { env } from '@/config/env.js';
import { buildIdentityContainer } from '@/modules/identity/identity.container.js';
import { DEMO_STOCK } from './demo-stock.js';
import { DEMO_TARGETS, targetMonths } from './demo-targets.js';

/**
 * DEMO DATA for the client demo — never for production. Fills an EMPTY database with a believable
 * company: staff, ten leads in every state, proposals, three projects with feed conversations,
 * to-dos, documents, complaints, two weeks of attendance and a salary sheet, then runs the
 * reminders so the bell and the dashboard already have things to show.
 *
 *   1. start the API (pnpm dev:api)
 *   2. pnpm --filter @vastu/api seed:demo
 *
 * It drives the REAL API over HTTP (so it doubles as a worked example of every flow) and only
 * touches the database directly to back-date a few records, so "sent 3 days ago, still unseen"
 * is true. Safe to run twice: it stops if the demo staff already exist.
 */

const API = process.env['DEMO_API_URL'] ?? `http://localhost:${env.PORT}/api`;
const STAFF_PASSWORD = 'demo-pass-123';
const OWNER = { name: 'Owner', phone: '9000000001', password: 'demo-admin-123' };
const DAY = 86_400_000;

async function call(method: string, path: string, token?: string, body?: unknown): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Client': 'mobile',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      `${method} ${path} → ${res.status} ${json.message ?? ''} ${JSON.stringify(json.data ?? '')}`,
    );
  return json.data;
}
const login = async (phone: string, password: string): Promise<string> =>
  (await call('POST', '/identity/auth/login', undefined, { phone, password })).accessToken;

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const dayOffset = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

async function main() {
  if (env.NODE_ENV === 'production') throw new Error('Demo data is never seeded in production.');
  await mongoose.connect(env.MONGO_URI);
  const { bootstrap } = buildIdentityContainer();
  await bootstrap.seedDesignations.execute();

  if ((await mongoose.model('User').exists({ phone: '9000000011' })) !== null) {
    console.warn('The demo data is already there (found Ravi, 9000000011). Nothing to do.');
    return;
  }

  // ── the owner ────────────────────────────────────────────────────────────
  let adminPhone = process.env['DEMO_ADMIN_PHONE'];
  let adminPassword = process.env['DEMO_ADMIN_PASSWORD'];
  if (!(await mongoose.model('User').exists({ role: 'ADMIN', active: true }))) {
    await bootstrap.createAdmin.execute(OWNER);
    adminPhone = OWNER.phone;
    adminPassword = OWNER.password;
    console.warn(`Created the owner account (${OWNER.phone} / ${OWNER.password}).`);
  }
  if (!adminPhone || !adminPassword)
    throw new Error(
      'An Admin already exists. Run with DEMO_ADMIN_PHONE and DEMO_ADMIN_PASSWORD set to their sign-in.',
    );
  const admin = await login(adminPhone, adminPassword);

  // ── staff ────────────────────────────────────────────────────────────────
  console.warn('Adding staff…');
  const staffDefs: Array<[string, string, string, string, 'GPS' | 'BIOMETRIC', number, boolean]> = [
    ['Ravi Sharma', '9000000011', 'SALES', 'Telecaller', 'BIOMETRIC', 18000, true],
    ['Anil Gurung', '9000000012', 'SALES', 'Field Sales Executive', 'GPS', 24000, true],
    ['Dev Mukherjee', '9000000013', 'DESIGNER', 'Senior Designer', 'BIOMETRIC', 42000, true],
    ['Sneha Roy', '9000000014', 'DESIGNER', 'Designer', 'BIOMETRIC', 30000, true],
    ['Kiran Thapa', '9000000015', 'DESIGNER', 'Designer', 'BIOMETRIC', 28000, true],
    ['Tarun Das', '9000000016', 'TECHNICIAN', 'Technician', 'GPS', 22000, true],
    ['Bikash Rai', '9000000017', 'TECHNICIAN', 'Technician', 'GPS', 20000, true],
    ['Rita Ghosh', '9000000018', 'OFFICE', 'Receptionist', 'BIOMETRIC', 16000, true],
    ['Bimal Sarkar', '9000000019', 'OFFICE', 'Office Boy', 'BIOMETRIC', 12000, false],
    ['Hema Pal', '9000000020', 'HR', 'HR Executive', 'BIOMETRIC', 32000, true],
  ];
  const id: Record<string, string> = {};
  const tok: Record<string, string> = { admin };
  for (const [name, phone, role, designation, attendanceType, fixedSalary, canLogin] of staffDefs) {
    const first = name.split(' ')[0]!;
    id[first] = (
      await call('POST', '/identity/users', admin, {
        name,
        phone,
        role,
        designation,
        attendanceType,
        fixedSalary,
        ...(canLogin ? { password: STAFF_PASSWORD } : {}),
      })
    ).id;
    if (canLogin) tok[first] = await login(phone, STAFF_PASSWORD);
  }

  // ── leads ────────────────────────────────────────────────────────────────
  console.warn('Adding leads, calls and visits…');
  const lead = async (by: string, name: string, phone: string, source: string, city: string) =>
    (await call('POST', '/leads', tok[by], { name, phone, source, city })).id as string;
  const L = {
    rao: await lead('Anil', 'Mrs Rao', '9811100001', 'WEBSITE', 'Siliguri'),
    das: await lead('Anil', 'Mr Das', '9811100002', 'FACEBOOK', 'Siliguri'),
    sen: await lead('Ravi', 'Mrs Sen', '9811100003', 'REFERRAL', 'Siliguri'),
    bose: await lead('Ravi', 'Mr Bose', '9811100004', 'JUSTDIAL', 'Jalpaiguri'),
    chatterjee: await lead('Anil', 'Ms Chatterjee', '9811100005', 'INSTAGRAM', 'Siliguri'),
    roy: await lead('Ravi', 'Mr Roy', '9811100006', 'FACEBOOK', 'Siliguri'),
    agarwal: await lead('Anil', 'Mrs Agarwal', '9811100007', 'WALK_IN', 'Siliguri'),
    gupta: await lead('Ravi', 'Mr Gupta', '9811100008', 'JUSTDIAL', 'Siliguri'),
    lama: await lead('Ravi', 'Ms Lama', '9811100009', 'WEBSITE', 'Darjeeling'),
    pradhan: await lead('Anil', 'Mr Pradhan', '9811100010', 'FACEBOOK', 'Siliguri'),
  };
  const status = (by: string, leadId: string, s: string, extra: object = {}) =>
    call('POST', `/leads/${leadId}/status`, tok[by], { status: s, ...extra });
  await status('Ravi', L.gupta, 'CONTACTED');
  await status('Ravi', L.roy, 'CONTACTED');
  await status('Ravi', L.roy, 'FOLLOW_UP', { note: 'Wants to discuss with family first' });
  await status('Anil', L.pradhan, 'LOST', { lostReason: 'Budget too low for modular' });
  await status('Anil', L.agarwal, 'VISIT');
  await call('POST', `/leads/${L.agarwal}/visits`, tok['Anil'], {
    latitude: 26.7271,
    longitude: 88.3953,
    note: 'Site measurement done, 11 ft L-shape',
  });
  const calls: Array<[string, string, number, number, boolean]> = [
    ['Ravi', L.gupta, 90 * 60_000, 140, true],
    ['Ravi', L.gupta, 30 * 60_000, 0, false],
    ['Ravi', L.bose, 3 * 3_600_000, 210, true],
    ['Ravi', L.roy, 5 * 3_600_000, 95, true],
    ['Anil', L.agarwal, 2 * 3_600_000, 320, true],
    ['Anil', L.chatterjee, 4 * 3_600_000, 180, true],
    ['Anil', L.rao, DAY + 3_600_000, 260, true],
  ];
  for (const [by, leadId, ago, durationSec, answered] of calls)
    await call('POST', `/leads/${leadId}/calls`, tok[by], {
      startedAt: iso(ago),
      durationSec,
      answered,
    });

  // ── proposals ────────────────────────────────────────────────────────────
  console.warn('Adding proposals…');
  const line = (title: string, unitPrice: number, description?: string) => ({
    title,
    quantity: 1,
    unitPrice,
    ...(description ? { description } : {}),
  });
  const proposal = async (by: string, leadId: string, title: string, items: object[]) => {
    const p = await call('POST', '/proposals', tok[by], { leadId, title, items });
    const sent = await call('POST', `/proposals/${p.id}/send`, tok[by]);
    return { id: p.id as string, token: String(sent.publicUrl).split('/').pop()! };
  };
  const P = {
    rao: await proposal('Anil', L.rao, 'L-shaped modular kitchen — Rao residence', [
      line(
        'Modular kitchen, L-shaped, premium laminate',
        3_200_000,
        'Soft-close, 18 mm BWP carcass',
      ),
      line('Hob, chimney and built-in oven', 700_000),
      line('Quartz countertop', 400_000),
      line('Civil work and installation', 200_000),
    ]),
    das: await proposal('Anil', L.das, 'Island kitchen and pantry — Das residence', [
      line('Modular kitchen with island, acrylic finish', 5_200_000),
      line('Pantry unit and tall storage', 1_400_000),
      line('Appliances package', 400_000),
      line('Civil work, electrical and installation', 500_000),
    ]),
    sen: await proposal('Ravi', L.sen, 'Parallel kitchen — Sen residence', [
      line('Modular kitchen, parallel, laminate', 2_100_000),
      line('Countertop and backsplash', 500_000),
      line('Installation', 400_000),
    ]),
    bose: await proposal('Ravi', L.bose, 'U-shaped kitchen — Bose residence', [
      line('Modular kitchen, U-shaped', 3_000_000),
      line('Appliances and installation', 800_000),
    ]),
    chatterjee: await proposal('Anil', L.chatterjee, 'Kitchen and wardrobes — Chatterjee', [
      line('Modular kitchen, L-shaped, PU finish', 3_400_000),
      line('Two wardrobes', 1_300_000),
      line('Installation', 500_000),
    ]),
  };
  // Customers open their links: the sales person is told, and the lead timeline shows it.
  for (const p of [P.rao, P.das, P.sen, P.chatterjee])
    await call('POST', `/public/proposals/${p.token}/seen`);
  await status('Anil', L.rao, 'WON');
  await status('Anil', L.das, 'WON');
  await status('Ravi', L.sen, 'WON');

  // ── projects ─────────────────────────────────────────────────────────────
  console.warn('Setting up projects…');
  await new Promise((r) => setTimeout(r, 1500)); // the won-lead events create the projects
  const all = (await call('GET', '/projects?pageSize=50', admin)).items as any[];
  const projectOf = (customer: string) => all.find((p) => p.customer.name === customer)!;
  const A = projectOf('Mrs Rao');
  const B = projectOf('Mr Das');
  const C = projectOf('Mrs Sen');
  const setup = async (
    p: any,
    name: string,
    address: string,
    value: number,
    designer: string,
    members: string[],
  ) => {
    await call('PATCH', `/projects/${p.id}`, admin, { name, siteAddress: address, value });
    await call('PUT', `/projects/${p.id}/members`, admin, {
      memberIds: members.map((m) => id[m]),
      designerId: id[designer],
    });
  };
  await setup(A, 'Rao Kitchen — Siliguri', 'Hakimpara, Siliguri', 4_500_000, 'Dev', [
    'Dev',
    'Sneha',
  ]);
  await setup(B, 'Das Residence — Pantry & Island', 'Pradhan Nagar, Siliguri', 7_500_000, 'Sneha', [
    'Sneha',
    'Tarun',
    'Bikash',
  ]);
  await setup(C, 'Sen Kitchen — Siliguri', 'Sevoke Road, Siliguri', 3_000_000, 'Kiran', [
    'Kiran',
    'Tarun',
  ]);
  await call('PATCH', `/projects/${A.id}/design-stage`, admin, { designStage: 'SHARED' });
  await call('POST', `/projects/${B.id}/stage`, admin, { stage: 'SITE' });
  await call('PATCH', `/projects/${B.id}/design-stage`, admin, { designStage: 'APPROVED' });

  const customer = async (p: any) => {
    const invite = await call('POST', `/identity/customers/${p.customer.id}/invite`, admin);
    return (await call('POST', '/identity/auth/invite/redeem', undefined, { token: invite.token }))
      .accessToken as string;
  };
  const [rao, das, sen] = [await customer(A), await customer(B), await customer(C)];

  console.warn('Writing the project conversations…');
  const post = async (token: string, p: any, text: string, extra: object = {}) =>
    (await call('POST', `/projects/${p.id}/posts`, token, { text, ...extra })).id as string;
  const comment = (token: string, p: any, postId: string, text: string) =>
    call('POST', `/projects/${p.id}/posts/${postId}/comments`, token, { text });

  // Kitchen A — the render / change-request / revision loop
  const render = await post(
    tok['Dev']!,
    A,
    'First render ready — L-shaped layout with a 7 ft run along the window wall. Tell us what you think!',
    { visibility: 'CLIENT' },
  );
  await comment(
    rao,
    A,
    render,
    'Beautiful! Can we make the corner unit bigger and change the handles to matte black?',
  );
  await comment(
    tok['admin']!,
    A,
    render,
    'Noted, Mrs Rao — Dev will share a revised render by tomorrow.',
  );
  await post(
    tok['Dev']!,
    A,
    'Revised render v2 — corner unit extended by 18 inches, matte black handles throughout.',
    { visibility: 'CLIENT' },
  );
  await post(
    tok['Dev']!,
    A,
    'Internal: confirm the quartz stock with the vendor before we promise the 4 June date.',
    { visibility: 'TEAM' },
  );

  // Kitchen B — the electric-board issue on site
  const board = await post(
    tok['Tarun']!,
    B,
    "Electric board sits exactly where the sink base goes. Board is here — it won't fit as drawn.",
    { visibility: 'TEAM' },
  );
  await comment(tok['Sneha']!, B, board, 'Can we shift the sink base to the left by one carcass?');
  await comment(
    tok['admin']!,
    B,
    board,
    'Shift the sink base 12 in to the left and have the electrician extend the wiring. Do not touch the board.',
  );
  await post(
    tok['Tarun']!,
    B,
    'Done — board untouched, sink base shifted, wiring extended. Fitting the carcass tomorrow.',
    { visibility: 'TEAM' },
  );
  await post(
    tok['Sneha']!,
    B,
    'Site update: carcass installation is complete, hob and chimney next.',
    { visibility: 'CLIENT' },
  );
  const bPost = await post(
    tok['Sneha']!,
    B,
    'Updated 3D view with the shifted sink base for your approval.',
    { visibility: 'CLIENT' },
  );
  await comment(das, B, bPost, 'Looks good to me. When will the countertop be fitted?');

  // To-dos on Kitchen B
  const list = await call('POST', `/projects/${B.id}/todo-lists`, tok['Sneha'], {
    name: 'Site work',
  });
  const todo = (title: string, assignee: string, dueOn: string, notes?: string) =>
    call('POST', `/todo-lists/${list.id}/todos`, tok['Sneha'], {
      title,
      assigneeIds: [id[assignee]],
      dueOn,
      ...(notes ? { notes } : {}),
    }) as Promise<any>;
  const done = await todo('Shift sink base and extend wiring', 'Tarun', dayOffset(-1));
  await call('POST', `/todos/${done.id}/complete`, tok['Tarun']);
  await todo('Fit hob and chimney', 'Bikash', dayOffset(2), 'Chimney duct is already on site');
  await todo(
    'Order the granite slab for the pantry',
    'Tarun',
    dayOffset(-2),
    'Vendor wants 3 days',
  );

  // Documents on Kitchen A (placeholders: upload real files in the demo)
  const quotes = await call('POST', `/projects/${A.id}/folders`, tok['Dev'], {
    name: 'Quotations',
  });
  await call('POST', `/projects/${A.id}/folders`, tok['Dev'], { name: 'Drawings' });
  const file = (folderId: string | undefined, name: string, visibility: string) =>
    call('POST', `/projects/${A.id}/files`, tok['Dev'], {
      publicId: `${env.CLOUDINARY_FOLDER}/projects/${A.id}/files/${name}.pdf`,
      format: 'pdf',
      originalName: `${name}.pdf`,
      bytes: 2_400_000,
      visibility,
      ...(folderId ? { folderId } : {}),
    });
  await file(quotes.id, 'Quotation-v1', 'CLIENT');
  await file(undefined, 'Floor-plan-measurements', 'TEAM');

  // Kitchen C — delivered and closed
  await post(
    tok['Kiran']!,
    C,
    'Handover day — your kitchen is complete. Thank you for choosing Vaastu Kitchen!',
    {
      kind: 'FINAL_DELIVERY',
      images: [{ publicId: `${env.CLOUDINARY_FOLDER}/projects/${C.id}/demo-delivery` }],
    },
  );
  await call('POST', `/projects/${C.id}/close`, admin);

  // ── complaints ───────────────────────────────────────────────────────────
  console.warn('Adding complaints…');
  const hinge = await call('POST', '/complaints', sen, {
    projectId: C.id,
    description: 'Soft-close hinge on the corner cabinet is loose and the door sags.',
    images: [{ publicId: `${env.CLOUDINARY_FOLDER}/projects/${C.id}/demo-hinge` }],
  });
  await call('POST', `/complaints/${hinge.id}/assign`, admin, { assigneeId: id['Bikash'] });
  const light = await call('POST', '/complaints', tok['Rita'], {
    projectId: C.id,
    description: 'Chimney light flickers when the exhaust runs on high.',
  });
  await call('POST', `/complaints/${light.id}/assign`, admin, { assigneeId: id['Tarun'] });
  await call('POST', `/complaints/${light.id}/resolve`, tok['Tarun'], {
    note: 'Loose neutral at the junction box — tightened and tested on all speeds.',
    images: [{ publicId: `${env.CLOUDINARY_FOLDER}/projects/${C.id}/demo-fixed` }],
  });

  // ── people: attendance and salary ────────────────────────────────────────
  console.warn('Adding attendance and a salary sheet…');
  await call('POST', '/attendance/simulate', tok['Hema'], { days: 14 });
  for (const who of ['Anil', 'Tarun', 'Bikash'])
    await call('POST', '/attendance/check-in', tok[who], {
      location: {
        lat: 26.72 + Math.random() / 100,
        lng: 88.39 + Math.random() / 100,
        accuracy: 15,
      },
    });
  await call('POST', `/salary/${new Date().toISOString().slice(0, 7)}/generate`, tok['Hema']);

  // ── monthly sales targets (this month and last, so carry-forward and progress both show) ──
  console.warn('Setting sales targets…');
  const months = targetMonths();
  for (const [first, phone] of staffDefs.map((d) => [d[0].split(' ')[0]!, d[1]] as const)) {
    const amounts = DEMO_TARGETS[phone];
    if (!amounts) continue;
    for (const [i, month] of months.entries())
      await call('PUT', `/targets/${month}/users/${id[first]}`, admin, { amount: amounts[i] });
  }

  // ── back-date a few records so the alerts are true ───────────────────────
  console.warn('Back-dating records for the alerts…');
  const db = mongoose.connection;
  const oid = (s: string) => new mongoose.Types.ObjectId(s);
  const ago = (days: number) => new Date(Date.now() - days * DAY);
  const aged = async (
    leadId: string,
    proposalId: string | null,
    sentDays: number,
    seenDays: number | null,
  ) => {
    await db
      .collection('leads')
      .updateOne({ _id: oid(leadId) }, { $set: { statusChangedAt: ago(sentDays) } });
    if (proposalId)
      await db.collection('proposals').updateOne(
        { _id: oid(proposalId) },
        {
          $set: {
            sentAt: ago(sentDays),
            ...(seenDays !== null ? { firstSeenAt: ago(seenDays), lastSeenAt: ago(seenDays) } : {}),
          },
        },
      );
  };
  await aged(L.bose, P.bose.id, 3, null); // sent 3 days ago, never opened
  await aged(L.chatterjee, P.chatterjee.id, 4, 3); // opened 3 days ago, nobody acted
  await aged(L.roy, null, 5, null); // follow-up, nothing since
  await db.collection('complaints').updateOne(
    { _id: oid(hinge.id) },
    {
      $set: {
        createdAt: ago(4),
        activeSince: ago(4),
        assignedAt: ago(4),
        'events.0.at': ago(4),
        'events.1.at': ago(4),
      },
    },
  );

  // ── let the reminders speak ──────────────────────────────────────────────
  // ── stock ────────────────────────────────────────────────────────────────
  console.warn('Adding stock…');
  for (const { moves, ...item } of DEMO_STOCK) {
    const made = await call('POST', '/stocks/items', admin, item);
    for (const [type, quantity, note] of moves)
      await call('POST', `/stocks/items/${made.id}/movements`, admin, { type, quantity, note });
  }

  const reminded = await call('POST', '/reminders/run', admin);
  console.warn('Reminders created:', JSON.stringify(reminded));

  console.warn(`
Demo data is ready.

  Sign in at POST ${API}/identity/auth/login (header X-Client: mobile).

  Owner (Admin)      ${adminPhone} / ${adminPassword}
  Ravi    — Telecaller      9000000011     Anil  — Field sales     9000000012
  Dev     — Senior Designer 9000000013     Sneha — Designer        9000000014
  Kiran   — Designer        9000000015     Tarun — Technician      9000000016
  Bikash  — Technician      9000000017     Rita  — Receptionist    9000000018
  Hema    — HR              9000000020     (all staff: ${STAFF_PASSWORD})
  Bimal   — Office boy      9000000019     (biometric only: no app login)

  Customers sign in by invite link: create one with POST /identity/customers/{id}/invite
  (Mrs Rao ${A.customer.id}, Mr Das ${B.customer.id}, Mrs Sen ${C.customer.id}).
  The seeder already used one invite each, so make a new one for the demo.

  Walkthrough: docs/demo/api-walkthrough.md
`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
