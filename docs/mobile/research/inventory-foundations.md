# Mobile inventory: cross-cutting foundations

Scope: what the React Native (Expo) app must replicate or consume from the existing API, contracts and web app. Read from the real code on 2026-11-12. Paths are relative to the repo root. Items not confirmed in code are marked UNVERIFIED. Notifications are only referenced (another document owns them).

---

## 1. Auth

### 1.1 Endpoints (all under `/api/identity/auth`, `apps/api/src/modules/identity/interface/auth.route.ts`)

| Method + path | Auth | Body (contracts `src/identity.ts`) | Returns `data` | Notes |
|---|---|---|---|---|
| POST `/login` | none, needs `X-Client` | `LoginBodyDto {phone, password}` | `LoginResponseDto` = `AuthTokensDto + user` | rate limit `attemptsLimiter` |
| POST `/otp/request` | none | `OtpRequestBodyDto {phone}` | `{}` always 200 | WhatsApp code; no `X-Client` needed |
| POST `/otp/verify` | none, needs `X-Client` | `OtpVerifyBodyDto {phone, code}` (code = `^\d{6}$`) | `LoginResponseDto` | `INVALID_OTP` 401 |
| POST `/invite/redeem` | none, needs `X-Client` | `RedeemInviteBodyDto {token}` | `LoginResponseDto` | customers only |
| POST `/refresh` | none, needs `X-Client` | `RefreshBodyDto {refreshToken?}` | `AuthTokensDto` | mobile MUST send `refreshToken` in body |
| POST `/logout` | none, needs `X-Client` | `{refreshToken?}` | `{}` | always 200; revokes that one session only |
| GET `/me` | Bearer | none | `UserDto` | use at cold start after refresh |
| POST `/change-password` | Bearer | `ChangePasswordBodyDto {currentPassword, newPassword}` | `{}` | revokes ALL sessions; wrong current = 400 VALIDATION_FAILED (not INVALID_CREDENTIALS) |

`AuthTokensDto` = `{accessToken, refreshToken? (mobile only), expiresIn (seconds)}`. `UserDto` = `{id, name, phone, role, designation|null, attendanceType|null, fixedSalary? (ADMIN/HR only), active, canLogin, createdAt}` (`user.mapper.ts`: salary hidden unless caller role is ADMIN or HR; `canLogin = passwordHash !== null`).

Phone rule (`phoneSchema`): accepts `+91 98765 43210`, `098765...`, `9876543210`; stored as 10 digits matching `^[6-9]\d{9}$`. The mobile app should reuse `phoneSchema` from `@vastu/contracts` (zod, ESM `.js` import suffixes; see section 9 on the package consumption).

### 1.2 X-Client header
Required on login, otp/verify, invite/redeem, refresh, logout (`shared/http/client.util.ts` -> 400 VALIDATION_FAILED "Send an X-Client header of web or mobile" otherwise). Values `web | mobile` (`CLIENT_KINDS`). Mobile always sends `X-Client: mobile` and `Content-Type: application/json`. `change-password` is the only auth route that does not need it (but the controller clears the cookie only when it equals `web`).

### 1.3 Token model (`env.ts`, `sessionIssuer.ts`, `docs/03-architecture/auth-and-roles.md`)
- Access token: JWT HS256, payload `{sub, role, iat, exp}` (`accessTokenPayloadSchema`), TTL `JWT_ACCESS_TTL_SECONDS` default 900 s (15 min), same for customers. Read `expiresIn` from the response rather than hard-coding.
- Refresh token: opaque, stored hashed, 30 days staff (`REFRESH_TTL_DAYS`), 90 days customers (`CUSTOMER_REFRESH_TTL_DAYS`). Rotated on EVERY refresh; new expiry is computed from now (sliding window). A refresh response includes only `accessToken, refreshToken, expiresIn`; no `refreshExpiresAt` is returned, so the app cannot know the absolute expiry (it just finds out on a 401 TOKEN_INVALID).
- Reuse detection (`refreshSession.usecase.ts`): presenting an already-rotated token revokes ALL the user's sessions (all devices, web too) and returns 401 `TOKEN_INVALID`. One grace replay is allowed within `REFRESH_GRACE_SECONDS` (default 10, max 60) of the rotation: the replay gets a fresh pair and revokes nothing; a second replay or one after the window is theft. Tokens revoked by logout/password change/deactivation are never eligible.
- Deactivated user: `RefreshSessionUseCase` revokes all sessions and returns TOKEN_INVALID; an issued access token lives on until expiry (<=15 min).
- Sessions table (`session.schema.ts`): `{userId, tokenHash, client, expiresAt, revokedAt, rotatedAt, graceUsedAt}`. No device name, push token or last-seen field exists (see gaps).
- JWT payload carries only `sub` and `role`; the app can decode the role locally but must still call `/me` for the user.

### 1.4 Mobile refresh discipline (what web does, `apps/web/lib/api/session.ts`)
The web client is the reference for the single-flight refresh; the mobile client MUST replicate it because of the theft rule:
1. Access token in memory only; refresh when `now >= expiresAt - 30_000` (`EARLY_MS = 30s`) or on a 401.
2. One in-flight refresh promise shared by all callers (`refreshAccessToken`, `inflight`). Web also uses a Web Lock across tabs; mobile has a single JS runtime so a module-level promise is enough, but see the background-task caveat below.
3. `refreshAccessToken(staleToken)`: after waiting, if another caller already replaced the token, return the new one without a second refresh.
4. Never retry a refresh that failed at network level (the server may have rotated already): web clears the session and emits `network`. On mobile this is harsh (flaky networks); a safer rule is: on a network error, keep the old refresh token in secure storage, mark the session `unknown`, and retry later. This works only because of the 10-second grace window, so the retry must happen within the grace window or it will be treated as theft. UNVERIFIED: no test shows grace is safe after a dropped response beyond one replay.
5. Persist the NEW refresh token to secure storage BEFORE using the new access token; if the app is killed between the server rotating and the write, the stored token is spent (grace window covers only 10 s).
6. Background tasks (push handlers, background fetch) that refresh concurrently with the foreground app would race; route every refresh through one module and one in-memory lock, and avoid refreshing from headless tasks.
7. On refresh failure (401 TOKEN_INVALID): clear secure storage, clear the React Query cache, go to login. Web does `queryClient.clear()` plus redirect `/login?reason=expired|network|signed-out`.

Web request wrapper rules to port (`apps/web/lib/api/client.ts`): `api<T>()` returns `body.data`; on 401 refresh once and retry once; second 401 -> clear session; HTTP 204 returns undefined; network failure -> `ApiError(0, 'NETWORK', ...)`; non-JSON error bodies -> `code 'HTTP_ERROR'`; 5xx without message -> "Something went wrong on our side"; `ApiError.fieldErrors` built from the 400 `data[]` zod issues (`path.join('.') -> message`); `isNotFound` is true for 404 AND 403 (the API hides records as 404; 403 means the role may never do it).

### 1.5 Login flows
- Web default is OTP (WhatsApp), password is the alternate (`apps/web/app/(public)/login/login-form.tsx`, `mode 'otp'|'password'`). Mobile should offer both; OTP is the only way for a customer to sign in other than an invite link, and staff who forget the password have no reset route (there is no forgot-password endpoint).
- OTP request (`otp.usecase.ts`): 6-digit code, TTL 5 min (`OTP_TTL_MS`), resend cooldown 30 s (`OTP_RESEND_COOLDOWN_MS`; inside it the endpoint still returns 200 but sends nothing), max 5 wrong tries (`OTP_MAX_ATTEMPTS`) then the code is dead, code hashed, replaced on each new request. Always 200 with message "If that number has an account, a code is on its way." whether or not the number exists (anti-enumeration). Sent via the WA AGENT client (`shared/whatsapp/waAgentClient.ts`, `waAgentOtpSender.adapter.ts`); server-only API key. `OTP_DEV_MODE=true` makes every code `123456` (refused in production); with no WA keys the code is printed to the API console.
- OTP works for any ACTIVE user with that phone, staff or customer. UNVERIFIED/observation: `RequestOtpUseCase` does not check `passwordHash`, so a staff user with `canLogin=false` (biometric-only, no password) appears able to sign in by OTP. Confirm with the product owner whether that is intended (it matters for the Office boy persona).
- Invite redeem (`customers.usecase.ts`): token created by ADMIN/SALES via `POST /api/identity/customers/:id/invite` returning `CustomerInviteDto {token, url, expiresAt}` where `url = {WEB_BASE_URL}/invite/{token}`; valid 7 days (`CUSTOMER_INVITE_TTL_DAYS`), single use, a new invite revokes older ones. Errors: 401 TOKEN_INVALID "This link has expired or was already used." The invite URL points at the WEB app, not the mobile app (see deep-link gap). The mobile app can accept the pasted token or a universal link and call `/invite/redeem` with `X-Client: mobile`.
- Web `/invite/[token]` page marks `started` to avoid double redemption (React strict mode); mobile must guard identically (single-use token).
- No self-signup, no forgot/reset password. HR/ADMIN set a user's password via `PUT /api/identity/users/:id/password` (`SetUserPasswordBodyDto`), out of mobile scope.
- Password rules (`passwordSchema`): min 8 chars, max 72 BYTES (bcrypt). `change-password` is not used anywhere in the web app (grep: no hits under `apps/web`); mobile may expose it in a profile screen; it signs the user out everywhere, so the app must clear local tokens afterwards (server message "Password changed. Please sign in again.").

### 1.6 Error codes on auth (`packages/contracts/src/errors.ts`, `FAULT_CODES`)
`VALIDATION_FAILED` 400, `UNAUTHENTICATED` 401 (missing/invalid access token), `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `INVALID_CREDENTIALS` 401 (one code for unknown number, wrong password, no password, inactive), `INVALID_OTP` 401 (wrong, expired, used, never sent, 5 tries), `TOKEN_INVALID` 401 (invite or refresh token), `RATE_LIMITED` 429, `PAYLOAD_TOO_LARGE` 413, `SERVICE_UNAVAILABLE` 503, `INTERNAL` 500. Note 401 has three meanings: access token dead (UNAUTHENTICATED: refresh and retry), refresh dead (TOKEN_INVALID: sign out), credentials wrong (INVALID_CREDENTIALS/INVALID_OTP: show an inline error). Do not run the refresh-and-retry loop for the anonymous endpoints (web marks them `anonymous: true`).

### 1.7 Rate limits (`auth.route.ts`)
| Limiter | Applies to | Rule | Key |
|---|---|---|---|
| `attemptsLimiter` | `/login`, `/otp/verify`, `/invite/redeem` | 30 FAILED requests / 15 min (`skipSuccessfulRequests: true`) | IP |
| `otpByIp` | `/otp/request` | 20 requests / 10 min, every request counted | IP |
| `otpByPhone` | `/otp/request` | 5 requests / 10 min, every request counted | phone in body |
| none | `/refresh`, `/logout`, `/me`, all other routes | no limiter found | - |

All answer 429 `RATE_LIMITED` in the standard envelope, with `RateLimit-*` standard headers (`standardHeaders: true`). `app.set('trust proxy', 1)` so the IP is the first `X-Forwarded-For` hop. Mobile impact: see gaps (carrier-grade NAT shares one IP across many users; `otpByIp` counts every request).

---

## 2. Roles and scopes

### 2.1 Single sources of truth
- `apps/api/src/shared/access/scope.ts`: `scopeFor(role, module)` -> `'all' | 'assigned'`. `SEES_ALL`: leads `[ADMIN, OFFICE]`, proposals `[ADMIN]`, projects `[ADMIN]`, complaints `[ADMIN, OFFICE]`. Everyone else is `assigned`.
- Role gates live ONLY in route files via `requireRole(...)` (`shared/http/authorize.middleware.js`); use cases decide by data (membership, ownership). Per ADR-0009 roles are hardcoded. Web `lib/nav.ts` is cosmetic; the API enforces.
- Error semantics: 403 FORBIDDEN = role may never do this; 404 NOT_FOUND = a record you may not see (hidden). The app should treat both as "not found" (`ApiError.isNotFound`), except 403 on write actions where a toast is better.

### 2.2 Route-level role gates (verified in `*.route.ts`)
| Area | Gate |
|---|---|
| Dashboard `GET /api/dashboard` | `ADMIN, HR` (HR gets attendance counters only; other blocks `null`) |
| Settings `/api/settings` | `ADMIN` (out of mobile scope) |
| Reminders `POST /api/reminders/run` | `ADMIN` |
| Leads list/create | `ADMIN, SALES, OFFICE` |
| Leads import | `ADMIN, OFFICE` (CSV: out of mobile scope) |
| Leads `call-stats` | `ADMIN` |
| Leads get/timeline | `ADMIN, SALES, OFFICE` |
| Leads update/status/calls/visits (create+list) | `ADMIN, SALES` (OFFICE cannot) |
| Leads assign | `ADMIN` |
| Proposals (all `/api/proposals`) | `ADMIN, SALES` |
| Proposal templates | staff routes `ADMIN, SALES`, admin routes `ADMIN` (builder out of scope) |
| Public proposals `/api/public/proposals/:token` | none (token); `POST /:token/seen` uses optional auth |
| Customers (CRM) `/api/customers` | `ADMIN, SALES, OFFICE` |
| Identity customers `POST /api/identity/customers`, `/:id/invite` | `ADMIN, SALES` |
| Users `/api/identity/users` | `ADMIN, HR` (HR further limited by `canManageUser`/`canAssignRole`; out of scope) |
| Designations | list: all staff roles (`STAFF_ROLES`, excludes CUSTOMER); create/update: `ADMIN, HR` |
| Projects create/update/members/stage/close | `ADMIN` |
| Projects design-stage | `ADMIN, DESIGNER` (use case further requires ADMIN or the project's own `designerId`) |
| Projects list/get/journey/feed/posts/comments/docs/to-dos/uploads | any authenticated role; scoped in use cases (see 2.3) |
| Complaints (all `/api/complaints`) | any authenticated role; rules in use cases |
| Attendance check-in/check-out/me | any authenticated role (the server does not gate CUSTOMER: UNVERIFIED whether `attendanceType` null users are rejected; see gap) |
| Attendance board/simulate/set-day/delete-day | `ADMIN, HR` |
| Attendance `GET /users/:userId` | any authenticated; HR/ADMIN may view anyone, others only themselves (`isHr` in `attendance.usecases.ts`; exact reject behaviour UNVERIFIED) |
| Salary (all) | `ADMIN, HR` |
| Notifications | any authenticated (`notifications.route.ts`: "no role gate") |
| Uploads relay `POST /api/uploads/relay`, `DELETE /api/uploads` | any authenticated |

### 2.3 Use-case rules by data (verified)
- Projects: `viewerOf()` (`projectAccess.ts`): `isAdmin` = `scopeFor(role,'projects')==='all'` (ADMIN only), `isCustomer` = `actor.id === project.customerId`, `isMember` = in `memberIds`. Feed/comments/uploads need admin, member or customer else 404. The summary and lead journey additionally allow whoever may access the project's lead (the SALES owner); SALES never sees the feed. The CLIENT/TEAM split: a customer sees only `CLIENT` posts (`visibleTabs`), can write only CLIENT, cannot post `FINAL_DELIVERY` (403), and only the customer can approve a design (`approvePost`, 403 otherwise). Delete post/comment: author or ADMIN. Project list for non-admin: `visibleTo = actor.id` unless via the SALES lead link.
- Complaints (`complaintAccess.ts`): sees-all = ADMIN, OFFICE; others see those they are assigned to / raised / customer of (else 404). Raise: `TECHNICIAN` and `HR` cannot (403); CUSTOMER only on own project; others on projects they are a member of (ADMIN/OFFICE any project). Actions follow status plus actor: assign = ADMIN (OPEN/ASSIGNED); resolve = ADMIN or assignee (ASSIGNED); reopen = ADMIN or the customer (RESOLVED); close = ADMIN (RESOLVED). The response carries `can{assign,resolve,reopen,close}`; render buttons only from it; 403 = never allowed, 409 = wrong status.
- To-dos (`todoAccess.ts`, `mine.usecase.ts`): membership-based, no role gate; `GET /api/todos/mine?scope=all` is ADMIN-only; assignees must be non-customer members or ADMIN. Customers have no to-dos (nav hides them; API membership check blocks).
- Docs (`docsAccess.ts`): staff (ADMIN or project member) see everything and organise folders; CUSTOMER sees a flat list of files with `visibility === 'CLIENT'` only, never folders (404).
- Leads: ADMIN and OFFICE `all`; SALES `assigned` (own leads); proposals: ADMIN `all`, SALES only the proposals they made unless filtering by a lead they can access (`queries.usecase.ts`).
- Customers CRM: SALES sees only customers of their leads (`customers/application/testing/fakes.ts` mirrors it); ADMIN/OFFICE all. UNVERIFIED in the real adapter (fake read only).
- Dashboard: `isAdmin = role === 'ADMIN'` gets counters/attention/recent; HR gets `staff` block and `people` attendance only; errors per block in `errors[]`.

### 2.4 ROLE x FEATURE permission matrix (what the mobile UI may expose)
Legend: Y = full, M = member/assigned only, O = own only, V = view only, - = no access. Backend facts above; "mobile scope" column applies the repo decision.

| Feature | ADMIN | HR | SALES | DESIGNER | TECHNICIAN | OFFICE | CUSTOMER | Mobile |
|---|---|---|---|---|---|---|---|---|
| Dashboard | Y | attendance only | - | - | - | - | - | in |
| Leads list/detail | Y | - | O | - | - | Y (all) | - | in |
| Lead create | Y | - | Y | - | - | Y | - | in |
| Lead status, edit, calls, visits | Y | - | O | - | - | - | - | in (call log, GPS visit) |
| Lead assign | Y | - | - | - | - | - | - | in (admin) |
| Lead CSV import | Y | - | - | - | - | Y | - | OUT |
| Call stats | Y | - | - | - | - | - | - | in (admin) |
| Proposals list/create/send | Y | - | O | - | - | - | - | in |
| Proposal view (public link) | link | link | link | link | link | link | link (token) | in (webview or native) |
| Proposal template builder | Y | - | - | - | - | - | - | OUT |
| CRM customers | Y | - | O | - | - | Y | - | in |
| Customer invite | Y | - | Y | - | - | - | - | in |
| Projects list/detail | Y | - | summary of own leads' projects | M | M | M | O (own) | in |
| Project create/members/stage/close | Y | - | - | - | - | - | - | in (admin) |
| Design stage | Y | - | - | own project | - | - | - | in |
| Feed (CLIENT tab) | Y | - | - | M | M | M | O | in |
| Feed (TEAM tab) | Y | - | - | M | M | M | - | in |
| Approve design | - | - | - | - | - | - | O (customer only) | in |
| To-dos | Y | - | M | M | M | M | - | in |
| Docs (project files) | Y | - | - | M | M | M | O (flat, shared only) | in |
| Complaints view | all | - | O | O | assigned/own | all | O | in |
| Complaint raise | Y | - | own projects | own projects | - | any project | own project | in |
| Complaint assign/close | Y | - | - | - | - | - | - | in (admin) |
| Complaint resolve | Y | - | - | - | assignee | - | - | in |
| Complaint reopen | Y | - | - | - | - | - | O (customer) | in |
| Own attendance (GPS check-in/out, my month) | Y | Y | Y | Y | Y | Y | - | in (mobile is the natural GPS surface) |
| Attendance board / edit days | Y | Y | - | - | - | - | - | in (board), edit day optional |
| Employees (users, designations) | Y | non-Admin/HR | - | - | - | - | - | OUT (edit); designation list read is in |
| Salary | Y | Y | - | - | - | - | - | OUT (salary editing) |
| Settings | Y | - | - | - | - | - | - | OUT |
| Notifications bell/list | Y | Y | Y | Y | Y | Y | Y | in |
| Change own password | Y | Y | Y | Y | Y | Y | n/a (no password) | in |

Notes: the docs matrix (`auth-and-roles.md`) says Designation read is allowed for SALES/DESIGNER/TECHNICIAN/OFFICE and the code matches (`STAFF_ROLES`). `docs/05-design/layout-and-navigation.md` says OFFICE's lead access is "add/view (no status, no calls)" which equals the route gates. Salary visibility: `UserDto.fixedSalary` is present for ADMIN and HR responses only, so the app must treat it as optional.

### 2.5 Landing page and navigation per role (`apps/web/lib/nav.ts`, `components/shell/*`)
`landingFor(role)`: ADMIN and HR -> `/` (dashboard; the HR dashboard is the attendance overview); SALES -> `/leads`; TECHNICIAN -> `/complaints`; DESIGNER, OFFICE, CUSTOMER -> `/projects` (customer lands on their project). The invite page redirects with `landingFor`.

`NAV` items (roles array, group):
| Item | Roles | Group |
|---|---|---|
| Dashboard `/` | ADMIN, HR | Work |
| Leads | ADMIN, SALES, OFFICE | Work |
| Proposals | ADMIN, SALES | Work |
| Customers | ADMIN, SALES, OFFICE | Work |
| Projects | ADMIN, SALES, DESIGNER, TECHNICIAN, OFFICE, CUSTOMER | Work |
| To-dos | ADMIN, SALES, DESIGNER, TECHNICIAN, OFFICE (`STAFF_EXCEPT_HR`) | Work |
| Complaints | ADMIN, SALES, DESIGNER, TECHNICIAN, OFFICE, CUSTOMER | Work |
| Attendance | ADMIN, HR, SALES, DESIGNER, TECHNICIAN, OFFICE | People |
| Employees | ADMIN, HR | People |
| Salary | ADMIN, HR | People |
| Settings | ADMIN | Admin |

Resulting visible items per role (mobile bottom-tab input): ADMIN 11; HR: Dashboard, Attendance, Employees, Salary (4; drop Employees/Salary on mobile = 2); SALES: Leads, Proposals, Customers, Projects, To-dos, Complaints, Attendance (7); DESIGNER: Projects, To-dos, Complaints, Attendance (4); TECHNICIAN: same as DESIGNER (4); OFFICE: Leads, Customers, Projects, To-dos, Complaints, Attendance (6); CUSTOMER: Projects, Complaints (2).

Shell rules to mirror:
- `AppShell` (staff): top bar 56 px (`h-14`) with logo, notification bell, user menu; sidebar from `lg`; drawer on tablets; `BottomTabs` below `md`.
- `BottomTabs`: at most 5 slots; if the role has more than 5 items, show the first 4 and a "More" sheet containing the full nav. Slot min height 56 px (`min-h-14`), label 11 px, icon 20 px, active = primary colour + medium weight, `aria-current`. Safe-area bottom padding.
- `CustomerShell`: no sidebar; top bar (logo, bell, user menu), centred column max 3xl, two fixed tabs: Project (`/projects`) and Complaints (`/complaints`). Design docs (`layout-and-navigation.md`) planned a third "Documents" tab for customers, but the code ships two (docs live inside the project). Follow the code.
- A project detail is a "workspace" (full-height, internal scrolling, like a chat); other pages scroll normally.
- Role-gated pages: `RoleGate` renders the calm not-found view for a disallowed role.
- Deep-link/route conventions for parity (`layout-and-navigation.md`): `/projects/[id]?tab=feed|todos|docs|activity`, `&feed=client|team`, `&post=`, `&todo=`, `&file=`; notification `ref` kinds `LEAD|PROPOSAL|PROJECT|TODO|COMPLAINT` with optional `postId`, `projectId`, `fileId`.
- Docs-promised sidebar counts (open complaints, unseen proposals) and a command palette are web conveniences, not needed on mobile.

---

## 3. Shared patterns

### 3.1 Envelope (`packages/contracts/src/http.ts`)
Success: `{success: true, statusCode, request: {method, url, requestId, ip? (omitted in production)}, message, data}`. Error: `{success: false, statusCode, code, request, message, data? (caller-actionable details), trace? (omitted in production)}`. The `x-request-id` response header equals `request.requestId`; capture it in the mobile error reporter (the app may also send `X-Request-Id`, which CORS allows; whether the server reuses it is UNVERIFIED, see `request-id.middleware.ts`). Helpers: `HttpSuccessBody<T>`, `HttpErrorBody`, `isHttpError`. Clients read `body.data`.

### 3.2 Error handling rules (`shared/http/error-handler.ts`)
- Zod body/query/param failure -> 400 `VALIDATION_FAILED`, `data` = zod issues array (`[{path:[...], message, code}]`). Map `path.join('.')` to form fields; unmapped issues go to a banner. Message: "Some of the details provided are not valid."
- Invalid JSON -> 400 `VALIDATION_FAILED`; body over 2 MB (`express.json({limit:'2mb'})`) -> 413 `PAYLOAD_TOO_LARGE`; unknown route -> 404 `NOT_FOUND`; unexpected -> 500 `INTERNAL`.
- `AppError.badRequest` -> 400 VALIDATION_FAILED; `conflict` -> 409; `unavailable` -> 503 SERVICE_UNAVAILABLE (Cloudinary unconfigured/down: show "Photo uploads are not set up yet"); `forbidden` 403; `notFound` 404.
- UI rules from `docs/05-design/design-system.md` section 5: every list needs loading (skeleton), empty, error with retry, forbidden/not-found (calm), offline states; 409 on complaint actions -> toast "Someone else just updated this" and refetch; optimistic updates only for lead status move, to-do check/uncheck, notification reads (rollback with toast); everything else waits for the server.

### 3.3 Pagination (`packages/contracts/src/pagination.ts`)
Page-based, not cursor: query `page` (>=1, default 1), `pageSize` (1..100, default 20), `search` (trimmed, non-empty), `sortOrder` (`asc|desc`, default `desc`). Response `data` = `PaginatedDto<T>` = `{items, page, pageSize, total, totalPages}`. Notifications and users reuse `page/pageSize` with module-specific filters. Some modules return plain arrays (e.g. `GET /api/todos/mine`, complaints counts); check each DTO. For mobile use `useInfiniteQuery` with `page` as the cursor and stop at `page >= totalPages`. Beware drift: new rows shift pages; de-dupe by `id`.

### 3.4 Dates, time, timezone
- Business timezone `BUSINESS_TIMEZONE`, default `Asia/Kolkata` (`env.ts`); web constant `BUSINESS_TZ = 'Asia/Kolkata'` (`apps/web/lib/format.ts`); the server `BusinessClock` (`shared/time/businessClock.ts`) gives `now()`, `dateOf(instant)` and `at(date, 'HH:mm')`.
- Instants travel as ISO 8601 strings (UTC, `toISOString`); attendance `setDayBodySchema` accepts `datetime({offset: true})`.
- Calendar days and months travel as strings: `dateStringSchema` `YYYY-MM-DD`, `monthStringSchema` `YYYY-MM`, in the BUSINESS timezone. To-do `dueOn` is a `YYYY-MM-DD` day; overdue is decided by the business calendar, so the phone's own zone must never decide "today". Use `businessDate()` (en-CA formatter in IST) from `format.ts` to compute "today" on the client, not `new Date().toISOString().slice(0,10)`.
- Display: `12 Nov 2026` (`en-GB`, day numeric, month short), `3:40 PM` (`en-US`, 12 h), relative ("just now", "5 min ago", "3 h ago", "2 days ago" under 14 days, then date), durations `45 s`, `7 min`, `1 h 20 min`. All in IST irrespective of device zone. React Native Hermes supports `Intl.DateTimeFormat` with `timeZone` on current Expo SDKs (UNVERIFIED for the chosen SDK; test `timeZone: 'Asia/Kolkata'` on Android release builds).
- Pure day arithmetic `addDays(date, n)` uses UTC to avoid DST/zone shifts; `formatDay(date)` uses noon UTC to avoid shifts.
- Weekly off is a settings string (e.g. `SUN; SAT:1,3`, `shared/time/weeklyOff.ts`); the attendance month DTO already marks `OFF` days so the app does not need the rule.

### 3.5 Money
Whole rupees as integers everywhere; no paise. `formatINR(rupees)` = `Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0})` after `Math.round` -> `₹12,50,000`. `formatINRShort`: >= 1 crore `₹1.5 Cr`, >= 1 lakh `₹90 L` (one decimal trimmed), else full. Use `tabular-nums` for money, counts, phones. Proposal totals are computed on the server in whole rupees; discount cannot exceed subtotal. UNVERIFIED: Hermes `Intl.NumberFormat` `en-IN` grouping on Android; write the lakh/crore grouping by hand in `packages` shared helper if unsure.

### 3.6 Phone
Stored/sent as 10 digits (no `+91`). Normalise with `phoneSchema` before sending. Display `+91 98765 43210` with the prefix shown not typed (design-system forms). Tap-to-call (`tel:`) and WhatsApp (`wa.me/91XXXXXXXXXX`, ADR-0004) are first-class buttons on a lead. WA AGENT adds `+91` server-side (`waAgentClient.ts`).

### 3.7 Files and images (`packages/contracts/src/uploads.ts`, `shared/storage/*`, `lib/upload.ts`)
Flow (provider-neutral): (1) ask for a signed ticket: `POST /api/projects/:id/uploads/sign`, `POST /api/complaints/uploads/sign` (body `signComplaintUploadBodySchema`), `POST /api/complaints/:id/uploads/sign` (resolve photos), `POST /api/projects/:projectId/files/uploads/sign` (documents); (2) POST multipart to `ticket.url` with `ticket.fields` first, exactly as given, then the file in `ticket.fileField` (progress via XHR); (3) take the provider reply (`public_id, width, height, bytes`) and send `ImageInputDto {publicId, width?, height?, bytes?}` with the post/comment/complaint. `UploadTicketDto` = `{url, method:'POST', fileField, fields: Record<string,string>, expiresAt}`.
- Image ticket: `url = https://api.cloudinary.com/v1_1/{cloud}/image/upload`, signed with `allowed_formats`, `folder`, `timestamp`. File ticket: `.../auto/upload`. Folders: `{root}/projects/{projectId}` for photos, `{root}/projects/{projectId}/files` for documents (`folders.ts`; the root is `CLOUDINARY_FOLDER`, e.g. `vastu-dev`). The server checks the `publicId` is a direct child of the folder (`isInFolder`).
- Limits: `MAX_IMAGES_PER_POST = 20`, `MAX_IMAGES_PER_COMMENT = 5`; web `MAX_IMAGE_BYTES = 10 MB` client-side check; relay `MAX_RELAY_BYTES = 60 MB`.
- Web uploads through the API relay `POST /api/uploads/relay?target=<ticket.url>` (Bearer; streams multipart untouched to Cloudinary; allowed targets only the cloud's `image/upload` and `auto/upload`). Reason: the browser never talks to Cloudinary. Mobile has no CORS/ad-block concern, so it may upload straight to `ticket.url` (works, since signature authorises) or through the relay (simpler for network allow-lists and for 60 MB cap). Decide once; direct upload saves server bandwidth on slow Indian mobile networks, but relay keeps a single host to whitelist. UNVERIFIED: relay behaviour with React Native `FormData` file parts (multipart boundary from RN `fetch` is fine in practice; test).
- Cancelled uploads: `DELETE /api/uploads?publicId=` (only project-folder ids not yet in use, 409 if in use).
- Response shape for display: `ImageDto {publicId, url, thumbUrl, width|null, height|null}`; the API builds the URLs, clients never do. `url = https://res.cloudinary.com/{cloud}/image/upload/f_auto,q_auto/{publicId}`; `thumbUrl = .../c_limit,w_480,f_auto,q_auto/{publicId}`. Documents (`FileUrls`): `url`, `thumbUrl|null`, `previewUrl?` (PDF first page `pg_1,c_limit,w_1400,f_jpg`), `downloadUrl` (`fl_attachment`). Seeded demo images use placeholder ids and yield non-resolvable URLs (storage adapter fallback returns the id as URL).
- Design guidance: lazy load, fixed aspect boxes from `width/height`, blurred placeholder, per-file progress with retry. Use `expo-image` with the thumb in lists and the full URL in the viewer. Android note: `f_auto` may serve AVIF/WebP; `expo-image` handles both.

### 3.8 Swagger
OpenAPI is served at `/api/docs` (`SWAGGER_DOCS_PATH`) in non-production only (`mountSwagger` returns early when `isProduction`). It is generated from the same zod schemas (`zod-to-openapi`), tagged per module. The mobile team can use it in dev/staging for request shapes; in production there is no live spec (a generated `openapi.json` snapshot or the contracts package is the substitute).

### 3.9 Health
`GET /api/health` returns `HealthReportDto {status: 'OK'|'DEGRADED', uptime, dependencies[{name, status, detail?}]}`. Useful as a reachability check; it carries no version information.

---

## 4. Design tokens (`apps/web/app/globals.css`, `docs/05-design/design-system.md`)

Light mode only ships (`globals.css`: "dark mode is phase 2"; no `.dark` block exists). The design doc proposes a dark palette (background `#171310`, card `#211C18`, foreground `#F2ECE4`, border `#352E28`, primary `#2BB59B`, primary-soft `#12352F`) but it is not implemented and clashes with the cool-ink light theme. Treat dark as new design work for mobile (ship light first).

### 4.1 Colours (hex, from `:root`)
| Token | Value | Use |
|---|---|---|
| background / card / popover | `#ffffff` | surfaces |
| foreground / card-foreground | `#0f1c1a` | body text |
| primary | `#0e8f78` | buttons, links, active tab, focus ring (`ring` same) |
| primary-hover | `#0b7563` | pressed state |
| primary-soft / accent | `#e4f5f0` | selected row, active nav bg |
| primary-foreground | `#ffffff` | text on primary |
| secondary / muted | `#f0f5f4` | subtle fills, skeletons |
| muted-foreground | `#566865` | secondary text (AA); placeholder/disabled can use brand `#9a8b7e` |
| border | `#dce6e3` | dividers |
| input | `#cbd8d4` | input borders |
| destructive | `#c0392b` | delete, error |
| sidebar / sidebar-accent | `#f5faf8` / `#dcf1ea` | web only; mobile tab bar uses background |

Semantic pairs (fg on soft bg; a status chip is ALWAYS tinted bg + dark text of the same hue, never colour alone):
| Tone | fg | soft bg |
|---|---|---|
| info | `#1d5fa8` | `#e8f1fb` |
| success | `#1e7a46` | `#e7f5ec` |
| warning | `#9a6200` | `#fdf3dc` |
| danger | `#b3261e` | `#fbe9e7` |
| neutral | `#4a5b58` | `#edf2f1` |
| violet | `#5b3fa6` | `#efeafb` |
| orange | `#a24a10` | `#fcebdd` |
| accent | `#0b7563` (primary-hover) | `#e4f5f0` |

Chart palette (only small counters/bars in MVP): `#0E8F78`, `#2A78D6`, `#E0A02B`, `#D4694A`, `#9A8B7E`.

### 4.2 Status chip tones (`apps/web/components/common/status-badge.tsx`, port this mapping 1:1)
- Lead: NEW info, CONTACTED info, VISIT violet, PROPOSAL_SENT warning, FOLLOW_UP orange, WON success, LOST danger. (The `stuck` flag is an additive warning clock icon, not a status.)
- Project stage: DESIGN violet, SITE info, CLOSED neutral. Design stage values `IN_DESIGN`, `SHARED`, `APPROVED` (no web chip mapping found; UNVERIFIED).
- Complaint: OPEN danger, ASSIGNED warning, RESOLVED success, CLOSED neutral; reopened = ASSIGNED plus "Reopened xN" chip.
- Attendance day: PRESENT success "Present", ABSENT danger "Absent", OFF neutral "Off", FUTURE no chip; `missingOut` warning icon; `corrected` pencil icon.
- Proposal: DRAFT neutral, SENT info, SEEN accent, NO ACTION warning. The API stores only DRAFT/SENT; SEEN and NO ACTION are derived (`docs/05-design/api-map.md` section 4).
- Alerts: unseen/no action/stagnant = warning, overdue = danger. Chip anatomy: `rounded-full`, `px-2 py-0.5`, 12 px medium text, no wrap.

### 4.3 Typography
Plus Jakarta Sans for all UI (web: `next/font/google`, variable `--font-jakarta`) with Noto Sans Bengali fallback; Playfair Display only for proposal headings/totals (28-40 px / 600). Scale: body 14 px/1.5, page title 20/600 tracking -0.015em, section title 14/600, table header 12/600 muted, counter 24/600 tabular, caption 12 muted. In Expo load via `@expo-google-fonts/plus-jakarta-sans` (and `playfair-display` only if proposals render natively); there is no variable-font support on Android in RN, so load discrete weights 400/500/600/700 (UNVERIFIED which weights the web uses beyond 400/500/600). On a phone body 14 px is small; consider 15-16 px for inputs (iOS zoom is not an issue in RN, but touch comfort is).

### 4.4 Spacing, radii, elevation, touch
- 4 px grid; page padding 16 (`p-4`), block gap 20, card padding 16, form field gap 16.
- `--radius` 10 px: sm 6, md 8 (inputs/buttons), lg 10 (cards), xl 14 (sheets/dialogs), 2xl 18, pills/avatars full.
- Elevation: border + `shadow-card` = `0 1px 2px rgb(15 40 35 / .05), 0 6px 16px -6px rgb(15 40 35 / .10)`; hover `0 2px 4px rgb(15 40 35 / .06), 0 12px 28px -8px rgb(14 143 120 / .22)`. In RN translate to `shadowColor #0f2823`, offset (0,6), radius 16 / opacity 0.1 and Android `elevation 2`; keep the 1 px border since Android elevation is weak on white.
- Touch targets: min 40 px; bottom bar 44-56 px; buttons sm 32, default 40, lg 44 (mobile primary actions use lg). Icons lucide 16 px in buttons/nav, 20 px in empty states and tab bar, stroke 1.75: use `lucide-react-native`.
- Motion: 150 ms hover/focus, 200 ms sheets, skeleton shimmer, honour reduced motion (`AccessibilityInfo.isReduceMotionEnabled`).
- Accessibility: AA contrast (tokens chosen for it); status never colour-only; visible focus becomes `accessibilityState`; form errors announced.

### 4.5 Reuse strategy for React Native
1. Extract tokens into a plain TS module (`packages/design-tokens` or inside `packages/contracts`-adjacent package), e.g. `colors.light`, `radius`, `spacing`, `typography`, `tone: {info:{fg,bg}...}`. Source values: this file, section 4.1. The web currently keeps tokens only in CSS; do not parse CSS at runtime. Introducing the package does not require changing the web immediately.
2. Use NativeWind (Tailwind for RN) only if the team wants class-name parity with the web components; otherwise a small `StyleSheet`/theme object is simpler and mirrors the greynote fieldApp approach (another agent covers that).
3. Components to port as RN primitives first: `StatusBadge` (tone map above), `EmptyState`, `ErrorState` with retry, `Skeleton`, `PageHeader`, `StatCard`, `Avatar` (initials on `primary-soft`), `PhoneLink` (tel + wa.me), `ImageUploader`. Radix/shadcn cannot be reused; behaviour comes from the design doc component table.
4. `lib/format.ts` (`formatINR`, `formatINRShort`, `formatDate`, `formatTime`, `businessDate`, `addDays`, `formatDay`, `relativeAge`, `formatDuration`, `initials`) is pure TS with `Intl`; move it to a shared package so web and mobile consume the same file (this is a gap: it lives in `apps/web/lib` and would be copied otherwise).

---

## 5. Seed and demo data (`docs/demo/api-walkthrough.md`, `docs/demo/dummy-data.md`, `apps/api/src/scripts/`)

Scripts: `seed.ts` (first Admin from a prompted password), `seed-demo.ts` (`pnpm --filter @vastu/api seed:demo`), `check-storage.ts`, `check-whatsapp.ts`. `seed:demo` drives the REAL API, fills an EMPTY database, refuses in production, does nothing if the demo exists; supports `DEMO_ADMIN_PHONE` / `DEMO_ADMIN_PASSWORD` when an admin already exists. Run API: `pnpm dev:api` (port 4000); Swagger at `http://localhost:4000/api/docs`.

Demo logins (password `demo-pass-123` for all staff; owner `demo-admin-123`):
| Person | Phone | Role | Mobile use |
|---|---|---|---|
| Owner | 9000000001 | ADMIN | dashboard, assign, close |
| Ravi Sharma | 9000000011 | SALES (telecaller) | lead list, calls |
| Anil Gurung | 9000000012 | SALES (field, GPS) | visits, GPS check-in, proposals |
| Dev Mukherjee | 9000000013 | DESIGNER (senior) | feed, render loop, design stage |
| Sneha Roy / Kiran Thapa | 9000000014 / 9000000015 | DESIGNER | design board |
| Tarun Das / Bikash Rai | 9000000016 / 9000000017 | TECHNICIAN | to-dos, resolve complaints |
| Rita Ghosh | 9000000018 | OFFICE (receptionist) | raise complaint, leads |
| Hema Pal | 9000000020 | HR | attendance board |
| Bimal Sarkar | 9000000019 | OFFICE (biometric, NO login) | proves `canLogin=false` |

Customers (Mrs Rao, Mr Das, Mrs Sen) have no password: the seeder consumed their invites; create a fresh one with `POST /api/identity/customers/{customerId}/invite` as owner/sales and redeem it, or use OTP in dev with `OTP_DEV_MODE=true` (code `123456`). Seeded projects: Rao Kitchen (feed loop, docs), Das Residence (electric-board thread), Mrs Sen's kitchen (delivered, closed). Seeded photos are placeholder ids, so real images need Cloudinary credentials. Date `2026-11-12` offsets: the seeder back-dates records so reminders fire; `PATCH /api/settings {"values":{"reminders.unseenDays":0.0001}}` then `POST /api/reminders/run` creates notifications on demand.

Mobile dev tips: swagger dropdown `x-client: mobile`; use `.env` `OTP_DEV_MODE=true` for a no-WhatsApp login; from an Android emulator the API is `http://10.0.2.2:4000` (cleartext; see gaps), from a physical device use the LAN IP and allow cleartext in the dev build (Expo `usesCleartextTraffic`). Expo web proxies `/api` in Next; mobile has no proxy and must use the absolute `API_BASE_URL` (all API routes are under `/api/...`).

---

## 6. Notification references (owned elsewhere)
Endpoints (`apps/api/src/modules/notifications/interface/notifications.route.ts`): `GET /api/notifications?page&pageSize&unread`, `GET /api/notifications/unread-count`, `POST /api/notifications/read-all`, `POST /api/notifications/:id/read`. DTO `NotificationDto {id, type, title, body, ref|null, readAt|null, createdAt}`; `ref` = `{kind: LEAD|PROPOSAL|PROJECT|TODO|COMPLAINT, id, postId?, projectId?, fileId?}`; 26 `NOTIFICATION_TYPES`. Web polls `unread-count` every 30 s plus on focus; there is no push. Planned FCM: `PushSender` port (`docs/03-architecture/notifications-and-cron.md`), not implemented.

---

## 7. Web-only assumptions the mobile app must not copy

| Web behaviour | Why it does not carry over |
|---|---|
| refresh token in httpOnly cookie, `credentials: 'same-origin'`, `vk_session` hint cookie, middleware redirects | mobile uses body token + secure storage; no cookies, no Next middleware |
| `/api` proxied by Next (`next.config.ts` rewrites, `API_ORIGIN`) | mobile calls the API origin directly (HTTPS) |
| Web Lock + BroadcastChannel for cross-tab refresh | single runtime; use one module-level lock |
| uploads through `/api/uploads/relay` | optional on mobile (direct to Cloudinary is possible) |
| invite link `WEB_BASE_URL/invite/{token}` | needs universal link / app link or paste-token (gap) |
| public proposal link `/p/{token}` | open in an in-app browser or native renderer |
| pagination by URL search params | local state / query keys |
| `window.focus` refetch | use `AppState` change to `active` |
| `localStorage`/cookie hints | `expo-secure-store` for refresh token only; non-secret prefs in `AsyncStorage` |

---

## 8. API gaps and server work the mobile app needs

Priority: P0 blocks release, P1 needed soon after, P2 nice. Each item lists the evidence.

1. **Device and push registration (P1, P0 if push is a launch goal).** No endpoint, field or collection exists (grep for `deviceToken|fcm|expo-push|pushToken` found only roadmap/arch docs). Needed: `POST /api/identity/devices {platform, pushToken, appVersion, deviceName}` (and `DELETE`), a `Device` collection keyed by session or user, cleanup on logout/refresh revoke and on `DeviceNotRegistered` push receipts, and a `PushSender` port in the notifications module (planned in `notifications-and-cron.md`) triggered where notifications are written. Choose FCM direct or Expo Push Service (a managed route; one extra hop). Until built, mobile polls `unread-count` at 30 s only while foregrounded (no background alerts for overdue complaints/leads, which are the main value for field staff).
2. **App version and force-update check (P1).** `GET /api/health` has no version; there is no `/app-config`. Needed: `GET /api/app/config` (public) returning `{minVersion, latestVersion, storeUrl|apkUrl, maintenance}` and an optional `X-App-Version` request header logged server-side; allow that header in CORS only for web (mobile ignores CORS). `docs/01-scope/mvp-scope.md` says direct APK sideload, so an in-app update flow would also need an `apkUrl` and signed releases; if Play Store/EAS Update is used, `expo-updates` covers JS-only changes.
3. **Mobile attendance (P0 for field roles).** Endpoints exist: `POST /api/attendance/check-in`, `/check-out` with body `{location?: {lat, lng, accuracy?}}`, `GET /api/attendance/me?month=YYYY-MM`; the server sets the time (no client clock trust) and `AttendanceMethod` includes `GPS`. Gaps: (a) location is OPTIONAL in `checkInBodySchema`, so GPS attendance can be recorded with no coordinates; no geofence/office-radius rule or `attendanceType === 'GPS'` enforcement is visible (UNVERIFIED in `attendance.usecases.ts`; read it before building the screen); (b) no idempotency key, so a retried check-in after a timeout may double-record or 409 (UNVERIFIED which); (c) no mock-location/`isMocked` flag or device attestation; (d) no offline queue contract: if the app queues a check-in offline and sends later, the server time would be wrong; need an optional `clientTime` with server-side bounds, or a rule to refuse queued punches; (e) CUSTOMER can technically call these routes (no role gate); the UI hides them; add a server gate (`requireRole` staff) so customers and `attendanceType = null` users get 403.
4. **Deep links and invite redemption (P0 for customers).** Invite URL is `{WEB_BASE_URL}/invite/{token}` (`customers.usecase.ts`), proposal link `/p/{token}`. For an app: register a scheme (e.g. `vastukitchen://invite/{token}`) and https universal/app links (Android `assetlinks.json` served from the web domain, iOS `apple-app-site-association` if iOS is ever shipped) so the WhatsApp-shared link opens the app when installed and the web page otherwise. Server change: allow `WEB_BASE_URL` page to detect the app or add an `INVITE_APP_SCHEME`; keep web fallback because the invite is sent over WhatsApp to customers who may not have the app yet. For first-time installs, deferred deep link (Play install referrer) is needed to carry the token through install; otherwise customers must reopen the link after installing, or use OTP. Notification `ref` already encodes screen targets (`kind/id/postId/projectId/fileId`) and maps to routes `/projects/[id]?tab=...&post=` in docs.
5. **CORS irrelevance (info).** `cors({origin: env.CORS_ORIGINS, credentials: true, allowedHeaders: [...]})` only governs browsers. Native HTTP clients ignore CORS, so no change is needed for mobile; do NOT add mobile origins to `CORS_ORIGINS`. The allow-list of headers (`Content-Type, Authorization, X-Client, X-Request-Id`) means any new request header the web must send (e.g. `X-App-Version`) must be added there too.
6. **Token storage implications.** Refresh token lives 30/90 days and is the credential that matters: store in `expo-secure-store` (Keystore-backed on Android; consider `requireAuthentication` only if biometrics are wanted, since it blocks silent background refresh). Keep the access token only in memory. `expo-secure-store` has a ~2 KB per-value limit on some platforms; the refresh token is an opaque random value (length UNVERIFIED, see `cryptoTokenGenerator.adapter.ts`) so check that it fits. Android Auto Backup can restore secure storage onto another device with a spent token, which will then trigger theft revocation of all the user's sessions: exclude the secure-store file from backup (`android:allowBackup=false` or backup rules). Logout must call `/logout` with the refresh token (revokes only that session) and wipe storage; the server never lists or revokes sessions individually (no "sign out other devices" API; only change-password revokes all).
7. **Rate limits behind mobile networks (P1).** `trust proxy` = 1 uses the first forwarded IP. Indian mobile carriers use CGNAT, so many staff/customers can share one public IP. Failed-login limiter (30 per 15 min per IP) only counts failures, which is tolerable, but `otpByIp` (20 requests/10 min, EVERY request counted) can lock out a whole carrier pool during peak (9 am login), and `otpByPhone` (5/10 min) means a user who retries after a slow WhatsApp delivery is blocked for up to 10 minutes. Recommend: raise `otpByIp` or count only per phone plus per device id, add a `Retry-After` hint to the 429 body (`RateLimit-*` headers exist but the body has no `retryAfter` field), and show the countdown (30 s resend cooldown is silent on the server: the API returns 200 and sends nothing, so the app must enforce its own 30 s button timer and not call again). Do not build automatic retry loops on 429. Also ensure the reverse proxy forwards the real client IP (`X-Forwarded-For`) or all users appear as one IP.
8. **OTP delivery depends on WhatsApp only (P1).** There is no SMS fallback; users without WhatsApp or with delivery delay cannot sign in by OTP and must use a password, which they cannot reset themselves (no forgot-password endpoint). Mobile needs either an HR/Admin reset path surfaced in the app text or a server-side SMS/voice fallback. WA AGENT template send failures are server-side only (check `check:whatsapp`); the request still returns 200.
9. **Sessions and device management (P2).** `GET /api/identity/auth/sessions` and `DELETE /api/identity/auth/sessions/:id` do not exist; add them (with device name from item 1) so users can revoke a lost phone and ADMIN can see logins. Today Admin deactivation (`PATCH users/:id {active:false}`) revokes all sessions; that is the only remote kill.
10. **HTTPS/transport (P0 ops).** `docs/01-scope/mvp-scope.md` lists the VPS domain and SSL as an open question; Android 9+ blocks cleartext by default, so a real API domain with a valid TLS cert is required before a release APK works. Certificate pinning is optional and not recommended without a rotation plan.
11. **Contracts consumption (P1).** `@vastu/contracts` ships TypeScript source with Node-ESM `.js` import specifiers (web needs a webpack `extensionAlias`, `next.config.ts`). Metro needs an equivalent resolver tweak (`resolver.sourceExts`/custom `resolveRequest` mapping `./x.js` to `./x.ts`) or the package needs a build step emitting JS; plan this before adding the package to Expo. Zod v3-style `z.string().openapi` is only used on the server. Check Expo SDK/Hermes compatibility with `TextEncoder` (used in `passwordSchema`): UNVERIFIED on Hermes, may need a polyfill (`TextEncoder` exists in recent Hermes builds).
12. **Calls and call logs (P1 for SALES).** Lead calls come from the device call log (`POST /api/leads/:id/calls {startedAt, durationSec, answered}`, ADR-0005); Android requires `READ_CALL_LOG` and is not available in Expo Go or on iOS, so this needs a dev client / config plugin; and the sideloaded APK is the stated mitigation for Play policy. Server: no bulk endpoint (one call per request) and no dedupe key, so replaying the call log could create duplicates (UNVERIFIED; read `recordCall` use case).
13. **Offline and retry semantics (P1).** No write endpoint accepts an idempotency key (grep found none outside the WA client). For queued offline writes (post, comment, to-do complete, complaint), the app needs de-dupe or the server needs `Idempotency-Key` support. Notification mark-read and to-do toggles are naturally idempotent; creates are not.
14. **Search/list performance and payload size (P2).** All lists are page-based with `pageSize` up to 100; the dashboard computes many blocks per request and the web refetches every 60 s; on mobile use longer intervals and pause when backgrounded.
15. **Swagger absent in production (P2).** Mobile devs need a spec: export `openapi.json` in CI or keep Swagger on staging.
16. **Customer proposal viewing (P2).** CUSTOMER cannot list proposals (`/api/proposals` is ADMIN/SALES); they reach a proposal only through the public token link (`GET /api/public/proposals/:token`, no auth, `POST .../seen` with optional auth). A customer-facing proposals tab would need a customer-scoped endpoint. Today the customer app has Project and Complaints tabs only.
17. **Design doc drift to settle.** Layout doc promises a customer "Documents" tab and a "forgot/reset" page that the code does not have (code has two customer tabs and explicitly no reset route); sidebar count pills and command palette are not in nav code. Mobile follows the CODE.

---

## 9. Quick reference for the mobile networking layer

- Base URL: `${API_BASE_URL}/api` (absolute HTTPS). Headers: `X-Client: mobile`, `Content-Type: application/json` when sending a body, `Authorization: Bearer <access>` except on anonymous auth routes, optional `X-Request-Id`.
- Wrapper contract: return `body.data`; throw `ApiError {status, code, message, fieldErrors, details}`; status 0 = `NETWORK`; 401 `UNAUTHENTICATED` -> single-flight refresh + one retry; second 401 -> sign out; 401 `TOKEN_INVALID` on refresh -> sign out; 429 -> show message, no auto retry; 503 -> "not set up / try later".
- Cold start: read refresh token from secure storage -> `POST /refresh` (body `{refreshToken}`, header `X-Client: mobile`) -> store NEW refresh token -> `GET /me` -> choose shell by `user.role` (CUSTOMER -> customer shell with 2 tabs; others -> staff shell with `navFor(role)` and the more-menu rule) -> land on `landingFor(role)`.
- Refetch policy: `AppState` active -> refetch unread count; poll unread count every 30 s while foreground only.
- Respect scoping by never client-filtering for security: trust 404 as "not yours", render action buttons from server-provided `can{}` blocks where present (complaints), and from role gates only for navigation.

## Appendix: key files cited
Server: `apps/api/src/app.ts`, `config/env.ts`, `routes.ts`, `shared/access/scope.ts`, `shared/http/{authenticate,authorize,client.util,error-handler,response.util,swagger.util}.ts`, `shared/storage/{uploadRelay.route,cloudinaryStorage.adapter,folders,storage.port}.ts`, `shared/time/{businessClock,businessDate}.ts`, `shared/whatsapp/waAgentClient.ts`, `modules/identity/**` (auth.route, auth.controller, refreshCookie, sessionIssuer, otp/refreshSession/login/customers/changePassword use cases, session.schema), `modules/{projects,complaints,todos,docs,hr,dashboard,leads,proposals}/interface/*.route.ts` and their access services.
Contracts: `packages/contracts/src/{identity,auth,errors,http,pagination,uploads,hr,notifications}.ts`.
Web: `apps/web/lib/{auth.tsx,nav.ts,format.ts,upload.ts}`, `lib/api/{client,session,queries}.ts`, `components/shell/{app-shell,bottom-tabs,customer-shell}.tsx`, `components/common/{status-badge,role-gate}.tsx`, `app/globals.css`, `app/(app)/layout.tsx`, `app/(public)/{login,invite}`.
Docs: `docs/03-architecture/{auth-and-roles,notifications-and-cron,overview}.md`, `docs/05-design/{design-system,layout-and-navigation,api-map}.md`, `docs/demo/{api-walkthrough,dummy-data}.md`, `docs/adr/0003,0004,0005,0009,0010`.
