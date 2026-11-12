# Personas and navigation

Status: design, 2026-11-12. Read [00-principles-and-scope.md](00-principles-and-scope.md) first; it holds the source key ([F], [L], [W], [P], [U], [N], [S], [O], [G]). Tab sets follow the UX research (max 4 + More; customers 3) and the web nav code [F §2.5], [U §1.2]. Roles and routes are enforced by the API; the app only hides.

## 1. Roles at a glance

| Role | Who | Top jobs on a phone | Default landing | Bottom tabs | In More |
|---|---|---|---|---|---|
| ADMIN | Owner | See what needs attention; check complaints and approvals; assign leads; close projects | Glance | Glance, Projects, Leads, Alerts | Proposals, Customers, To-dos, Complaints, Attendance board, Team, Profile |
| HR | HR manager | See who is in today; open a person's month; check own attendance if GPS | Board | Board, Team, Alerts | My attendance (if `attendanceType` set), Profile |
| SALES | Telecaller or field sales | Call leads and log outcomes; log visits; add leads; send proposals | Today | Today, Leads, Projects, Alerts | Proposals, Customers, To-dos, Complaints, My attendance, Profile |
| DESIGNER | Kitchen designer | Post renders; track design stage; clear to-dos; answer the customer in chat | Today | Today, Projects, To-dos, Alerts | Complaints, My attendance, Profile |
| TECHNICIAN | Site technician | Check in; see today's to-dos; post site photos; resolve complaints | Today | Today, Projects, Complaints, Alerts | My attendance, Profile |
| OFFICE | Receptionist | Add walk-in leads; look up customers; raise and watch complaints | Today | Today, Leads, Customers, Alerts | Projects, To-dos, Complaints, My attendance, Profile |
| CUSTOMER | Homeowner (no password; OTP or invite link) | See project progress; chat with the team; approve a design; open shared files; raise a complaint | Project | Project, Docs, Complaints | Header: bell, avatar (Profile, language, delete account) |

- Tabs for staff follow [U §1.2]. Differences from it: DESIGNER "Docs" tab dropped (GAP: no cross-project docs endpoint); HR gets Board, Team, Alerts [F §2.5].
- Customer tabs: code ships Project + Complaints [F §2.5]; the owner asked for 3 tabs, so Docs is promoted from the project into a tab. Decision (proposed): Project (chat), Docs, Complaints; alternative: 2 tabs as on the web; why: the owner's 3-tab rule and the customer's three web workspace tabs (Chat, Complaints, Docs) [W §2].
- Landing: Decision (proposed): every staff role lands on its Home tab; alternative: web landing (SALES leads, TECHNICIAN complaints, DESIGNER/OFFICE projects [F §2.5]); why: Home carries the check-in card and today's work.
- Alerts tab = notification list with unread badge [P §6.3]; customers get a header bell. Tab labels always visible, wrap to 2 lines at large font scale [U §3, §2.6].
- No attendance (`attendanceType == null`, e.g. the owner): no check-in, no My attendance; 404 on `/attendance/me` is a normal state [P §0.3, G15].

## 2. Role homes (wireframes)

Common rule: GPS-tracked users get the Check-in card at the top of Home [U §1.2]. Pull to refresh; refetch on foreground [W §0.3]. Numbers in short INR (`₹1.5 Cr`) [F §3.5].

### 2.1 ADMIN: Glance
Endpoint `GET /api/dashboard` (blocks may be null, partial render) [P §5]. Order from [P §5].
```
+--------------------------------+
| Vastu Kitchen            (AD)  |
| Updated 3:40 PM        [Today v]|
| NEEDS YOUR ATTENTION           |
| [Unseen proposals 3][Overdue   |
|  complaints 2][Stuck leads 5]  |
|  > Rao Kitchen proposal  2d    |
| STAFF TODAY   9 / 11 in    >   |
| Open leads 24  Complaints 3    |
| Pipeline ₹90 L  Won ₹12 L      |
| CUSTOMER ACTIVITY (last 5)     |
|  Mrs Rao: approved design      |
+--------------------------------+
|Glance|Projects|Leads|Alerts(2)|
+--------------------------------+
```
Each row opens the filtered list or the item via `ref` [P §5]. Skip the per-person activity table [P §5].

### 2.2 HR: Board
Endpoints `GET /api/attendance/board?date=` and `GET /api/dashboard` (staff block) [P §2.3, §5].
```
+--------------------------------+
| Attendance      < 12 Nov 2026 >|
| Present 9  Absent 1  No out 1  |
| [All][Absent][Missing out]     |
| (RS) Ravi Sharma  Present 9:02 |
| (AG) Anil Gurung  Present 9:15 |
| (TD) Tarun Das    Absent       |
+--------------------------------+
| Board |  Team  |  Alerts      |
+--------------------------------+
```

### 2.3 SALES: Today
GAP: leads have no follow-up date or scheduled-visit field. Today is built from status and the `stuck` flag: `GET /leads?stuck=true`, `?status=FOLLOW_UP`, `?status=NEW` [L §1].
```
+--------------------------------+
| Today, Thu 12 Nov              |
| [ Check in ]  not checked in   |
| STUCK (5)                      |
|  Priya S.  Follow-up  3d       |
|  [Call] [WhatsApp]             |
| NEW LEADS (2)                  |
|  Amit K.  Justdial   1h        |
|  [Call] [WhatsApp]             |
|                          ( + ) |
+--------------------------------+
|Today|Leads|Projects|Alerts     |
+--------------------------------+
```
`( + )` = Add lead FAB (3 fields: name, phone, source) [L §2], [U §1.7].

### 2.4 DESIGNER: Today
`GET /todos/mine`, `GET /projects?designStage=SHARED&designerId=<me>`, `GET /complaints?assignedTo=me` [W §0.4, §4.4].
```
+--------------------------------+
| Today                          |
| [ Check in ]                   |
| WAITING ON CUSTOMER (2)        |
|  Rao Kitchen  Design shared 2d |
| MY TO-DOS                      |
|  Overdue 1 | Today 3           |
|  [ ] Send render v2   Today    |
+--------------------------------+
|Today|Projects|To-dos|Alerts    |
+--------------------------------+
```

### 2.5 TECHNICIAN: Today
Same data as DESIGNER plus complaints first (web landing is Complaints [F §2.5]). Cannot raise complaints [W §5.1].
```
+--------------------------------+
| Today                          |
| [ Check in ]                   |
| COMPLAINTS FOR ME (2)          |
|  Das Residence: switch loose   |
|  ASSIGNED  1d   [Open]         |
| MY TO-DOS  Overdue 0 | Today 2 |
|  [ ] Measure wall B   Today    |
| MY PROJECTS (3): Rao Kitchen > |
+--------------------------------+
|Today|Projects|Complaints|Alerts|
+--------------------------------+
```

### 2.6 OFFICE: Today
Sees all leads (view/add only; no call or visit buttons) and all complaints [F §2.2, §2.3]. Biometric-only staff get no check-in card [P §1].
```
+--------------------------------+
| Today                          |
| [ Check in ]  (GPS staff only) |
| WALK-INS / NEW LEADS (3)       |
|  Amit K.   Walk-in   10m       |
| COMPLAINTS NEEDING ATTENTION 2 |
|  Mrs Sen: tap leaks  OPEN 1d   |
| MY TO-DOS  Today 1             |
|                          ( + ) |
+--------------------------------+
|Today|Leads|Customers|Alerts    |
+--------------------------------+
```

### 2.7 CUSTOMER: Project
Opens the single project directly; a project switcher chip appears only when `GET /projects` returns more than one [W §1], [U §1.2]. Only CLIENT posts are visible [W §3.2].
```
+--------------------------------+
| Rao Kitchen        (bell)(MR)  |
| Design · Shared                |
| +----------------------------+ |
| | WHAT'S NEXT                | |
| | Approve the design         | |
| | [ Approve ] [Ask a change] | |
| +----------------------------+ |
| Dev (Designer)    3:40 PM      |
| [photo][photo]  Render v2      |
|            Approved ✓ 4:10 PM  |
| [camera][ Message... ][ send ] |
+--------------------------------+
|  Project |  Docs | Complaints  |
+--------------------------------+
```
"What's next" shows the newest CLIENT post with `canApprove = true`, else the stage line. GAP: no "pending approvals" endpoint; derive from page 1 of `/projects/:id/posts?visibility=CLIENT` [W §3.2]. Stage names in code are DESIGN, SITE, CLOSED only; the research's 6-step timeline (U §1.5) needs server data that does not exist.

## 3. Project screen

One screen for staff and customers, shaped by the viewer. Chat is the default segment [U §1.4], [W §2].
```
+--------------------------------+
| <  Rao Kitchen      (i)  (...) |
|    Mrs Rao · SITE · Design OK  |
| [Chat][To-dos][Complaints][Docs]|
|--------------------------------|
|        -- Today --             |
|  Rao: kitchen is ready (CLIENT)|
|        Dev: v2 attached  🔒    |
|   · Tarun ticked "Measure" ·   |
|  [Complaint card: Tap leaks    |
|   ASSIGNED]                    |
| (Team only v) [cam][Message][>]|
+--------------------------------+
```
| Part | Rule | Source |
|---|---|---|
| Header | Back, project name, subtitle `customer · stage chip · design-stage chip`. (i) opens the Info bottom sheet. (...) opens an action sheet. | [W §2] |
| Segments | Staff: Chat, To-dos, Complaints, Docs (max 4). Customer on the project tab: chat only; Docs and Complaints are bottom tabs. Swipe between segments. Badges: open complaints, my overdue to-dos. | [W §2] |
| Info sheet | Stage and design stage (change if allowed), team with Designer tag, customer (call, WhatsApp), site address (open in Maps), value, created, closed, lead journey link (not customer). | [W §2] |
| Action sheet | Invite customer (ADMIN, SALES), Close project (ADMIN, needs a FINAL_DELIVERY post), Save to Docs, Edit and Team are LATER. | [W §2] |
| Feed | Inverted `FlatList` (P8). `GET /projects/:id/timeline?limit=30` for staff; customers use `posts?visibility=CLIENT`. Load older with `before=<nextCursor>` on `onEndReached`. "N new messages" pill when scrolled up. Activity rows are single grey lines, staff only. Complaint cards open `complaints/[id]`. | [W §3.4, §3.6] |
| Composer | Single-line growing input, camera, attach, send. Audience chip "Team only" / "Client can see", default Team only; client-visible turns the composer tint and shows an eye icon on the bubble. Customers have no chip (always CLIENT). "Final delivery" lives in the (...) sheet and in the Close flow. Draft kept per project. | [W §3.4], [U §1.6] |
| Closed project | Composer replaced by a banner; comments and "Raise complaint" hidden. Server enforces only post creation (GAP: comments, to-dos, complaints are UI-only rules). | [W §0.2] |
| Reply | Swipe right or tap Reply opens `post/[postId]` (thread) with its own composer. Inline: 3 recent comments. | [W §3.6] |
| Photos | 1-4 tile grid, tap opens the full-screen pager (pinch-zoom, swipe down to dismiss, save/share). Compress to long edge ~1600 px before upload. | [W §0.5], [O §3.4] |
| Long-press | Copy text, save photo, Save to Docs, Delete (only if `canDelete`). | [W §3.7] |
| Approve | Customer only, on a CLIENT post with photos; confirmation sheet names the item; haptic on success. | [W §3.2, §3.9] |

## 4. Screen map

Route style: expo-router. Groups: `(auth)`, `(staff)`, `(customer)`; `(tabs)` is the tab layout inside a group. List screens live at `(staff)/(tabs)/<name>`; the role's layout shows its 4 as tabs and hides the rest with `href: null`; More rows `router.push` to the hidden ones (verify the tab-bar behaviour in a spike, UNVERIFIED). Query params reuse the web names `?post= &todo= &complaint= &file=` so one `ref -> route` function serves push and in-app taps [F §2.5], [W §7]. "M" = modal or bottom sheet. Guards: one `Stack.Protected` per group in the root layout; splash stays up until session restore; a deep link to a protected route is stored and replayed after login [S §4.1]. Guards are UX only.

| Route | Screen | Roles | Doc |
|---|---|---|---|
| `index` | Boot: restore session, `/me`, pick shell | all | auth-and-account |
| `(auth)/login` | Phone, then OTP or password | all | auth-and-account |
| `(auth)/invite/[token]` | Redeem invite (guard against double redeem) | CUSTOMER | auth-and-account |
| `app-update` | Blocking "update required" screen (needs GAP 5) | all | auth-and-account |
| `(staff)/(tabs)/index` | Home: Glance, Board or Today by role | staff | dashboard-glance |
| `(staff)/(tabs)/leads` | Leads list with status chips, filter sheet | ADMIN, SALES, OFFICE | leads-and-calls |
| `(staff)/leads/[id]` | Lead detail: timeline, calls, visits, proposals, details | ADMIN, SALES, OFFICE (read-only) | leads-and-calls |
| `(staff)/leads/new` | Add lead | ADMIN, SALES, OFFICE | leads-and-calls |
| `(staff)/leads/[id]/status` (M) | Change status, LOST reason | ADMIN, SALES | leads-and-calls |
| `(staff)/leads/[id]/assign` (M) | Assign to SALES | ADMIN | leads-and-calls |
| `(staff)/leads/[id]/call-outcome` (M) | Post-call outcome sheet | ADMIN, SALES | leads-and-calls |
| `(staff)/leads/[id]/visit` (M) | GPS visit log with note, photo | ADMIN, SALES | visits |
| `(staff)/proposals` | Proposals list | ADMIN, SALES | proposals |
| `(staff)/proposals/new` | New draft (`?leadId=`) | ADMIN, SALES | proposals |
| `(staff)/proposals/[id]` | Draft form, or sent view with seen panel | ADMIN, SALES | proposals |
| `(staff)/proposals/[id]/send` (M) | Confirm number, send on WhatsApp, share link | ADMIN, SALES | proposals |
| `(staff)/(tabs)/customers` | Customers list | ADMIN, SALES, OFFICE | customers |
| `(staff)/customers/[id]` | Customer detail, Start new project | ADMIN, SALES, OFFICE | customers |
| `(staff)/customers/new` | Add customer | ADMIN, SALES, OFFICE | customers |
| `(staff)/(tabs)/projects` | Projects list, search, Show closed | ADMIN, SALES, DESIGNER, TECHNICIAN, OFFICE | projects-and-chat |
| `(staff)/projects/[id]/chat` | Project chat (default) | ADMIN, members | projects-and-chat |
| `(staff)/projects/[id]/todos` | Project to-dos (`?todo=`) | ADMIN, members | todos |
| `(staff)/projects/[id]/complaints` | Project complaints (`?complaint=`) | ADMIN, members | complaints |
| `(staff)/projects/[id]/docs` | Folders and files (`?file=`, `?folderId=`) | ADMIN, members | docs-files |
| `(staff)/projects/[id]/info` (M) | Info sheet | ADMIN, members, lead owner (summary) | projects-and-chat |
| `(staff)/projects/[id]/post/[postId]` | Post thread and comments | ADMIN, members | projects-and-chat |
| `(staff)/projects/[id]/photos` (M) | Full-screen photo pager | ADMIN, members | projects-and-chat |
| `(staff)/(tabs)/todos` | My to-dos by bucket | ADMIN, SALES, DESIGNER, TECHNICIAN, OFFICE | todos |
| `(staff)/todos/[id]` | To-do detail, comments | same | todos |
| `(staff)/(tabs)/complaints` | Complaints list, Active / Resolved | ADMIN, SALES, DESIGNER, TECHNICIAN, OFFICE | complaints |
| `(staff)/complaints/[id]` | Complaint detail, actions from `can{}`, conversation | scoped | complaints |
| `(staff)/complaints/new` | Raise complaint (`?projectId=`) | ADMIN, OFFICE, SALES, DESIGNER (own projects) | complaints |
| `(staff)/attendance` | Check-in card + my month | users with `attendanceType` | attendance |
| `(staff)/attendance/board` | Day board (`?date=`) | ADMIN, HR | attendance |
| `(staff)/attendance/[userId]` | Person month | ADMIN, HR | attendance |
| `(staff)/(tabs)/team` | Employees (read-only) | ADMIN, HR | attendance |
| `(staff)/(tabs)/alerts` | Notification list | staff | notifications |
| `(staff)/(tabs)/more` | More menu | staff | this doc |
| `(staff)/profile` | Profile, change password, language, sign out, delete account | staff | auth-and-account |
| `(customer)/(tabs)/project` | Project chat with "What's next" card (`?projectId=&post=`) | CUSTOMER | projects-and-chat |
| `(customer)/(tabs)/docs` | Shared files, flat list; upload | CUSTOMER | docs-files |
| `(customer)/(tabs)/complaints` | Own complaints | CUSTOMER | complaints |
| `(customer)/complaints/[id]`, `/new` | Detail (reopen), raise | CUSTOMER | complaints |
| `(customer)/post/[postId]` | Post thread | CUSTOMER | projects-and-chat |
| `(customer)/photos` (M) | Full-screen photo pager | CUSTOMER | projects-and-chat |
| `(customer)/notifications` | Notification list (header bell) | CUSTOMER | notifications |
| `(customer)/profile` | Profile, language, sign out, delete account | CUSTOMER | auth-and-account |

## 5. Deep-link targets

One resolver `routeFor(ref, role)` serves the notification list, push taps (payload `{url|ref}`; ids only, no content [N §3.3]) and dashboard attention items [P §6.2].

| `ref.kind` | Staff route | Customer route | Notes |
|---|---|---|---|
| `LEAD` | `(staff)/leads/[id]` | n/a | Roles without lead access fall back to Alerts. |
| `PROPOSAL` | `(staff)/proposals/[id]` | n/a | Customers never get PROPOSAL refs [P §6.2]. |
| `PROJECT` | `(staff)/projects/[id]/chat?post=<postId>` | `(customer)/(tabs)/project?projectId=<id>&post=<postId>` | The web feed may not read `post` (UNVERIFIED); the mobile chat must scroll to it [W §3.7]. |
| `PROJECT` + `fileId` | `(staff)/projects/[id]/docs?file=<fileId>` | `(customer)/(tabs)/docs?projectId=<id>&file=<fileId>` | GAP 7: `fileId` is probably dropped when stored; server must add it to schema and mapper [P §0]. Until fixed, open the Docs tab. |
| `TODO` with `projectId` | `(staff)/projects/[id]/todos?todo=<id>` | n/a | Customers have no to-dos. |
| `TODO` without `projectId` | `(staff)/(tabs)/todos` | n/a | Same fallback as the web [P §6.2]. |
| `COMPLAINT` | `(staff)/complaints/[id]` | `(customer)/complaints/[id]` | Always open the detail directly. A technician assigned to a complaint may not be a project member [W §5.1, §5.5]. |
| `null` or unknown | `(staff)/(tabs)/alerts` | `(customer)/notifications` | Also the fallback when the role cannot open the target [P §6.2]. |

The 26 notification types per ref kind are in [P §6.2]. Mark read, then navigate [P §6.3]. Inbound links (WhatsApp, browser) use Android App Links on the web domain (P10) [N §3.5]:

| Link | App target | Not installed |
|---|---|---|
| `/invite/<token>` | `(auth)/invite/[token]` | Web invite page (existing) |
| `/projects/<id>`, `/complaints/<id>`, `/leads/<id>`, `/proposals/<id>` | Same routes as above with the query params of the web URL | Web page after login |
| `/p/<token>` | Not an app link in v1: opens in the browser | Existing public page |

`/p/<token>` stays in the browser because no mobile screen shows proposals to customers (GAP: customer proposals endpoint, [F §8.16]). The invite token cannot survive an install without a deferred link (GAP, [F §8.4]): the customer reopens the link or signs in with OTP.

## 6. Role x feature permission matrix

Condensed from [F §2.4] and [W §0.1, §8], [L §0]. Y = full, O = own only, M = member or assigned, V = view only, - = no access. This is what the UI may show; the API decides. Notes follow the table.

| Feature | ADMIN | HR | SALES | DESIGNER | TECHNICIAN | OFFICE | CUSTOMER |
|---|---|---|---|---|---|---|---|
| Glance / dashboard | Y | attendance only | - | - | - | - | - |
| Leads list, detail, timeline | Y | - | O | - | - | V (all) | - |
| Add lead | Y | - | Y | - | - | Y | - |
| Edit, status, calls, visits | Y | - | O | - | - | - | - |
| Assign lead, call stats | Y | - | - | - | - | - | - |
| Proposals list, create, send | Y | - | O | - | - | - | - |
| Customers list, add, start new project | Y | - | O | - | - | Y | - |
| Invite customer | Y | - | Y | - | - | - | - |
| Projects list and detail | Y | - | M, else summary via own lead | M | M | M | O |
| Project stage, close | Y | - | - | - | - | - | - |
| Design stage | Y | - | - | O (own project) | - | - | - |
| Chat, Client view | Y | M | M | M | M | M | O |
| Chat, Team view | Y | M | M | M | M | M | - |
| Post `FINAL_DELIVERY` | Y | M | M | M | M | M | - |
| Approve design | - | - | - | - | - | - | O |
| To-dos | Y | - | M | M | M | M | - |
| Docs | Y | M | M | M | M | M | O (shared files, flat) |
| Complaints, view | all | - | O | O | assigned | all | O |
| Complaint raise | Y | - | M | M | - | Y | O |
| Complaint assign, close | Y | - | - | - | - | - | - |
| Complaint resolve | Y | - | - | - | assignee | - | - |
| Complaint reopen | Y | - | - | - | - | - | O |
| Own attendance (GPS check-in, month) | if GPS | if GPS | if GPS | if GPS | if GPS | if GPS | - |
| Attendance board, person month | Y | Y | - | - | - | - | - |
| Employees (read-only) | Y | Y | - | - | - | - | - |
| Notifications | Y | Y | Y | Y | Y | Y | Y |
| Change password | Y | Y | Y | Y | Y | Y | n/a (no password) |

- "M" for HR and SALES applies only if added to the project; SALES without membership sees the summary and lead journey only [W §0.1].
- "Own attendance" requires `UserDto.attendanceType = GPS` and an active account; decide the button from `/me`, no extra call [P §1].
- Server errors: 404 = hidden record (drop it from the cache); 403 = never allowed (toast on write actions); 409 = wrong status (refetch) [F §2.1], [W §5.2]. Web-only items have no mobile route [00 §5].
