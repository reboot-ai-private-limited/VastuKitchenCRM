# Vastu Kitchen mobile app: principles and scope

Status: design, 2026-11-12. Read this first. Next: [01-personas-and-navigation.md](01-personas-and-navigation.md). Feature specs are in `docs/mobile/features/`.

Source key (all under `docs/mobile/research/`). Used in brackets, e.g. [F §2.4] = `inventory-foundations.md` section 2.4.

| Code | File |
|---|---|
| F | inventory-foundations.md |
| L | inventory-leads-customers-proposals.md |
| W | inventory-project-workspace.md |
| P | inventory-people-overview.md |
| G | reference-greynote-fieldapp.md |
| U | research-ux-patterns.md |
| N | research-native-and-policy.md |
| O | research-offline-performance-i18n.md |
| S | research-stack-and-distribution.md |
| D | `docs/05-design/*.md` (web design docs) |

Marks: UNVERIFIED = not confirmed in code or a primary source; GAP = the server or contract lacks something, the doc says what to add.

## 1. What the app is

- One React Native (Expo) app for every role: ADMIN, HR, SALES, DESIGNER, TECHNICIAN, OFFICE, CUSTOMER. The shell changes per role, as on the web [F §2.5].
- The phone client of the existing API (`apps/api`, 114 operations [D README]) and the existing `@vastu/contracts` zod schemas. It adds no new business rules. The API is the only gate; the app hides what a role cannot use [F §2.1].
- The place where phone-only work happens: calling a lead, logging a visit with GPS, checking in to work, taking site photos into the project chat, approving a design, raising a complaint.
- Architecture and base setup mirror `../greynote/apps/fieldApp` (expo-router, `src/lib`, `src/offline`, secure-store session, single-flight refresh) [G §1, §3, §10].

## 2. What the app is not

- Not the admin console. Settings, CSV imports, employee and salary editing, and the proposal template builder stay on the web (owner decision).
- Not a second source of truth. No local-only business data beyond a read cache and a write outbox.
- Not a document editor. No WYSIWYG proposal rendering in v1 [L §10].
- Not a tracker. No background location, no call-log scraping on the Play build [N §1].
- Not a push-dependent app. Everything works without push; push is a doorbell [O §1.4].

## 3. Principles

| # | Principle | What it means for design | Source |
|---|---|---|---|
| 1 | Phone-first jobs | Build around the job (call, check in, post a photo, approve), not around the web page. Tables become cards, dialogs become bottom sheets. | [U §1.1], [L §0] |
| 2 | WhatsApp-native | Project chat looks and behaves like WhatsApp (bubbles, reply, photo grid, send ticks). Links to proposals, invites and projects are shared and opened through WhatsApp. | [U §1.1, §1.4] |
| 3 | Field actions work offline | Check-in/out, visit log, call outcome, chat photo post, to-do tick go through an outbox. Everything else shows "Needs internet". | [O §1.1] |
| 4 | Server is the authority | Never filter client-side for security. 404 means "not yours", 403 means "never". Render action buttons from server `can{}` blocks where they exist. | [F §2.1, §9] |
| 5 | Thumb-friendly | 48 dp targets, 8 dp spacing, primary actions in the bottom third, destructive actions never next to primary ones. | [U §2.5], [O §1.6] |
| 6 | Audience is unmissable | In chat, "Team only" vs "Client can see" is a labelled, coloured chip, default Team only. A wrong-audience post is the costliest mistake. | [U §1.1], [W §3.4] |
| 7 | Few tabs | Max 4 tabs + "More" for staff, 3 tabs for customers. No drawer as primary navigation. | [U §1.2, §3] |
| 8 | Role-specific home | One skeleton, a different Home per role. Check-in card is on Home for every GPS-tracked person. | [U §1.3] |
| 9 | Low-end, low-data | Android 8+, 2-4 GB RAM, patchy 4G. Skeletons over spinners, cached first paint, thumbnails in lists, photos compressed before upload. | [O §3.2, §3.4] |
| 10 | Business time, business money | Dates in Asia/Kolkata, never the device zone. Whole rupees, lakh/crore grouping. | [F §3.4, §3.5] |
| 11 | Never block on permissions | Ask in context (location at first check-in, camera at first capture, notifications after the first meaningful event). Offer a manual fallback if refused. | [N §2] |
| 12 | Follow the code, not the old design docs | Where `docs/05-design` and the code differ (customer tabs, forgot password), the code wins. | [F §2.5, §8.17] |
| 13 | Accessible by default | Labels on icon buttons, status never colour-only, layouts survive 200% font scale, reduce-motion honoured. | [O §7], [F §4.2] |
| 14 | English first, i18n-ready | No literal strings in JSX. Hindi then Bengali later. | [O §1.5] |

## 4. Decisions

### 4.1 Made by the owner

| # | Decision |
|---|---|
| M1 | One mobile app for all roles, role-based shells like the web. |
| M2 | React Native + Expo. Architecture and base setup mirror `../greynote/apps/fieldApp`. |
| M3 | Not in the mobile app: proposal template builder/editor/gallery, Admin settings, CSV imports, employee and salary editing. |

### 4.2 Proposed (owner to confirm)

Format: Decision (proposed), alternative, why.

| # | Decision (proposed) | Alternative | Why |
|---|---|---|---|
| P1 | Expo SDK 58 (RN 0.88, React 19.3). | SDK 57 as in greynote. | 58 is stable since 2026-10-15; React pin is nearer the web's 19.3.1 (greynote needs web pinned to 19.2.3). Pin one React for web+mobile. Re-check libraries for 58. [S §1.1, §2.1], [G §7] |
| P2 | Call logging by `tel:` link + post-call outcome bottom sheet on return to the app. Outcome, duration chips, note. | READ_CALL_LOG reader in a separate sideloaded/MDM "internal" Android flavor (ADR-0005). | A CRM is not a permitted READ_CALL_LOG use on Play; rejection risk is high (the risk is inferred from the closed use-case list). `startedAt` and `durationSec` are self-reported; mark `estimated` in UI. [N §1, §3.1], [L §5] |
| P3 | GPS attendance by one explicit foreground fix (`getCurrentPositionAsync`, High accuracy) on a Check in / Check out tap. | Geofence or background tracking. | Needs background-location review and a stronger DPDP justification. One-shot fixes cost no battery. [N §3.2] |
| P4 | Push via Expo push service, plus an in-app inbox as the fallback. Payload carries ids only. | Direct FCM (greynote uses a raw FCM token). | One API for both platforms, receipts, simpler server. Every push is also an inbox row. GAP: server needs device registration and a sender (section 7). [N §3.3], [G §5] |
| P5 | Hand-rolled SQLite outbox for field writes; TanStack Query persisted cache for reads. | PowerSync, WatermelonDB. | Five command types against an existing REST API; a sync engine replicates data sets instead. [O §1.1, §2.11] |
| P6 | `StyleSheet` + a shared design-token module. | NativeWind. | NativeWind v5 is still RC and needs Tailwind v4 on web. Tokens exist only as CSS today and must be extracted. [S §5], [F §4.5] |
| P7 | expo-router with `Stack.Protected` per role group: `(auth)`, `(staff)`, `(customer)`. | Separate customer and staff apps. | One codebase, deep links land in the right shell. Two store listings stay possible later (Open question 2). [S §4.1], [N §3.8] |
| P8 | Project chat is an inverted `FlatList`. | FlashList v2. | FlashList chat issues (scroll jumps, keyboard inset) are open upstream. Re-test in a spike. [S §4.4] |
| P9 | i18next + expo-localization, English only at launch, strings externalised. | i18n-js, Lingui. | Largest ecosystem; Hindi/Bengali phases need no refactor. [O §6.1] |
| P10 | WhatsApp deep links via verified Android App Links on the web domain, with the existing web page as fallback. | Custom scheme only. | Customers without the app must still open the proposal or invite. Deferred deep link through install is GAP (invite token). [N §3.5], [F §8.4] |

## 5. Web to mobile scope matrix

Verdicts: INCLUDE = ship as is, ADAPT = ship redesigned for the phone, LATER = after v1, EXCLUDE = never on mobile. Doc column links to `features/<name>.md` (written separately). Roles show who may use it; the API still enforces [F §2.2].

| Web feature | Verdict | Roles | Reason (one line) | Doc |
|---|---|---|---|---|
| Leads list (table) | ADAPT | ADMIN all, SALES own, OFFICE all (view/add) | Cards with status chips, stuck icon, call/WhatsApp buttons. [L §1] | [leads-and-calls](features/leads-and-calls.md) |
| Leads board (kanban) | LATER | ADMIN, SALES | Drag is a desktop pattern; status filter chips cover it. [L §1] | [leads-and-calls](features/leads-and-calls.md) |
| Add lead | INCLUDE | ADMIN, SALES, OFFICE | Fast capture in the field; 409 duplicate phone opens the existing lead. [L §2] | [leads-and-calls](features/leads-and-calls.md) |
| Lead detail + timeline | ADAPT | ADMIN, SALES own, OFFICE read-only | Single scroll with sticky Call / WhatsApp / Status / Proposal bar. [L §3] | [leads-and-calls](features/leads-and-calls.md) |
| Edit lead, change status | INCLUDE | ADMIN, SALES own (not WON) | Small forms, same rules (LOST reason, WON lock). [L §4] | [leads-and-calls](features/leads-and-calls.md) |
| Assign lead | ADAPT | ADMIN | Bottom-sheet SALES picker. [L §4] | [leads-and-calls](features/leads-and-calls.md) |
| Calls: log a call | INCLUDE | ADMIN, SALES own leads | Main reason Sales uses the phone; `tel:` + outcome sheet (P2). OFFICE cannot. [L §5] | [leads-and-calls](features/leads-and-calls.md) |
| Calls: call stats | LATER | ADMIN | Admin-only block of the dashboard. [L §14] | [dashboard-glance](features/dashboard-glance.md) |
| Visits: GPS visit log | INCLUDE | ADMIN, SALES own leads | One GPS fix + note + photo. GAP: no lead photo upload ticket; visit POST not idempotent. [L §6, §15] | [visits](features/visits.md) |
| Leads CSV import | EXCLUDE | ADMIN, OFFICE | Owner decision. [L §14] | none |
| Proposals list | ADAPT | ADMIN all, SALES own | Cards: number, customer, total, status chip, seen info. [L §9] | [proposals](features/proposals.md) |
| Proposal view, seen status, duplicate | INCLUDE | ADMIN, SALES | Frozen once sent; refetch on focus and push replace 30 s polling. [L §11] | [proposals](features/proposals.md) |
| Proposal send on WhatsApp / share link | INCLUDE | ADMIN, SALES | Bottom sheet with `requestId`; share sheet for the link. [L §12] | [proposals](features/proposals.md) |
| Proposal builder (draft form) | ADAPT | ADMIN, SALES | Simple form for items, discount, validity. No WYSIWYG renderer (LATER, GAP: no draft preview URL). [L §10, §15] | [proposals](features/proposals.md) |
| Proposal templates (gallery, editor) | EXCLUDE | ADMIN | Owner decision M3. Template picking defaults to `DEFAULT_PROPOSAL_TEMPLATE_KEY`. [L §14] | none |
| Public proposal page `/p/[token]` | EXCLUDE | link holders | Opened in the browser or share sheet, not a native screen. [L §13] | [proposals](features/proposals.md) |
| Customers list | ADAPT | ADMIN, OFFICE all, SALES own | Searchable list + call/WhatsApp. [L §7] | [customers](features/customers.md) |
| Customer detail, Start new project | ADAPT / INCLUDE | ADMIN, OFFICE, SALES own | Lead timeline plus one confirm sheet. [L §8] | [customers](features/customers.md) |
| Add customer | INCLUDE | ADMIN, OFFICE, SALES | Three fields. [L §8] | [customers](features/customers.md) |
| Invite customer | INCLUDE | ADMIN, SALES | Create invite, share link by share sheet. [W §2] | [customers](features/customers.md) |
| Customers CSV import | EXCLUDE | ADMIN, SALES, OFFICE | Owner decision. [L §14] | none |
| Projects grid | ADAPT | all with projects | List with stage chip; customers with one project open it directly. [W §1] | [projects-and-chat](features/projects-and-chat.md) |
| New project, edit project, team | LATER | ADMIN | Rare; projects are created when a lead is won. [W §1] | [projects-and-chat](features/projects-and-chat.md) |
| Stage, design stage, close project | INCLUDE | ADMIN; DESIGNER (own design stage) | Quick actions; close needs a final-delivery post. [W §2] | [projects-and-chat](features/projects-and-chat.md) |
| Workspace chat (feed) | ADAPT | members, ADMIN, CUSTOMER (client posts) | WhatsApp-style thread, camera first, audience chip. [W §3] | [projects-and-chat](features/projects-and-chat.md) |
| Approve design, final delivery | INCLUDE | CUSTOMER approves; staff post | Customer's key action. [W §3.2] | [projects-and-chat](features/projects-and-chat.md) |
| Project to-dos | INCLUDE | ADMIN, members | Checkbox list, expand to detail. [W §4] | [todos](features/todos.md) |
| Standalone /todos (My to-dos) | INCLUDE | ADMIN, SALES, DESIGNER, TECHNICIAN, OFFICE | Primary list for field staff, grouped by due bucket. [W §4.4] | [todos](features/todos.md) |
| To-do list management; Admin "Everyone" | EXCLUDE / LATER | ADMIN | Hidden on web too / low frequency. [W §4.8] | [todos](features/todos.md) |
| Complaints in project, standalone /complaints | INCLUDE | all (scoped) | Customer-facing, technician core. Buttons from `can{}`. [W §5] | [complaints](features/complaints.md) |
| Docs: browse, view, upload, share | INCLUDE | ADMIN, members; CUSTOMER shared files | Picker/camera/scan upload; open or share files. [W §6] | [docs-files](features/docs-files.md) |
| Docs: folder admin, share-into-app | LATER | ADMIN, members | Minimal folders in v1; share extension needs native work. [W §6.8] | [docs-files](features/docs-files.md) |
| Attendance: GPS check-in / check-out | INCLUDE | any user with `attendanceType = GPS` | Phone-only feature; web is read-only. Offline needs GAP G1. [P §2.1] | [attendance](features/attendance.md) |
| My attendance (month) | INCLUDE | any user on attendance | Merged with the check-in card. [P §2.2] | [attendance](features/attendance.md) |
| Attendance board (day) | ADAPT | ADMIN, HR | Status list + date stepper. [P §2.3] | [attendance](features/attendance.md) |
| Person month, correct a day | LATER | ADMIN, HR | View is in the board drill-down; corrections are low priority. [P §2.4] | [attendance](features/attendance.md) |
| Attendance simulate | EXCLUDE | ADMIN, HR | Demo tool. [P §2.5] | none |
| Employees list | ADAPT | ADMIN, HR | Read-only directory, tap to call. Hide `fixedSalary`. [P §3.1] | [attendance](features/attendance.md) |
| Employees add/edit/password, designations | EXCLUDE | ADMIN, HR | Owner decision M3. Deactivate-only is LATER. [P §3.2] | none |
| Salary: view sheet | LATER | ADMIN, HR | Owner glance, low phone value. [P §4] | none |
| Salary: generate, edit, finalize, CSV | EXCLUDE | ADMIN, HR | Owner decision M3. [P §4] | none |
| Dashboard (Admin) | ADAPT | ADMIN | Attention list first, then counters. [P §5] | [dashboard-glance](features/dashboard-glance.md) |
| Dashboard (HR) | ADAPT | HR | Attendance only = the day board plus a "present today" card. [P §5] | [dashboard-glance](features/dashboard-glance.md) |
| Dashboard range picker | ADAPT | ADMIN, HR | Presets: Today, 7 days, This month. [P §10] | [dashboard-glance](features/dashboard-glance.md) |
| Notification bell + list | INCLUDE | all | Alerts tab (staff) or header bell (customer); push added. [P §6] | [notifications](features/notifications.md) |
| Settings, reminders run | EXCLUDE | ADMIN | Owner decision M3. [P §7] | none |
| Login: OTP and password | INCLUDE | all | OTP default; password for staff. Sends `X-Client: mobile`. [F §1.5] | [auth-and-account](features/auth-and-account.md) |
| Invite redeem `/invite/[token]` | INCLUDE | CUSTOMER | App Link or pasted token; single use. [F §1.5] | [auth-and-account](features/auth-and-account.md) |
| Change password | INCLUDE | staff | Signs out everywhere; clear local tokens. [F §1.5] | [auth-and-account](features/auth-and-account.md) |
| Delete account (store rule) | INCLUDE | all | GAP: no delete-account endpoint exists; Play and App Store require an in-app path. [N §3.5] | [auth-and-account](features/auth-and-account.md) |
| Command palette, sidebar count pills | EXCLUDE | - | Web conveniences. [F §2.5] | none |
| Customer proposal list | LATER | CUSTOMER | GAP: `/proposals` is ADMIN/SALES only. [F §8.16] | [proposals](features/proposals.md) |

## 6. Non-goals

- No iOS-specific work for staff. Staff are Android. Customers may be on iPhone, so build and test iOS for the customer shell (Apple needs a demo account and in-app deletion) [N §3.5].
- No background location, geofencing, continuous tracking, call recording, SMS/contacts reading [N §4].
- No offline login, offline proposal send, offline admin actions, offline delete [O §1.1].
- No real-time channel (WebSocket/SSE) in v1. Foreground polling + push [O §1.4].
- No chat editing, mentions, read receipts, typing indicator. The API has none [W §10.7].
- No dark mode in v1; the web ships light only [F §4].
- No Hindi/Bengali strings in v1; the structure supports them.

## 7. Server dependencies that gate scope

These are GAPs the server must close; each feature doc repeats the ones it needs. Source: [F §8], [P §9], [W §10], [L §15].

| # | GAP | Needed by |
|---|---|---|
| 1 | Device and push-token registration, sender in `NotifyUseCase` | push (P4) |
| 2 | Idempotency (`clientId` or `Idempotency-Key`) on posts, comments, complaints, visits | outbox |
| 3 | Optional `capturedAt` on attendance check-in/out, or a decision to refuse offline punches | offline attendance |
| 4 | Role gate on attendance routes (CUSTOMER can call them today) | attendance |
| 5 | `GET /api/app/config` (min version) and `X-App-Version` | force update |
| 6 | Lead-scoped upload ticket for visit photos | visits |
| 7 | `fileId` missing from stored notification `ref` (code-evident, runtime UNVERIFIED) | file deep links |
| 8 | Delete-account endpoint | store policy |
| 9 | Per-project `lastPostAt`, unread count; `since` cursor | chat list |
| 10 | App Links: `assetlinks.json` on the web domain; deferred link for invite tokens | WhatsApp links |

## 8. Glossary

| Term | Meaning |
|---|---|
| Lead | A person who asked for a kitchen. One phone = one lead. Statuses: NEW, CONTACTED, VISIT, PROPOSAL_SENT, FOLLOW_UP, WON, LOST. [L §0] |
| Customer | A lead with an account (`customerId`). Created when a lead is WON, or added as an existing customer. The customer `id` is the CUSTOMER user id, not the lead id. [L §8] |
| Proposal | A priced document sent to a lead. API states DRAFT, SENT; "Seen" and "No action" are derived. Frozen once sent. [L §9, F §4.2] |
| Project | The workspace created when a lead is WON. Stages DESIGN, SITE, CLOSED. Design stages NOT_STARTED, IN_DESIGN, SHARED, APPROVED. [W §1] |
| Workspace / chat | The project feed: posts, photos, comments, approvals, activity rows. |
| CLIENT / TEAM | Post visibility. CLIENT = team + customer. TEAM = staff on the project only. Default TEAM. [W §3.2] |
| Final delivery | A CLIENT post kind with at least one photo; required to close a project. [W §0.2] |
| Complaint | A ticket: OPEN, ASSIGNED, RESOLVED, CLOSED, with reopen. [W §5.1] |
| To-do | A project task with assignees and a business-day due date. Buckets OVERDUE, TODAY, UPCOMING, NO_DATE. [W §4.4] |
| Docs | Project files and folders. Customers see only shared files, flat. [W §6.1] |
| GPS staff | A user whose `attendanceType` is `GPS`. Only they can check in on the phone. [P §1] |
| Outbox | Local SQLite table of pending writes with a client UUID used as the idempotency key. [O §2.2] |
| Shell | The role-specific tab layout: `(staff)` or `(customer)`. |
| `can{}` | Server-computed permission block on a DTO (complaints, posts). Render actions from it. [F §2.3] |
| Business date | `YYYY-MM-DD` in Asia/Kolkata, computed with `businessDate()`, never from the device zone. [F §3.4] |
| ref | Notification target: `{kind: LEAD\|PROPOSAL\|PROJECT\|TODO\|COMPLAINT, id, postId?, projectId?, fileId?}`. [P §6.1] |

## 9. Open questions for the owner

1. Proposal builder on mobile: draft form in v1 (this doc) or view/share/resend only (U §1.4)?
2. One app, two store listings (customer public, staff restricted)? Affects Play Data safety and review surface. [N §5.4]
3. Offline check-in: accept replay time as the official time, add `capturedAt`, or refuse offline punches? [P §2.1]
4. Call logging: tel + outcome sheet only (P2), or also an internal non-Play flavor with call-log reading? [N §5.1]
5. Staff with `canLogin = false` (biometric) appear able to sign in by OTP. Intended? UNVERIFIED. [F §1.5]
