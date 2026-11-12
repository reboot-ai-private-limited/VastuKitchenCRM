# Mobile inventory: People and Overview (attendance, employees, salary, dashboard, notifications, reminders)

Scope: web features under `apps/web/components/{hr,dashboard,notifications,shell}`, `apps/web/app/(app)/{attendance,employees,salary,notifications,page.tsx}`, API modules `hr`, `dashboard`, `notifications`, `reminders` (+ `identity` users/designations, `leads` calls/visits as attendance neighbours), and contracts `hr.ts`, `dashboard.ts`, `notifications.ts`. Written 2026-11-12 from the code. Claims not confirmed by reading code or running it are marked UNVERIFIED. Verdicts: INCLUDE / ADAPT / EXCLUDE / LATER.

Sources: `docs/02-product/hr.md`, `docs/03-architecture/notifications-and-cron.md`, `docs/adr/0005-call-log-tracking.md`, `apps/api/src/modules/hr/interface/hr.route.ts`, `.../hr/application/usecases/attendance.usecases.ts`, `.../hr/infrastructure/{hr.schemas,mongoHr.adapters}.ts`.

---
## 0. Headline findings

1. **Check-in/out API exists and is mobile-ready, but the server clock is the only clock.** `POST /api/attendance/check-in|check-out` ignore any client time. There is no way to submit an offline punch with its real time. A phone that queues a check-in while offline and replays it hours later will record the replay time. This is the main design gap.
2. **No push channel exists.** No FCM/Expo token storage, no device registration endpoint, no `PushSender` code (grep for fcm/firebase/pushToken/PushSender hits only docs). The doc says "a `PushSender` port ... slots in"; the port is not implemented. Notifications are in-app rows polled every 30 s.
3. **Only GPS-tracked, active staff can check in.** Others get 403. The owner account has `attendanceType: null` (bootstrap), so `/attendance/me` returns 404 for the owner; the phone must treat 404 as "no attendance for you" (a normal state, not an error).
4. **GPS check-in captures a point only.** `location {lat, lng, accuracy?}` is optional, stored on `inLocation`/`outLocation`, no geofence, no validation of distance, no photo, no device id, no mock-location flag. Location is optional, so a phone that denies permission can still check in.
5. **Dashboard is Admin/HR only and is one fat call** (`GET /api/dashboard`). On a phone an Admin cares about: attention list, pending complaints, staff present, open leads, pipeline. Per-person activity table is a poor fit.
6. **Contract/DB mismatch bug (code-evident, runtime UNVERIFIED):** `notificationRefSchema` has `fileId`, but the Mongoose `ref` sub-schema and `toEntity` mapper in the notifications module have no `fileId`; docs alerts put `fileId` in `ref`, so it is very likely silently dropped and the web `?file=` deep link cannot work. A phone deep link to a file would be affected. Needs a backend fix (add `fileId` to schema + mapper).

---
## 1. Role and access matrix (as enforced by the API)

| Feature | ADMIN | HR | SALES / DESIGNER / TECHNICIAN / OFFICE | CUSTOMER |
|---|---|---|---|---|
| Check-in/out (`POST /attendance/check-in|check-out`) | only if `attendanceType=GPS` and active | same | same (typical field staff) | no (no attendance type) |
| `GET /attendance/me` | only if on attendance | only if on attendance | yes if on attendance (404 otherwise) | 404 |
| `GET /attendance/users/:id` | any | any | only own id; other ids give 404 | 404 |
| `GET /attendance/board`, PUT/DELETE day, `/simulate` | yes | yes | 403 | 403 |
| Employees (`/identity/users*`) | yes, any role | yes, create limited to sales/designer/technician/office | 403 | 403 |
| Designations list | yes | yes | any staff (list) | n/a UNVERIFIED |
| Designations create/rename | yes | yes | 403 | 403 |
| Salary `/salary/*` | yes | yes | 403 | 403 |
| Dashboard `GET /dashboard` | all blocks | only `staff` and per-person attendance; rest `null` | 403 | 403 |
| Notifications `/notifications*` | own | own | own | own (customers have them too) |
| `POST /reminders/run` | yes | 403 | 403 | 403 |

Cites: `hr.route.ts` (`hr = requireRole('ADMIN','HR')`, salary router `requireRole('ADMIN','HR')`), `dashboard.route.ts`, `notifications.route.ts` ("Every signed-in user ... no role gate"), `reminders.route.ts`, `attendance.usecases.ts` (`UserMonthUseCase`: non-HR viewing another id gives not found), `users.route.ts` ("Create a staff account (Admin: any role; HR: sales, designer, technician, office)").

Web nav (`apps/web/lib/nav.ts`): Attendance for ADMIN, HR, SALES, DESIGNER, TECHNICIAN, OFFICE; Employees and Salary for ADMIN, HR; Dashboard for ADMIN, HR. Landing: ADMIN/HR `/`, SALES `/leads`, TECHNICIAN `/complaints`, others `/projects`. Web nav is cosmetic; the API is the gate. The web shows an app hint "Check in and out from the Vaastu app on your phone" to GPS people (`attendance-month.tsx` `showAppHint`).

**Who is GPS-tracked:** decided per employee by `attendanceType` (`GPS` | `BIOMETRIC`, `ATTENDANCE_TYPES` in `identity.ts`), set when an Admin/HR creates/edits the employee. Not tied to role. `mustBeGpsStaff` requires an existing, active, `GPS` user (403 "Your account is not active." / "Your attendance is recorded by the biometric device."). Biometric people can log in (if they have a password) but cannot check in from the phone. The user DTO exposes `attendanceType` (null for customers/owner), so the phone can decide whether to show the check-in button from `GET /auth/me` alone, no extra call.

---
## 2. Attendance

### 2.1 Check-in / check-out (the phone-only feature)

- **Purpose:** field staff record start/end of the working day with a location.
- **Web:** none (web is read-only and tells GPS users to use the app). Mobile feature per `docs/02-product/hr.md`.
- **Roles:** any active GPS-tracked user (including Admin/HR if set to GPS).
- **Calls:**
  - `POST /api/attendance/check-in`, body `CheckInBodyDto = { location?: { lat: -90..90, lng: -180..180, accuracy?: >=0 metres } }`. Response 200 `AttendanceDayDto` (today's day). Errors: 403 not active / not GPS; 400 validation.
  - `POST /api/attendance/check-out`, same body. 200 `AttendanceDayDto`. 409 "Check in first." if no record for today.
  - Button state: `GET /api/attendance/me?month=YYYY-MM` (default this month), find today's entry in `days` (the route doc says exactly this).
- **Response shape (`AttendanceDayDto`):** `date, status (PRESENT|ABSENT|OFF|FUTURE), offDay, inAt, outAt (ISO|null), method (GPS|BIOMETRIC_SIM|MANUAL|null), inLocation, outLocation, missingOut, corrected, note`.
- **Server behaviour (`CheckInUseCase`, `mongoHr.adapters.ts`):**
  - Time: `now = clock.now()` on the server; business date from the business timezone (default Asia/Kolkata). The body has no time field; unknown keys are not an input.
  - Idempotency: check-in is an upsert on unique index `(userId, date)` with `$setOnInsert`; a repeat returns the existing record with the FIRST inAt and FIRST location (200, not 201, and no signal that it was a repeat in the response). Concurrent taps: duplicate-key is caught and the existing doc returned. There is no `Idempotency-Key` header.
  - Check-out: `$set outAt, outLocation` every call, so the **last check-out wins** and overwrites location. Needs a record for (user, today) else 409.
  - Method: `GPS`. If an Admin/HR later corrects the day (`PUT`), `corrected=true` with note; the `method` of an existing record is kept.
  - Check-in after Admin pre-entered a MANUAL day today returns the existing record (the phone cannot override).
  - Business day boundary: the date is derived from the server instant in the business tz. A check-out at 00:30 after a late shift belongs to the NEW day and returns 409 (no check-in that day) while yesterday stays missingOut. UNVERIFIED by test; follows from `clock.dateOf(now)` in `CheckOutUseCase`.
- **Location fields:** `lat, lng, accuracy` only. Stored as `inLocation` / `outLocation`. Web shows only the check-in location as a Google Maps link (`attendance-month.tsx` ~l.257-264). Not exposed: altitude, provider, mock flag, timestamp of the GPS fix, device id, address.
- **States:** not checked in (button "Check in"); checked in (shows inAt, "Check out" enabled); checked out (outAt; may check out again and overwrite); off day (still allowed; "Working on a day off still counts as present"); not GPS-tracked (hide the button, show hint); inactive (403); offline (see below); location denied (allowed, send without `location`).
- **What changes on a phone:** it is the primary screen for field roles. Needs: foreground location permission (`expo-location`), a high-accuracy single fix with timeout and fallback, confirm sheet showing server time after the response, haptic/success state, disable button while in flight, refetch `/attendance/me` on app foreground, local notification/reminder "check out?" (client-only; the server has no check-out reminder).
- **Offline check-in design (client time vs server time):**
  - Today the server stamps arrival time. An offline punch replayed later records the replay time, which is wrong payroll data. Neither a `clientTime` nor `capturedAt` field exists in `checkInBodySchema`, and `setDayBodySchema` (the only way to set a time) is Admin/HR-only and requires `inAt` on that date.
  - What the phone can do now: queue the request, replay when online, show "pending sync" and the local capture time, but be explicit that the official time is the sync time. Because check-in is idempotent (first wins) it is safe to retry blindly.
  - Needed API change (gap G1): accept an optional `capturedAt` (ISO) on check-in/out, validated against server time (same business date, not in the future, bounded skew/age e.g. 12 h), stored alongside `receivedAt`, and flagged (e.g. `method` stays GPS, add `clientCaptured: true`). Phone also needs a monotonic-clock guard: users can change device time; send both device time and the elapsed-since-boot offset or rely on server validation. A decision for the product owner, not made yet.
  - Check-out offline has the same issue; additionally replay order matters (check-in must be applied before check-out, else 409), so the queue must be ordered per user.
- **Verdict: INCLUDE** (core, GPS staff). Online path is complete; offline path ADAPT behind gap G1.

### 2.2 My attendance (own month calendar)

- **Purpose:** the signed-in person sees their month.
- **Web:** `AttendanceMonth userId=null` (`attendance-month.tsx`), "My attendance", month stepper (cannot go past current month), calendar grid, selected-day panel with times, method, corrected flag, note, check-in location link.
- **Roles:** any user who is on attendance (`attendanceType != null`). Admin/HR with a type see their own via `/me` too, but the web sends them to the board; they reach their own month via the board row.
- **Data:** `AttendanceMonthDto { userId, name, month, workingDays, presentDays, missingOutDays, days: AttendanceDayDto[] }` (one entry per calendar day, weekly off computed from the `hr.weeklyOff` setting).
- **Calls:** `GET /api/attendance/me?month=YYYY-MM`; or `GET /api/attendance/users/:ownId?month=` (equivalent for self).
- **States:** loading skeleton; 404 `No attendance for you.` (owner/customer/no type) shows NotFound in web, should be "Attendance not tracked for your account" on phone; error with retry; placeholder data while changing month (keepPreviousData).
- **What changes on a phone:** merge with the check-in screen (today card on top, month below); native calendar-like grid with colours (present green, absent red, off grey; `missingOut` badge); tap a day for a bottom sheet; tap location to open Maps (`Linking`). Cache current month for offline view.
- **Phone-only:** home-screen widget / quick action, local reminders, optional map thumbnail.
- **Gaps:** there is no summary-only or date-range endpoint (always a whole month with every day); no timestamp of last sync. Acceptable.
- **Verdict: INCLUDE** (ADAPT: merged with check-in).

### 2.3 Day board (Admin/HR)

- **Purpose:** everyone's attendance for a date with present/absent/missing-out counts.
- **Web:** `attendance-board.tsx`; refetches every 60 s (`useBoard`).
- **Roles:** ADMIN, HR (`requireRole('ADMIN','HR')`, 403 otherwise).
- **Calls:** `GET /api/attendance/board?date=YYYY-MM-DD` returns `BoardDto { date, offDay, counts{present,absent,missingOut}, items[{userId,name,designation,attendanceType,day}] }`. Only active people with an attendance type. No pagination (all staff).
- **Actions:** tap a person to open their month (`?userId=`); "Simulate" demo data is a button on the web (`POST /attendance/simulate`, EXCLUDE from mobile).
- **What changes on a phone:** a list with status chips and a date stepper; filter chips (All / Absent / Missing out). Pull to refresh instead of 60 s polling (or poll while focused).
- **Phone-only:** tap-to-call the absent person (`tel:` is not in the board DTO; needs the employee phone from `/identity/users`, gap), push "N people not in by 10:30" (needs push).
- **Verdict: ADAPT** for Admin/HR (a lightweight list; the owner checks on the go).

### 2.4 Person month with corrections (Admin/HR)

- **Purpose:** view anyone's month and fix a day.
- **Web:** `AttendanceMonth userId=X canEdit`, `correct-day-dialog.tsx` (fields In, Out optional, Reason; "Correct this day" / "Enter attendance"), remove day.
- **Calls:** `GET /api/attendance/users/:userId?month=`; `PUT /api/attendance/users/:userId/days/:date` body `SetDayBodyDto { inAt: ISO with offset, outAt?: ISO|null, note?: 1..200 }` returns `AttendanceDayDto`; `DELETE /api/attendance/users/:userId/days/:date`.
- **Rules (`SetDayUseCase`):** 404 if the person is not on attendance; 400 if date in the future; `inAt`/`outAt` must fall on that business date; out not before in; an existing day is marked `corrected` with who/when; method set to `MANUAL` for GPS people, `BIOMETRIC_SIM` otherwise (kept on existing). `outAt: null` clears out.
- **What changes on a phone:** time pickers (native) combined with the date; must send ISO with offset in the business tz (Asia/Kolkata +05:30), not the device tz, or the date check fails when the phone is elsewhere. Reason required UX (API treats note as optional but web asks).
- **Verdict: ADAPT** (small bottom sheet; Admin/HR only). Lower priority than the board.

### 2.5 Simulate attendance

`POST /api/attendance/simulate {days 1..60}` demo data. **EXCLUDE** (admin demo tool).

### 2.6 Attendance neighbours on leads: calls and visits

- **Call log:** `POST /api/leads/:id/calls` (Admin, Sales) body `RecordCallBodyDto { startedAt (coerce date), durationSec 0..14400, answered, outcome?, note? }`; 201 new, 200 if already recorded; idempotent on (lead, user, startedAt); first call on a NEW lead moves it to CONTACTED. `GET /api/leads/:id/calls`. `GET /api/leads/call-stats?from&to` (Admin) returns per-user calls/answered/talk seconds. ADR-0005: open the dialer, on return read Android `READ_CALL_LOG`, match number/time/duration, ask outcome + note; sideloaded APK; Android only; fallback manual entry. Note the contrast: **calls carry client time (`startedAt`), attendance does not.** Dashboard "People" shows these call counts.
- **Visits:** `POST /api/leads/:id/visits` (Admin, Sales) body `RecordVisitBodyDto { at? (default now), latitude, longitude, note?, photoUrl? }` returns `VisitDto`; `GET /api/leads/:id/visits`. A GPS check-in at a customer site. `at` is client-supplied (here the phone CAN set the time), unlike attendance. No idempotency key on visits (retry could duplicate; UNVERIFIED in the use case).
- These belong to the leads inventory; flagged here as neighbours. A visit does not create or update an attendance record (no link).
- **Verdict:** calls INCLUDE (Android, ADR-0005, in leads area); visits INCLUDE; note the offline-replay duplicate risk for visits.

---
## 3. Employees and designations

### 3.1 Employee list

- **Purpose:** staff directory; Admin/HR manage accounts.
- **Web:** `employees-view.tsx` (search, role filter, active filter, 20 per page).
- **Roles:** ADMIN, HR (`RoleGate` + API `requireRole('ADMIN','HR')` on all of `/identity/users`).
- **Calls:** `GET /api/identity/users?page&pageSize<=100&search&role&active` returns `Paginated<UserDto>`. `UserDto: id, name, phone, role, designation, attendanceType (null for customers), fixedSalary? (ADMIN/HR only), active, canLogin, createdAt`.
- **States:** loading, empty, filtered-empty, error.
- **Phone:** a read-only directory with tap-to-call/WhatsApp. Note `fixedSalary` is returned in the list, so the list must not be shown over a shoulder or cached unencrypted.
- **Gap:** non-HR staff (e.g. designers wanting a colleague's number) have no directory endpoint (`/identity/users` is Admin/HR). A "team directory" would need a minimal public-fields endpoint.
- **Verdict: ADAPT** (read-only list for Admin/HR; decision says employee/salary EDITING is excluded).

### 3.2 Add / edit employee, deactivate, password

- **Calls:** `POST /api/identity/users` body `CreateUserBodyDto { name, phone, role (STAFF_ROLES), designation (must be an ACTIVE designation), attendanceType, fixedSalary default 0, password? }`; `GET /api/identity/users/:id`; `PATCH /api/identity/users/:id` `UpdateUserBodyDto` (name, role, designation, attendanceType, fixedSalary, active; at least one field); `PUT /api/identity/users/:id/password` `SetUserPasswordBodyDto`. HR cannot create/edit Admins (policy in use cases, UNVERIFIED in detail).
- **Verdict: EXCLUDE** (product decision: employee/salary editing is not in the mobile app). One possible LATER: toggle `active` (deactivate a leaver) from the phone, since it is the sole urgent action; this edits only `active`.

### 3.3 Designations

- **Calls:** `GET /api/identity/designations?includeInactive`, `POST /api/identity/designations`, `PATCH /api/identity/designations/:id` (rename and/or active; a rename updates holders).
- **Verdict: EXCLUDE** (master-data admin). Phone needs only read to display text (already in `UserDto.designation`).

---
## 4. Salary (Admin/HR only)

- **Purpose:** month payroll sheet from attendance: `payable = fixedSalary * min(present, working) / working`, rupees. No deductions.
- **Calls:** `GET /api/salary/:month` returns `SalarySheetDto { month, generated, weeklyOff, workingDays, finalizedAt, rows[{userId,name,designation,fixedSalary,presentDays,workingDays,computedPayable,payable,edited,note}], totals }`; `POST /api/salary/:month/generate` (400 not started, 409 finalized); `PATCH /api/salary/:month/users/:userId` `{payable, note?}` (409 finalized); `POST /api/salary/:month/finalize` (409 not generated/already finalized); `GET /api/salary/:month/export.csv`.
- **States:** not generated; generated; finalized (locked, badge); empty payroll; errors 400/409.
- **Web:** `salary-view.tsx` with month stepper, Generate / Finalize / Export CSV buttons, edit dialog.
- **Phone:** the owner may want a glance at "this month payable total" and per-person amounts. Finalizing is an irreversible money action: a mobile tap risk (confirm sheet).
- **Verdict:** sheet read-only view **LATER** (low value on phone; fits "owner glance"); generate/edit/finalize/CSV **EXCLUDE** per decision (CSV export would need the share sheet; defer).

---
## 5. Dashboard (Admin and HR)

- **Purpose:** the owner's overview, worked out live (nothing stored).
- **Call:** `GET /api/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` (inclusive business dates, default today, max 31 days, 400 otherwise) returns `DashboardDto { range, generatedAt, counters|null, staff|null, people|null, attention|null, recent|null, errors[] }`. A block that failed is `null` and named in `errors` (partial render). 403 for non-Admin/HR. Web polls every 60 s (`useDashboard`).
- **HR:** only `staff` and `people[].attendance` (`activity` is null); web renders "Staff present today" + attendance table.
- **Blocks:**
  - `counters`: `leads {open, byStatus, newInRange}`, `projects {design, site, running}`, `complaints {…counts, pending}`, `value {pipeline, wonInRange, pipelineCapped}`. Web cards: Open leads, Running projects, Complaints pending, Staff present today, Pipeline, Won in period, New leads in period. Cards link to /leads, /projects, /complaints, /attendance.
  - `staff`: `{date, offDay, tracked, present, absent}` (always today).
  - `attention`: 5 blocks `unseenProposals, noActionProposals, stagnantLeads, overdueComplaints, overdueTodos`, each `{total, capped(at 50), items[oldest 10: title, detail, since, ref]}`; uses the same Admin-editable day thresholds as the reminders. Items deep link via `refHref(ref)`.
  - `people[]`: per employee `attendance {daysPresent, inAt, outAt}` and `activity {firstAt,lastAt,calls,answeredCalls,talkSeconds,leadsHandled,proposalsGenerated,proposalsSent,posts,comments}`; sortable table on the web (`people.tsx`).
  - `recent[]`: customer activity `{kind POST|COMMENT|APPROVAL, at, projectId, projectName, postId, authorName, snippet, hasPhotos}`.
- **Range picker:** `range-picker.tsx`, range kept in the URL query (`/?from&to`).
- **What matters on a phone for an Admin (proposed order):**
  1. `attention` (all 5 blocks): the actionable list, with deep links. Top priority.
  2. `staff` present/absent today (one number; tap to open board).
  3. `counters.complaints.pending` and `counters.leads.open` / `newInRange`.
  4. `counters.value.pipeline` and `wonInRange` as two short-INR figures (`formatINRShort`).
  5. `recent` customer activity (short list, last 5).
  6. `projects.running`.
  Skip on phone: per-person sortable `people` activity table (wide, 10 columns) other than as a per-person drill-down; `byStatus` map.
- **Phone-only:** pull-to-refresh, last-updated timestamp from `generatedAt`, badge in the app icon (needs push), widget with "present / tracked" and pending complaints.
- **Perf note:** single request computes everything for every staff member; on mobile data the `people` and `recent` blocks cost payload. Gap G7: no way to request only some blocks (`DASHBOARD_BLOCKS` exists in the contract but there is no `blocks=` query param on the route; `dashboardQuerySchema` has only `from`/`to`).
- **Verdict: ADAPT** (Admin: summary-first; HR: attendance-only view = same as the day board plus `staff` card).

---
## 6. Notifications

### 6.1 Model (contract + storage)

- `NotificationDto`: `id, type, title, body, ref: {kind, id, postId?, projectId?, fileId?}|null, readAt: ISO|null, createdAt`.
- Storage (`notification.schema.ts`): `userId, type, title, body, ref, dedupeKey, readAt, createdAt` (no updatedAt). Indexes: `(userId, createdAt desc)`, `(userId, readAt)`, unique partial `(userId, dedupeKey)` for idempotent reminders, **TTL index: documents deleted 30 days after creation.** So read history on the phone is at most 30 days.
- **Read state:** per-notification `readAt`; unread = `readAt == null`.
- **Ref kinds:** `LEAD | PROPOSAL | PROJECT | TODO | COMPLAINT`. No ref kind for attendance, salary, employees, or for `FILE` (file is a `fileId` extra on a PROJECT ref).
- **Fetch (web):** `GET /api/notifications?page&pageSize(<=100, default 20)&unread=true|false` returns `Paginated<NotificationDto>` newest first (stable sort `createdAt desc, _id desc`); `GET /api/notifications/unread-count` returns `{count}` (web polls every 30 s: `useUnreadCount refetchInterval: 30_000`, and the bell list fetch is lazy when the popover opens); `POST /api/notifications/:id/read` (404 if not yours); `POST /api/notifications/read-all` returns `{marked}`. Pagination is page-number based, so with new items arriving while paging, items can shift (duplicates across pages); a cursor (`before=`/`since=`) is a gap G4.
- **Push channel: DOES NOT EXIST.** Facts: no `PushSender` or FCM/Expo code in `apps/api/src`; no device/push token field on users or any collection; no endpoint to register/unregister a token; `notifications.public.ts` exposes only `notify()` (writes a row and returns `{created}`); `docs/03-architecture/notifications-and-cron.md` says push (FCM) "comes with the mobile app (needs a Firebase project)" and expects a `PushSender` port in the notifications module. The only delivery is the stored row + client polling. `NotifyUseCase` is the single choke point where a push send would hook in (every module's alerts funnel through `notifications.contract.notify`), so adding push touches only the notifications module.
- **Other delivery channels:** none (no email, SMS). WhatsApp is used for proposal links and OTP login codes, not notifications.

### 6.2 Notification types, recipients and deep-link targets

Web mapping (`apps/web/lib/notifications.ts` `refHref`): LEAD to `/leads/:id`; PROPOSAL to `/proposals/:id`; PROJECT to `/projects/:id?post=<postId>&file=<fileId>&tab=docs`; TODO with `projectId` to `/projects/:projectId?tab=todos&todo=:id` else `/todos`; COMPLAINT to `/complaints/:id`; null ref or unknown goes to `/`. Group icon by type prefix (`groupOf`: PROPOSAL_, PROJECT_, TODO_, FILE_, COMPLAINT_, else lead).

| Type | Ref | Recipient | Source |
|---|---|---|---|
| `PROPOSAL_SEEN` | PROPOSAL id | person who sent it (first open of public link) | `subscribers.ts`, dedupe `proposal-seen:<id>` |
| `PROPOSAL_UNSEEN` | LEAD or PROPOSAL (UNVERIFIED which) | lead's assignee, else sender, else all Admins | reminder rule 1 |
| `PROPOSAL_NO_ACTION` | same | same | rule 2 |
| `LEAD_STAGNANT` | LEAD id | same | rule 3 |
| `LEAD_ASSIGNED` | LEAD id | new assignee (not self-assign) | `subscribers.ts` |
| `LEAD_WON` | LEAD id | all Admins except the actor ("Lead won, no project yet", dedupe `lead-won-no-project:<leadId>`) | `projectAlerts.ts` |
| `FILE_ADDED` | PROJECT id + `fileId` | project members (staff upload); members + Admins (customer upload) | `docAlerts.ts` |
| `FILE_SHARED` | PROJECT id + `fileId` | the customer | `docAlerts.ts` |
| `COMPLAINT_RAISED` | COMPLAINT id + `projectId` | all Admins except actor | `complaintAlerts.ts` |
| `COMPLAINT_ASSIGNED` | COMPLAINT | the technician | same |
| `COMPLAINT_RESOLVED` | COMPLAINT | Admins, customer, raiser | same |
| `COMPLAINT_REOPENED` | COMPLAINT | technician + Admins | same |
| `COMPLAINT_COMMENT` | COMPLAINT | customer, raiser, technician (+ Admins if customer wrote) | same |
| `COMPLAINT_CLOSED` | COMPLAINT | the customer | same |
| `COMPLAINT_OVERDUE` | COMPLAINT | technician, else every Admin | reminder rule 5 |
| `TODO_ASSIGNED` | TODO id + `projectId` | assignees (not actor) | `todoAlerts.ts` |
| `TODO_DUE_CHANGED` | TODO | assignees | same |
| `TODO_COMPLETED` | TODO | creator + notify-on-done list | same |
| `TODO_COMMENT` | TODO | assignees, creator, earlier commenters | same |
| `TODO_OVERDUE` | TODO | assignees, else creator | reminder rule 4 |
| `PROJECT_CREATED` | PROJECT | all Admins except actor | `projectAlerts.ts` |
| `PROJECT_ASSIGNED` | PROJECT | newly added members | same |
| `PROJECT_POST` | PROJECT + `postId` | Admins + members (+ customer if CLIENT-visible), not author | same |
| `PROJECT_COMMENT` | PROJECT + `postId` | same audience rule | same |
| `PROJECT_APPROVED` | PROJECT + `postId` | Admins + members (not the customer) | same |
| `PROJECT_CLOSED` | PROJECT | Admins + members + customer | same |

26 types total (`NOTIFICATION_TYPES`). **There are no attendance, salary or HR notification types** (no "missed check-in", "salary finalized"). `docs/.../notifications-and-cron.md` lists only 14 of the 26 (docs lag: LEAD_WON, COMPLAINT_COMMENT, PROJECT_* are not in the table).
Dashboard attention items use the same `ref` shape and `refHref`, so one navigation resolver serves both.

Mobile deep-link mapping needed: ref kind to route; `PROJECT` + `fileId` to the project Docs tab file (blocked by the fileId bug, G6); `TODO` without `projectId` to the To-dos list; customers (CUSTOMER role) only see PROJECT / COMPLAINT refs. A notification whose target is a screen the role can't open (e.g. an Admin deep link in an HR shell) falls back to the list.

### 6.3 Screens

| Screen | Web | Mobile |
|---|---|---|
| Bell (badge + dropdown of 10) | `notification-bell.tsx` (`useNotifications(10, open)`, mark-all, "See all") | Tab-bar/header bell badge + native screen |
| Notifications page | `notifications-view.tsx`: All/Unread toggle, load-more pages, mark read on open, mark all | Full-screen list, pull-to-refresh, infinite scroll, swipe to mark read (client of `POST /:id/read`), unread dot |

- Roles: every signed-in user, including customers (`customer-shell.tsx` presumably has a bell UNVERIFIED).
- States: loading skeleton, "You're all caught up", "No unread notifications", error with retry. Row: icon by group, title (bold if unread), body, relative age, unread dot.
- Mark-read: on tap (`markRead.mutate` then navigate). Mark all.
- What changes on a phone: replace 30 s polling with push + foreground refetch (AppState) + polling fallback; OS badge count from `unread-count`; notification-tap routes into the right screen from the push payload (`type`, `ref`); when the user is signed out, queue the deep link until login; per-channel settings.
- **Verdict: INCLUDE** (core; ADAPT delivery to push). Polling-only is acceptable as phase 1.

### 6.4 What the phone needs from the backend for push (gaps)
Register token (`POST /api/notifications/devices {token, platform, appVersion}` and unregister on logout), store per user and per device (multiple devices), a `PushSender` (FCM or Expo push service) called from `NotifyUseCase` after a created (not deduped) row, payload `{notificationId, type, ref}`, token invalidation on `UNREGISTERED`, badge count, and a revoke on logout/deactivation. Android requires a Firebase project and `google-services.json` for FCM (Expo handles via EAS). Quiet hours / per-type mute settings do not exist.

---
## 7. Reminders and scheduled jobs

- **Module:** `apps/api/src/modules/reminders` (tier 7; reads leads/proposals/todos/complaints through public contracts; writes via `notifications.contract.notify`).
- **Scheduler:** plain interval job `REMINDER_INTERVAL_MINUTES` (default 60) with overlap guard, run once at startup, only when `ENABLE_CRON=true`, on ONE instance. No `node-cron`. So reminder latency is up to an hour; not real-time.
- **Rules and outputs** (`reminderRunResultSchema`: `unseen, noAction, stagnant, todoOverdue, complaintOverdue`): 1 proposal not opened after `REMINDER_UNSEEN_DAYS` (2) once per proposal; 2 opened but lead unchanged for `REMINDER_NO_ACTION_DAYS` (2) once; 3 stagnant open lead each `LEAD_STUCK_DAYS` (2), max `REMINDER_STAGNANT_MAX` (3) per stuck period, skips PROPOSAL_SENT leads; 4 to-do overdue once per due date; 5 complaint unresolved after `reminders.complaintDays` (3) once per complaint (reopen resets). Won/Lost leads never. Thresholds are system settings in days (decimals allowed), Admin editable.
- **Idempotency:** `dedupeKey` per recipient (`proposal-unseen:<id>`, `proposal-no-action:<id>`, `lead-stagnant:<leadId>:<statusChangedAt>:<window>`).
- **Endpoint:** `POST /api/reminders/run` (Admin) returns counts. **EXCLUDE** from mobile (demo/testing).
- **What exists as push/alert:** nothing pushed; each rule creates a row only. No reminder for attendance (no "you have not checked in" or "you forgot to check out"). No daily digest. No cron for salary.
- **Phone implications:** a push per reminder at hourly cadence is bursty (a batch of N stale leads could send N pushes on one run: batching/collapse key needed, gap G5). Local (client-side) check-in/out reminders are an opportunity because the server has none.
- **Verdict: n/a (backend only)**, consumed through notifications.

---
## 8. Cross-cutting facts the phone needs

- **Auth/mobile:** clients identify with header `x-client` (`web` | `mobile`, `CLIENT_HEADER` in `identity.ts`); web gets the refresh token via cookie, mobile in the body (UNVERIFIED in detail; `auth.controller.ts` clears the cookie only for `x-client: web`). Access token TTL default 900 s (`JWT_ACCESS_TTL_SECONDS`), so a queued offline action will meet an expired token: the client needs a refresh-then-retry interceptor.
- **Business timezone:** all dates (`YYYY-MM-DD`, `YYYY-MM`) are business-tz (Asia/Kolkata default), NOT device tz. The phone must not derive "today" from the device clock for attendance; derive from server time (e.g. `generatedAt` or the day returned by check-in) or format in the business tz. Web uses `businessDate()` from `lib/format`.
- **Weekly off/working days** are computed by the server (`hr.weeklyOff` setting); the phone just renders `status`.
- **Errors:** standard AppError JSON (400 with `errors[]` path/message, 403, 404, 409). 

---
## 9. API gaps the phone will hit (consolidated)

| # | Gap | Impact | Suggested fix |
|---|---|---|---|
| G1 | No client capture time on check-in/out | offline punches get the replay time; payroll wrong | optional `capturedAt` + validation + `clientCaptured` flag, or product decision to refuse offline |
| G2 | No push token / device registration endpoint; no `PushSender` | no push at all | `devices` collection + register/unregister + sender in `NotifyUseCase` |
| G3 | No device identity on attendance (device id, mock-location, GPS fix time) | spoofing (fake GPS, buddy punching on another phone) | optional `device`, `isMock`, `fixAt`; at least log `accuracy` threshold |
| G4 | Notifications paginate by page number, no cursor/`since` | duplicates/missed on live feed, wasteful polling | `since`/`before` cursor; also `unread-count` could return `latestId` |
| G5 | No batching/collapse for reminders | push storm after downtime | collapse by type per run |
| G6 | `fileId` missing in notification `ref` storage (schema + mapper) | file deep links broken on web and phone (code-evident; runtime UNVERIFIED) | add `fileId` to schema and `toEntity` |
| G7 | Dashboard cannot select blocks; heavy `people` block | payload and latency on mobile networks | `blocks=` query using `DASHBOARD_BLOCKS` |
| G8 | Attendance history is month-whole only; no range, no summary | OK for calendar, heavy for "last 7 days" widget | `from/to` or `summary` endpoint (low priority) |
| G9 | No "today" status endpoint (need to fetch the month and scan) | check-in screen loads 30+ days of data | `GET /attendance/today` returning `AttendanceDayDto` + server time |
| G10 | Check-in response does not say whether it was a repeat; no server time header other than `inAt` | UX cannot say "already checked in at 9:02" vs new | add `alreadyCheckedIn` or use 200/201 |
| G11 | No employee phone on the board DTO; no team directory for non-HR | tap-to-call from board / peers | add `phone` (Admin/HR) / minimal directory endpoint |
| G12 | No attendance/HR notification types or ref kind | no "forgot to check out", "late", "salary ready" | add types + `ATTENDANCE` ref |
| G13 | Check-out after midnight returns 409 (day boundary), no open-shift concept | night/overtime edge cases | policy decision (UNVERIFIED by test) |
| G14 | Visits have no idempotency key | offline replay duplicates | key on (lead,user,at) like calls |
| G15 | Admin owner has no attendance type; `/attendance/me` 404 | client must treat as normal | document; hide screen from `attendanceType == null` |
| G16 | Notifications TTL 30 days | history capped | acceptable; show in UI |

---
## 10. Screen-by-screen mobile verdict summary

| Screen / flow | Roles | Verdict | Note |
|---|---|---|---|
| Check-in / check-out | GPS staff (any role incl. Admin/HR if GPS) | INCLUDE | core mobile feature; offline needs G1 |
| My attendance (month) | on attendance | INCLUDE (ADAPT, merge with check-in) | |
| Attendance day board | ADMIN, HR | ADAPT | list + date stepper |
| Person month + corrections | ADMIN, HR | ADAPT (view); corrections ADAPT/LATER | native time pickers, tz care |
| Simulate attendance | ADMIN, HR | EXCLUDE | demo |
| Employee list | ADMIN, HR | ADAPT (read-only) | contains salary field |
| Employee add/edit/password/deactivate | ADMIN, HR | EXCLUDE (deactivate LATER) | product decision |
| Designations | ADMIN, HR | EXCLUDE | |
| Salary sheet view | ADMIN, HR | LATER | read-only glance |
| Salary generate/edit/finalize/CSV | ADMIN, HR | EXCLUDE | |
| Dashboard (Admin) | ADMIN | ADAPT | attention first |
| Dashboard (HR) | HR | ADAPT | attendance only |
| Range picker | ADMIN, HR | ADAPT | presets (Today / 7 days / This month) |
| Notification bell + list | all | INCLUDE | push needs G2 |
| Reminder run (`/reminders/run`) | ADMIN | EXCLUDE | |
| Lead calls / visits (neighbours) | ADMIN, SALES | INCLUDE (in leads inventory) | calls use client time; G14 |
