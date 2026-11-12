# Mobile — Projects and the project chat

The projects list, the project screen shell (top bar, segments, Info sheet) and the chat that is the default tab of every project: posts with photos, team activity lines, complaint cards, Reply, Approve, final delivery, Save to Docs. The server is the authority: access is decided by the person's **relationship to the project**, never by role name. The phone mirrors what the web shows and hides what the server would refuse, but it never relies on hiding. Companions: [`todos.md`](todos.md), [`complaints.md`](complaints.md), [`docs-files.md`](docs-files.md). Plan date 2026-11-12.

**Status key:** ✅ API exists and the web uses it. 📱 phone to build. ⚠ GAP: needs server work (or a stated client workaround until then).
**Source tags** (in the Rule column): `api:` = `apps/api/src/modules/`, `web:` = `apps/web/`, `c:` = `packages/contracts/src/`, `inv:` = `docs/mobile/research/inventory-project-workspace.md`.

## Roles

| Viewer (decided by data) | How decided | Sees in the project |
|---|---|---|
| Admin | `scopeFor(role,'projects') === 'all'` (ADMIN only) | every project; chat (Everything and Client view), To-dos, Complaints, Docs; every action |
| Member (any staff added to the project: Designer, Technician, Office, HR, Sales) | `project.memberIds` contains the user | chat (team + client posts), To-dos, Complaints, Docs |
| Customer | `project.customerId === user.id` | client-visible posts only, own complaints, shared docs; never To-dos, never team posts or activity lines |
| Lead owner (Sales, not a member) | `leads.canAccess` | summary and lead journey only; no feeds (`loadForSummary`) |
| Anyone else | none | `404 NOT_FOUND` "Project not found." (ids cannot be probed) |

Source: `api:projects/application/services/projectAccess.ts` (`viewerOf`, `loadAsMember`, `loadForSummary`).
The phone has no `can{}` block on `ProjectDto` (⚠ GAP 8), so it derives `isAdmin` (role), `isMember` (`members[]` contains me) and `isCustomer` (`customer.id === me`) from `GET /auth/me` and the project. Post, comment and complaint DTOs carry their own `can` flags: always use those.

## 1. The rules

| # | Rule | Status |
|---|---|---|
| 1 | **Project list = my projects.** `GET /projects` returns projects where I am `customerId` or in `memberIds`; Admin gets all. A customer's list is therefore exactly their projects. (`api:projects/infrastructure/mongoProject.adapter.ts` `visibleTo`; `inv` 0.1) | ✅ |
| 2 | **Open straight in when there is one.** For every role except Admin and Sales (web `CHOOSES_PROJECTS = ['ADMIN','SALES']`): if the list has exactly one project and no search text, the app replaces the list with that project. Customers normally land inside their only project. Android back from that project exits the app (no list to return to). (`web:components/projects/projects-view.tsx`) | 📱 |
| 3 | **Closed projects are hidden by default.** The list splits client-side into Ongoing and Closed; closed ones sit behind "Show closed (N)" and render greyed, without the value. The list is sorted newest-created first. (`web:projects-view.tsx`) | 📱 |
| 4 | **The list is capped at 100.** `pageSize` max is 100 and the web asks `pageSize=100` with no paging. The phone does the same and, if `total > 100`, shows a footer "Showing 100 of N. Search to find others." Search is server-side (`search`, 300 ms debounce). (`c:projects.ts listProjectsQuerySchema`; `inv` 0.4) | ⚠ no cursor past 100 |
| 5 | **Creating, editing, team and closing are Admin-only; stage and design stage are not.** Route gates: create, `PATCH`, `PUT members`, `POST stage`, `POST close` = ADMIN. `PATCH design-stage` = ADMIN or the project's own designer (route allows ADMIN+DESIGNER, the use case then requires `isAdmin || project.designerId === me`, else `403`). The phone v1 builds: stage change, design-stage change, close, invite customer. New project, edit project and edit team stay on the web. (`api:projects/interface/projects.route.ts`; `projects.usecases.ts` `ChangeDesignStageUseCase`) | ✅ / 📱 |
| 6 | **Stages.** `DESIGN`, `SITE`, `CLOSED`. Design stage: `NOT_STARTED`, `IN_DESIGN`, `SHARED`, `APPROVED`. The design-stage control is hidden when the project is closed. Reopening a closed project = `POST /projects/:id/stage {stage:'DESIGN'|'SITE'}` (clears `closedAt`); Admin only. (`c:projects.ts`; `api` `ChangeStageUseCase`) | ✅ |
| 7 | **Closing needs a Final delivery post.** `POST /projects/:id/close` answers `409` "Add a Final Delivery post with photos before closing the project." when no `FINAL_DELIVERY` post exists, and `409` "This project is already closed." when closed. When the 409 arrives, the phone opens the chat with the composer in final-delivery mode (rule 24). (`api:projects.usecases.ts` `CloseProjectUseCase`) | ✅ |
| 8 | **Closed project: what the API enforces and what is UI-only.** Enforced (`409 "This project is closed."`): create post, sign project photo upload (`feed.usecases.ts` `CreatePostUseCase`, `SignUploadUseCase`). NOT enforced by the API: comments, to-dos, raising complaints, docs upload/share. The phone mirrors the web: on a closed project the composer is replaced by a banner "This project is closed. It takes no new posts or comments. Reopen it to continue.", Reply is hidden, "Raise complaint" is hidden. To-dos and Docs stay usable (web banner for Docs: "Documents are still available"). | ✅ posts/upload; ⚠ comments (UI-only) |
| 9 | **Chat has two feeds.** Staff **Everything** = `GET /projects/:id/timeline` (posts of both visibilities + team activity lines). Staff **Client view** = `GET /projects/:id/posts?visibility=CLIENT` (exactly what the customer sees). Customer = `GET /projects/:id/posts?visibility=CLIENT`; the server never returns TEAM posts or activity to a customer (`visibleTabs(viewer)`, timeline skips activities when `isCustomer`). A `visibility=TEAM` query by a customer is `404`. (`api:feed.usecases.ts` `ListPostsUseCase`; `timeline.usecases.ts`) | ✅ |
| 10 | **Visibility.** A post is `CLIENT` (team + customer) or `TEAM` (staff on the project only). New staff posts default to `TEAM`: "nothing reaches the customer by accident". A customer's posts are always forced to `CLIENT`; the customer has no audience control. (`c:projects.ts createPostBodySchema`; `api:feed.usecases.ts:102`) | ✅ |
| 11 | **Post body.** `text` 1-5000 (trimmed), `images` up to 20, `visibility`, `kind` (`UPDATE` default). A post needs text or at least one photo ("Write something or add a photo"). (`c:projects.ts`) | ✅ |
| 12 | **Final delivery.** `kind: 'FINAL_DELIVERY'` needs at least one photo ("A final delivery post needs at least one photo"), is always forced to `CLIENT`, and a customer cannot create one (`403`). Any staff member of the project may post it (not only Admin); only Admin may then close the project. (`c:projects.ts`; `api:feed.usecases.ts` `CreatePostUseCase`) | ✅ |
| 13 | **Approve design.** Only the customer, only on a `CLIENT` post that has photos and was not authored by the customer, once (atomic: a second tap changes and announces nothing). Not allowed: `403` "Only the customer can approve a design."; `400` "There is no design to approve on this post.". The API returns the updated `PostDto` with `approval {by, at}`; the team is notified (`PROJECT_APPROVED`). The `canApprove` flag on the post decides whether the button shows. (`api:feed.usecases.ts` `ApprovePostUseCase`) | ✅ |
| 14 | **Delete a post or comment.** Author or Admin: `403` "You can only delete your own posts." / "...your own comments.". `canDelete` on the DTO says. Soft delete; no edit exists for posts or comments. (`api:feed.usecases.ts` `DeletePostUseCase`, `DeleteCommentUseCase`) | ✅ |
| 15 | **Comments (Reply).** `POST .../comments` body `{text?<=2000, images?<=5}`, needs text or a photo. A comment exists only for someone who may see the post (a customer cannot comment on a TEAM post: `404`). The post shows its latest 3 `recentComments` and `commentCount`; the full thread is `GET .../comments` (oldest first, unpaginated). (`c:projects.ts`; `api:feed.usecases.ts` `CreateCommentUseCase`, `ListCommentsUseCase`; `inv` 0.4) | ✅ / ⚠ comments unpaginated |
| 16 | **The chat stream merges four sources.** (a) posts, (b) team activity lines (`TODO_*`, `FILE_ADDED`, `FILE_SHARED`, `FILES_SAVED`; staff only), (c) one **complaint card** at the complaint's `createdAt`, (d) one **complaint update row** per later history event (`ASSIGNED`, `RESOLVED`, `REOPENED`, `CLOSED`) or conversation message, each at its own time. `COMPLAINT_*` activity lines from the timeline are dropped (the card replaces them). Resolution photos show only on the last `RESOLVED` row. Complaints are shown to customers too (their project). (`web:components/projects/feed.tsx` `buildStream`) | ✅ web / 📱 |
| 17 | **Ordering.** The server pages newest-first; the phone keeps the array newest-first and renders it in an **inverted** list, so the screen shows oldest at the top and the newest at the bottom beside the composer. New items arrive at index 0. | 📱 |
| 18 | **Cursor pagination.** `limit` default 20, max 50. The response is `{items, nextCursor}`; pass `nextCursor` as `before` to load older (strict `createdAt < before`). `nextCursor` is `null` when there is no older item. Timeline merges posts and activity, each source read `limit+1`. The phone asks `limit=30` for the timeline and 20 for client posts, and **auto-loads older** from `onEndReached` of the inverted list (the visual top) with a "Loading older messages..." strip. There is no `after`/`since` parameter. (`c:projects.ts`; `api:timeline.usecases.ts`) | ✅ / ⚠ no `since` |
| 19 | **Older complaints are withheld while older pages remain.** While `hasNextPage` is true, complaint cards and update rows older than the oldest loaded timeline item are not shown (otherwise they would float above a gap). When the last page has loaded, all are shown. (`web:feed.tsx` `buildStream`, `visible()`) | 📱 |
| 20 | **BUG/GAP: only 20 complaints per project reach the chat.** The web merges `GET /complaints?projectId=...` page 1 with the default `pageSize` 20, and each `ComplaintDto` embeds its whole history and comments. A project with more than 20 complaints silently loses the older ones from the chat, and the payload is heavy. **Phone workaround until the server fix:** request `pageSize=100` and keep fetching `page=2..` while `items.length < total` and the oldest loaded complaint is newer than the oldest loaded timeline item. **Server fix to ask for:** emit complaint events as timeline items (`kind: 'COMPLAINT'` with a slim card DTO: id, status, description snippet, first photo thumb, assignee, `at`; and `kind: 'COMPLAINT_UPDATE'` with event type/actor/note/`at`) in `GET /projects/:id/timeline` and the client posts feed, so they page by the same cursor and the full `ComplaintDto` is fetched only when a card is opened. | ⚠ GAP |
| 21 | **Jump to card.** Tapping a complaint update row scrolls to the card in the chat (`scrollToIndex`, then a brief highlight) if it is loaded; otherwise it opens the complaint detail (`/project/[id]?tab=complaints&complaint=<id>`). Tapping a card opens its detail. (`web:feed.tsx`, `complaint-update-row.tsx`) | 📱 |
| 22 | **Composer visibility chip (staff only).** Always visible in the composer bar: **Team only** (default, lock icon, neutral bar) or **Client can see** (eye icon, bar tinted green). The chip resets to Team only after every send and when the screen opens (never sticky). Customers have no chip. Photos meant for the customer need an explicit switch. (`c:projects.ts` default `TEAM`; `inv` 3.6; `research-ux-patterns.md` 1.1 #7) | 📱 |
| 23 | **Reply.** "Reply" on a post opens the thread screen with the post on top, all comments (`GET .../comments`) oldest first and its own composer (text + up to 5 photos). The chat bubble keeps the latest 3 `recentComments` and "Show all N comments". Hidden on a closed project (rule 8). | 📱 |
| 24 | **Final delivery action.** In the composer "+" menu (staff only, project not closed): "Final delivery". It opens a screen: photo picker (at least 1, up to 20), optional text, a fixed "Client can see" label, button "Post final delivery". The Close flow (Info sheet, Admin) opens the same screen when the close call returns the 409 of rule 7, and afterwards offers "Close project". The post renders with a green left border and a "Final delivery" badge. | 📱 |
| 25 | **Photo attach tray.** The camera button opens the in-app camera (multi-shot) and the gallery button opens the picker (multi-select). Selected photos appear as a thumbnail strip above the composer, each with its own progress ring, a Retry on failure and an x to remove. Limits: 20 per post, 5 per comment; images only (`image/*`), no video. Photos are compressed on the phone before upload to about 1600 px on the long edge, JPEG quality 0.7 (about 300-600 KB), EXIF orientation applied, GPS stripped. Send is disabled while any photo is uploading or the post would be empty. (`inv` 0.5; `research-offline-performance-i18n.md` 1.2 #11) | 📱 |
| 26 | **Upload path (per photo).** (1) `POST /projects/:id/uploads/sign {}` once per batch, `409` if the project is closed; (2) `POST /api/uploads/relay?target=<ticket.url>` with Bearer, multipart: every `ticket.fields` entry first, then the file under `ticket.fileField`; always send a `Content-Length` (cap 60 MB); (3) take `public_id, width, height, bytes` from Cloudinary's reply; (4) send them as `images:[{publicId,width,height,bytes}]` with the post. The ticket lives 55 minutes: sign lazily at upload time and re-sign once on a 4xx. Removing an unsent photo calls `DELETE /api/uploads?publicId=` (best effort). The server checks each `publicId` belongs to this project: `400` "A photo does not belong to this project.". (`api:feed.usecases.ts`; `inv` 0.5) | ✅ |
| 27 | **No idempotency key on `POST /posts`.** A retry after a timeout can double-post. Phone workaround: keep an outbox row per post with a client UUID; when the outcome is unknown (timeout or app killed mid-request), refetch page 1 first and treat a post by me with the same text, photo count and a `createdAt` after the send time as sent, instead of posting again. **Server fix to ask for:** accept `clientRequestId` on posts and comments and return the existing row on repeat. | ⚠ GAP |
| 28 | **Save to Docs.** Long-press a photo (or the post menu) "Save to Docs" opens a sheet: chosen photos (up to 20), folder (staff only; default top level), name (optional). Visibility is passed from the source post (a Client post's photo = `CLIENT`, a Team post's = `TEAM`). Customers may use it: the server forces their copy to top level and shared. Nothing is re-uploaded; saving the same photo again returns the existing file (`created:false`). Details in [`docs-files.md`](docs-files.md). (`api:docs/.../files.usecases.ts` `SaveFromPhotosUseCase`) | ✅ |
| 29 | **Unread and last read: no server support.** There is no per-project unread count, no last-message preview and no `lastRead` marker on `ProjectDto` or any feed endpoint. Interim phone rule: store `lastSeenAt` per project locally (set when the chat is open and scrolled to the bottom); inside an open chat, items with `at > lastSeenAt` that I did not write get the "N new messages" divider and the jump-to-bottom badge. The list screen cannot show unread dots or last-message previews. **Server fix to ask for:** `GET /projects` adds `lastActivity {at, preview, authorName}` and `unreadCount`, plus `POST /projects/:id/read {at}`. | ⚠ GAP |
| 30 | **Polling while focused.** While the project screen is focused and the app is in the foreground, refetch the first page of the active feed every 15 s (`GET .../timeline?limit=20` or the client posts), and the complaints merge source every 45 s. Stop on blur or background; refetch on focus, on app foreground and on pull. Merge by `id`; if the user is scrolled up, show a "New messages" pill instead of jumping. A push notification is only a **trigger** to refetch (payload carries ids, not content). (`research-offline-performance-i18n.md` 1.4 #16; `inv` 0.3) | 📱 |
| 31 | **Deep links.** `/project/[id]` accepts `?tab=feed|todos|complaints|docs`, `?post=`, `?todo=`, `?complaint=`, `?file=` (same names as the web). A notification ref `{kind:'PROJECT', id, postId?, fileId?}` maps to `/project/<id>?post=<postId>` (or `?tab=docs&file=<fileId>`). `?post=` scrolls the chat to that post, loading older pages until found, then highlights it (the web feed does not read `post` today; the phone does). (`web:lib/notifications.ts` `refHref`; `c:notifications.ts`) | 📱 |
| 32 | **Info sheet contents.** Stage and design stage (editable per rule 5), Team (names, designation, "Designer" tag), Customer (name and a Call / WhatsApp button from `customer.phone`), Site address (tap opens Maps), Value (INR, hidden when closed), Created, Closed date, "Lead journey" link (staff, not the customer). Actions (only those allowed): Invite customer (Admin or Sales; shares the link via the share sheet; `POST /identity/customers/:customerId/invite` returns `{url, expiresAt}`), Close project (Admin, not closed), Reopen as Design / Site (Admin, closed). (`web:project-detail.tsx`; `inv` 2) | ✅ / 📱 |
| 33 | **A technician assigned to a complaint but not on the project cannot open the project** (`404`). The phone never routes such a user into `/project/[id]`; see [`complaints.md`](complaints.md) rule 12. | ✅ |
| 34 | **Photo URLs are public.** `ImageDto.url` / `thumbUrl` are plain Cloudinary delivery URLs, not signed. Do not log or share them casually; use `thumbUrl` (about 480 px) in the list and `url` only in the viewer. (`inv` 10 #14) | ✅ |

Errors worth a message: `409` "This project is closed." (post/sign) - show the closed banner and disable the composer; `409` on close - rule 7; `403` on delete/approve - toast the server `message`; `400` "A photo does not belong to this project." - drop that photo and retry; `404` on any project call - "This project isn't available." and go back to the list.

## 2. What the phone shows

### 2.1 Route map (expo-router)

| Route | Screen |
|---|---|
| `/(app)/(tabs)/projects` | Projects list (staff tab; customers skip it) |
| `/(app)/project/[id]/_layout` | Project shell: top bar + segments (Chat, To-dos, Docs, Complaints) + Info sheet |
| `/(app)/project/[id]/index` | Chat (default; `?post=` to jump) |
| `/(app)/project/[id]/todos` | To-dos segment ([`todos.md`](todos.md)) |
| `/(app)/project/[id]/docs` | Docs segment ([`docs-files.md`](docs-files.md)) |
| `/(app)/project/[id]/complaints` | Complaints segment ([`complaints.md`](complaints.md)) |
| `/(app)/project/[id]/post/[postId]` | Post thread (Reply) |
| `/(app)/project/[id]/final-delivery` | Final delivery composer (modal) |
| `/(app)/project/[id]/photos` | Full-screen photo pager (modal; params `postId` or `urls`, `index`) |

A link `?tab=todos` etc. is redirected to the matching segment route so a push maps 1:1. Customers get Chat, Complaints, Docs only (no To-dos segment).

### 2.2 Projects list (`/projects`)

```
+----------------------------------+
| Projects                    [ + ]|   + = none in v1 (web only)
| [ Search projects...          ]  |
|----------------------------------|
| Sharma Residence          DESIGN |
| Mrs Sharma · Designer: Anil      |
| [In design]            Opened 3d |
|----------------------------------|
| Gupta Villa                 SITE |
| Mr Gupta · Designer: Anil        |
| [Approved]  ₹ 14.5 L   Opened 2w |
|----------------------------------|
|        Show closed (3)  v        |
+----------------------------------+
```

- Card: project name; stage badge (Design / Site / Closed); customer name; "Designer: <name>"; design-stage chip (Not started / In design / Shared / Approved); value in short INR (hidden when closed); "Opened <relative>". Closed cards grey.
- Pull to refresh. Tap opens `/project/[id]`. The app remembers the last opened project for the next cold start when the user has more than one.
- Search: server `search`, 300 ms debounce, minimum 1 character.
- Unread dot and last-message preview: not shown in v1 (rule 29, ⚠).
- States. Loading: 4 skeleton cards. Error with no cache: "Couldn't load projects." + button "Try again". Empty (no search): "No ongoing projects" with hint "Closed projects are under Show closed." when closed ones exist. Empty (search): "No projects match your search". Offline: cached list with a banner "You're offline. Showing saved projects." Single-project user: no list is shown (rule 2).

### 2.3 Project shell (`/project/[id]`)

```
+----------------------------------+
| <  Sharma Residence        (i) ⋮ |   fixed top bar
|    Mrs Sharma · [Design][In design]|
|----------------------------------|
| Chat | To-dos | Docs | Complaints |   segments (swipe between)
|----------------------------------|
|   ... active segment ...         |
+----------------------------------+
```

- Top bar (fixed, never scrolls): back (to the list; hidden for single-project users), project name (1 line, ellipsis), subtitle = customer name + stage badge + design-stage chip, an (i) button for the Info sheet, and a ⋮ menu only when it would have items.
- Segments: Chat (default), To-dos (staff only), Docs, Complaints. A small badge on Complaints = open complaints I can act on; on To-dos = my overdue to-dos (from `GET /todos/mine`). Swipe horizontally switches segments.
- Staff only, under the segments when on Chat: a filter chip "Everything ▾" with options "Everything" and "Client view". Choosing Client view shows the banner "This is what the customer sees." and hides the composer.
- Summary-only viewers (Sales lead owner): no segments; the screen shows the lead journey (`GET /projects/:id/journey`) and the Info content only.
- States. Loading: top bar skeleton. `404`: "This project isn't available." Other error: "Couldn't load this project." + "Try again".

### 2.4 Info sheet (bottom sheet, from (i))

```
+----------------------------------+
|  Sharma Residence                |
|  Stage        [ Design        v ]|  Admin only (others: plain text)
|  Design stage [ In design     v ]|  Admin or this project's designer
|----------------------------------|
|  Team                            |
|  Anil Kumar  · Designer  [Designer]
|  Ravi        · Technician        |
|  Customer    Mrs Sharma  [Call][WhatsApp]
|  Site        12 MG Road, ...  [Maps]
|  Value       ₹ 14.5 L            |
|  Created     12 Oct 2026         |
|----------------------------------|
|  [ Lead journey ]                |
|  [ Invite customer ]             |  Admin or Sales
|  [ Close project ]               |  Admin, not closed
+----------------------------------+
```

- A closed project shows "Closed 3 Nov 2026" and the buttons "Reopen as Design" / "Reopen as Site" (Admin) instead of the stage select.
- Close project asks "Close this project? The customer and team will be told." with "Close project" / "Cancel". On the rule-7 409 it shows "Add a Final Delivery post first." and a button "Add final delivery" (opens rule 24).
- Invite customer: calls the invite endpoint, then opens the system share sheet with the link ("Your Vastu Kitchen project link: <url>"). Errors are shown as toasts.

### 2.5 Chat (`/project/[id]`)

```
+----------------------------------+
| (top bar + segments)             |
|----------------------------------|
|  ----- Loading older... -----    |  top: onEndReached
|        Tue 10 Nov                |  date separator
|  [Anil · Designer]  🔒 Team only |
|  +----------------------+        |
|  | Kitchen layout v2    |        |
|  | [img][img]           |        |
|  +----------------------+  3:12pm|
|    ✓ Anil completed "Order tiles"|  activity line (staff)
|  [Mrs Sharma · Customer]  👁     |
|  | Please move the sink |        |
|  Reply · 2 comments              |
|  ┌ COMPLAINT · Assigned ┐        |  complaint card
|  | Drawer jammed   [img]|        |
|  └──────────────────────┘        |
|    Ravi resolved this complaint  |  update row
|              [ ↓ 3 new ]         |  jump-to-bottom pill
|----------------------------------|
| 🔒 Team only v                   |  visibility chip (staff)
| [📷] [🖼] [ Message...       ] [➤]|  composer
+----------------------------------+
```

Item types (all newest-first in the data, rendered inverted):

| Item | Look | Actions |
|---|---|---|
| Date separator | centered grey "Today", "Yesterday", "Tue 10 Nov" (Asia/Kolkata days) | none |
| Post | bubble: author name + designation (or "Customer"), text, photo grid (1-4 tiles, "+N" overlay for more), time; badges "Team only" (lock, tinted bubble, never rendered to a customer), "Final delivery" (green left border), approval pill "Approved by <name> · <date>"; up to 3 recent comments, "Show all N comments", "Reply" | tap photo: pager; tap Reply: thread; long-press: sheet (Copy text, Save photo, Save to Docs, Delete if `canDelete`); "Approve design" button when `canApprove` |
| Activity line | one centered grey line, "<who> <did what>: <subject>" for `TODO_CREATED/ASSIGNED/DUE_CHANGED/COMPLETED/REOPENED`, `FILE_ADDED/SHARED`, `FILES_SAVED`; staff only; never a bubble | tap a to-do line opens that to-do (`?tab=todos&todo=`); a file line opens Docs |
| Complaint card | compact card: status chip, "Reopened xN" chip, description snippet (2 lines), first photo thumb, assignee, date | tap: complaint detail |
| Complaint update row | centered grey line "Raised/Assigned to X/Resolved/Reopened/Closed by Y" or the comment text; resolution photos on the last Resolved row | tap: jump to card (rule 21) |

**Approve design.** The post shows a full-width green button "Approve design" (customer only, when `canApprove`). Tapping opens a confirmation sheet: title "Approve this design?", body "<Designer name> will be told you approved the design in this post.", buttons "Approve" / "Not yet". On success: haptic success, the button becomes the pill "You approved this on <date>". If a tap is repeated the server is a no-op; show no error.

**Composer bar.** One line that grows to 5 lines, camera button, gallery button, send button (disabled when empty/uploading). Return inserts a newline; Send is the button only. Staff see the visibility chip above the input (rule 22); when "Client can see" is on, the bar is tinted green and the placeholder reads "Message the customer and team". "+" menu (staff): Final delivery. Draft text and selected local photos persist per project across app restarts.
Placeholder: "Message..." (Team only), "Message the customer and team" (Client can see; also the customer's text). Closed: banner "This project is closed. It takes no new posts or comments. Reopen it to continue." instead of the bar. Client view: no bar.

**Sending states** (WhatsApp style, per own post): clock "Sending..." (spinner on photos), single tick "Sent", and "Not sent. Tap to retry" (red) with Retry / Delete draft. Failed posts stay at the bottom of the list until resolved.

**Thread screen (`post/[postId]`).** Header "Replies". The post at the top, then all comments (author, text, photo grid, time, long-press Delete when `canDelete`), a composer at the bottom with text, camera, gallery (up to 5 photos). Keyboard-safe. Hidden when the project is closed.

**Photo pager (`photos`).** Full-screen, swipe between all photos of the post, pinch-zoom, swipe-down to close, a share button (native share sheet) and "Save to gallery". Loads `url` (full) with `thumbUrl` as the placeholder.

**Final delivery screen.** Title "Final delivery". A photo grid with "Add photos" (camera/gallery, at least 1), text field "Add a note (optional)", a fixed line "Visible to the customer", button "Post final delivery" (disabled without a photo). On success it returns to the chat; for the close flow the Info sheet re-opens with "Close project" enabled.

**States.**
- Loading: 6 skeleton bubbles, composer already usable.
- Error (no cache): "Couldn't load the chat." + "Try again". With cache: show the cache plus a slim "Couldn't refresh" bar.
- Empty: "No posts yet" and "Share an update or a photo to get started." (hint hidden when closed). Client view empty: "Nothing shared with the customer yet."
- Loading older: strip "Loading older messages...". End: "Start of the conversation".
- Offline: banner "You're offline. Showing what was saved."; the composer still accepts posts (queued); Reply, Approve, delete and Save to Docs show "Needs internet".

## 3. Endpoints

| METHOD path | Purpose | DTO | Notes |
|---|---|---|---|
| `GET /projects` | list my projects | query `page,pageSize<=100,search` -> `PaginatedDto<ProjectDto>` | phone sends `pageSize=100`; rule 4 |
| `GET /projects/:id` | one project (shell, Info) | `ProjectDto` | `404` for non-access; summary-only viewers allowed |
| `PATCH /projects/:id/design-stage` | change design stage | `{designStage}` -> `ProjectDto` | Admin or this project's designer |
| `POST /projects/:id/stage` | DESIGN/SITE, reopen | `{stage}` -> `ProjectDto` | Admin |
| `POST /projects/:id/close` | close | -> `ProjectDto` | Admin; needs a final-delivery post (409) |
| `GET /projects/:id/journey` | lead story | `LeadActivityDto[]` | staff with lead access, not the customer |
| `POST /identity/customers/:customerId/invite` | invite link | -> `{url, expiresAt}` | Admin or Sales |
| `GET /projects/:id/timeline?before&limit` | Everything feed | `TimelinePageDto {items[{kind:'POST'|'ACTIVITY'}], nextCursor}` | staff; limit<=50 |
| `GET /projects/:id/posts?visibility&before&limit` | Client view / customer feed | `PostPageDto {items, nextCursor}` | `visibility=TEAM` by a customer is 404 |
| `POST /projects/:id/posts` | create post / final delivery | `CreatePostBodyDto` -> `PostDto` | 409 closed; no idempotency (rule 27) |
| `DELETE /projects/:id/posts/:postId` | delete post | | author or Admin |
| `POST /projects/:id/posts/:postId/approve` | approve design | -> `PostDto` | customer only; idempotent |
| `GET /projects/:id/posts/:postId/comments` | whole thread | `CommentDto[]` | oldest first; unpaginated |
| `POST /projects/:id/posts/:postId/comments` | reply | `CreateCommentBodyDto` -> `CommentDto` | no closed check in the API |
| `DELETE /projects/:id/posts/:postId/comments/:commentId` | delete reply | | author or Admin |
| `POST /projects/:id/uploads/sign` | photo ticket | `{}` -> `UploadTicketDto` | 409 closed; 503 storage off |
| `POST /api/uploads/relay?target=` | send the file | multipart -> Cloudinary JSON | Bearer; length cap 60 MB |
| `DELETE /api/uploads?publicId=` | drop an unsent photo | | best effort; 409 if in use |
| `GET /complaints?projectId&page&pageSize` | complaint cards for the chat | `PaginatedDto<ComplaintDto>` | rule 20 (cap) |
| `POST /projects/:projectId/files/from-photos` | Save to Docs | `SaveFromPhotosBodyDto` -> `SaveResultDto` | up to 20 |
| `GET /todos/mine?status=open` | badge on the To-dos segment | `MyTodoDto[]` | staff |

All responses use the standard envelope; money in the project DTO is whole rupees (`value`).

## 4. Errors

| Code / status | Where | Show |
|---|---|---|
| `401` after one refresh | any | sign out and go to login (foundations doc) |
| `404 NOT_FOUND` "Project not found." | project routes | "This project isn't available." and go back |
| `409 CONFLICT` "This project is closed." | create post, sign upload | closed banner; keep the draft text locally |
| `409` "Add a Final Delivery post with photos before closing the project." | close | rule 7 |
| `403 FORBIDDEN` | delete, approve, final delivery by a customer | toast the server message |
| `400 VALIDATION_FAILED` | post/comment | field errors from `data[]`; "Write something or add a photo" |
| `400` "A photo does not belong to this project." | create post/comment | remove that photo, re-upload |
| `400` "There is no design to approve on this post." | approve | toast the message; refresh the post |
| `413` / `503` on upload | relay / sign | "That photo is too large." / "Photo upload isn't available right now." |
| `0 NETWORK` | any | rule per section 5 |

## 5. Offline behaviour

| Action | Offline? |
|---|---|
| Open projects list, an opened chat, Info | yes, from the persisted read cache (TanStack Query persisted to SQLite, allow-listed keys, 7-day max age); banner and "Last updated <time>" |
| Post text and photos | **queued** in the outbox (client UUID, photos copied into app storage, uploaded when online; order kept per project); bubble shows Sending / Not sent. Without `clientRequestId` the retry uses the refetch check of rule 27 (⚠) |
| Reply, delete, approve, Save to Docs, final delivery, stage/design-stage/close, invite | online only: "Needs internet" (deleting and approving must not be replayed blindly) |
| Load older messages | only pages already cached |

A failed upload keeps the local file; the outbox retries with backoff (network, 408, 429, 5xx), refreshes the token on 401, and moves refused items (400/403/404/409/413) to a visible "Needs attention" list with the server message. Closed-project `409` on a queued post: mark Not sent with "This project was closed." The queue never blocks reading.

## 6. Acceptance criteria

- [ ] A customer with one project lands directly inside it; a customer never sees To-dos, TEAM posts, activity lines or the visibility chip.
- [ ] Admin sees all projects; a member sees theirs; a technician not on a project cannot open it (404 handled, no crash).
- [ ] The list searches, caps at 100 with the footer, hides closed projects behind "Show closed (N)", and greys closed cards.
- [ ] The chat shows oldest at the top, newest at the bottom, with an inverted list; older pages auto-load with the `before` cursor; no duplicates after polling and loading older.
- [ ] Timeline merge shows posts, activity lines (staff only), complaint cards and update rows in time order; `COMPLAINT_*` activity lines never appear twice.
- [ ] Complaints beyond the first 20 appear in the chat (workaround of rule 20) and tapping an update row jumps to its card or opens the detail.
- [ ] New staff posts default to Team only every time; the chip is unmissable and tints the bar when Client can see.
- [ ] A customer's post is always client-visible; a customer cannot post final delivery; final delivery without a photo is blocked on the phone and refused by the API.
- [ ] Approve shows the confirmation, succeeds once, and shows the approved pill; repeat taps change nothing.
- [ ] Photos are compressed to about 1600 px q0.7, capped at 20 per post and 5 per reply, uploaded with progress and Retry, and removable before sending.
- [ ] Offline posts queue and send in order; a retry after a timeout does not duplicate a post.
- [ ] On a closed project the composer, Reply and Raise complaint are hidden; To-dos and Docs still work.
- [ ] Polling runs only while the chat is focused and foregrounded (15 s); a "New messages" pill appears when scrolled up.
- [ ] A push or link `?post=<id>` opens the chat at that post.
- [ ] Info sheet shows Stage/Design stage controls only to those allowed, Close is blocked with the right message without a final delivery, and Invite opens the share sheet.
- [ ] No photo URL appears in logs or crash reports.

## 7. Open questions

1. Info as a segment or a sheet: the plan lists Info among the top segments; this doc uses a top-bar (i) button opening a sheet. Confirm.
2. Should the visibility chip ever be sticky for a technician posting many site photos? Doc says it resets to Team only after each send.
3. Do customers also compress photos to 1600 px q0.7? The decision names staff; the same pipeline is assumed for customers.
4. Server work to schedule: complaint events in the timeline (rule 20), `clientRequestId` on posts/comments (rule 27), `lastActivity`/`unreadCount` and a read marker (rule 29), `can{}` on `ProjectDto`, comments/to-dos/complaints/docs closed-project checks (rule 8).
5. Should the Client view toggle stay for staff or be replaced by a "Preview as customer" action in the Info sheet?
6. Push (new backend feature: device tokens and sender) is the trigger for refetching; until it ships only polling and foreground refetch exist.
7. Does the phone show the lead journey for Sales lead owners in v1, or is summary-only a web-only case?
