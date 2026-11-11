# API map (screen → endpoints)

What each screen calls, who may call it, and the traps. Built from the running API's OpenAPI document (114 operations): **Swagger at `/api/docs` is the source of truth for shapes**; this file is the *index* a UI builder needs. DTO types come from `packages/contracts` (`z.infer`), never hand-written.

## 0. Conventions every screen relies on

| Topic | Rule |
|---|---|
| **Envelope** | Success `{ success: true, statusCode, message, data }`; errors `{ success: false, statusCode, code, message, data? }`. Read `data`; show `message` for errors. |
| **Validation errors** | `400` with `data: [{ path: ['field'], message }]`. Map `path` to the form field; unmapped ones go to the banner above the form. |
| **Hidden records** | A record you may not see is **`404`**, not `403`. `403` only means "your role may never do this". The UI treats both as "not found" except action buttons (below). |
| **Conflicts** | `409` = state changed under you (complaint status, finalized month, name clash, etc.). Show the `message`, refetch. |
| **`can` blocks** | Complaints (and similar) return `can: { assign, resolve, reopen, close }`. **Render buttons from `can`**, never from role names. |
| **Pagination** | Lists: `?page=&pageSize=` (≤100) → `{ items, page, pageSize, total, totalPages }`. Feed/timeline use a **cursor** (`before`). |
| **Dates & time** | Instants are ISO strings (UTC). Calendar dates are `YYYY-MM-DD` and months `YYYY-MM`, **in the business timezone (Asia/Kolkata)**: never build them from the browser's local zone. Show times in IST. |
| **Money** | Whole rupees (integers). Format with `formatINR`. |
| **Uploads** | Never through the API: `POST …/uploads/sign` → upload straight to the returned `url` (multipart, `fields` first, then the file as `fileField`) → send the returned `publicId` (+ `bytes`, `width`/`height`) in the real call. Photos use the *image* ticket; documents use the *file* ticket. Without Cloudinary credentials the sign call returns `503`: show "Photo uploads are not set up yet". |
| **Polling** | Notifications: `GET /notifications/unread-count` every ~30 s and when the tab regains focus. Nothing else is pushed. |
| **Rate limit** | Login/redeem: 30 *failed* attempts per IP per 15 min → `429` "Too many attempts". Show the message; do not retry automatically. |
| **Staff pickers** | `GET /identity/users` is **Admin/HR only**. Other roles must build pickers from data they already have: project `members` (to-do assignees, project member list), the complaint `assign` picker is Admin (so fine). Do not call `/identity/users` from non-HR screens. |
| **No customer list** | There is no "all customers" endpoint. Customers appear via `project.customer` and `lead.customerId`. "New project for an existing customer" picks from projects/leads the Admin already sees. |
| **No global search endpoint** | ⌘K runs `GET /leads?search=` and `GET /projects?search=` in parallel (role permitting) plus a static page list. |

## 1. Auth & session

| Action | Call | Notes |
|---|---|---|
| Staff sign in | `POST /identity/auth/login` `{ phone, password }`, header **`X-Client: web`** | Returns `accessToken` + `user`; the refresh token is set as an **httpOnly cookie** (web). `401` = wrong phone/password **or** no login **or** deactivated (indistinguishable on purpose). |
| Customer sign in | `POST /identity/auth/invite/redeem` `{ token }` from `/invite/[token]` | One-time link; `401` "Link expired or used". The API builds links as `${WEB_BASE_URL}/invite/<token>`. |
| Who am I | `GET /identity/auth/me` | `role`, `designation`, `canLogin`; drives nav and landing page. |
| Refresh | `POST /identity/auth/refresh` (no body on web: the cookie is used) | **Rotating**: the old token dies. **Reuse of an old token signs the user out everywhere.** See [implementation-guide §Auth](implementation-guide.md#auth--sessions) for the single-flight rule. |
| Sign out | `POST /identity/auth/logout` | This device. |
| Change password | `POST /identity/auth/change-password` | Signs out all devices. |
| ~~Forgot / reset~~ | **does not exist** | Staff passwords are reset by Admin/HR (`PUT /identity/users/{id}/password`); customers get a new invite. The login page has no "Forgot password" link. |

## 2. Dashboard — `GET /dashboard?from=&to=` (Admin, HR)
One call; dates inclusive, default today, ≤ 31 days (`400` otherwise).
- **Admin:** `counters` (leads open/byStatus/newInRange · projects design/site/running · complaints per status + `pending` · `value.pipeline`/`wonInRange`/`pipelineCapped`), `staff` (today: tracked/present/absent/offDay), `people[]` (attendance + activity), `attention` (5 blocks: `unseenProposals`, `noActionProposals`, `stagnantLeads`, `overdueComplaints`, `overdueTodos`; each `{ total, capped, items[{ title, detail, since, ref }] }`), `recent[]` (customer posts/comments/approvals).
- **HR:** only `staff` and `people[].attendance`; `counters`, `attention`, `recent` are `null`, `people[].activity` is `null`.
- Any block can be `null` with its name in `errors[]`: render a small "Couldn't load, Retry" in that card only.
- `ref` = `{ kind: LEAD|PROPOSAL|PROJECT|TODO|COMPLAINT, id, projectId?, postId?, fileId? }` → route table in §10.

## 3. Leads

| Screen / action | Call | Gate |
|---|---|---|
| List, board columns | `GET /leads?page&pageSize&search&status&source&assignedTo=me\|unassigned\|<id>&stuck=true` | Admin, Office: all · Sales: own only (filter ignored) |
| Board | One `GET /leads?status=X&pageSize=50` per visible column (no board endpoint). Counts come from each response's `total`. | same |
| Add / edit | `POST /leads` · `PATCH /leads/{id}` (`null` clears optional fields) | Add: Admin, Sales, Office · Edit: Admin, Sales |
| CSV import | `POST /leads/import` `{ defaultSource, rows[≤500] }` (parse the CSV **in the browser**) → `{ created, duplicates[], invalid[] }` | Admin, Office |
| Detail | `GET /leads/{id}` · `GET /leads/{id}/timeline` | any who can see it |
| Change status | `POST /leads/{id}/status` `{ status, note?, lostReason? }` | Admin, Sales. `LOST` needs `lostReason` (`400`). `WON` creates the customer account and (unless the setting is off) the project; Won leads are then locked. **Office cannot change status.** |
| Assign | `POST /leads/{id}/assign` `{ userId \| null }` | Admin |
| Calls / visits | `GET`/`POST /leads/{id}/calls` · `…/visits` | Admin, Sales (web only lists; calls are logged by the phone app) |
| Call stats | `GET /leads/call-stats` | Admin (dashboard `people[]` already has this; the standalone call is optional) |

`LeadDto` has `isStuck` and `statusChangedAt` but **no "last activity"**: show "Status changed 3 d ago" (from `statusChangedAt`) in the list; the timeline has full history.

## 4. Proposals

| Screen / action | Call | Gate |
|---|---|---|
| List | `GET /proposals?page&pageSize&leadId&status=DRAFT\|SENT` | Admin all · Sales own |
| Builder | `POST /proposals { leadId, items[], … }` → `PATCH /proposals/{id}` (drafts only) · `DELETE` (drafts) | Admin, Sales |
| Preview | `GET /proposals/{id}` (never counts as "seen") | |
| Send | `POST /proposals/{id}/send` → `{ proposal, publicUrl, whatsappUrl }` (`whatsappUrl` opens WhatsApp with the message ready); **freezes** it | |
| Change a sent one | `POST /proposals/{id}/duplicate` → new draft, new number and link | |
| Public page `/p/[token]` | `GET /public/proposals/{token}` (no login, `no-store`) then, **after render in the browser**, `POST /public/proposals/{token}/seen` | public. A plain GET never counts as "seen" (chat apps pre-fetch links). |

Status chips are **derived**: `status` is only `DRAFT`/`SENT`. "Seen" = `firstSeenAt != null` (+ `seenCount`); "No action" = sent, seen, and the lead's status has not changed since `firstSeenAt` (the dashboard `attention.noActionProposals` is the authority).

## 5. Projects

| Screen / action | Call | Gate |
|---|---|---|
| List | `GET /projects?stage&designStage&designerId&customerId&leadId&search` | Admin all · others only theirs (member/customer). A Sales person can also list the projects of **their own lead** with `?leadId=` (a summary, never the feeds) |
| Create | `POST /projects` (existing customer, or from a lead) | Admin |
| Detail | `GET /projects/{id}` | member/customer/Admin |
| Edit | `PATCH /projects/{id}` (name, siteAddress, value) · `PUT /projects/{id}/members { memberIds, designerId }` | Admin |
| Stage | `POST /projects/{id}/stage { stage: DESIGN\|SITE }` (**also reopens a closed project**) · `PATCH …/design-stage` (Admin or the designer) | |
| Close | `POST /projects/{id}/close` | Admin; needs a **Final Delivery** post (`409` otherwise) |
| Lead journey | `GET /projects/{id}/journey` | Admin and the lead's owner |
| Team timeline | `GET /projects/{id}/timeline?before=` → `{ kind: 'POST', post } \| { kind: 'ACTIVITY', activity }` (posts + to-do/file/complaint lines) | team. **Customers get posts only.** |
| Feed | `GET /projects/{id}/posts?visibility=CLIENT\|TEAM&before=` · `POST …/posts` · `DELETE …/posts/{postId}` | Customer posts are always `CLIENT` |
| Approve | `POST …/posts/{postId}/approve` | the customer, once, on a post with photos |
| Comments | `GET`/`POST …/posts/{postId}/comments` · `DELETE …/{commentId}` | text and/or ≤ 5 photos |
| Photo upload | `POST /projects/{id}/uploads/sign` | |
| Invite the customer | `POST /identity/customers/{customerId}/invite` → `{ url, expiresAt }` | Admin, Sales. Show Copy link + WhatsApp. Each call makes a **new** link. |

## 6. To-dos (inside a project, plus "My assignments")

| Screen / action | Call |
|---|---|
| Lists | `GET /projects/{id}/todo-lists` (with "3/8 done") · `POST` · `PATCH /todo-lists/{listId}` (rename/archive) |
| To-dos | `GET /projects/{id}/todos?status=open\|done\|all&listId&assignee=me\|<id>` · `POST /todo-lists/{listId}/todos` · `PATCH`/`DELETE /todos/{todoId}` |
| Done / reopen | `POST /todos/{todoId}/complete` · `…/reopen` |
| Discussion | `GET`/`POST /todos/{todoId}/comments` (text and/or photos) · `DELETE …/{commentId}` |
| My assignments | `GET /todos/mine?status=open\|done\|all` (across projects, most urgent first) |

Team only: the **customer has no to-dos**. Due dates are `YYYY-MM-DD`; "overdue" is computed by the API (`isOverdue`).

## 7. Docs (inside a project)

| Action | Call |
|---|---|
| Folder tree | `GET /projects/{id}/folders` (flat list with `parentId`, `fileCount`; **empty for the customer**) · `POST` · `PATCH`/`DELETE /folders/{folderId}` (max depth 5; delete only if empty) |
| Files | `GET /projects/{id}/files?folderId=<id>\|root&search&shared=true` · `PATCH`/`DELETE /files/{fileId}` · `GET /files/{fileId}` |
| Upload a document | `POST …/files/uploads/sign` → upload → `POST …/files` `{ publicId, format, originalName, bytes, folderId?, visibility }` |
| **Save to Docs** | `POST …/files/from-photos { items[≤20], folderId?, visibility }` → `[{ created, file }]`; idempotent, no re-upload. Offer it on every photo in feed posts, comments and to-dos. |
| Share with client | `PATCH /files/{id} { visibility: 'CLIENT'\|'TEAM' }` |

The customer sees one **flat** list of shared files (no folders) and can upload (always shared, top level). Allowed types and the size limit (`docs.maxFileMb`) come from the server: show its `400` message.

## 8. Complaints

| Action | Call | Gate |
|---|---|---|
| List / counts | `GET /complaints?status&projectId&assignedTo=me&page` · `GET /complaints/counts` | Admin, Office: all · others only theirs |
| Detail | `GET /complaints/{id}` (`history[]`, `can{}`) | |
| Raise | `POST /complaints/uploads/sign { projectId }` → `POST /complaints { projectId, description, images? }` | customer (own project), Office, Admin, Sales/Designer (own projects). **Technician and HR cannot raise.** |
| Assign | `POST …/assign { assigneeId }` | Admin (any active non-customer) |
| Resolve | `POST …/{id}/uploads/sign` → `POST …/resolve { note, images? }` | the assignee or Admin |
| Reopen / Close | `POST …/reopen { reason }` · `POST …/close { note? }` | customer or Admin / Admin |

Statuses: **`OPEN → ASSIGNED → RESOLVED → CLOSED`** (no "In progress"). A `409` means someone else acted: show "Someone else just updated this" and refetch.

## 9. HR

| Screen | Call | Gate |
|---|---|---|
| Employees | `GET /identity/users?search&role&active` · `POST` · `PATCH /identity/users/{id}` (incl. `active:false` → signed out immediately) · `PUT …/{id}/password` (also gives a no-login employee a login) | Admin, HR (HR cannot create/edit Admin or HR accounts) |
| Designations | `GET /identity/designations?includeInactive=true` (any staff) · `POST`, `PATCH /{id}` (rename updates everyone holding it) | Admin, HR |
| Attendance board | `GET /attendance/board?date=` | Admin, HR |
| A person's month | `GET /attendance/users/{userId}?month=YYYY-MM` | Admin, HR any · others only themselves |
| My attendance | `GET /attendance/me?month=` | any staff on attendance |
| Correct / remove a day | `PUT /attendance/users/{userId}/days/{date} { inAt, outAt?, note? }` · `DELETE` | Admin, HR. Times are ISO instants that must fall on that business date. |
| Demo data | `POST /attendance/simulate { days }` | Admin, HR |
| Salary | `GET /salary/{month}` · `POST …/generate` · `PATCH …/users/{userId} { payable, note? }` · `POST …/finalize` · `GET …/export.csv` (needs the bearer header: fetch → blob, not a plain link) | Admin, HR |
| GPS check-in/out | `POST /attendance/check-in`/`check-out` | **mobile app only**; the web shows read-only |

Day `status`: `PRESENT`, `ABSENT`, `OFF` (weekly off), `FUTURE`; plus `missingOut`, `corrected` (flag + one `note`; there is **no change history**) and `method` (`GPS`, `BIOMETRIC_SIM`, `MANUAL`). There is **no leave**.

## 10. Notifications, deep links

`GET /notifications?unread=true&page` · `GET …/unread-count` · `POST …/{id}/read` · `POST …/read-all`.
Types: `LEAD_ASSIGNED`, `LEAD_WON`, `PROPOSAL_SEEN`/`_UNSEEN`/`_NO_ACTION`, `LEAD_STAGNANT`, `PROJECT_CREATED|ASSIGNED|POST|COMMENT|APPROVED|CLOSED`, `TODO_ASSIGNED|DUE_CHANGED|COMPLETED|COMMENT|OVERDUE`, `FILE_ADDED|SHARED`, `COMPLAINT_RAISED|ASSIGNED|RESOLVED|REOPENED|CLOSED|OVERDUE`.

`ref.kind` → route: `LEAD → /leads/{id}` · `PROPOSAL → /proposals/{id}` · `PROJECT → /projects/{id}?post={postId}` (scroll to the post; `?file={fileId}` for documents) · `TODO → /projects/{projectId}?tab=todos&todo={id}` · `COMPLAINT → /complaints/{id}`.

## 11. Settings (Admin)
`GET /settings` → array of `{ key, group, label, description, type: boolean|number|text|longText, value, default, isDefault, min, max, updatedAt, updatedById }` · `PATCH /settings { values: { key: value } }` (all-or-nothing; `400` names the bad `values.<key>` in `data[].path`) · `DELETE /settings/{key}` (reset). Groups: Projects, Leads, Reminders, Proposals, Documents, HR, Company. **`hr.weeklyOff` is a text setting with its own grammar** (`SUN; SAT:1,3`); give it a dedicated editor (§screens 11) that produces the string and shows the server's hint on `400`.

## 12. Who can call what (summary)

| Area | Admin | HR | Sales | Designer | Technician | Office | Customer |
|---|---|---|---|---|---|---|---|
| Dashboard | all | attendance only | – | – | – | – | – |
| Leads | all | – | own | – | – | all, no status/calls | – |
| Proposals | all | – | own | – | – | – | public link |
| Projects | all | – | member / summary | member | member | member | own |
| To-dos / Docs | all | – | member | member | member | member | docs only (flat, shared) |
| Complaints | all | – | raise (own projects) | raise (own projects) | assigned | all | own |
| Attendance | all | all | own | own | own | own | – |
| Employees / Salary | all | all (HR: not Admin/HR accounts) | – | – | – | – | – |
| Settings | ✅ | – | – | – | – | – | – |
