# Mobile inventory: Leads, Customers, Proposals (+ call and visit logging)

Source of truth: code read on 2026-11-12. Paths are relative to the repo root.
Abbreviations: **R-L** = `apps/api/src/modules/leads/interface/leads.route.ts`, **R-C** = `apps/api/src/modules/customers/interface/customers.route.ts`, **R-P** = `apps/api/src/modules/proposals/interface/proposals.route.ts`, **SCOPE** = `apps/api/src/shared/access/scope.ts`, **LA** = `apps/api/src/modules/leads/application/services/leadAccess.ts`. All endpoints are under `/api`, return `{ data }` envelopes (the web client unwraps `data`; error shape not re-verified here, see `apps/web/lib/api/client.ts`), and all need a bearer token except the two `/public/proposals/*` routes.

## 0. Cross-cutting rules (apply to every screen below)

**Roles and routes** (from the `requireRole(...)` calls, not the docs):

| Capability | ADMIN | SALES | OFFICE | HR / DESIGNER / TECHNICIAN / CUSTOMER |
|---|---|---|---|---|
| List/get leads, timeline (R-L:198-225) | all leads | only own assigned | all leads | no access (403) |
| Create lead | yes | yes (auto-assigned to self) | yes (unassigned) | no |
| Edit lead `PATCH /leads/:id` | yes | own | no | no |
| Change status | yes | own, not if WON | no | no |
| Assign `POST /leads/:id/assign` | yes (to active SALES only) | no | no | no |
| Calls + visits (record and list) | yes | own leads | **no** | no |
| `GET /leads/call-stats` | yes | no | no | no |
| `POST /leads/import` | yes | no | yes | no (EXCLUDED from mobile) |
| Customers (`R-C:96` `ADMIN,SALES,OFFICE`) list/get/add/new-project/import | yes | own-lead customers | all | no |
| Proposals (`R-P:163` `ADMIN,SALES` for the whole router) | all | only ones they created (or any proposal on a lead they can access when `leadId` is given) | **no** | no |
| Proposal templates read `GET /proposal-templates[/:key]` | yes | yes | no | no (write is ADMIN, EXCLUDED) |
| Public proposal `GET /public/proposals/:token`, `POST .../seen` | no auth | no auth | no auth | no auth |

**Scope rule** (SCOPE:12-15): `leads` and `projects` and `complaints` and `proposals` each have a "sees all" role list; everyone else is `assigned`. For leads: `['ADMIN','OFFICE']` see all, others scoped. A lead outside scope returns **404, not 403** (LA:21-24) so the phone must treat 404 on a known id as "no longer yours" (e.g. reassigned) and drop it from local cache. For SALES, `GET /leads?assignedTo=<anything>` is silently overridden to "me" (`listLeads.usecase.ts`).

**Phone format**: `phoneSchema` (`packages/contracts/src/identity.ts:7`) accepts `+91 98765 43210`, `098765...`, 12-digit `91...`, and stores 10 digits. The phone can send raw contact-picker numbers. Stored values are always 10 digits (web builds `tel:+91XXXXXXXXXX` and `https://wa.me/91XXXXXXXXXX` from them, `apps/web/lib/leads.ts:97-100`).

**Pagination**: `{items,total,page,pageSize,totalPages}` (`paginatedSchema`); leads `pageSize` max 100 (default 20), customers default 24, proposals default 20. Web uses page numbers; mobile should use infinite scroll over `page`.

**Lead statuses** (`packages/contracts/src/leads.ts`): `NEW, CONTACTED, VISIT, PROPOSAL_SENT, FOLLOW_UP, WON, LOST`. Labels: New, Contacted, Visit, Proposal sent, Follow-up, Won, Lost (`apps/web/lib/leads.ts`). Any status may move to any other (not a strict funnel). Rules in `changeLeadStatus.usecase.ts`:
- `LOST` requires `lostReason` (zod refine, 400 otherwise); `lostReason` cleared when leaving LOST.
- Same-status move = 400 "already X".
- A WON lead is locked for SALES (403 "Ask an admin"); only ADMIN may move it back (project is not deleted).
- `WON` with no `customerId` finds-or-creates the CUSTOMER account, stores `customerId`, emits `lead.won` (creates the project). A later WON only creates another project if the lead had `newProjectRequested` ("Start new project").
- Automatic moves: first recorded call on a NEW lead -> CONTACTED (`calls.usecase.ts`, timeline row has `auto:true`); proposal send -> PROPOSAL_SENT unless WON/LOST (docs/02-product/proposals.md; implemented in `leads/.../proposalHooks.usecase.ts`, not re-read: UNVERIFIED line-level).
- **Visits do NOT move the lead to VISIT** (`visits.usecase.ts` only writes a VISIT activity). The phone should offer "also mark as Visit" via `POST /leads/:id/status`.
- `isStuck` = not WON/LOST and `statusChangedAt` older than a configured number of days (default `LEAD_STUCK_DAYS`=2 per docs).
- Sources: `WEBSITE, FACEBOOK, INSTAGRAM, JUSTDIAL, WALK_IN, REFERRAL, EXISTING_CUSTOMER, OTHER`. Call outcomes: `INTERESTED, CALL_BACK, NOT_INTERESTED, NO_ANSWER, WRONG_NUMBER`. Activity types: `CREATED, ASSIGNED, STATUS_CHANGED, CALL, VISIT, PROPOSAL_SENT, PROPOSAL_SEEN, PROJECT_CREATED, PROJECT_CLOSED`.

**Web "cosmetic" permissions** live in `leadPermissions()` (`apps/web/lib/leads.ts:28-37`); comment says "the API is the real gate". Mobile should copy the same table but derive from role at login.

**Global web behaviours that change on a phone**: tables -> card lists; dialogs/sheets -> bottom sheets or full screens; hover/`title` tooltips -> long-press or visible text; URL-synced filters (`?q=&status=&view=`) -> local state/route params; React Query `invalidateQueries` on `['leads'],['dashboard']` after every mutation -> same cache-invalidation plan on mobile; 30 s `refetchInterval` on sent proposals -> pull-to-refresh/focus refetch/push notification.

---

## 1. Leads list (table + board)

- **Purpose**: find and triage leads. Web: `apps/web/app/(app)/leads/page.tsx` -> `components/leads/leads-view.tsx` (table) and `leads-board.tsx` (kanban).
- **Roles**: ADMIN (all, can filter by assignee, assign from row menu), SALES (own only; no assignee filter), OFFICE (all, view/add only, no status/assign). Others: not in nav / 403. Rule: R-L:198 + `listLeads.usecase.ts`.
- **Data**: name, phone, city?, status badge, source, assignee name, `statusChangedAt` age, stuck clock icon (`isStuck`), created date. `LeadDto` (`leadSchema`).
- **Filters**: search (name/phone/city), status, source, assignee (`me|unassigned|userId`, Admin only), stuck toggle, view = table|board.
- **Actions**: open lead, change status (row menu, not when WON), assign (Admin), add lead, import CSV (Admin/Office; EXCLUDED on mobile), drag-drop between board columns.
- **API**: `GET /leads?page&pageSize&search&status&source&assignedTo&stuck=true` -> `PaginatedDto<LeadDto>` (`listLeadsQuerySchema`, `leadPageSchema`). Board: one `GET /leads?status=X&pageSize=50` per column (`useBoardColumn`); drag calls `POST /leads/:id/status {status}` with optimistic update and rollback. Assign picker: `GET /identity/users?role=SALES&active=true&pageSize=100` (Admin/HR only per comment in `lib/api/leads.ts`).
- **States**: loading = 10 row skeletons; error = `ErrorState` with retry; empty = "No leads yet" (with Add CTA if `can.add`) or "No leads match these filters" (filtered); 403 shown as 404 page.
- **Change on phone**: table -> card list with status chip, stuck icon, phone quick actions; board with drag -> horizontal status tabs/segmented filter (drag needs long-press; WON/LOST collapsed by default on web, `leads-board.tsx:34`); LOST/WON moves always open a confirmation (LOST reason, WON explanation), others move instantly with a snackbar (`leads-board.tsx:62-80`); filters in a bottom sheet; "stuck" as a prominent chip.
- **Phone-only**: swipe row for Call / WhatsApp; badge count of leads assigned today; offline cache of "my leads" (needed for call-log matching, section 5); push for "New lead assigned to you" (event exists server-side).
- **Verdict**: **ADAPT** (list + status filter chips for SALES is the core mobile screen; board view = LATER or skip, a status-filtered list achieves the same on a phone).

## 2. Add lead

- **Purpose**: capture a lead fast (walk-in, call). Web: `add-lead-sheet.tsx` (side sheet).
- **Roles**: ADMIN, SALES, OFFICE (`POST /leads`). SALES-created leads are auto-assigned to the creator; OFFICE/Admin-created stay unassigned until Admin assigns (docs/02-product/leads.md).
- **Fields**: name* (<=120), phone* (10-digit), source*, altPhone, email, city, notes (<=2000). Source has no default; user must choose.
- **API**: `POST /leads` body `CreateLeadBodyDto` -> 201 `LeadDto`. **409** if phone exists with `error.details.existingLeadId` (web reads it in `add-lead-sheet.tsx:101-103` and links to the existing lead). Field errors come as 400 with per-field details; web maps them via `friendly()`.
- **States**: submitting ("Adding..."), inline field errors, duplicate-phone state with "Open existing lead".
- **Change on phone**: side sheet -> full-screen form; **autofill from contact picker / share-into-app**; phone keyboard `phone-pad`.
- **Phone-only**: pick from device contacts; "Walk-in" preset source; add from an incoming-call screen (UNVERIFIED feasibility).
- **Verdict**: **INCLUDE** (high value for field sales).

## 3. Lead detail

- **Purpose**: the single place to work a lead. Web: `components/leads/lead-detail.tsx`, route `/leads/[id]`.
- **Roles**: ADMIN, SALES (own), OFFICE (read-only; no Calls/Visits/Proposals tabs because `seesLogs = ADMIN||SALES`, `lead-detail.tsx:46-47`). Out-of-scope id -> 404 `NotFoundView`.
- **Header**: name, status badge, "Stuck: no movement for a while", formatted phone. Buttons: Change status (disabled when WON, tooltip "Won leads are locked"), Edit (hidden when WON), Assign (Admin), +Proposal (ADMIN/SALES), Call (`tel:`), WhatsApp (`wa.me`).
- **Tabs**: Timeline, Proposals, Calls, Visits, Details (phone, alt phone, email, city, notes). Side summary: assignee, source, "status changed" age, created date, lost reason, linked project(s) when WON (`GET /projects?leadId` via `useLeadProjects`, not re-read: UNVERIFIED path), "Customer account created. Won leads are locked."
- **API**:
  - `GET /leads/:id` -> `LeadDto`
  - `GET /leads/:id/timeline` -> `LeadActivityDto[]` newest first (ADMIN/SALES/OFFICE). Rendered by `describeActivity` in `apps/web/lib/lead-activity.ts`; `data` is a loose record per type (`{from,to,note}` for status, `{answered,durationSec,outcome}` for call, `{note,latitude,longitude}` for visit).
  - `GET /leads/:id/calls` -> `CallDto[]` (ADMIN/SALES)
  - `GET /leads/:id/visits` -> `VisitDto[]` (ADMIN/SALES)
  - `GET /proposals?leadId=:id` -> `PaginatedDto<ProposalDto>` (ADMIN/SALES)
  - `PATCH /leads/:id` (edit, section 4), `POST /leads/:id/status`, `POST /leads/:id/assign`
- **States**: skeleton, error+retry, 404 view; per-tab skeleton/empty/error. Empty copy: Calls "Calls are logged automatically by the phone app."; Visits "Visits are checked in from the phone app." (web explicitly assumes the phone logs them, so the phone owns these.)
- **Change on phone**: two-column + tabs -> single scroll with sticky action bar (Call, WhatsApp, Status, +Proposal) and segmented tabs; summary aside becomes a collapsible card; Map link `https://www.google.com/maps?q=lat,lng` -> open native maps; lazy-load tabs (web only fetches a tab when active).
- **Phone-only**: tap-to-call that also starts call tracking (section 5); WhatsApp deep link; "Check in visit" button (section 6); add note; share lead.
- **Verdict**: **ADAPT** (core screen, must be redesigned as a mobile detail with a sticky action bar).

## 4. Edit lead / Change status / Assign (dialogs)

- **Edit** (`edit-lead-dialog.tsx`): ADMIN, SALES-own, not WON. `PATCH /leads/:id` `UpdateLeadBodyDto` (partial; send `null` to clear optional fields; "Nothing to update" 400). 409 on phone clash is likely (same unique rule) - UNVERIFIED for PATCH specifically.
- **Change status** (`lead-dialogs.tsx` `StatusDialog`): ADMIN, SALES (not WON). `POST /leads/:id/status` `ChangeLeadStatusBodyDto {status, note?, lostReason?}` -> `LeadDto`. UI: select status, optional note, lost-reason required when LOST, WON shows an explainer that a customer account is created and the lead locks. Errors: 400 same status / missing reason; 403 WON-locked for SALES.
- **Assign** (`AssignDialog`): ADMIN only. `POST /leads/:id/assign {userId|null}` -> `LeadDto`. 400 if user is not SALES. Notifies the new assignee.
- **Change on phone**: dialogs -> bottom sheets; status as a radio list with big targets; reuse the same optimistic-update + rollback approach as `useMoveLead`.
- **Verdict**: Edit **INCLUDE**; Status **INCLUDE**; Assign **ADAPT** (Admin only; bottom-sheet user picker; needs `/identity/users`, Admin/HR only, which is fine because only Admin sees it).

## 5. Call logging (phone owns this)

Design source: `docs/adr/0005-call-log-tracking.md` + `docs/02-product/leads.md` "Call tracking". Backend: `calls.usecase.ts`.

- **Flow**: Call button opens the phone's own dialer (no in-app dialer) -> user returns to app -> app reads Android call log (`READ_CALL_LOG`; sideloaded APK, so Play restrictions do not apply) -> match number+time+duration -> ask for outcome + note -> upload. Android only; iOS cannot read the call log (ADR "Android only"; fallback = manual outcome entry).
- **Privacy rule (hard requirement)**: upload **only** calls whose number matches a lead assigned to that employee; never other calls. The API also rejects a lead the user cannot access (404 via `LeadAccess`), but it does NOT verify the number actually matches the lead (it takes `leadId` in the path and trusts the client), so the matching must be done on-device.
- **Roles**: ADMIN, SALES (OFFICE cannot log calls: R-L:244-256).
- **API**:
  - `POST /leads/:id/calls` body `RecordCallBodyDto {startedAt (ISO date), durationSec 0..14400, answered: boolean, outcome?, note? (<=1000)}` -> `CallDto`. **201 when new, 200 when already recorded** (idempotent on lead+user+startedAt, so retrying after a network failure is safe: queue and retry). 400 if `startedAt` is more than 5 minutes in the future (phone clock skew limit, `calls.usecase.ts:CLOCK_SKEW_MS`). Side effects: timeline `CALL` row; first call on a NEW lead auto-moves to CONTACTED.
  - `GET /leads/:id/calls` -> `CallDto[]` (id, leadId, user{id,name}, startedAt, durationSec, answered, outcome|null, note|null).
  - `GET /leads/call-stats?from&to` -> `CallStatDto[] {user, calls, answered, talkSeconds}` ADMIN only, default today (server local time). Powers the Admin dashboard; mobile Admin could show it (ADAPT/LATER).
- **Data needed on device to match**: the user's assigned leads' phones. `GET /leads?assignedTo=me&pageSize=100` (loop pages). Also `altPhone`. See gap G3.
- **States**: permission denied (call-log permission) -> manual outcome form that posts `answered`, `durationSec: 0` and the user's own `startedAt`; unmatched call -> "Which lead was this?" picker limited to assigned leads; upload failure -> offline queue with retry (idempotent); 404 on upload = lead reassigned, drop it.
- **Phone-only**: the whole feature. Background-sync call log on app foreground; heads-up after a call ("Log outcome for Priya?"); notification action buttons for outcome.
- **Verdict**: **INCLUDE** (primary reason the phone app exists for Sales). Manual outcome-only fallback is mandatory (iOS and denied permission).

## 6. Visit logging / GPS check-in (phone owns this)

- **Roles**: ADMIN, SALES (own leads); OFFICE no. Allowed on any lead including WON ("a visit before a proposal and after it is Won", `visits.usecase.ts`).
- **API**:
  - `POST /leads/:id/visits` body `RecordVisitBodyDto {at? (default now), latitude -90..90, longitude -180..180, note? (<=1000), photoUrl? (valid URL)}` -> `VisitDto {id, leadId, user, at, latitude, longitude, note|null, photoUrl|null}`. Writes a timeline `VISIT` row. **Not idempotent** (no dedupe key, unlike calls): a retry after timeout creates a duplicate (gap G4).
  - `GET /leads/:id/visits` -> `VisitDto[]`.
- **Web**: Visits tab lists user, note, time, "Map" link to Google Maps. Nothing on web creates visits.
- **States**: location permission denied -> blocked (lat/lng are required; no manual-address fallback in the contract, gap G5); GPS accuracy poor -> show accuracy and let user retry; offline -> queue (needs client-side dedupe key).
- **Phone-only**: GPS (foreground permission only needed), camera photo, note, "Open in maps / navigate to lead city" (no street address on a lead, only `city`; proposal `siteAddress` is the closest). Suggest a "also move lead to Visit" toggle that calls `POST /leads/:id/status {status:'VISIT'}` (the visit endpoint does not).
- **Photo upload gap**: `photoUrl` is a plain URL, but the signed-upload flow (`uploadTicketSchema`: ask API for a ticket, POST file to storage, send `publicId`) exists only under `POST /projects/:id/uploads/sign` and docs; there is **no lead-scoped upload ticket endpoint** (gap G2). Interim: use the projects/docs ticket (needs a project/doc context, not available for a lead) or add `POST /leads/:id/uploads/sign`.
- **Verdict**: **INCLUDE** (GPS check-in is the second flagship phone feature).

## 7. Customers list

- **Purpose**: people who are customers (a lead that was WON or added as existing customer). Web: `components/customers/customers-view.tsx`, `/customers`.
- **Roles**: ADMIN, OFFICE (all), SALES (customers whose lead is theirs). R-C:96. Customers appear in the web side menu for these roles only (per nav; `apps/web/lib/nav.ts` not re-read: UNVERIFIED).
- **Data (`CustomerDto`)**: `id` (the CUSTOMER user id), name, phone, city, `leadId`, `leadStatus`, `owner{id,name}|null`, `projects[] {id,name,stage,createdAt}`, `projectsCount`, `activeProjects`, `startedAgain`, `lastActivityAt`, `createdAt`. Sort: customers with a project first, then most recent activity (`customers.usecases.ts` ListCustomers, sorted per page).
- **API**: `GET /customers?search&page&pageSize` -> `PaginatedDto<CustomerDto>`. Search matches name/phone/city. (Sorting is applied per returned page, so order may jump across pages - gap G7.)
- **States**: skeleton cards; empty "No customers yet" ("A customer appears when a lead is won. You can also add or import people who are already customers.") / "No customers match your search"; error+retry.
- **Change on phone**: 3-column card grid -> single-column list; debounced search; the `+ Add` and `Import CSV` header buttons -> FAB (add) and drop import.
- **Phone-only**: swipe to call/WhatsApp; import from device contacts into "Add customer" (instead of CSV).
- **Verdict**: **ADAPT** (list is simple, mostly a lookup + quick contact tool).

## 8. Customer detail (the customer model)

- **Model** (`packages/contracts/src/customers.ts` header comment, `customerLeads.usecase.ts`): one phone = one lead = the customer's record. The customer's timeline IS their lead's timeline (`Timeline id={c.leadId}`, `customer-detail.tsx:156`). There is no separate customer table in leads; customers are "leads with `customerId` set" (`customersOnly: true`). The customer `id` is the CUSTOMER user account id, not the lead id; always link to `/leads/:leadId` for lead actions.
- **Screen** (`customer-detail.tsx`, `/customers/[id]`): header (name, phone, city, Call, WhatsApp, owner), "Open lead", **Start new project** (hidden while `inProgress`), a warning banner when a new project is being planned ("Continue on the lead"), Projects list (links to `/projects/:id`, with stage), Timeline.
- **Roles**: ADMIN, OFFICE, SALES-own. Out-of-scope -> 404.
- **API**: `GET /customers/:customerId` -> `CustomerDto`; `GET /leads/:leadId/timeline` -> `LeadActivityDto[]`; `POST /customers/:customerId/new-project` -> `CustomerDto`; `GET /customers` (list). Create: `POST /customers` `AddCustomerBodyDto {name, phone, city?}` -> `CustomerDto`; 409 `error.details.existingCustomerId` if phone already a customer; 409 "belongs to another customer" if the lead's phone is linked to another account; staff phone refused (per import path comment).
- **Add-customer semantics** (`AddCustomerLeadUseCase`): no lead for that phone -> a WON lead with source `EXISTING_CUSTOMER` is created, **no project is made**; lead exists without account -> linked (and `newProjectRequested` set if not WON); already a customer -> 409. SALES adding becomes owner.
- **Start new project** (`StartNewProjectUseCase`): only acts when lead is WON or LOST; sets lead back to **NEW**, clears lostReason, `newProjectRequested = true`, keeps assignee (or assigns self if SALES and unassigned), writes timeline STATUS_CHANGED note "New project started". Idempotent: if already open, returns unchanged. When this lead later goes WON again, `lead.won` fires with `again:true` and a second project is created. Web confirm dialog text: "Their lead goes back to New so you can plan a visit and send a proposal. Nothing is [lost]..." (`customer-detail.tsx:163-166`). Button is shown to all three roles; no extra gate.
- **State logic**: `inProgress = leadStatus not WON/LOST` hides the button and shows the banner. Locked WON lead semantic means SALES cannot edit a WON customer's lead until Start new project is used.
- **Change on phone**: confirm dialog -> bottom-sheet confirm; project rows deep-link to the Projects feature (owned by another area; DESIGNER/TECHNICIAN projects are not reachable from here for those roles anyway since they have no Customers access).
- **Phone-only**: tap-to-call; "Check in visit" for a returning customer (works on WON leads); share customer contact.
- **Verdict**: **ADAPT** (detail + Start new project are simple; Add customer = INCLUDE; Import CSV = EXCLUDE per decision; `POST /customers/import` is Admin/Sales/Office web-only).

## 9. Proposals list

- **Purpose**: see proposals and their seen status. Web: `components/proposals/proposals-view.tsx`, `/proposals`.
- **Roles**: ADMIN (all), SALES (only those they created; "or any for a lead they can access" when filtering by `leadId`). OFFICE has **no** proposals access (router-level role gate R-P:163). ADMIN also sees a "Templates" button (EXCLUDED on mobile).
- **Data (`ProposalDto`)**: `number` (`VK-<year>-<0001>`), `status` (`DRAFT|SENT`), `leadId`, `customer{name,phone,city,siteAddress}` snapshot, `title`, `items[] {title,description,quantity,unitPrice,lineTotal}`, `subtotal, discount, total` (whole rupees), `notes, terms`, `templateKey` + `template` snapshot, `validUntil`, `publicUrl|null`, `sentAt, firstSeenAt, lastSeenAt, seenCount`, `whatsappSends[] {to,at,by}`, `createdBy`, `createdAt`. Chip (`ProposalChipBadge`) states: Draft / Sent / Seen / expired (exact rules in `proposals-view.tsx`, not re-read: UNVERIFIED).
- **API**: `GET /proposals?page&pageSize&leadId&status=DRAFT|SENT` -> `PaginatedDto<ProposalDto>`. Row actions (Duplicate, Delete draft) use the endpoints below.
- **States**: skeleton rows, error+retry, empty "No proposals yet" / "No proposals here" (status filtered) with "New proposal" CTA; pagination by Prev/Next on web.
- **Change on phone**: table -> cards (number, customer, total in INR, status chip, "Seen 2h ago . 3x"); the "New proposal" button opens a lead picker (web: `picking` state -> choose lead then `/proposals/new?leadId=`).
- **Phone-only**: push when customer opens ("proposal.seen" event -> in-app notification exists); open link in browser/share.
- **Verdict**: **ADAPT**.

## 10. Proposal builder (new / edit draft)

- **Purpose**: create/edit a draft. Web: `components/proposals/proposal-builder.tsx`, routes `/proposals/new?leadId=` and `/proposals/[id]` (draft). Two panes (Edit | live Preview) with a sticky preview on `lg`; on small screens an Edit/Preview toggle already exists (`pane` state, `proposal-builder.tsx:74,188-200`).
- **Roles**: ADMIN, SALES (lead must be accessible, else 404).
- **Fields**: template picker (`templateKey`), title (default "Modular kitchen proposal"), site address, items (1..50: title, description?, quantity > 0 up to 100 000, unitPrice integer rupees; reorder up/down, remove), flat discount (<= subtotal), notes (<=2000), terms (defaults from setting `proposals.defaultTerms`, <=5000), valid-until date (must not be in the past, else 400 `validUntil`).
- **API**:
  - `POST /proposals` `CreateProposalBodyDto {leadId, title?, siteAddress?, items[], discount?, notes?, terms?, validUntil?, templateKey?}` -> `ProposalDto` (draft; server computes number, totals, token, snapshot of customer from the lead and of the template).
  - `GET /proposals/:id` -> `ProposalDto` (preview; never counts as "seen")
  - `PATCH /proposals/:id` `UpdateProposalBodyDto` (drafts only; **409 "already sent... Duplicate it"** if sent; re-snapshot template when `templateKey` changes; totals recomputed server side).
  - `DELETE /proposals/:id` (drafts only; 409 for sent).
  - `GET /proposal-templates` -> list for the picker (ADMIN/SALES; DTO in `proposalTemplates.ts`, not re-read in full). `GET /proposal-templates/:key` for the selected template.
- **States**: dirty flag (Send disabled with "Save your changes first"), saving, validation errors per field, 409 already-sent, "Draft saved" toast then `router.replace(/proposals/:id)`; no autosave.
- **Change on phone**: the **live document preview** is rendered client-side by `components/proposals/render/*` (React/CSS `TemplateDocument` with themes, blocks, print stylesheet) - **this renderer cannot be reused in RN**. Options: (a) mobile preview = a simple native summary (items, totals) plus "Open customer view" in an in-app browser of `publicUrl` once sent; drafts have no public URL (drafts 404 publicly), so true WYSIWYG preview of a draft is not available (gap G6); (b) LATER: a WebView hitting a staff-authenticated preview page.
- **Phone-only**: voice-to-text for items; camera/gallery? (not part of the contract - proposals have no images; UNVERIFIED that templates have image blocks: `proposalBlockSchema` is a discriminated union, not enumerated here); numeric keypad for rupees.
- **Verdict**: **ADAPT** (create/edit as a simple form wizard; template **editing** EXCLUDED; template **picking** is optional, can default to `DEFAULT_PROPOSAL_TEMPLATE_KEY`). Mark WYSIWYG preview as **LATER**.

## 11. Proposal detail (sent state, seen tracking) and duplicate

- **Web**: `proposal-screen.tsx`. Draft opens the builder. Sent shows frozen document (rendered by `TemplateDocument` from the stored snapshot), buttons: Send/Send again on WhatsApp, Copy link, Customer view (open `publicUrl`), "Duplicate to edit", a "Frozen" notice (Snowflake icon), a seen panel: "N views . last X ago" or "Not seen yet . sent X ago", and the WhatsApp send history (`whatsappSends`).
- **Polling**: `useProposal` refetches every 30 s when SENT (`lib/api/proposals.ts`) so the panel notices a customer opening it.
- **API**: `GET /proposals/:id`; `POST /proposals/:id/duplicate` -> new draft `ProposalDto` (new number, new token, customer re-read from the lead, validity cleared, status DRAFT).
- **Rules**: sent = frozen (no edit, no delete); change = duplicate; the link is identical on every resend; "seen" tracking only counts the customer's browser, not staff (`publicProposal.usecase.ts`: ignores bots by user-agent and any authenticated non-CUSTOMER viewer).
- **Change on phone**: polling -> refetch on focus/pull-to-refresh + push; "Copy link" -> native Share sheet (share `publicUrl`) plus copy.
- **Verdict**: **INCLUDE** (read status, resend, share, duplicate).

## 12. WhatsApp proposal send flow

Web UI: `components/proposals/send-flow.tsx` (dialog). Server: `sendProposalWhatsapp.usecase.ts`, adapter `infrastructure/waAgentProposalMessenger.adapter.ts`. Commit `4590d6d`.

**Steps**
1. User taps "Send on WhatsApp" on a draft or sent proposal (builder disables it while dirty).
2. Dialog: "Send to" field prefilled with the lead's 10-digit number (+91 prefix shown), editable, validated with `phoneSchema`. Editing shows: "Different from the lead's number. This only changes where this message goes: the lead keeps its own number." Preview of the template message: greeting + "View proposal" button (`proposalMessagePreview`).
3. Copy for a draft: sending **freezes** it (`SEND_MESSAGE_FROZEN`, constant in `lib/proposals.ts`); for a sent one: "uses the same link... nothing changes".
4. `POST /proposals/:id/send-whatsapp` body `SendProposalWhatsappBodyDto {phone?, requestId?}` (requestId 8-64 chars: **one per confirm click**; backend builds idempotency key `proposal-<id>-<requestId>`, so a double tap or retry sends once; the web generates `crypto.randomUUID()`; mobile must generate its own, e.g. `expo-crypto` / `uuid`, and keep it for retries of the same tap).
5. Response `SendProposalWhatsappResponseDto` = `{proposal, publicUrl, whatsappUrl, sentTo, delivery: 'sent'|'not_configured'}`.
6. Result UI: `delivery:'sent'` -> "Sent to +91 XXXXX XXXXX" + Copy link + Done; `not_configured` -> "Sending from here is not set up yet, so nothing was sent. The proposal is frozen: share the link yourself" + Copy link + **Open WhatsApp** (`whatsappUrl` = `https://wa.me/91<phone>?text=<"Namaste <first>, here is your proposal <number> from <company>: <publicUrl>">`).
7. Fallback: "Share the link myself instead" -> `POST /proposals/:id/send` -> `SendProposalResponseDto {proposal, publicUrl, whatsappUrl}` then Copy link/Open WhatsApp. Calling `/send` again returns identical links and changes nothing.

**Side effects**: first send flips DRAFT->SENT (`markSent`), moves the lead to PROPOSAL_SENT (unless WON/LOST) with a timeline `PROPOSAL_SENT` row (only the request that really flipped the state does this); each WhatsApp send appends to `whatsappSends [{to, at, by}]`. The template sent is `proposal_share` (route description) from the business number, so the **phone does not need WhatsApp installed** for the template path.
**Errors**: 400 if `validUntil` is in the past when freezing a draft (`assertNotInPast`); 404 not accessible; **503** if WhatsApp could not send - "the proposal stays frozen" (web appends: "The proposal is now frozen: you can try again or share the link yourself."); network failure on an idempotent retry is safe only if the same `requestId` is reused. Web invalidates queries on failure too, because the draft was frozen before WhatsApp was attempted (`onSettled`).
**Roles**: ADMIN, SALES (proposal must be theirs / on an accessible lead).
**Mobile adaptation**: dialog -> bottom sheet; number field = `phone-pad` + contact picker; after success offer the **native share sheet** for `publicUrl`; for `not_configured` use `Linking.openURL(whatsappUrl)` (prefers the WhatsApp app); also offer "Send from my own WhatsApp" (opens `whatsappUrl`) as an explicit choice, noting that goes through `POST /proposals/:id/send` first so the proposal is frozen and logged.
**Verdict**: **INCLUDE**.

## 13. Public proposal page (customer's link)

- `GET /public/proposals/:token` -> `PublicProposalDto` (no auth; drafts 404; does **not** record a view; includes expiry flag and company block; sales-person **name** only). `POST /public/proposals/:token/seen` (optional auth; first view writes timeline `PROPOSAL_SEEN` and fires `proposal.seen` notification; ignored for bots and any authenticated non-CUSTOMER user; always safe to repeat).
- The page is `/p/<token>` on the web (`ProposalLinks.publicUrl`), rendered by the web app with a print stylesheet; "Download PDF" is the browser's Save-as-PDF (no server PDF).
- **Mobile**: for staff, open in in-app browser / Share. **CUSTOMER role**: could view via the same link (WebView) but there is no authenticated "my proposals" endpoint (gap G8); the customer app shell is Project/Documents/Complaints (docs/05-design/layout-and-navigation.md).
- **Verdict**: **EXCLUDE** as a native screen (WebView/share link only); customer in-app proposal list = **LATER**.

## 14. Excluded or deferred from this area

| Item | Reason | Verdict |
|---|---|---|
| Proposal template gallery/editor (`/proposals/templates`, `/proposal-templates` writes, `template-*.tsx`) | decision | EXCLUDE |
| Lead CSV import (`import-dialog.tsx`, `POST /leads/import`) | decision, Admin/Office web task | EXCLUDE |
| Customer CSV import (`POST /customers/import`) | decision | EXCLUDE |
| Lead board (kanban drag-drop) | desktop pattern | LATER (use status filter chips instead) |
| Call stats dashboard (`GET /leads/call-stats`) | Admin only; dashboard area | LATER (belongs to dashboard doc) |
| WYSIWYG proposal preview | renderer is web-only React | LATER |
| Proposal customer view in app | no endpoint | LATER |

## 15. API gaps and web-only assumptions the phone will hit

- **G1 No bulk call upload.** Only `POST /leads/:id/calls` per call. After a day offline the phone sends N requests (fine, idempotent), but there is no batch endpoint and no server-side check that the uploaded number matches the lead. Matching is purely client-side.
- **G2 No lead-scoped upload ticket.** `VisitDto.photoUrl` requires a URL; signed uploads exist only at `/projects/:id/uploads/sign` and docs routes. A visit photo has no clean path. Needs `POST /leads/:id/uploads/sign` (or accept `publicId` like posts do) - API change.
- **G3 No "assigned phone numbers" feed.** To match the call log, the app must page `GET /leads?assignedTo=me&pageSize=100`; there is no `updatedSince` filter or lightweight `[{id, phone, altPhone}]` endpoint, so a sync is a full re-list. `altPhone` calls cannot be matched except by sending it too (it is in `LeadDto`).
- **G4 Visits are not idempotent.** `POST /leads/:id/visits` has no dedupe key; offline retries can duplicate. Ask for dedupe on (lead,user,at) like calls.
- **G5 Visit requires lat/lng.** No permission-denied fallback; no accuracy field; no address.
- **G6 No draft preview URL.** Drafts 404 publicly, and the document renderer is web-only React. A mobile draft preview has no server-rendered target.
- **G7 Customers sort is per page.** The "customers with projects first" ordering is applied after pagination, so infinite scroll can show out-of-order rows. Search covers name/phone/city only.
- **G8 No customer-facing proposals endpoint.** `/proposals` is `ADMIN,SALES` only; CUSTOMER can only use the public token link.
- **G9 OFFICE gets nothing for calls/visits/proposals** by design; the phone must hide those tabs for OFFICE (and not call endpoints that return 403).
- **G10 Lead -> status VISIT is manual** after a visit check-in (not automatic).
- **G11 `GET /leads/call-stats` is Admin only**; Sales cannot see their own daily calls/talk time from the API (their own calls list per lead is available, but no "my stats" endpoint).
- **G12 Web-only client assumptions**: `crypto.randomUUID()` and `navigator.clipboard` in `send-flow.tsx`; URL-synced filter state; React Query keys; CSV parsing in browser; `window`-based drag and drop; `target=_blank` links. All have RN equivalents but are not shared code. `packages/contracts` (zod DTOs) is shared and reusable as-is; `apps/web/lib/leads.ts` helpers (labels, `formatPhone`, `whatsappUrl`, `telUrl`, `leadPermissions`) are pure TS and worth extracting to a shared package.
- **G13 No push for lead/proposal events yet in mobile**: server emits `lead.assigned` and `proposal.seen` to the in-app notification module; device push registration is covered by the notifications area, not verified here (UNVERIFIED).

## 16. Verdict summary

| Feature | Verdict | One line |
|---|---|---|
| Leads list | ADAPT | Core Sales screen; cards + status chips + stuck filter replace table/board. |
| Lead board (kanban) | LATER | Drag-drop is a desktop pattern; status filter chips cover it. |
| Add lead | INCLUDE | Fast capture in the field, contact-picker autofill. |
| Lead detail | ADAPT | Single scroll with sticky Call/WhatsApp/Status bar. |
| Edit lead / Change status | INCLUDE | Small forms; same rules (LOST reason, WON lock). |
| Assign lead | ADAPT | Admin only; bottom-sheet picker. |
| Call logging | INCLUDE | The reason Sales uses the phone app; Android call-log + manual fallback. |
| Visit check-in | INCLUDE | GPS + note + photo; needs upload and idempotency API work. |
| Customers list / detail | ADAPT | Lookup + quick contact + timeline. |
| Add customer | INCLUDE | Simple 3-field form (contact picker). |
| Start new project | INCLUDE | One confirm + endpoint; the customer's lead goes back to NEW. |
| Proposals list | ADAPT | Cards with seen status. |
| Proposal builder | ADAPT | Form wizard; no WYSIWYG renderer (LATER). |
| Proposal detail + duplicate | INCLUDE | Seen tracking, resend, duplicate-to-edit. |
| WhatsApp send flow | INCLUDE | Idempotent `requestId`, `not_configured` fallback, share sheet. |
| Public proposal page | EXCLUDE | Web page opened in browser/WebView; customer-in-app list LATER. |
| Template gallery/editor, CSV imports | EXCLUDE | Per product decision. |
