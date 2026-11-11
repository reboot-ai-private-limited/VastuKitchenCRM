# API Walkthrough (Swagger)

A guided tour of the whole backend in **Swagger UI**, following the [demo script](demo-script.md). Everything below runs against the seeded demo company, so every screen already has something in it.

## 1. Set up (2 minutes)

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # set MONGO_URI (an EMPTY database) and JWT_ACCESS_SECRET
pnpm dev:api                                # http://localhost:4000
pnpm --filter @vastu/api seed:demo          # in a second terminal
```

Open **http://localhost:4000/api/docs**. `seed:demo` fills an **empty** database (it refuses in production, and does nothing if the demo is already there). It drives the real API, so it is also a worked example of every flow. If you already created an Admin, run it with `DEMO_ADMIN_PHONE` and `DEMO_ADMIN_PASSWORD` set.

**To start over:** drop the database and run the seeder again.

## 2. The cast

All staff: password **`demo-pass-123`**. The owner: **`demo-admin-123`**.

| Who | Phone | Role | Use them to show |
|---|---|---|---|
| Owner | 9000000001 | Admin | everything: dashboard, settings, assigning, closing |
| Ravi Sharma | 9000000011 | Sales (telecaller) | the lead table, calls, alerts |
| Anil Gurung | 9000000012 | Sales (field, GPS) | visits, GPS check-in, proposals |
| Dev Mukherjee | 9000000013 | Senior designer | the render → change request → revision loop |
| Sneha Roy / Kiran Thapa | 9000000014 / 15 | Designers | the design board |
| Tarun Das / Bikash Rai | 9000000016 / 17 | Technicians | to-dos, complaints, site updates |
| Rita Ghosh | 9000000018 | Receptionist | raising a complaint |
| Hema Pal | 9000000020 | HR | attendance and salary |
| Bimal Sarkar | 9000000019 | Office boy | tracked by biometric only: **has no login** |

Customers (Mrs Rao, Mr Das, Mrs Sen) sign in by **one-time invite link**. The seeder used one invite each, so make a fresh one when you need to be the customer (step 7).

## 3. Using Swagger

1. `POST /api/identity/auth/login`: pick **`x-client: mobile`** in the header dropdown (the refresh token comes back in the body), enter phone and password, **Execute**.
2. Copy `data.accessToken`, click **Authorize** (top right), paste it, **Authorize**. Every call is now made as that person.
3. To switch person, log in again and **Authorize** with the new token. Keep the owner's token handy.

Every response has the same envelope: `success`, `statusCode`, `message`, `data`. Errors have a `code` and what to fix. What you may do depends on who you are: out-of-reach records are `404` and wrong-role actions are `403`.

## 4. The walkthrough

### 1. The owner's dashboard: *as Owner*
`GET /api/dashboard`
- **Counters:** 6 open leads, 2 running projects (1 design, 1 site), 2 complaints pending, pipeline **₹90 L**, won **₹1.5 Cr**.
- **Staff:** 3 present today (the field people checked in).
- **People:** each person's attendance, first and last activity, calls, leads handled, proposals.
- **Needs attention:** an unopened proposal (Mr Bose), a proposal opened but not acted on (Ms Chatterjee), a stagnant lead (Mr Roy), a 4-day-old complaint, an overdue to-do. Each item has a `ref` the app would open.
- **Recent customer activity:** the customers' latest comments.
- Try `?from=2026-11-01&to=2026-11-07` for a week (up to 31 days). Then log in as **Hema** and call it again: HR sees **attendance only**; money, complaints and activity are `null`.

### 2. Leads: *as Owner, then Ravi*
- `GET /api/leads`: ten leads in every pipeline state, across sources. As **Ravi** the same call returns only *his* leads.
- `POST /api/leads`: add one by hand. `POST /api/leads/import` with `{"rows":[{"name":"A","phone":"9811199999"}]}` for a CSV-style upload (bad rows and duplicates are reported, never fatal).
- `GET /api/leads/{id}/timeline`: the lead's whole story.

### 3. The sales app: *as Anil*
- `POST /api/leads/{id}/calls`: log a call from the phone's call log (`startedAt`, `durationSec`, `answered`).
- `POST /api/leads/{id}/visits`: check in a site visit with GPS coordinates.
- `GET /api/leads/call-stats` (Owner): calls per person.

### 4. A proposal and "seen" tracking: *as Anil, then as the customer*
1. `POST /api/proposals` with line items, then `POST /api/proposals/{id}/send`. The response has the public link and a ready-made **WhatsApp** (`wa.me`) link.
2. As the customer (no login): `GET /api/public/proposals/{token}` shows the page; the page then calls `POST /api/public/proposals/{token}/seen`.
3. Back as **Anil**: `GET /api/notifications`. There is a **Proposal seen** alert, and the lead's timeline logged it.
(Merely opening the link with a plain GET does *not* count as seen: chat apps pre-fetch links.)

### 5. Reminders: *as Owner*
The seeder back-dated a few records, so the alerts are already there. To make it live in front of the client:
- `PATCH /api/settings` with `{"values":{"reminders.unseenDays":0.0001}}` (days; decimals allowed).
- `POST /api/reminders/run`. Check **Ravi's** `GET /api/notifications`: *Proposal not opened yet*, *Lead needs attention*. **Anil** has *Proposal seen, no action*; **Bikash** has an overdue complaint; **Tarun** an overdue to-do.
- The settings screen (`GET /api/settings`) is how the owner tunes all of this without a developer, including the weekly off (`hr.weeklyOff`).

### 6. Won → Project: *as Owner*
`POST /api/leads/{id}/status` with `{"status":"WON"}` (try Mr Bose). Then `GET /api/projects`: a project appeared on its own, with the customer account already created. Make a customer invite with `POST /api/identity/customers/{customerId}/invite`. (Whether wins create projects automatically is itself a setting: `projects.autoCreateOnWon`.)

### 7. The project feed: *as Dev, the customer, then Owner*
Use **Rao Kitchen** (seeded). `GET /api/projects/{id}/timeline` as **Dev** shows the whole conversation.
1. Dev: `POST /api/projects/{id}/posts` with `{"text":"…","visibility":"CLIENT"}`.
2. Customer: redeem a new invite (`POST /api/identity/auth/invite/redeem`), then `POST /api/projects/{id}/posts/{postId}/comments`: "make the corner unit bigger".
3. Owner replies the same way; Dev posts the revised render.
4. Show the **Client / Team** split: the same timeline fetched as the customer has **no internal posts**, no to-do or document activity.
- **Das Residence** has the **electric-board thread**: a technician's team-only post, a designer's question, the owner's instruction, and the fix.

### 8. The design board: *as Owner or a designer*
`GET /api/projects?designerId={id}` or `?designStage=SHARED`. Move one with `PATCH /api/projects/{id}/design-stage` (`IN_DESIGN`, `SHARED`, `APPROVED`).

### 9. Complaints: *as Rita → Owner → Bikash*
Seeded on the delivered kitchen: one **assigned** (Bikash, 4 days old), one **resolved with a note and photo**. Do the whole loop live:
1. **Rita** (reception): `POST /api/complaints` with a `projectId` and description.
2. **Owner**: `POST /api/complaints/{id}/assign` with Bikash.
3. **Bikash**: `GET /api/complaints?assignedTo=me`, then `POST /api/complaints/{id}/resolve` with a note.
4. **Customer**: `…/reopen` if it is still broken. **Owner**: `…/close`.
- Show the scoping: Bikash sees only his; each response carries `can` (what *you* may do now).

### 10. HR: *as Hema*
- `GET /api/attendance/board`: today's present/absent for everyone tracked.
- **GPS:** as **Anil**, `POST /api/attendance/check-in` (the server sets the time). **Biometric** is simulated: Hema enters or corrects punches with `PUT /api/attendance/users/{userId}/days/{date}`; `POST /api/attendance/simulate` fills more days.
- `GET /api/salary/{YYYY-MM}`: the generated table. Edit one with `PATCH /api/salary/{month}/users/{userId}`, **finalize** (`POST …/finalize`) to lock the month, and download `GET …/export.csv`.
- Change the weekly off to `SUN; SAT:1,3` in Settings and regenerate to show working days follow the client's calendar.

### 11. Close the deal: *as Owner*
`POST /api/projects/{id}/close` needs a **final delivery** post (`"kind":"FINAL_DELIVERY"` with a photo). **Mrs Sen's kitchen** is seeded as delivered and closed; its lead timeline shows the whole journey (`GET /api/projects/{id}/journey`).

### Extras worth a minute
- **To-dos** (*as Tarun*): `GET /api/todos/mine`, then `POST /api/todos/{id}/complete`: whoever was set to be told when it is done gets an alert (see [to-dos](../02-product/todos.md)).
- **Docs** (*as Dev*): `GET /api/projects/{id}/files` on Rao Kitchen: folders, a client-shared quotation, a team-only drawing. **Save to Docs** (`POST …/files/from-photos`) keeps a photo from a post without re-uploading.

## 5. What this demo can't show yet
- **Real photos:** the seeded photos are placeholders. Live photo upload needs Cloudinary credentials in `apps/api/.env`; then run `pnpm --filter @vastu/api check:storage` once to confirm it works.
- **Biometric:** simulated punches only. The real device (Hikvision) is the live phase.
- **WhatsApp:** a `wa.me` link opens WhatsApp with the message ready; there is no automatic sending.
- **Screens:** this is the backend. The web admin and the mobile app come next and use exactly these calls.
