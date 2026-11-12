# 05. Offline and sync

Status: design, 2026-11-12. Audience: mobile team and coding agents. Inputs: `research/research-offline-performance-i18n.md`, `research/reference-greynote-fieldapp.md`, the four `research/inventory-*.md` files, and the API code read directly (paths relative to `apps/api/src/` unless they start with `packages/` or `docs/`). Server-side changes that do not exist yet are marked **GAP** and collected in section 3.5.

Principles: (1) the phone records what happened, the server decides what is true; (2) offline writes are a short allow-list of append-only events and single-field state sets by their owner, so conflicts are rare by construction; (3) everything else says "Needs internet" and does nothing; (4) the user can always see what is waiting.

---

## 1. What works offline and what does not

Offline = queued in the outbox (section 3), shown immediately, sent later. All other writes require a live request and are disabled with a reason when the reachability state is `offline`.

| Action | Endpoint | Offline? | Notes |
|---|---|---|---|
| Check-in | `POST /api/attendance/check-in` (`modules/hr/interface/hr.route.ts:223`) | Yes | Server stores `inAt = server now` today (`modules/hr/application/usecases/attendance.usecases.ts:74-80`). **GAP-1**: a replay hours later records the replay time. Needs `capturedAt`. Shown as "Checked in 09:12 (will sync)", never as confirmed. |
| Check-out | `POST /api/attendance/check-out` (`hr.route.ts:224`) | Yes | Depends on the check-in row if both are queued. `409 CONFLICT "Check in first."` otherwise (`attendance.usecases.ts:103`). Same GAP-1. |
| Visit log | `POST /api/leads/:id/visits` (`modules/leads/interface/leads.route.ts:238`) | Yes | Body already accepts `at` (packages/contracts/src/leads.ts `recordVisitBodySchema`), but no dedupe (**GAP-2**). ADMIN, SALES only. |
| Call outcome | `POST /api/leads/:id/calls` (`leads.route.ts:244`) | Yes | Already idempotent on `{leadId,userId,startedAt}` (`modules/leads/infrastructure/leadCall.schema.ts:27`, `mongoCall.adapter.ts:18-24`). |
| Photo post (+ photos) | sign, relay, `POST /api/projects/:id/posts` (`modules/projects/interface/projects.route.ts:297`) | Yes | Upload before post (section 4). Post not idempotent (**GAP-2**). |
| Photo comment on a post | `POST /api/projects/:id/posts/:postId/comments` (`projects.route.ts:313`) | Yes | Depends on the post if the post is still queued. |
| To-do tick / untick | `POST /api/todos/:todoId/complete`, `/reopen` (`modules/todos/interface/todos.route.ts:225,231`) | Yes | Set-state, atomic and idempotent (`modules/todos/infrastructure/mongoTodo.adapters.ts:133-142`: filter `completedAt: null`). |
| Complaint reply | `POST /api/complaints/:complaintId/comments` (`modules/complaints/interface/complaints.route.ts:190`) | Yes | `409` if the complaint was closed meanwhile (`complaints.usecases.ts:474-483`). Not idempotent (**GAP-2**). |
| Lead status change | `POST /api/leads/:id/status` (`leads.route.ts:232`) | Yes, except to `WON` | A same-status retry is `400 "already X"` (`changeLeadStatus.usecase.ts:37-39`), so it needs the replay behaviour from GAP-2. `WON` creates a customer account and may start a project (`changeLeadStatus.usecase.ts:50-57`): online-only. |
| Everything else | all other routes | No | Reasons below. |

Online-only, with reason:

| Action | Reason |
|---|---|
| Login, OTP, invite redeem, refresh, change password | Need the server, rate limits (`modules/identity/interface/auth.route.ts:112-175`), and a rotated token must not be replayed. |
| Raise complaint, assign / resolve / reopen / close | Status machine with actor rules; response carries `can{...}` (inventory-foundations 2.x). 409 on race. Raise needs photo signing. |
| Lead create / edit / assign / import | `phone` is unique (`lead.schema.ts:25`): a queued create would fail late and confuse. |
| Proposals, quotes, WhatsApp send | Prices and WA templates must be live and are not idempotent for the customer. |
| Project / stage / member changes, close; delete post / comment / to-do / upload; approve post | Admin or destructive actions with customer-visible side effects. |
| To-do create / edit / assign / comments; documents upload (60 MB `files` folder) | Out of v1 offline scope (large, or rare in the field); revisit on request. |
| Salary, employees, settings, notifications read-state | Admin or low value. |

Decision (proposed): the offline list stays exactly the nine rows above. Alternative: queue every mutation generically via TanStack `resumePausedMutations`. Why not: each added action needs its own idempotency and conflict rule, and a generic queue hides that work; paused mutations are also awkward for uploads and ordering (research 2.2).

---

## 2. Read cache

### 2.1 Design

Decision (proposed): TanStack Query with `PersistQueryClientProvider`, persisted through an async persister on `expo-sqlite/kv-store`, an allow-list via `dehydrateOptions.shouldDehydrateQuery`, `maxAge` 7 days, `gcTime` >= `maxAge` (7 days), `buster = appVersion + CACHE_SCHEMA`. Alternative: MMKV, or AsyncStorage. Why not: one native storage dependency (SQLite) already needed for the outbox; AsyncStorage has Android size limits against a single whole-cache blob (research 2.1, UNVERIFIED there; test with a 500-item cache before relying on either claim). Greynote used its own `useCachedFetch` + `cache` table (reference section 4); VK uses TanStack instead, so do not port `cached-fetch.ts`, only its per-user keying rule.

Rules:
1. The query key's first element after the version is the **user id**: `['v1', userId, 'leads', ...]`. A different user on the same phone never sees the previous cache, and logout clears it (section 3.10).
2. Persist only keys in the allow-list below. Never persist tokens (they live in `expo-secure-store`), customer proposals/prices, other staff's salary/HR data, search results, admin screens.
3. Lists are `useInfiniteQuery` with `maxPages` 5; persist only page 1 (strip later pages in `shouldDehydrateQuery`/`serialize`). The API paginates by page number, not cursor (inventory-foundations 3.3), except posts/timeline which use `before` cursors (`packages/contracts/src/projects.ts` `listPostsQuerySchema`). De-duplicate by `id` when merging.
4. Render order on cold start: restore cache, paint, then refetch stale queries in the background. No network call blocks first paint.
5. `networkMode: 'offlineFirst'` for queries so a wrong "offline" verdict still tries the request (research 2.9).
6. Outbox rows are merged into list data at render time (the list is server data plus pending rows), so there is no optimistic-cache rollback logic (research 2.6).

### 2.2 Persisted keys and staleness

| Screen / data | Query key family | `staleTime` | Persisted | Refetch triggers | "Last updated" label |
|---|---|---|---|---|---|
| Profile / role (`GET /api/identity/auth/me`) | `me` | 1 h | yes | cold start, login | no |
| Today's attendance + my month (`GET /api/attendance/me`) | `attendance.me` | 30 s | yes | focus, after outbox attendance item syncs | yes, on the check-in card |
| My to-dos (`GET /api/todos/mine`, plain array) | `todos.mine` | 60 s | yes | focus, after tick sync, push | yes |
| Leads list (page 1), lead detail + calls / visits (last 7 d) | `leads.list`, `leads.detail` | 60 s | yes | focus, pull-to-refresh, after status/visit/call sync | yes |
| Projects list + project detail | `projects.*` | 60 s | yes | focus, push | yes |
| Project feed / chat (`GET /api/projects/:id/timeline` or `/posts`, first page) | `feed.<projectId>` | 10 s focused | last ~50 items per project, text and thumbnail URLs only | polling (6), push, after own post syncs | yes, in the header |
| Complaints list + detail (`GET /api/complaints`) | `complaints.*` | 60 s | yes | focus, push | yes |
| Notifications list, unread count | `notifications` | 30 s | list: no; count: yes | poll 60 s on home, push | no |
| Lookups (designations, stages, settings the UI reads) | `lookups.*` | 24 h | yes | cold start | no |
| Proposals, documents list, salary, employees | any | n/a | **no** | online-only screens | n/a |

Images: never in the query cache. `expo-image` disk cache holds thumbnails; request resized Cloudinary URLs (research 3.4). Cached screens show text and last thumbnails; opening a full image offline shows a placeholder with "Needs internet".

### 2.3 Invalidation

| Event | Action |
|---|---|
| Outbox item reaches `done` | Invalidate the key families listed for its type (end of 3.8), then drop the row's pending overlay. |
| Push received / tapped; app foreground | Invalidate that `{type, entityId}`'s keys (section 6); on foreground `focusManager.setFocused(true)` refetches queries older than `staleTime`. |
| Logout, or different user logs in | `queryClient.clear()`, remove persisted cache, per-user DB wipe rules in 3.10. |
| App upgrade | `buster` changes; discard the persisted cache (outbox rows are NOT in this cache and are migrated, see `schema_version`). |
| 401 `TOKEN_INVALID` on refresh | Keep cache and outbox, pause the queue (section 7). |

### 2.4 "Last updated" UI

Source: `query.dataUpdatedAt`. Show `Updated 14 min ago` under the screen header when the data is older than its `staleTime` **and** reachability is not `online`, or when the last fetch failed. Online and fresh: show nothing. Pull-to-refresh when offline is disabled with the line "Offline. Showing saved data." A failed refetch keeps the old data on screen with a small inline error, never an empty state.

---

## 3. The outbox

Decision (proposed): hand-rolled SQLite outbox in `expo-sqlite`, separate from the query cache. Alternative: PowerSync, WatermelonDB, ElectricSQL. Why: the surface is nine commands replayed against an existing REST API with its own auth and rules, not a replicated data set; PowerSync would bypass the API's access rules and add a service (research 1.1, 2.11). Revisit if the product asks for offline editing of shared records (quotes, proposals).

### 3.1 Schema (DDL)

One database file `vk-outbox.db`, `PRAGMA journal_mode = WAL; PRAGMA user_version = 1;`. All calls go through one promise queue (greynote's `sqlite-store.ts` found that overlapping calls on one expo-sqlite connection reuse a released statement; reference section 4).

```sql
CREATE TABLE IF NOT EXISTS outbox (
  id              TEXT PRIMARY KEY,           -- UUID v4 made at tap time; = Idempotency-Key = clientId
  user_id         TEXT NOT NULL,              -- owner; rows are only ever sent by this user's session
  type            TEXT NOT NULL,              -- see 3.2
  schema_version  INTEGER NOT NULL DEFAULT 1, -- payload shape version; a reader migrates old rows
  payload         TEXT NOT NULL,              -- JSON, small (media are file refs, not bytes)
  entity_key      TEXT NOT NULL,              -- FIFO scope: 'attendance:<date>', 'lead:<id>', 'project:<id>', 'todo:<id>', 'complaint:<id>'
  depends_on      TEXT NULL REFERENCES outbox(id) ON DELETE SET NULL, -- single parent (3.4)
  status          TEXT NOT NULL CHECK (status IN ('queued','sending','done','needs_attention','discarded')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0, -- epoch ms, device clock
  lease_until     INTEGER NULL,               -- set while 'sending'; expired lease => back to 'queued' at boot
  last_error      TEXT NULL,                  -- JSON {status, code, message, requestId}
  result          TEXT NULL,                  -- JSON of the server response (ids), used by dependants
  captured_at     INTEGER NOT NULL,           -- REAL event time (device clock, epoch ms); sent to the server
  created_seq     INTEGER NOT NULL,           -- monotonic counter (meta table), tie-break and ordering, immune to clock changes
  created_at      INTEGER NOT NULL,           -- device wall clock, display only
  done_at         INTEGER NULL
);
CREATE INDEX IF NOT EXISTS outbox_drain ON outbox(user_id, status, next_attempt_at, created_seq);
CREATE INDEX IF NOT EXISTS outbox_entity ON outbox(entity_key, created_seq);

CREATE TABLE IF NOT EXISTS outbox_media (       -- one row per local file in a queued action
  id          TEXT PRIMARY KEY,               -- UUID; also the clientId passed to uploads sign (GAP-3)
  outbox_id   TEXT NOT NULL REFERENCES outbox(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  local_uri   TEXT NOT NULL,                  -- under documentDirectory/outbox/<userId>/, never cacheDirectory
  mime        TEXT NOT NULL, width INTEGER, height INTEGER, bytes INTEGER,
  state       TEXT NOT NULL CHECK (state IN ('pending','uploading','uploaded','failed')),
  public_id   TEXT NULL,                      -- filled after upload; reused on every retry
  upload_attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS drafts (             -- composer text, 3.9
  key TEXT NOT NULL, user_id TEXT NOT NULL, body TEXT NOT NULL, updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); -- seq counter, last_drain_at, last_error_at
```

Versus greynote's `outbox(client_id, kind, payload, depends_on JSON[], ...)`: `depends_on` is one id (every VK dependency is parent-then-child); `user_id`, lease, backoff, `captured_at` and `outbox_media` are new.

### 3.2 Record shape and action types

`OutboxRow` is the camelCase mirror of the table; `type` is one of `attendance.checkin | attendance.checkout | visit.log | call.record | post.create | comment.create | todo.complete | todo.reopen | complaint.reply | lead.status` (plus the internal `upload.cleanup`, section 4); `payload` is validated per type with zod. Payloads reuse the contracts bodies (`checkInBodySchema`, `recordVisitBodySchema`, `recordCallBodySchema`, `createPostBodySchema`, `createCommentBodySchema`, `addComplaintCommentBodySchema`, `changeLeadStatusBodySchema`) plus the route ids. `post.create` and `comment.create` store `images: []` at queue time and the drain fills `images` from `outbox_media.public_id` right before sending.

### 3.3 State machine

```
                       tap (writes row + media copy, one SQLite txn)
                                       |
                                       v
        +-----------------------> QUEUED <---------------------------------+
        |                           |                                      |
        |       drain picks it (online or 60 s grace, deps done,           |
        |       next_attempt_at <= now) ; lease_until = now + 90 s         |
        |                           v                                      |
        |                       SENDING ----- lease expired / app killed --+
        |                      /   |    \
        |        2xx or "applied" |     \---- retry class (network, 408/425/429/5xx, 401->refresh)
        |        (409 replay)     |              attempts+1, next_attempt_at = backoff (3.6) ---> QUEUED
        |                         v                         \
        |                       DONE                         \--- after 24 h of retries or 50 attempts
        |                (kept 7 d, then purged)                     |
        |                                                            v
        |                          refused class (400/403/404/409-business/410/413/415/422)
        |                          or 24 h exhausted ---------> NEEDS_ATTENTION
        |                                                         |      |
        |        user taps Retry (reset attempts) -----------------+      +-- user taps Discard --> DISCARDED
        |        user taps Edit (e.g. reply text) -> back to QUEUED       (media deleted, children cascade to
        +---------------------------------------------------------+        NEEDS_ATTENTION "parent was discarded")
```

Rules: `DONE` and `DISCARDED` are terminal. `QUEUED` rows can be edited or cancelled by the user (cancel = `DISCARDED`; allowed because nothing was sent). `SENDING` rows cannot be edited. Compared to greynote (`DRAFT -> QUEUED -> SYNCED/FAILED`, `outbox.ts`): there is no `DRAFT` state because composer drafts are not outbox rows (3.9) and nothing waits for a manual Submit; every tap on Send/Check-in queues immediately.

### 3.4 Ordering and dependencies

- **FIFO per `entity_key`** by `created_seq`; different `entity_key`s drain in parallel, concurrency 2 for JSON and 1 for uploads (slow networks).
- `depends_on` is set at queue time when the child's parent is itself queued: `attendance.checkout` -> same-day `attendance.checkin` (if not yet `done`); `comment.create` on a post that is still a `post.create` row -> that row (comment payload uses `postId = 'pending:<outboxId>'`, resolved from the parent's `result.id` at send time); `complaint.reply` and `post.create` need no parent.
- A child runs only when its parent is `done`. If the parent goes `needs_attention` the child stays `queued` and is shown as "Waiting for the previous item". If the parent is `discarded` the child moves to `needs_attention` with reason `PARENT_DISCARDED`.
- Photo upload is step 1 of the same row, not a separate row: `post.create` -> `[sign, upload each media, POST post]` (section 4). Upload results persist in `outbox_media.public_id` after each file, so a retry never re-uploads a finished file.
- Coalescing (before send only): a queued `todo.complete` followed by `todo.reopen` on the same todo collapses to the last one (the earlier row becomes `discarded`); same for two `lead.status` rows on one lead (keep the last). Endpoints are set-state, never toggle, so replays are safe.
- Cross-entity ordering is not guaranteed and not needed.

### 3.5 Idempotency: rules per action and the exact server behaviour required

Verified in code what is safe to retry today and what is not:

| Action | Safe to retry today? | Evidence | Client key | Server work needed |
|---|---|---|---|---|
| check-in | Yes (upsert `$setOnInsert`, duplicate-key handled) | `modules/hr/infrastructure/mongoHr.adapters.ts:37-61` | `outbox.id` (informational) | **GAP-1** `capturedAt` |
| check-out | Mostly: `$set outAt = server now` each time, so a retry moves `outAt` later; "last check-out wins" | `mongoHr.adapters.ts:64-71`, `hr.route.ts` doc text | `outbox.id` | **GAP-1** `capturedAt`; then a retry sets the same value |
| call.record | Yes: unique `{leadId,userId,startedAt}`, retry returns the stored call with 200 | `mongoCall.adapter.ts:18-24`, `calls.usecase.ts:45-55` | `startedAt` is the key; the app must send the same value on every retry | none. Note `startedAt > now + 5 min` is `400` (`calls.usecase.ts:12,39`): see clock skew (8.3) |
| visit.log | **No**: every POST inserts and adds an activity | `modules/leads/application/usecases/visits.usecase.ts:24-42`; no unique index | `Idempotency-Key` | **GAP-2** |
| post.create | **No** (inventory-project-workspace: no idempotency on `POST /posts`) | `modules/projects/application/usecases/feed.usecases.ts:96-131`; indexes only on lookups (`projectPost.schema.ts:49-53`) | `Idempotency-Key` | **GAP-2** |
| comment.create (feed) | **No** and it also bumps `commentCount` (`feed.usecases.ts:211-218`) | same | `Idempotency-Key` | **GAP-2** |
| complaint.reply | **No** | `complaints.usecases.ts:468-483` | `Idempotency-Key` | **GAP-2** |
| todo.complete / reopen | Yes: atomic filter, only the winner announces (`mongoTodo.adapters.ts:133-142`, `todos.usecases.ts:214-227`) | | none | none |
| lead.status | Replay-unsafe: same status => `400 "already X"` | `changeLeadStatus.usecase.ts:37-39` | `Idempotency-Key` | **GAP-2** (replay of the stored 200); fallback in the client is in 3.8 |
| uploads sign | Stateless, safe | `shared/storage/cloudinaryStorage.adapter.ts:39-53` | none | optional **GAP-3** |
| Cloudinary upload | Not idempotent: a lost response leaves an orphan asset; a retry makes a second one (random `public_id`, the signed params contain only `allowed_formats, folder, timestamp`) | `cloudinaryStorage.adapter.ts:40-41` | `outbox_media.id` | **GAP-3** |

**GAP-1: attendance `capturedAt`** (`packages/contracts/src/hr.ts:43`). Change `checkInBodySchema` to `{ location?, capturedAt?: ISO datetime }` (additive). Server behaviour in `CheckInUseCase`/`CheckOutUseCase`: if `capturedAt` is absent, behave as today. If present and within `[now - 36 h, now + 5 min]` (same skew constant as calls, `calls.usecase.ts:12`), use it as `inAt`/`outAt` and use `clock.dateOf(capturedAt)` as the attendance date; also store `receivedAt = now` and `lateSync = true` when `now - capturedAt > 10 min` so HR can see it. If it is outside the window, record server time and `lateSync = true` with `clockRejected = true` (do not fail the request: the user did show up). Check-in keeps "first wins"; check-out with the same `capturedAt` is a no-op overwrite. Without GAP-1 the app must show "time recorded on send" and HR would see replay time: do not ship offline attendance until GAP-1 lands.

**GAP-2: `Idempotency-Key` middleware** (`shared/http/`, mounted per route, not globally). Applies to exactly:
`POST /api/leads/:id/visits`, `POST /api/leads/:id/status`, `POST /api/projects/:id/posts`, `POST /api/projects/:id/posts/:postId/comments`, `POST /api/complaints/:complaintId/comments`.
Contract:
1. Header `Idempotency-Key: <uuid v4>`, optional (web keeps working without it). Mobile always sends it. Value = `outbox.id`.
2. Store `{userId, method, routeTemplate, key} -> {requestHash (sha256 of canonical body + path params), status, responseBody, createdAt}` in a Mongo collection with TTL **14 days** (longer than the outbox's 7-day hold, so a late replay is still caught). Unique index on `{userId, key}`.
3. Same key, same hash, completed: return the stored status and body unchanged plus `Idempotent-Replayed: true` (so a 200/201 is replayed, not re-run).
4. Same key, request still in flight: `409` `code: CONFLICT`, `data: { reason: 'IDEMPOTENCY_IN_FLIGHT' }`, `Retry-After: 2`. Client treats it as retry.
5. Same key, different hash: `400` `code: VALIDATION_FAILED`, `data: { reason: 'IDEMPOTENCY_KEY_REUSED' }`. Client treats it as a bug (refused).
6. Only 2xx responses are stored. A 4xx/5xx leaves no record, so a retry re-evaluates (the complaint may have been reopened since).
7. Store the response inside the same logical write as the action where possible; otherwise accept the narrow window and rely on the in-flight claim (insert the key row first with `status: 'pending'`, finalize after).
Alternative: a unique `clientId` per collection (`{authorId, clientId}` on posts, comments, visits, complaint comments), returning the existing document with 200 on duplicate (research 2.3 layer A). Why not primary: it needs a schema and DTO change on four collections plus the return-existing logic in four use cases, while the middleware is one piece with the same effect and also covers `lead.status`. The `clientId` option is the better fit if the middleware's response store proves expensive.
Mixed fallback if GAP-2 is not ready: the client probes before re-POSTing after an ambiguous failure (list the lead's visits `GET /api/leads/:id/visits`, or page 1 of the feed, match on `authorId + capturedAt/text`). Weak: use only as a stopgap and ship offline photo posts only after GAP-2.

**GAP-3: deterministic `public_id` on sign** (optional but recommended). `POST /api/projects/:id/uploads/sign` (`projects.route.ts:286`, `feed.usecases.ts:266-274`) gains an optional body `{ clientId: uuid }`; the adapter signs `public_id=<clientId>` within the project folder and `overwrite=true` (verify exact Cloudinary semantics of `public_id` with `folder`, UNVERIFIED here), so the resulting id is `<root>/projects/<projectId>/<clientId>`, which still passes `isInFolder` (`shared/storage/folders.ts`) and `projectImages` (`shared/storage/attachImages.ts`). A retry overwrites the same asset (no orphans) and the app knows the `publicId` before the upload response arrives. Without it, the app stores the response `public_id` after each success and accepts an occasional orphan when a response is lost.

### 3.6 Retry and backoff

| Parameter | Value |
|---|---|
| Base / factor / cap | 2 s, x2, 5 min |
| Jitter | full jitter: `delay = random(0, min(cap, base * 2^attempts))`; honour `Retry-After` (seconds or date) as a floor on 429/503/409-in-flight |
| Immediate re-attempt triggers | reachability turns `online`, app foreground, user taps "Send now", a parent finishes |
| Per-request timeout | 15 s JSON, 120 s per upload with progress (research 1.3) |
| Give up (-> `needs_attention`) | 24 h since first attempt or 50 attempts, whichever first; reason `RETRY_EXHAUSTED` |
| Offline gating | While reachability is `offline` the drain waits, but after 60 s offline it makes one probe attempt anyway (NetInfo can be wrong, research 2.9) |
| Concurrency | 2 JSON, 1 upload |
| Lease | `sending` rows get `lease_until = now + 90 s` (uploads: `+ 150 s`, renewed on progress); at app start and every drain tick, expired leases go back to `queued` without counting an attempt |

### 3.7 Refused vs retry (real API codes)

Envelope and codes: `packages/contracts/src/errors.ts` `FAULT_CODES`; body `{success:false, statusCode, code, message, data?}` (`packages/contracts/src/http.ts`). Zod failures are `400 VALIDATION_FAILED` with `data` = issues (`shared/http/error-handler.ts`). The decision uses `status` first, then `code`, then `data.reason`.

| Outcome | Class | Action |
|---|---|---|
| fetch throws, timeout, abort, DNS, TLS reset | retry | backoff; ambiguous outcome => rely on idempotency (3.5) |
| 408, 425, 429 `RATE_LIMITED`, 500 `INTERNAL`, 502, 503 `SERVICE_UNAVAILABLE`, 504 | retry | honour `Retry-After` |
| 503 on `uploads/sign` or relay ("Uploads are not set up yet", `uploadRelay.route.ts:25`) | retry, then refuse at 24 h | same |
| 401 `UNAUTHENTICATED` (access token dead) | refresh | single-flight refresh (section 7), retry the same request once; row not counted as an attempt |
| 401 `TOKEN_INVALID` from refresh | pause queue | keep all rows, show re-login prompt (section 7) |
| 2xx | done | store `result`, invalidate keys |
| 2xx with `Idempotent-Replayed: true` | done | same |
| 409 `CONFLICT` with `data.reason = IDEMPOTENCY_IN_FLIGHT` | retry | wait `Retry-After` |
| 409 `CONFLICT` otherwise (closed complaint, closed project, "Check in first.", archived list) | refused | `needs_attention` with the server `message`; refetch the entity (3.8) |
| 400 `VALIDATION_FAILED` | refused | `needs_attention`; "Edit" offered where the payload is user text. Exception: `lead.status` with message "already X" is verified by refetching the lead and marking `done` if it equals the target |
| 400 "A photo does not belong to this project." (`attachImages.ts`) | refused | re-upload is pointless; `needs_attention` |
| 403 `FORBIDDEN` | refused | role/assignment changed meanwhile |
| 404 `NOT_FOUND` | refused | target deleted or hidden (the API hides inaccessible records as 404; inventory-foundations 1.x) |
| 410, 413 `PAYLOAD_TOO_LARGE` (JSON body > 2 MB, `app.ts:35`), 415 | refused | for 413 on a photo, recompress once with q 0.6, then refuse |
| 426 (future force-update) | pause | blocking screen; drain may continue first if the API still accepts old writes (research 8.3) |
| any other 4xx | refused | |

Upload step (Cloudinary via relay returns Cloudinary's status): 2xx with `public_id` => `uploaded`; 400 from Cloudinary with "expired"/"Stale request" => the ticket (valid 55 min, `cloudinaryStorage.adapter.ts:7`) expired: re-sign and retry, not an attempt; other 4xx => refused; 5xx/network => retry.

### 3.8 What the user sees, and conflicts, per state

| State | Row UI | Chip / banner | Accessibility |
|---|---|---|---|
| queued (offline) | clock icon, "Waiting to send" | chip "3 waiting" | polite live-region announcement on count change |
| queued (online, waiting backoff) | clock icon, "Will retry shortly" | chip "Sending" | |
| sending | spinner (+ upload percent for media) | chip "Sending 2" | |
| done | check icon for 3 s then the normal server row | chip "All sent" (then hides) | announce "Sent" |
| needs_attention | red exclamation + server message in plain words, buttons Retry / Edit (text items) / Discard | chip "1 needs attention" (tap opens the list), toast with deep link | never colour only: icon + text |
| waiting on parent | clock, "Waiting for the previous item" | counted as waiting | |

A single "Needs attention" screen (Settings -> Sync, also reachable from the chip) lists these rows with the reason and a `requestId` for support. Do not use modal alerts for refusals.

Conflict handling per action (policy: server wins on shared state; the phone's event is kept only if the server accepts it):

| Action | Meanwhile on the server | Result | Copy (i18n key `sync.conflict.*`) |
|---|---|---|---|
| check-in | already checked in (other device or HR set the day) | first wins, returns existing day with 200: `done` | none |
| check-out | no check-in exists | `409 "Check in first."` -> `needs_attention` | "Check-in was not recorded, so check-out could not be saved." Refetch attendance; offer "Contact HR". |
| visit.log | lead reassigned / no longer visible | 403 or 404 -> refused | "You can no longer log visits on this lead." |
| call.record | none relevant (idempotent) | `startedAt` in the future by > 5 min => 400 (clock skew 8.3) | "Call time looks wrong. Check your phone clock." |
| post.create | project closed | `409 "This project is closed."` (`feed.usecases.ts:98`) -> refused; text kept so it can be copied | "This project was closed. Your update was not posted." |
| comment.create | post deleted or no longer visible | 404 -> refused | "That post is gone." |
| todo.complete / reopen | to-do deleted, reassigned away (access lost) | 404 / 403 -> refused; already completed: 200 no-op | "This task changed. Your tick was not applied." Refetch `todos.mine`. |
| complaint.reply | closed (`complaints.usecases.ts:474,483`) | 409 -> refused, reply text preserved | "This complaint was closed, so your reply was not sent." Offer copy to clipboard. |
| lead.status | already that status, lead WON and caller is SALES (`changeLeadStatus.usecase.ts:34-36`), reassigned | 400 (verify, mark done if equal) / 403 / 404 | "This lead changed. Status not applied." |

After any refusal, invalidate the entity's query keys so the screen shows the server truth. Invalidation per type on `done`: attendance -> `attendance.me`; visit/call/status -> `leads.detail`, `leads.list`; post/comment -> `feed.<projectId>`; todo -> `todos.mine`; complaint reply -> `complaints.detail`, `complaints.list`.

### 3.9 Draft saving for composers

Composer text (chat post, complaint reply, visit note, lead note) is saved to the `drafts` table, debounced 500 ms, key `<screen>:<entityId>`, per user. Restored when the composer opens; deleted on a successful queue (not on send success: after queueing the content lives in the outbox row). Photos picked but not yet sent are copied into `documentDirectory/outbox/<userId>/` at pick time and referenced from a draft media list; the "queue" step only moves them into `outbox_media`. A draft older than 14 days is purged on app start. Drafts are never sent to the server (privacy; greynote's `PUT /sync/drafts` server backup is dropped, reference section 4). On refusal of a `needs_attention` text item, "Edit" reopens the composer prefilled from the row.

### 3.10 Limits, cleanup, privacy, logout

- Caps: warn at **50** queued rows or **200 MB** queued media (banner "Free up space: connect to send waiting items"); block new media items at **100 rows / 400 MB** with an explanation. Single photo target 300-600 KB (section 4), so 200 MB is about 400 photos.
- `done` rows are kept 7 days (for "Sent" history and support) then purged; `discarded` immediately; local media of a row is deleted when the row becomes `done` or `discarded`, never earlier (research 2.2). A boot sweep deletes media files in `documentDirectory/outbox/` with no `outbox_media` row (orphans after crashes).
- Free-storage check before capture: if device free space < 200 MB, warn and refuse to queue new media.
- Privacy: queued photos live in app-private storage (`documentDirectory`, not the gallery, no `MediaLibrary.saveToLibraryAsync`), EXIF is stripped by `expo-image-manipulator` re-encode (GPS leak), logs hold IDs and counts only, never text or file names (research 8.1). The SQLite file is not backed up (`allowBackup` off in the Android manifest via config plugin, UNVERIFIED setting name; confirm).
- Logout with pending rows: if `count(queued|sending|needs_attention) > 0`, explicit logout shows "3 items have not been sent. Sign out and delete them, or stay signed in." Default action is Cancel. If the device is online, offer "Send now and sign out" (drain, then logout). "Sign out and delete" wipes the user's rows and media. A session that merely expires (section 7) keeps the rows (same rule as greynote `auth.ts`: only explicit logout or a different user clears the phone). On login as a **different** user, the previous user's rows are not sent under the new session: they are wiped after a confirmation that names the count; this is the only safe option because the server attributes every write to the token holder (`actor.id`).
- Remote kill-switch: `GET /app-config` flag `offline.disabled` (research 8.2) makes the app online-only without a release.

---

## 4. Uploads

Facts: a ticket is `{url, method:'POST', fileField:'file', fields, expiresAt}` (`packages/contracts/src/uploads.ts`), valid 55 min (`cloudinaryStorage.adapter.ts:7`), signed for `folder`, `timestamp`, `allowed_formats` only. The relay `POST /api/uploads/relay?target=<ticket.url>` (Bearer) streams multipart to Cloudinary untouched, accepts only the cloud's `image/upload` and `auto/upload` targets, rejects non-multipart and `content-length` > 60 MB with 400, and returns Cloudinary's status and body verbatim (`shared/storage/uploadRelay.route.ts:19-56`). `DELETE /api/uploads?publicId=` removes an unattached file only inside a project folder, 409 if in use (`uploadRelay.route.ts:64-82`).

Decision (proposed): upload through the relay with `expo-file-system` `uploadAsync` (multipart, progress callback), not direct to Cloudinary. Alternative: direct upload to `ticket.url`. Why: one host (the API) on carrier allow-lists, same auth path, and the 60 MB cap is enforced; cost is API bandwidth, acceptable at photo sizes. Verify RN multipart through the relay in the first sprint (inventory-foundations 5.x UNVERIFIED).

Flow for one media file (runs inside the drain, never at tap time, because the ticket expires and needs a live token):

1. **Prepare at pick time (offline-safe)**: `expo-image-manipulator` resize to long edge **1600 px**, JPEG quality **0.7**, target **300-600 KB**; if the result is > 800 KB re-encode at 0.6 once. Drawings/legibility-critical photos: 1-1.5 MB at q 0.8 (a per-flow constant, not user-facing). Copy to `documentDirectory/outbox/<userId>/<mediaId>.jpg`; record width, height, bytes. Max 20 images per post and 5 per comment/reply (`MAX_IMAGES_PER_POST`, `MAX_IMAGES_PER_COMMENT`).
2. **Sign** when the row is next to send: `POST /api/projects/:projectId/uploads/sign` (member; `409 "This project is closed."` for closed projects, `feed.usecases.ts:273`). For complaint replies use the **project** sign endpoint with the complaint's `projectId`, because `POST /api/complaints/:id/uploads/sign` requires the `resolve` permission (`complaints.usecases.ts:70-73`) while `projectImages` only checks the project folder (`attachImages.ts`). Open question 2 confirms this with the API owner. One ticket may serve all files of the row until `expiresAt - 5 min`.
3. **Upload** `POST /api/uploads/relay?target=<encoded ticket.url>` with form fields `...ticket.fields` first, then `file`. Parse the Cloudinary JSON for `public_id`, `width`, `height`, `bytes`. Persist `public_id` and `state='uploaded'` to SQLite immediately.
4. **Attach**: after all media are `uploaded`, send the JSON action (`POST .../posts` etc.) with `images: [{publicId,width,height,bytes}]` and the `Idempotency-Key`. The API never verifies the asset exists (it only checks the folder, `attachImages.ts`), so the app must not attach a `publicId` unless `state = 'uploaded'`.
5. On `done`: delete local files. On `discarded` or on `needs_attention -> Discard`: for each `uploaded` media call `DELETE /api/uploads?publicId=...` best-effort (ignore 404 and 409), then delete the local file. If the user is offline at discard time, enqueue a `upload.cleanup` row type (low priority, no UI) that retries with backoff and gives up after 7 days.

Persistent queue and resume: upload state lives in `outbox_media`, so killing the app mid-upload loses nothing; an `uploading` media row whose lease expired goes back to `pending` and the file is re-uploaded from the start (Cloudinary single-request upload; chunked/resumable upload is out of v1 because photos are <= 1 MB). Retries re-sign if the ticket expired. Per-file attempts are counted in `upload_attempts`; > 8 => the row goes `needs_attention`.

Progress UI: per-photo percent on the pending bubble, row-level "Uploading 2 of 4", a Cancel action (discard row, section 3.8), and "Slow connection, still trying" after 8 s without progress (research 4.2). Non-blocking: never a full-screen spinner.

**No video in v1.** Reasons: size (tens of MB), no chunked upload in the relay, 60 MB relay cap, storage cost, and Android foreground-service needs for large background transfers (research 2.7). Photo-only flows enforce `allowed_formats` server-side through the signature.

---

## 5. Connectivity

Decision (proposed): custom reachability on top of NetInfo, not NetInfo alone. Alternative: trust `isConnected`/`isInternetReachable` (TanStack's documented snippet). Why: NetInfo's default probe is a Google URL, and captive-portal or "connected but dead" Wi-Fi reports online (research 2.9).

- **Reachability URL**: `GET <API_ORIGIN>/api/health` already exists, public, no auth (`apps/api/src/routes.ts:8`, `modules/health/interface/health.route.ts`): envelope with `data.status` `OK` (200) or `DEGRADED` (503, a dependency such as Mongo is down; `modules/health/domain/health.entity.ts`). `reachabilityTest`: response is JSON and `body.success !== undefined && body.data?.status` is `OK` or `DEGRADED`; a 503 DEGRADED means "reachable, server unhealthy" (drain backs off, banner not shown). `reachabilityLongTimeout: 15_000`, `reachabilityShortTimeout: 5_000`. The route probes Mongo on every call, so the app must not probe more than once per 60 s when online (GAP-4: a cheap `HEAD`/no-DB variant is optional).
- **Captive portal**: a portal returns 200 HTML or a redirect; the JSON-signature test fails, so the state is `offline` (with `reason: 'captive'` when the body is HTML, to show "Sign in to the Wi-Fi network").
- **State**: `online | offline | unknown`. `online` = `isConnected && isInternetReachable !== false`; `unknown` while NetInfo is null (treated as online for attempting requests). Feed `onlineManager`; set `focusManager` from `AppState`.
- **Requests beat NetInfo**: any successful API response sets `online` immediately; two consecutive network failures set `offline`. The drain tries one request after 60 s even when `offline`.
- **Banner** (global, under the header): `Offline. Changes will send when you're back online.`; slides in after the state has been `offline` for 3 s (debounce), hides on `online`. Offline never blocks reading cached data.
- **Sync chip** (header): hidden when 0 pending and online. States per 3.8: `N waiting` (offline or backoff), `Sending N`, `N need attention` (tap -> list), `All sent` for 3 s after the last row completes. Tapping while online runs "Send now". Chip changes are announced politely.
- **Slow network**: after 8 s with no response show "Slow connection, still trying" on the active row, not a global error.
- **Online-only actions** when `offline`: button disabled with helper text "Needs internet", never a hidden failure.

---

## 6. Polling and refresh policy

Decision (proposed): foreground drain is the real sync path; background tasks are best-effort. Alternative: rely on `expo-background-task`. Why: it runs at best every 15+ minutes, is inexact, deferred by Doze, and killed by aggressive OEMs (research 2.7; https://docs.expo.dev/versions/latest/sdk/background-task/). Staff are told to open the app after returning to coverage. One `expo-background-task` (min interval 15 min) drains only small JSON items and runs no uploads; if it fires it uses the same single-flight drain and the same refresh lock (section 7 forbids refreshing from it).

Drain triggers (foreground): app start, `AppState -> active`, reachability `offline -> online`, 5 s debounce after any new outbox row, "Send now", a parent completing, backoff timers. One single-flight `drain()` guarded by a module-level promise (as greynote `runSync`, reference section 4).

| Surface | Policy |
|---|---|
| Project chat / feed, focused and foreground | Poll page 1 (`timeline?limit=20`) every **15 s** (research says 10-15; use 15 on cellular or data-saver, 10 on Wi-Fi is allowed), stop on blur/background/offline; back off 15 -> 30 -> 60 s on three empty polls, reset on new data or user activity. Merge by `id`. No `since` parameter exists, so the poll refetches page 1 (about 20 items); a `since`/ETag is a nice-to-have (open question 3). |
| Lists (leads, complaints, to-dos, projects) | Refetch on screen focus and app foreground when older than `staleTime` (60 s). Pull-to-refresh. No interval. |
| Home / dashboard | Refetch on focus, `staleTime` 60 s. |
| Notifications | Unread count on focus + every 60 s on the home tab only (web does 30 s, `inventory-people-overview` section on notifications); list on open. |
| Attendance card | On focus and after outbox attendance rows sync. |
| Backgrounded app | Nothing, no polling. |

Push is a doorbell (owned by the notifications doc): visible notification with `{type, entityId}`; on foreground receipt or tap, invalidate that entity's keys and, if a chat is open, refetch immediately instead of waiting for the poll; the phone never trusts a push for state (greynote `push.ts` principle, reference). Silent/data-only pushes are not relied on (Doze throttles them, research section 5).

---

## 7. Session and multi-account edge cases

Facts: access token <= 15 min; refresh token rotates on every refresh, 30 days staff / 90 days customers, sliding; presenting an already-rotated token revokes all of the user's sessions except for one replay within `REFRESH_GRACE_SECONDS` (default 10 s) (inventory-foundations 1.3, `refreshSession.usecase.ts`). Mobile must send `X-Client: mobile` and the refresh token in the body.

Rules:
1. **Never refresh while offline.** Refresh is attempted only when reachability is `online` AND an actual request got a 401 `UNAUTHENTICATED` (or the access token is within 30 s of expiry before a request). Never speculatively on resume. Rationale: a refresh whose response is lost has already rotated the token; the retry window is 10 s.
2. **Single-flight, one module, one lock** (`refreshing ??= ...`, as greynote `session.ts`), shared by the outbox, the query layer and uploads. No refresh from headless/background tasks.
3. **Persist the new refresh token to `expo-secure-store` before using the new access token** (inventory-foundations 1.4 rule 5).
4. **Network error during refresh**: keep the old refresh token, set session `unknown`, do not log out, retry on the next `online` event. Do not hammer: the grace window is 10 s, so a retry after a dropped response may be treated as theft and revoke every session; if the first attempt got no response at all, retry once immediately, then wait for the next explicit trigger, and surface "Session could not be refreshed. Tap to retry." (UNVERIFIED: whether grace is safe after a dropped response beyond one replay.)
5. **Token expired while offline**: access token is dead but there is no problem; queued rows just wait. On `online`, the first drain request gets 401 -> one refresh -> continue. Outbox rows are not counted as failed attempts for 401.
6. **Refresh returns 401 `TOKEN_INVALID`** (refresh token expired after > 30 days offline, session revoked, or user deactivated, `refreshSession.usecase.ts`): pause the queue, keep all rows and the cache, show the login screen with "Your session ended. Sign in to send N waiting items." After the same user signs in again, the queue resumes. If a different user signs in, rows are wiped after confirmation (3.10).
7. **Deactivated user**: access token lives <= 15 min after deactivation; queued writes get 401/403 -> pause/refuse as above.
8. **Cold start offline**: restore session from secure store, trust the saved `UserDto`, open the cached app (greynote `index.tsx` boot flow: only a 401 goes to login; offline/5xx opens the app).
9. **Shared phone**: outbox, drafts, cache and media are per `user_id`; all views filter by the current session's user.
10. **Role change while offline**: the server is the judge; a 403 becomes `needs_attention`. The cached role updates on the next `/me`.
11. **Multiple devices**: attendance check-in on two devices: first wins (3.5). To-do ticks: set-state, fine. Feed posts: both are real posts.

---

## 8. Test matrix and acceptance criteria

### 8.1 Unit tests (React-free `offline/` modules, vitest)
State machine transitions; lease expiry; backoff with `Retry-After`; classifier table in 3.7 (one test per row); ordering with `depends_on` and parent discard; coalescing; coalescing under crash; single-flight refresh; reachability probe with HTML portal body; draft save/restore; per-user filtering; schema migration of `schema_version` rows; media cleanup sweep.

### 8.2 Device scenarios (airplane mode and radio manipulation)

| # | Scenario | Expected |
|---|---|---|
| 1 | Airplane mode on, check-in, check-out, airplane off | Two rows queued in order; on `online` both `done`; attendance shows the **captured** times (needs GAP-1); chip passes waiting -> sending -> all sent |
| 2 | Offline, post with 3 photos, comment on that queued post, go online | Post `done`, then comment `done` (parent first); exactly one post and one comment on the server |
| 3 | Kill the app while photo 2 of 3 uploads | On restart lease expires, photo 1 not re-uploaded, photo 2 retried, post sent once |
| 4 | Kill the app between server success and local `done` write | On restart the row is retried with the same key; server returns replay/duplicate; one record |
| 5 | Lost response: server executes but the client sees a timeout (proxy that drops responses) | Retry produces no duplicate for each of the nine actions (Idempotency middleware; natural for check-in/call/to-do) |
| 6 | Double tap on Send / Check-in / tick | One outbox row (disable button + `id` generated per screen-intent, debounce 600 ms); tick then untick collapses |
| 7 | Captive-portal Wi-Fi (200 HTML) | State `offline` with "Sign in to the Wi-Fi network"; no duplicate sends |
| 8 | 2G throttle + 8 s stall | "Slow connection" note; no timeout storm; 15 s timeouts back off |
| 9 | Complaint closed on web while the reply is queued | Row `needs_attention` with the closed message; text recoverable; complaint refetched |
| 10 | Project closed while post queued | `409` -> `needs_attention`; no photo orphans left after Discard (DELETE uploads) |
| 11 | Offline > access-token life, then online | One refresh, queue continues; no logout |
| 12 | Offline 31 days (staff refresh expired) | Queue pauses, login prompt, rows kept; after re-login they send |
| 13 | Logout with 3 pending | Warning with count; Cancel is default; "Sign out and delete" wipes rows and media |
| 14 | Different user signs in | Previous rows wiped only after confirmation; never sent under the new token |
| 15 | Fill queue to 50 / 200 MB / 100 / 400 MB | Warning, then block with explanation |
| 16 | Low free storage < 200 MB | New media capture refused with a clear message |
| 17 | Doze: `adb shell dumpsys deviceidle force-idle`, app backgrounded | No polling; on foreground the drain runs; background task, if fired, only sends small rows |
| 18 | OEM kill (swipe-away on a Xiaomi/Realme device) | All data intact; drain on next open |
| 19 | Rotate/low-memory kill during compression | Row not created, or created with valid file; never a row with a missing file (media copy and row insert in one logical step; boot sweep) |

### 8.3 Clock skew and device time

- Device clock wrong by hours: attendance `capturedAt` outside `[now-36h, now+5min]` is replaced by server time and flagged (GAP-1). The app also computes `serverOffsetMs` from the `Date` header of any API response and shows "Your phone clock looks wrong" when |offset| > 5 min; it still sends the raw device `capturedAt` and the offset in a header `X-Clock-Offset-Ms` (informational, logged by the server; optional GAP-5).
- Call `startedAt` more than 5 min in the future => `400` (`calls.usecase.ts:12,39`); with a fast clock the app clamps `startedAt` to `now - offset` before queueing.
- Ordering uses `created_seq`, not wall-clock time, so a clock change cannot reorder the queue.
- Test: set the phone 2 h ahead, check-in, verify server-side flag; set it 2 h behind, verify the call and visit rows.

### 8.4 Acceptance criteria

1. Airplane mode on: all nine offline actions can be performed and show "Waiting to send" without an error dialog.
2. After restoring connectivity with the app in foreground, every queued row reaches `done` within 60 s on a normal connection, in dependency order, with zero duplicates on the server (checked by counting records per `outbox.id`).
3. No data loss across app kill, device reboot, and token expiry; verified by scenarios 3, 4, 11, 12.
4. Every refusal in 3.7 shows plain-language copy, keeps the user's text recoverable, and never retries automatically.
5. The user can always see how many items are waiting and can open the "Needs attention" list.
6. Logout and account switch never send or show another user's data.
7. First paint on a cold start offline renders cached data in < 3 s on a 3 GB device (performance budget, research 3.2) without waiting on the network.
8. GAP-1, GAP-2 are live in production before offline attendance, visit, post, comment, reply and status actions are enabled in the release (feature-flag each type via `/app-config`).

---

## 9. Reuse from greynote vs rewrite

Greynote paths relative to `/home/arjit/Work/rebootai/greynote/apps/fieldApp/src/offline/` (read-only reference; reference file section 4).

| Piece | Verdict | Notes |
|---|---|---|
| `types.ts` `Store` interface, `sqlite-store.ts` (serialised promise queue, `user_version`), `memory-store.ts`, `store.web.ts` | Reuse the pattern, adapt the schema | New tables in 3.1; keep the serialised-queue fix; keep a memory store for tests |
| `outbox.ts` API shape (`createRecord`, `queueRecord`, `listRecords`, `countUnsent`, `subscribeOutbox`) | Reuse the shape | Drop `DRAFT` and `dirty`/tombstones (no server draft backup); add `discard`, `retry`, `edit` |
| `order.ts` topological sort | Reuse | Simplified to a single parent chain; add per-`entity_key` FIFO |
| `engine.ts` `pushPending` (batch `POST /sync/push`), `pull`, `backupDrafts`, `restoreDrafts`, `runSync` | **Rewrite** | VK has no `/sync/*` endpoints and none are proposed: the drain replays each action against its existing REST endpoint. Keep only the single-flight `running ??=` guard and "NetworkError stops the batch, rest stays queued" |
| `hooks.ts` `useAutoSync` triggers (start, reconnect, AppState active, 5 s debounce) | Reuse | Drop the `role === 'FIELD'` check |
| `connectivity.ts` | Rewrite | Greynote treats NetInfo null as online and has no custom reachability or captive-portal handling; use section 5 |
| `cached-fetch.ts`, `cache.ts` | Replace | VK uses TanStack Query persistence (2.1); keep the per-user key rule |
| `OfflineBanner`, `SyncChip`, `useOutboxCounts`, `useSyncStatus` | Reuse and restyle | Add the `needs_attention` count and the live-region announcements |
| Auth `session.ts` single-flight refresh, `logout()` warning on `countUnsent`, wipe on a different user (`prepareForUser`) | Reuse the logic | Add the "never refresh offline" rule and secure-store-before-use ordering (section 7); VK sends `X-Client: mobile` |
| `calls.ts`, `day.ts`, `geofence.ts`, `final-submit.ts`, `doctor-photos.ts`, `team.ts`, `colleagues.ts`, `local-draft.ts`, `SyncKind` values, `PERMANENT_REFUSALS`, settings keys | Drop | Pharma-specific. Greynote has no backoff, no media table and no tests; those are new work |

Key difference: greynote commits at one daily Submit via `POST /sync/push`; VK sends each action on its own REST endpoint as soon as possible (greynote's `STANDALONE_KINDS` behaviour), hence the idempotency work in 3.5.

---

## 10. Server work list (summary of the GAPs)

| ID | Change | Where | Blocks |
|---|---|---|---|
| GAP-1 | `capturedAt` on check-in / check-out, window `[now-36h, now+5min]`, `lateSync` flag | `packages/contracts/src/hr.ts:43`, `modules/hr/application/usecases/attendance.usecases.ts` | offline attendance |
| GAP-2 | `Idempotency-Key` middleware (14-day TTL, replay 2xx, 409 in-flight, 400 key-reuse) on five POST routes in 3.5 | new `shared/http/idempotency.middleware.ts`; mount in `leads.route.ts`, `projects.route.ts`, `complaints.route.ts` | offline visit, post, comment, reply, status |
| GAP-3 | Optional `clientId` on project upload sign to fix `public_id` | `feed.usecases.ts:266`, `cloudinaryStorage.adapter.ts:39` | nice-to-have (no orphans) |
| GAP-4 | Optional: cheap no-DB liveness variant of `GET /api/health` (today it probes Mongo each call) | `modules/health/` | nothing (optimisation) |
| GAP-5 | Log `X-Clock-Offset-Ms` header | request logger | optional |

## 11. Open questions

1. Owner policy for attendance with a rejected or missing clock (flag for HR review vs refuse), and for check-ins with no GPS fix (research risk 3).
2. Is using `POST /api/projects/:id/uploads/sign` for complaint-reply photos acceptable to the API owner, or should `POST /api/complaints/:id/uploads/sign` be relaxed from the `resolve` permission to "may comment"? (`complaints.usecases.ts:70-73`)
3. Should the feed endpoints gain `since`/ETag so a 15 s empty poll costs about 200 bytes, and should the API pick 14 days as the idempotency TTL given a 7-day outbox hold?
