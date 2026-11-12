# Mobile inventory: the project workspace

Scope: projects grid, workspace shell, chat/feed, to-dos, complaints, docs, the standalone
/todos and /complaints pages, and photo uploads. Source of truth is the code as of 2026-11-12.
Claims not confirmed in code are marked UNVERIFIED. Verdict key: INCLUDE (ship in v1 as is),
ADAPT (ship, but redesigned for the phone), LATER (post-v1), EXCLUDE (never on mobile).

Paths: web = `apps/web`, api = `apps/api/src`, contracts = `packages/contracts/src`.
The API envelope and auth (Bearer access token, refresh on 401, one retry) live in
`web/lib/api/client.ts`; see the auth research doc for token storage on the phone.

---------------------------------------------------------------------------------------------

## 0. Cross-cutting rules (read first)

### 0.1 Who is "on" a project (the real access model)

Access is by relationship to the project, never by role name (api `modules/projects/application/services/projectAccess.ts`).

| Viewer | How decided | Sees |
|---|---|---|
| Admin | `scopeFor(role,'projects')==='all'` (`shared/access/scope.ts`; only ADMIN) | every project, every tab, every action |
| Member | `project.memberIds` contains user (any staff role: DESIGNER, TECHNICIAN, OFFICE, HR, SALES if added) | chat (both tabs), to-dos, complaints, docs |
| Customer | `project.customerId === user.id` | CLIENT posts only, complaints about own project, shared docs only; never to-dos, never team activity |
| Lead owner (SALES not on project) | `leads.canAccess` | summary + lead journey only (`loadForSummary`); no feeds. Web shows `Summary` (`project-detail.tsx`) |
| Anyone else | , | 404 "not found" (ids cannot be probed) |

Project list: `visibleTo = actor.id` matches `customerId` OR `memberIds`
(`mongoProject.adapter.ts:88`), so a customer's list is exactly their projects.
Admin-only project actions (route-level `requireRole`, `projects.route.ts`): create, PATCH edit,
PUT members, POST stage, POST close. Design stage: ADMIN or DESIGNER who is the project's designer
(`projects.usecases.ts:295`, route allows ADMIN+DESIGNER).

`web/lib/projects.ts projectPermissions()` is cosmetic duplication of this; mobile should derive
the same flags but treat the API as the gate. Gap: ProjectDto has no `can` block (complaints and
posts do), so the client re-derives `isMember` from `members[]` and role.

### 0.2 CLOSED project rules (what the API actually enforces)

| Thing | Enforced by API when stage==='CLOSED' | Web UI |
|---|---|---|
| Create post | YES, 409 "This project is closed." (`feed.usecases.ts:98`) | composer replaced by banner |
| Sign project photo upload | YES, 409 (`feed.usecases.ts:274`) | n/a |
| Create comment | NO (no stage check in `CreateCommentUseCase`) | Reply hidden |
| To-dos create/edit/complete | NO | tab usable (`closed` prop unused) |
| Raise complaint | NO | button hidden (`raisable && !closed`) |
| Docs upload/share | NO | banner "Documents are still available" |

Mobile must mirror the web UI (hide post/comment/raise on closed) but cannot rely on the API for
comments, to-dos, complaints (API GAP: UI-only rule, a stale client or a race can still write).
Closing needs a FINAL_DELIVERY post with photos (`projects.usecases.ts:318`). Reopen = POST
`/projects/:id/stage` `{stage:'DESIGN'|'SITE'}` (clears `closedAt`). Closed projects are greyed in
the grid and hidden behind "Show closed".

### 0.3 Realtime: how the web behaves today

- No websocket, no SSE, no push. Verified by grep (`refetchInterval|EventSource|WebSocket`): the only
  polling is the notification bell (`GET /notifications/unread-count`, 30 s + focus,
  `lib/api/queries.ts`), dashboard (60 s), HR attendance (60 s) and a SENT proposal (30 s).
- Workspace data (feed, to-dos, complaints, docs) is request/response only. React Query defaults
  (`app/providers.tsx`): `staleTime 20 s`, `refetchOnWindowFocus true`. `useMyTodos` also refetches on focus.
  So the feed shows another person's new post only after a tab refocus (and >20 s since last fetch),
  a mutation by me (invalidates posts + timeline), or a manual reload.
- Every mutation invalidates broad key families (posts, timeline, complaints, todos, dashboard)
  rather than patching caches. Only the to-do checkbox is optimistic (`useToggleTodo`).
- Server-side events exist (`shared/events/appEvents.ts`, `subscribers.ts`) and create in-app
  notification rows (types in contracts `notifications.ts`), plus WhatsApp via `shared/whatsapp`.
  No device-token table, no Expo/FCM/APNs code anywhere in `apps/` or `packages/` (grep:
  deviceToken/fcm/apns/expo-server: zero hits). Push is therefore a NEW backend feature.

Phone recommendation (applies to every list below):
1. v1: refetch-on-focus + refetch-on-app-foreground (AppState `active`) + pull-to-refresh, with
   `staleTime` ~15-20 s, mirroring web. While a chat screen is focused and foregrounded, poll the
   first page every 10-15 s (cheap: one `GET /projects/:id/timeline?limit=20`); stop on blur/background.
2. v1.5: Expo push for the types in section 9 (a deep link payload `{kind,id,projectId,postId}` is
   already modelled by `NotificationRefDto`). Push should trigger a refetch, not carry content.
3. Later: SSE/WebSocket only if chat latency complaints appear. Not needed for a design-review workflow.

### 0.4 Pagination summary

| Endpoint | Style | Params | Notes |
|---|---|---|---|
| `GET /projects` | page/pageSize | `page, pageSize(max100), search, stage, designStage, designerId, customerId, leadId` | web grid asks `pageSize=100`, no paging (silent cap 100). Returns `PaginatedDto<ProjectDto>` |
| `GET /projects/:id/posts` | time cursor | `visibility?, before, limit(<=50, default 20)` | `PostPageDto{items,nextCursor}`; newest first; cursor = ISO `createdAt` of last item, filter `createdAt < before` (`mongoPost.adapter.ts:53`). Fetches limit+1 to compute `nextCursor` |
| `GET /projects/:id/timeline` | time cursor | `before, limit(<=50)` | `TimelinePageDto`; merges posts + team activity, each source read limit+1, sorted desc, sliced. Web uses limit 30 |
| `GET /projects/:id/posts/:postId/comments` | none | , | returns ALL comments (unbounded). `PostDto.recentComments` holds latest 3 (`RECENT_COMMENTS=3`), `commentCount` total |
| `GET /complaints` | page/pageSize | `page,pageSize(<=100),status,projectId,assignedTo=me` | standalone page loads pageSize 100, groups client-side |
| `GET /projects/:id/todos`, `/todos/mine`, `/projects/:id/folders`, `/projects/:id/files` | none | filters only | unbounded arrays |

Cursor caveat (UNVERIFIED in practice): strict `createdAt < before` at millisecond resolution can
skip a row if two posts share the same millisecond across a page boundary; negligible for human posting.
Gap: there is NO `after`/`since` parameter, so "give me what is new since X" is not possible; the phone
refetches page 1 and merges by id.

### 0.5 Upload flow end to end (photos), and what the phone does differently

Web flow (`web/hooks/use-image-uploader.ts`, `lib/upload.ts`):
1. Pick files; client-checks (`imageProblem`): must be `image/*`, <= 10 MB (`MAX_IMAGE_BYTES`),
   caps: 20 per post, 5 per comment, 10 per to-do (`MAX_TODO_IMAGES`), 5 per complaint / resolution.
2. SIGN: `POST /projects/:id/uploads/sign` body `{}` -> `UploadTicketDto{url,method:'POST',fileField,fields,expiresAt}`
   (project feed, to-do photos, to-do comments; 409 if project CLOSED). Complaint raise:
   `POST /complaints/uploads/sign {projectId}`; complaint resolve: `POST /complaints/:id/uploads/sign`
   (needs `can.resolve`). Docs (any file type): `POST /projects/:projectId/files/uploads/sign` `{}`.
   Ticket valid 55 min (`cloudinaryStorage.adapter.ts` `TICKET_MINUTES`). Image ticket signs
   `allowed_formats=jpg,jpeg,png,webp,heic,heif` and a per-project folder. 503 = storage not configured.
3. RELAY: `POST /api/uploads/relay?target=<ticket.url>` with `Authorization: Bearer`, multipart
   form: every `ticket.fields` entry first, exactly as given, then the file under `ticket.fileField`
   (`uploadRelay.route.ts`). The API streams it to Cloudinary untouched (no buffering) and returns
   Cloudinary's JSON (`public_id,width,height,bytes,resource_type`). Rules: target must be exactly
   `https://api.cloudinary.com/v1_1/<cloud>/(image|auto)/upload`; content-type must be
   multipart/form-data; `content-length` <= 60 MB (a missing header is read as 0 and passes the
   check but will break the upstream request: UNVERIFIED, so always send a length).
   Web uses XHR (for `upload.onprogress`); the relay exists so the browser never calls Cloudinary.
4. ATTACH: client sends `images:[{publicId,width?,height?,bytes?}]` (`ImageInputDto`) with the post /
   comment / to-do / complaint. The API checks each `publicId` is inside THIS project's folder
   ("A photo does not belong to this project." 400) and builds thumb/full URLs (`ImageDto`: `url`,
   `thumbUrl` ~480 px, `f_auto/q_auto`).
   Docs register instead: `POST /projects/:projectId/files` (`RegisterFileBodyDto`: publicId, format,
   originalName, bytes, resourceType?, name?, folderId?, visibility) , idempotent (same upload twice
   returns same file); server enforces extension list (`DOC_EXTENSIONS`: pdf, office, csv, txt, rtf,
   jpg/png/webp/heic/heif/gif, dwg, dxf, skp) and the `docs.maxFileMb` setting.
5. CANCEL: removing a thumbnail or dismissing the composer calls `DELETE /api/uploads?publicId=...`
   (best effort, errors swallowed). Server only deletes ids shaped
   `<root>/projects/<24hex>/(files/)?<name>` AND not referenced by any post, comment, to-do, to-do
   comment, complaint (incl. resolution images) or doc (409 "already in use"). Orphans from crashed
   sessions are never collected (GAP: no sweeper).
6. The post button is disabled while any item is `uploading`; failed items stay with Retry.
   The signed ticket is fetched ONCE per batch and reused for the parallel uploads.

What the phone must do differently:
- Pick/capture with `expo-image-picker` / `expo-camera` (multi-select, camera). iOS gives HEIC: allowed
  by the signature, but convert/resize on device anyway.
- Compress before upload (target long edge ~2048 px, JPEG q~0.8 via `expo-image-manipulator`), so a
  12 MP photo is ~1-3 MB and well under the 10 MB web rule. Keep EXIF orientation applied. Strip GPS
  unless wanted (customers see these photos).
- Do not rely on the 55-minute ticket across a long offline gap: sign lazily at upload time, and on
  4xx from relay/Cloudinary (expired signature) re-sign once and retry.
- Retry policy: exponential backoff on network errors/5xx, per-file; keep the file + metadata in a
  persistent outbox so app kill does not lose it. `expo-file-system` background upload sessions
  (`uploadAsync` with `BACKGROUND` type on iOS) can post the multipart directly to the relay with the
  Bearer header; on Android use a foreground service/WorkManager-style library (UNVERIFIED which
  library). Show per-file progress, allow cancel, then `DELETE /uploads` for finished-but-unattached ids.
- Posting is two-phase and the second phase (`POST /posts`) has NO idempotency key: a retried POST after a
  timeout can double-post. The phone outbox must dedupe (GAP, see section 10).
- Video is not accepted (`allowed_formats` is images only; docs list has no video). Hide video in the picker.
- Consider uploading directly to `ticket.url` and skipping the relay: contracts describe the ticket as
  provider-neutral "upload straight to storage" and the relay is a browser CSP/CORS convenience
  (UNVERIFIED reason). Direct upload saves API bandwidth and avoids the 60 MB/2 MB-JSON-limit path, but
  skips the server's URL allow-list; decide with backend (recommend keep relay for v1: one auth path).

---------------------------------------------------------------------------------------------

## 1. Projects grid (web `/projects`, `components/projects/projects-view.tsx`)

- Purpose: choose a project. Mobile equivalent: the "Projects" tab / inbox.
- Roles: all roles with projects. Admin and SALES "choose between many"
  (`CHOOSES_PROJECTS=['ADMIN','SALES']`); everyone else, if the list has exactly 1 item and no search,
  is redirected straight into that project (`router.replace`, "like a chat app"). Customers
  therefore normally land directly in their single project.
- Data: `ProjectDto` per card: name, customer name, stage badge (DESIGN/SITE/CLOSED), design-stage chip
  (NOT_STARTED/IN_DESIGN/SHARED/APPROVED), value (hidden when closed), designer name, "opened X ago".
  Sorted newest-created first client-side; `ongoing` vs `closed` split client-side.
- Actions: search (300 ms debounce, server `search`), "Show closed (N)" toggle, tap card, "New project"
  (Admin only, see below).
- API: `GET /projects?pageSize=100&search=` -> `PaginatedDto<ProjectDto>` (`useProjectGrid`).
- States: skeleton cards; error with retry (`ErrorState`) only if no cached data; empty
  "No ongoing projects" / "No projects match your search" / hint to use Show closed.
  Closed cards greyscale. Lead-owner SALES see projects they own leads of? No: list is by
  member/customer; SALES who are not members reach a project only via lead -> projects
  (`GET /projects?leadId=`), and then see the summary.
- Web-specific to change: 3-col card grid -> single-column list; value in INR short. On phone show
  last activity preview + unread dot (GAP: no field for either, see section 10).
- Phone-only: pull-to-refresh; persistent last-opened project; open straight into the single project
  with the root shell showing project tabs; Android back returns to list only when list has >1 items.
- Realtime: refetch on focus; no polling.
- New project dialog (`new-project-dialog.tsx`, `POST /projects`, `CreateProjectBodyDto`: customerId XOR leadId,
  name, siteAddress?, value?): Admin only. Verdict LATER (projects are auto-created when a lead is
  won; manual create is rare admin work). Edit project (`PATCH /projects/:id`) and Team
  (`PUT /projects/:id/members`): ADAPT-later/LATER for Admin (low frequency, fine on web).
- Verdict: grid INCLUDE (ADAPT to list), search INCLUDE, Show closed INCLUDE, create/edit/members LATER.

## 2. Workspace shell (web `components/projects/project-detail.tsx`)

- Purpose: one project's home. Left nav (md+) / pill row (phone): Chat, To-do, Complaints, Docs.
  To-do is hidden for customers (`seesTeam = isAdmin || isMember`). Summary-only viewers get no nav, just
  the lead journey (`GET /projects/:id/journey`).
- Top bar (fixed): back link ("Projects" or "Complaints"/"My to-dos" if `?from=`), project name,
  customer name, stage badge, design-stage chip, feed toggle Everything | Client view (Chat tab,
  staff only), Info button (sheet), Actions menu (only if allowed).
- Info panel (`Rail`): Stage select (Admin; closed shows "Reopen as Site/Design" buttons), Design
  stage select (Admin or this project's designer; hidden when closed), Team list with Designer tag,
  Customer, Site address, Value, Created, Closed date, "Lead journey ->" link (not for customer).
  API: `PATCH /projects/:id/design-stage {designStage}`, `POST /projects/:id/stage {stage}`.
- Actions menu: Edit project (Admin), Team (Admin), Invite customer (Admin or SALES; not shown to the
  customer), Close project (Admin, not closed). Invite: `POST /identity/customers/:customerId/invite`
  -> `{url,expiresAt}` (`InviteDialog`). Close: `POST /projects/:id/close`, if no final-delivery post
  the dialog sends the user to Chat with the composer in final-delivery mode.
- URL state: `?tab=feed|todos|complaints|docs`, `?todo=<id>`, `?complaint=<id>`, `?from=` , used as
  deep links by notifications and the standalone pages. Mobile: use router params with the same names
  (`/project/[id]?tab=&todo=&complaint=&post=&file=`), so a push payload maps 1:1.
- States: skeleton; 404 -> NotFoundView (also what a non-member gets); other error -> retry.
- API: `GET /projects/:id` -> `ProjectDto` (access: `loadForSummary`).
- Web-specific to change: left rail + top bar -> native header (back, title, chips collapsed into a
  subtitle line) + bottom or top segmented tabs (Chat, To-do, Complaints, Docs, max 4; no "More"
  needed). Info panel -> bottom sheet. Dropdown -> action sheet. Feed toggle -> segmented control or
  header chip; consider a persistent "Visible to client" lock affordance because the default is TEAM.
  Per-viewer tab sets: customer = Chat, Complaints, Docs.
- Phone-only: header badges per tab (open complaints, my overdue todos); swipe between tabs;
  share-sheet for invite link; call/WhatsApp customer from info sheet (phone is in `ProjectDto.customer.phone`);
  open site address in Maps.
- Verdict: shell ADAPT, info sheet ADAPT, stage/design-stage change INCLUDE (designer uses it daily),
  close project INCLUDE (admin, needs final delivery first), invite customer INCLUDE (share sheet),
  edit project / team LATER.

## 3. Chat / feed (Basecamp-style) (web `feed.tsx`, `post-card.tsx`, `feed-rows.tsx`, `photos.tsx`)

### 3.1 What it is
A single oldest-at-top stream with a composer pinned at the bottom (chat layout, though the API
pages newest-first and the client reverses). Max reading width 680 px.

### 3.2 Roles and visibility
- Post visibility `CLIENT` (team + customer) or `TEAM` (staff on project only). Default for new
  posts is TEAM ("nothing reaches the customer by accident"). Customer's posts forced to CLIENT
  (`feed.usecases.ts:102`). `FINAL_DELIVERY` kind: needs >=1 photo, forced CLIENT, customer cannot
  create (403). (contracts `projects.ts createPostBodySchema`.)
- Staff toggle: "Everything" = `GET /projects/:id/timeline` (all posts + team activity rows);
  "Client view" = `GET /projects/:id/posts?visibility=CLIENT&limit=20` (preview of what the customer sees).
  Customer always uses the CLIENT variant and never gets activity (`timeline.usecases.ts`: activities
  skipped when `viewer.isCustomer`).
- Delete post: author or Admin (`canDelete`, `deletePost` 403 "only your own posts"). Delete comment:
  author or Admin. No edit of posts/comments exists in the API.
- Approve: only the customer, only on a CLIENT post with photos not authored by the customer, once
  (atomic; repeat is a no-op). `canApprove` flag comes from the API. Records `approval{by,at}` and
  notifies team (PROJECT_APPROVED).

### 3.3 Data shown per item
- `PostDto`: author (name, designation or "Customer"), time (relative on phone, absolute column on
  desktop), text, photo grid (1-4 tiles, "+N" overlay, tap = full-screen viewer with prev/next),
  badges "Team only" and "Final delivery" (green left border), approval pill, up to 3 `recentComments`,
  "Show all N comments", Reply, Delete (hover-only on desktop, always visible on touch), "Save to Docs".
- Activity rows (`feed-rows.tsx`, `lib/project-activity.ts`): compact grey line "who did what: subject" for
  TODO_*, FILE_*, FILES_SAVED; staff only. COMPLAINT_* activity types are FILTERED OUT of the stream (the
  complaint card replaces them).
- Complaint cards and update rows in the chat: the Feed ALSO calls `GET /complaints?projectId=...`
  (default filters, page 1, pageSize 20) and merges: one card at `createdAt`, and one row per later
  event (ASSIGNED/RESOLVED/REOPENED/CLOSED) or conversation message, at its own time, with resolution
  photos shown only on the last RESOLVED row. While older timeline pages are unloaded, complaint
  items older than the oldest loaded item are withheld (`buildStream`). Tapping an update row scrolls to
  the card (`#complaint-<id>` flash) or, if not loaded, opens `?tab=complaints&complaint=<id>`.
  Complaints are shown to the customer too (their own project). GAP: only 20 complaints/project are merged
  (older ones silently never appear in chat) and each complaint embeds full history and comments, heavy.

### 3.4 Actions and API calls
| Action | Call | DTO |
|---|---|---|
| Load newest | `GET /projects/:id/timeline?limit=30` or `GET /projects/:id/posts?visibility=CLIENT&limit=20` | `TimelinePageDto` / `PostPageDto` |
| Auto-load older | `...&before=<nextCursor>` when scrolled within 120 px of top; also loops while content is shorter than the pane; preserves scroll offset | same |
| Create post | `POST /projects/:id/posts` | `CreatePostBodyDto{text<=5000, images<=20, visibility, kind}` -> `PostDto` |
| Delete post | `DELETE /projects/:id/posts/:postId` | |
| Approve | `POST /projects/:id/posts/:postId/approve` | -> `PostDto` |
| Reply | `POST /projects/:id/posts/:postId/comments` | `CreateCommentBodyDto{text<=2000, images<=5}` -> `CommentDto` |
| All comments | `GET /projects/:id/posts/:postId/comments` | `CommentDto[]` (oldest first) |
| Delete comment | `DELETE /projects/:id/posts/:postId/comments/:commentId` | |
| Photos | sign + relay + attach, section 0.5 | |
| Save to Docs | `POST /projects/:projectId/files/from-photos` | `SaveFromPhotosBodyDto{items<=20 {publicId,name?}, folderId?, visibility}` -> `SaveResultDto` |

Composer behaviour (`Composer` in feed.tsx): single-line auto-growing textarea (max 128 px) +
photo button + send. Focusing it opens an options tray: photo thumbnails with progress/retry,
checkbox "Show to customer", checkbox "Final delivery" (forces client-visible, needs a photo),
Cancel (discards uploads). Cmd/Ctrl+Enter sends. Hidden for customers: the checkboxes (their
posts are always client). Post button disabled when empty, final-delivery without photo, uploading,
or pending. On success: toast, clear, scroll to bottom. Reply composer (`CommentComposer`) is
per-post, inline, with up to 5 photos.

### 3.5 States
Loading skeleton; error card with retry; empty "No posts yet / Share an update or a photo to get
started" (hint hidden when closed); "Loading older..." strip; closed banner replacing the composer
("takes no new posts or comments. Reopen it to continue."); delete confirm dialogs.
Approval and final delivery are visual states on the post.

### 3.6 Web-specific behaviour that must change on a phone
- Hover-revealed delete (`md:opacity-0 group-hover`): use long-press / swipe / overflow menu.
- Cmd+Enter send: Send button only; Return = newline.
- Three nested scroll containers (pane + dropdown): use a single inverted FlatList (`FlashList`
  inverted) with `onEndReached` for older pages instead of the scrollTop<120 listener and
  scrollHeight fix-ups.
- Composer options tray with two checkboxes: replace with a prominent audience toggle chip
  ("Team only" / "Client can see") always visible in the composer bar; default TEAM; colour the
  composer differently when client-visible. Final delivery moves to a "..." option or a dedicated
  "Final delivery" action (also launched by the Close flow).
- Photo viewer dialog -> full-screen pager with pinch-zoom, swipe-down to dismiss, share/save to gallery.
- Per-post inline reply -> "Reply" opens the post thread in a screen or bottom sheet with its own
  composer (keyboard-safe); keep inline 3 recent comments in the feed.
- Date column removed on phones already (relative time shown with `sm:hidden`).
- Complaint cards + update rows can stay as-is in the stream, but tapping should push the native
  complaint detail screen rather than scrolling/flashing.

### 3.7 Phone-only opportunities
- Camera straight into chat: a camera button in the composer opens the camera; shoot several photos
  in a row (site visits), each starts uploading immediately; keep-on-device as drafts.
- Site-visit mode: technician posts "photos + one line" in two taps (default TEAM, flip to client).
- Push deep link: PROJECT_POST/PROJECT_COMMENT/PROJECT_APPROVED carry `{kind:'PROJECT',id,postId}`
  -> open the project Chat scrolled to that post (web does `?post=` ; verify the feed handles the
  param: UNVERIFIED, the web code reviewed does not read `post` in `Feed`).
- Share sheet: share a photo from gallery/WhatsApp INTO a project chat or Docs (needs share
  extension; LATER). Share a post's photos out (save/WhatsApp to customer) via native share.
- Offline drafts: persist composer text + selected local photos per project; outbox with retry and
  "sending..." / "not sent, tap to retry" bubbles. Needs idempotency (section 10).
- Haptics: success on Approve, send, check-off; warning on failed send.
- Pull-to-refresh at the newest end (inverted list: pull at bottom is awkward; use a "New posts" pill
  or a header refresh) and refetch on foreground.
- Notification badge on tab and project row; clear when chat opens.
- Long-press post: copy text, save photo, delete (if `canDelete`), Save to Docs.

### 3.8 Realtime
See 0.3. Web: invalidation after my own mutations + focus refetch; no polling in the feed. Phone:
poll page 1 every 10-15 s only while focused; on push, refetch. Merge by id; when new items arrive and
the user is scrolled up, show a "New messages" pill instead of jumping.

### 3.9 Verdict
Feed/timeline reading INCLUDE; composer with photos INCLUDE (ADAPT: audience toggle, camera first);
comments/Reply ADAPT (thread screen); Approve INCLUDE (customer's key action, big button + haptic +
confirm); Final delivery INCLUDE; delete INCLUDE; Save to Docs ADAPT (action-sheet item);
Client-view toggle ADAPT (segmented control; also consider a "Preview as customer" mode);
auto-load older ADAPT (`onEndReached`); complaint cards in chat INCLUDE (ADAPT, section 5.3).

## 4. To-dos (web `todos-tab.tsx`, `todo-drawer.tsx`, `todo-bits.tsx`, `lib/todos.ts`)

### 4.1 Roles
Team only: Admin and project members (`todoAccess.ts`). Customer and non-members get 404. Closed
project: no server restriction (0.2). Any member can edit/complete/reopen any to-do (no
assignee-only rule found in `todos.usecases.ts`); delete = creator or Admin (`canDelete`).
Assignees and "notify when done" must be active non-customer project members or Admin
(`assertPeople`, 400 "Choose people who are on this project."). Creator is always notified on done.

### 4.2 In-project tab (`TodosTab`)
- UI: "Add a to-do..." quick-add (title only, max 200) -> `POST /todo-lists/:listId/todos`; the tab uses ONE
  flat list: the project's first list; if none, silently `POST /projects/:projectId/todo-lists {name:'To-dos'}`
  then create. (Lists exist in the API with archive/rename `PATCH /todo-lists/:id` but the UI hides them.)
- Filter: segmented Open / Done / All (client-side over a status=all fetch, so counts agree),
  toggle "Assigned to me" (server `assignee=me` -> separate query key), counter "X of Y done".
  An open to-do stays visible even if filter would hide it.
- Row: checkbox (optimistic toggle in every cache, rolled back on error), title (strike-through when done),
  due badge (`dueChip`: Overdue . N days red, Due today amber, tomorrow blue, else date), up to 3
  assignee avatars (+N), comment count; tap row = expand in place (inline `TodoDetail` card).
- Expanded detail (`todo-drawer.tsx`): editable title, notes, due date (`<input type=date>` ->
  `todoDueSchema` YYYY-MM-DD, business day not UTC; `isOverdue` is server-computed), Assigned to
  (multi-pick from `project.members`), "When done, notify" (multi-pick), photos (<=10), dirty-state
  Save (PATCH only if changed), delete confirm, discussion thread with comment composer (text+<=5 photos).
- States: skeleton rows; error + retry (lists or todos); empty copy varies ("No to-dos yet / Add the first
  one above", "Nothing completed yet", "Nothing assigned to you", "All caught up").

### 4.3 API
| Action | Call | DTO |
|---|---|---|
| Lists | `GET /projects/:projectId/todo-lists` | `TodoListDto[]` (openCount, doneCount) |
| Create list | `POST /projects/:projectId/todo-lists` | `CreateTodoListBodyDto` |
| Todos | `GET /projects/:projectId/todos?status=open|done|all&listId&assignee=me|id` | `TodoDto[]` |
| One | `GET /todos/:todoId` | `TodoDto` |
| Create | `POST /todo-lists/:listId/todos` | `CreateTodoBodyDto{title,notes?,images,assigneeIds,notifyOnDoneIds,dueOn?}` |
| Update | `PATCH /todos/:todoId` | `UpdateTodoBodyDto` (partial; null clears; listId moves) |
| Complete / reopen | `POST /todos/:todoId/complete|reopen` | idempotent, atomic; writes timeline activity + alerts |
| Delete | `DELETE /todos/:todoId` | soft delete |
| Comments | `GET/POST /todos/:todoId/comments`, `DELETE .../comments/:commentId` | `TodoCommentDto`, `CreateTodoCommentBodyDto` |
| Photo ticket | `POST /projects/:id/uploads/sign` (project feed ticket; no to-do-specific sign) | |

### 4.4 Standalone /todos ("My to-dos", `my-todos-view.tsx`)
- `GET /todos/mine?status=open|all&scope=mine|all` -> `MyTodoDto[]` (todo + `project{id,name}`,
  `listName`, `bucket` OVERDUE|TODAY|UPCOMING|NO_DATE). `scope=all` only for Admin (others silently
  `mine`). Server drops to-dos on projects I can no longer open. Sorted by bucket then due date.
- UI: grouped under project name with "N overdue" and "Open project" link; "Show completed" toggle;
  Admin "Mine | Everyone" toggle; a to-do expands in place with the same detail, "Open in project" deep link
  `/projects/:id?tab=todos&todo=:id&from=/todos`. Refetch on focus.
- Note: web groups by project (grouped lists), server ALSO provides `bucket` for day grouping
  (Overdue/Today/This week/Later/No date via `groupMine` in `lib/todos.ts`, evidently used elsewhere
  e.g. dashboard: UNVERIFIED).
- Mobile: make "My to-dos" a primary tab for TECHNICIAN/DESIGNER/OFFICE: sections by bucket (Overdue,
  Today, Upcoming, No date) is more useful on a phone than by project; keep project as a chip on each row.

### 4.5 Web-specific changes
Expand-in-place -> push a to-do detail screen (or bottom sheet); date input -> native date picker;
multi-picker popovers -> checkbox sheet; quick-add -> a sticky input above the keyboard; swipe row to
complete/delete; the hidden "lists" concept stays hidden (always use first list; same silent create).

### 4.6 Phone-only
Local notification/push for TODO_ASSIGNED, TODO_DUE_CHANGED, TODO_OVERDUE, TODO_COMMENT (deep link
`{kind:'TODO',id,projectId}` -> `/projects/:projectId?tab=todos&todo=:id`; notification `ref` without
projectId falls back to `/todos` on web); home-screen badge = overdue count (`TodoBucket`); haptic tick on
complete; "Remind me" via native calendar (LATER); attach site photo straight from camera.

### 4.7 Realtime
Web: focus refetch only (`useMyTodos`), mutation invalidation. Phone: refetch on focus/foreground,
pull-to-refresh, push for assignment.

### 4.8 Verdict
Project to-do list INCLUDE; My to-dos INCLUDE (primary for field staff); expanded detail ADAPT (screen);
create/assign/due/notify INCLUDE; photos on to-dos INCLUDE; comments INCLUDE; list management (rename/archive,
multiple lists) EXCLUDE (web UI does not expose it either); Admin "Everyone" scope LATER.

## 5. Complaints (web `complaints-tab.tsx`, `complaint-tile.tsx`, `complaint-detail.tsx`, `complaint-thread.tsx`, `complaint-actions.tsx`, `complaints-view.tsx`, `raise-dialog.tsx`)

### 5.1 Lifecycle and rules (api `complaintAccess.ts`)
OPEN -> ASSIGNED -> RESOLVED -> CLOSED (reopen: RESOLVED -> ASSIGNED, counted in `reopenCount`).
- See: Admin and OFFICE see all (`scopeFor(...,'complaints')`); everyone else only complaints they
  are assigned to, raised, or (customer) are about their project; others get 404.
- Raise: not TECHNICIAN or HR (`CANNOT_RAISE`, 403). Customer: own project. Staff: Admin/Office any
  project, others only projects they are members of.
- assign: Admin; status OPEN or ASSIGNED. resolve: Admin or the assignee; status ASSIGNED.
  reopen: Admin or the customer; status RESOLVED. close: Admin; status RESOLVED. Wrong status = 409,
  wrong actor = 403. The DTO carries `can{assign,resolve,reopen,close}` so clients never re-derive.
- Conversation: anyone who can see it may post until CLOSED (409 after).
- A technician assigned but not a member cannot open the project; web routes them to the standalone
  `/complaints/:id` page (`complaints/[id]/page.tsx`); everyone else is redirected into
  `/projects/:projectId?tab=complaints&complaint=:id`.

### 5.2 Complaints tab inside a project (`ComplaintsTab`)
- Tile grid (cover photo or placeholder, status badge, "Reopened xN" chip, description snippet,
  assignee, date). `GET /complaints?projectId=...` (page 1, pageSize 20) -> `PaginatedDto<ComplaintDto>`.
- "Show resolved (N)": active-for-me complaints are shown; resolved/closed are tucked unless they
  still await my action (`isActiveForMe`: RESOLVED and I can close/reopen). Open complaint is always
  shown even if tucked.
- Tap tile -> inline detail (`complaintId` in the URL `?complaint=`). "Raise complaint" button when
  `canRaiseComplaint(role) && !closed` (ADMIN, OFFICE, SALES, DESIGNER, CUSTOMER).
- Detail (`ComplaintCard`/`ComplaintDetail`): description, photo grid, who/when, resolution note +
  resolution photos, history list (`describeComplaintEvent`: Raised/Assigned/Resolved/Reopened/Closed by),
  the conversation (`ComplaintThread`) with reply box (text + photos up to 5) until closed, delete own
  message (author/Admin), and an action row driven by `can`.
- Raise dialog (`raise-dialog.tsx`): project select (from `GET /projects?pageSize=100`, skipped/pre-filled
  inside a project), description (<=2000), photos (<=5). `POST /complaints/uploads/sign {projectId}` then relay,
  then `POST /complaints` `RaiseComplaintBodyDto{projectId,description,images?}` -> `ComplaintDto`.
- Action dialogs: Assign (Admin; picks from active staff via `GET /identity/users?active=true&pageSize=100`,
  an Admin/HR-only endpoint) `POST /complaints/:id/assign {assigneeId}`; Resolve (note required <=2000, photos <=5)
  `POST /complaints/:id/uploads/sign` + `POST /complaints/:id/resolve {note,images?}`; Reopen (reason required
  <=500) `POST /complaints/:id/reopen {reason}`; Close (optional note <=500) `POST /complaints/:id/close {note?}`.
  Each returns the full `ComplaintDto`; on 409 the UI refreshes ("Someone else just updated this. Showing the
  latest." `STALE_MESSAGE`).
- Conversation: `POST /complaints/:id/comments` `AddComplaintCommentBodyDto{text?,images?}` and
  `DELETE /complaints/:id/comments/:commentId`, both return the whole `ComplaintDto` (no separate comments GET).
- Other: `GET /complaints/:id` -> `ComplaintDto`; `GET /complaints/counts` -> `ComplaintCountsDto`
  (scoped like the list; used by dashboard/tabs).

### 5.3 Standalone /complaints (`ComplaintsView`)
`GET /complaints?pageSize=100[&projectId][&assignedTo=me]` grouped by project (projects with most
active complaints first), filters: "Assigned to me", project select (only if >1 project), Clear,
"Show resolved (N)"; header "N need attention . M resolved"; Raise button. Tile opens inline detail,
"Open project" link (hidden for TECHNICIAN). States: skeleton tiles, error, empty variants (filtered /
nothing needs attention / no complaints).

### 5.4 Web-specific changes
Tile grid -> list rows with thumbnail; inline detail -> detail screen with sticky bottom reply bar;
dialogs -> bottom sheets or full-screen forms with native keyboards; project select -> picker; staff
assign list -> searchable sheet. Technician flow: land on "Assigned to me" and use detail screen without
project access (matches web fallback). Do NOT build standalone assign-picker logic around `/identity/users`
for non-Admins (403): the assign action exists only for Admin anyway.

### 5.5 Phone-only
- Raise a complaint with camera first (customer in kitchen: photo + one line + project preselected).
- Technician resolve with before/after camera photos; call customer / open site address in Maps.
- Push deep links: COMPLAINT_RAISED/ASSIGNED/RESOLVED/REOPENED/CLOSED/COMMENT/OVERDUE with
  `{kind:'COMPLAINT',id}` -> detail screen directly (web `refHref` goes `/complaints/:id` which then
  redirects into the project; on mobile open the detail directly; the notification ref has no projectId
  for complaints, so a project-wrapped screen requires fetching the complaint first).
- Share a complaint summary (WhatsApp) via share sheet (LATER); badge count from `/complaints/counts`.

### 5.6 Realtime
Web: no polling. Complaint detail is replaced by each mutation response. Phone: refetch on focus; push for
assignment/resolution/comments (most valuable realtime in the whole app because the customer waits on it).

### 5.7 Verdict
List/detail INCLUDE (ADAPT list rows); raise INCLUDE (customer + staff); assign INCLUDE for Admin; resolve
INCLUDE (technician's core flow); reopen INCLUDE (customer); close INCLUDE (Admin); conversation INCLUDE;
cards/updates in project chat ADAPT; Show resolved ADAPT (segmented Active | Resolved).

## 6. Docs (web `docs-tab.tsx`, `file-list.tsx`, `folder-dialogs.tsx`, `upload-zone.tsx`, `use-doc-uploader.ts`, `save-to-docs-dialog.tsx`, `lib/docs.ts`)

### 6.1 Roles (api `docsAccess.ts`)
Staff (Admin + members) see folders and every file, organise, share. Customer sees ONE flat list of
files shared with them (`shared=true`), no folders (folder endpoints 404/empty for them), uploads
always top-level and shared (`placement`), cannot rename/move/toggle sharing. Delete: uploader or
Admin (`canDelete`). Docs stay usable on closed projects (banner only). Non-members 404.

### 6.2 UI and data
- Staff (`TeamDocs`): left folder tree (new folder, nested up to `MAX_FOLDER_DEPTH=5`, rename/move/delete
  folder via `folder-dialogs.tsx`), breadcrumb, file search, switch "Share new uploads with client",
  upload zone (drag and drop + file picker) with per-file progress rows, gallery of `FileCard`s.
- FileCard: thumbnail/icon (`thumbUrl` for images), name, "Shared" / "Team only" chip, size
  (`formatBytes`), menu: Download (`downloadUrl`), Share with client / Make team only, Rename, Move,
  Delete. Click preview = `FileViewer`: image -> `previewUrl ?? thumbUrl`; pdf -> first-page
  `previewUrl` plus Download; other types -> Download only.
- `DocFileDto`: id, name, originalName, kind IMAGE|FILE, format, bytes, visibility, uploadedBy, url,
  thumbUrl, previewUrl, downloadUrl, canDelete, createdAt. `FolderDto`: id, parentId, name, fileCount.

### 6.3 API
| Action | Call | DTO |
|---|---|---|
| Folders | `GET /projects/:projectId/folders` | `FolderDto[]` (flat; client builds tree; customer gets []) |
| New / rename / move | `POST /projects/:projectId/folders`, `PATCH /folders/:folderId` | `CreateFolderBodyDto`, `UpdateFolderBodyDto` |
| Delete folder | `DELETE /folders/:folderId` | (empty-ness rule: UNVERIFIED, see `folders.usecases.ts`) |
| Files | `GET /projects/:projectId/files?folderId=<id|root>&search=&shared=true` | `DocFileDto[]` |
| One | `GET /files/:fileId` | `DocFileDto` |
| Sign | `POST /projects/:projectId/files/uploads/sign` | `UploadTicketDto` (`auto/upload`, no format list) |
| Register | `POST /projects/:projectId/files` | `RegisterFileBodyDto` -> `DocFileDto` (idempotent) |
| Update | `PATCH /files/:fileId` | `UpdateFileBodyDto{name?,folderId?,visibility?}`; sharing alerts customer (FILE_SHARED) |
| Delete | `DELETE /files/:fileId` | |
| Save to Docs | `POST /projects/:projectId/files/from-photos` | `SaveFromPhotosBodyDto` -> `SaveResultDto[{file,created}]` (no re-upload; max 20; a dated default name; writes FILES_SAVED activity) |

Upload flow for documents: same sign -> relay (target `.../auto/upload`) -> register; the doc uploader
falls back to `file.size` for bytes (raw uploads may omit it) and passes Cloudinary's `resource_type`
(`image` for PDFs, `raw` for Word/Excel). File picker accepts the `DOC_EXTENSIONS`; size limit is a server
setting `docs.maxFileMb` surfaced as the API's error message (client cannot know it up front: GAP).

### 6.4 States
Skeleton; empty folder/files messages; closed banner; upload error rows with retry/remove; search with
no match; customer empty "Files the team has shared with you. You can add your own too."

### 6.5 Web-specific changes
Two-pane tree -> single list with breadcrumb and a folder-first drill-down (native stack or in-place);
drag-drop removed; downloads become "open in viewer / share"; folder dialogs -> action sheets. Gallery
cards -> list/grid toggle. PDF/Office viewing: open natively (`downloadUrl` -> in-app viewer or system
"Open in..."), images via full-screen pager.

### 6.6 Phone-only
Scan-a-document / camera to Docs; document picker (`expo-document-picker`) incl. cloud drives;
open-with and share-sheet in/out (WhatsApp is the dominant source of drawings and PDFs; a share extension
that drops a file into a chosen project's Docs is high-value, LATER); save to device; cache recently
viewed files offline; push FILE_ADDED / FILE_SHARED (`ref` has `fileId` -> `?tab=docs&file=`; whether web
opens the viewer from `file`: UNVERIFIED).

### 6.7 Realtime
None; refetch on focus / after mutation.

### 6.8 Verdict
Browse + view INCLUDE; customer shared-files list INCLUDE; share-with-client toggle INCLUDE (staff);
upload INCLUDE (ADAPT: picker/camera/scan); Save to Docs from photo ADAPT (long-press action); download/open
INCLUDE; folder create/rename/move/delete ADAPT-minimal (create + move INCLUDE, rename/delete in an overflow
menu) or LATER if v1 is tight; DWG/DXF/SKP preview EXCLUDE (download/open-in only).

## 7. Notifications deep links relevant to the workspace
`web/lib/notifications.ts refHref(ref)`: PROJECT -> `/projects/:id?post=&file=&tab=docs`; TODO ->
`/projects/:projectId?tab=todos&todo=:id` (else `/todos`); COMPLAINT -> `/complaints/:id`. Mobile screens
must accept these params so one `ref -> route` function serves in-app list taps and push taps.
Types: see contracts `notifications.ts` (PROJECT_POST/COMMENT/APPROVED/CLOSED/ASSIGNED/CREATED, TODO_*,
COMPLAINT_*, FILE_*). Polled unread count `GET /notifications/unread-count` (30 s) drives the bell.

## 8. Role-by-role phone shell implications (workspace only)
| Role | Projects | Chat | To-dos | Complaints | Docs |
|---|---|---|---|---|---|
| ADMIN | all, search | read/post (TEAM/CLIENT), final delivery, close, stage | all + "Everyone" later | all, assign/close | all folders |
| DESIGNER | member projects | post renders to client, design stage | yes | raise, see own | yes |
| TECHNICIAN | member projects | team posts with site photos | primary: My to-dos | cannot raise; assigned only, resolve | yes |
| OFFICE | member projects | yes | yes | sees ALL complaints, can raise | yes |
| HR | only if made member | yes | yes | cannot raise | yes |
| SALES | member projects; else summary-only via lead | if member | if member | raise if member | if member |
| CUSTOMER | own projects (often one, opened directly) | Client tab only, approve, post, comment | none | raise, reopen | shared files, upload |

## 9. Push candidates (workspace)
Highest value first: complaint assigned/resolved/commented (technician/customer), design shared/new
client post and approval (customer/designer), todo assigned/due-changed/overdue, project post/comment.
Payload should hold `NotificationRefDto` fields. Respect TEAM-only: a push must never leak a TEAM post to the
customer (server decides recipients today via `projectAlerts.ts`/`todoAlerts.ts`: verify the same filter
when push is added, UNVERIFIED).

## 10. API gaps the phone will hit
1. No device-token registration and no push sender (new endpoint + Expo/FCM integration). No realtime channel.
2. No `since`/`after` delta on timeline/posts: phone polls page 1 and diffs; no unread counters per project and
   no `lastPostAt` / last-message preview on `ProjectDto`, so an inbox-style list (with unread dots) needs a new
   field or endpoint (`GET /projects` + `unread`).
3. `POST /projects/:id/posts` and the comment/complaint POSTs have no idempotency key: retries after timeouts
   can duplicate. Ask for `clientRequestId` (dedupe) for offline outbox. Docs register is already idempotent.
4. Chat merges complaints via `GET /complaints?projectId=` page 1 (20): older complaints vanish from chat;
   the response embeds full history + comments. Prefer a complaints-summary field in the timeline
   (e.g. COMPLAINT events as timeline items) or paged per-project endpoint.
5. Comments for a post are unpaginated (`GET .../comments`); to-dos, files, folders unpaginated; projects capped
   at 100 with no cursor.
6. Closed-project rule enforced only for posts and project upload-sign; comments, to-dos, complaints, docs are
   UI-only (0.2).
7. No edit for posts/comments (delete only); no @mentions, read receipts or typing; no link previews.
8. `ProjectDto` has no `can{}`; roles/membership must be re-derived on device. Technician-on-complaint without
   project membership gets complaint but not project (needs deep-link fallback).
9. Upload relay: 60 MB cap, 2 MB JSON cap elsewhere; missing `content-length` behaviour UNVERIFIED; no resumable
   or chunked upload; no orphan cleanup; video unsupported.
10. `docs.maxFileMb` is server-side only; client cannot pre-validate. No thumbnail for PDFs beyond page 1; no
    DWG/DXF/SKP preview.
11. `GET /identity/users` (staff picker for complaint assign, project team) is Admin/HR only: fine because only
    Admin assigns, but the phone's "Team" pickers must use `project.members` for to-do assignees.
12. Notification `ref` for COMPLAINT lacks `projectId`; for PROJECT lacks tab hint except `fileId`.
13. Cursor semantics rely on `createdAt` millisecond timestamps (tie risk, UNVERIFIED in practice).
14. Photo `ImageDto.url` is a public Cloudinary delivery URL (not auth-gated): anyone with the URL can fetch it, so
    the phone must not log or share it casually. UNVERIFIED whether URLs are signed/expiring (build in
    `cloudinaryStorage.adapter.ts` appears to produce plain delivery URLs).

## 11. Verdict table
| Feature | Verdict | Why |
|---|---|---|
| Projects list, search, Show closed | INCLUDE (ADAPT to list) | daily entry point; customers skip it |
| New project / edit / team | LATER | rare admin work, auto-created from won leads |
| Workspace shell, info sheet | ADAPT | native header, segmented tabs, bottom sheet |
| Stage / design-stage change, close, invite | INCLUDE | quick admin/designer actions; invite via share sheet |
| Chat read (timeline / client view) | INCLUDE | core |
| Composer + photos | INCLUDE (ADAPT) | camera-first, audience chip, outbox |
| Reply / comments | ADAPT | thread screen |
| Approve design | INCLUDE | customer's key action |
| Final delivery | INCLUDE | needed to close project |
| Activity rows | INCLUDE | staff context, small |
| Complaint cards in chat | ADAPT | open native detail |
| To-dos (project) | INCLUDE | |
| My to-dos | INCLUDE | primary for technician/designer |
| Todo list management | EXCLUDE | hidden on web too |
| Complaints list/detail/actions | INCLUDE | customer-facing, technician core |
| Docs browse/view/upload/share | INCLUDE | |
| Docs folder admin | LATER (or minimal) | |
| Save to Docs from photo | ADAPT | long-press |
| Share-extension into project | LATER | high value, extra native work |
| Realtime | polling now, push next | no backend support yet |
| Video capture | LATER | API does not accept video |
