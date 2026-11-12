# Mobile — Leads and Calls

What the phone shows and does for leads: the Sales "Today" agenda, the lead list, lead detail with its timeline, status changes, assigning (Admin), adding a lead, and logging calls. The server is the authority: every rule below comes from the API code, and the phone only decides how to present it. Companion to [`visits.md`](visits.md), [`customers.md`](customers.md) and [`proposals.md`](proposals.md). Research behind this doc: [`../research/inventory-leads-customers-proposals.md`](../research/inventory-leads-customers-proposals.md) (sections 1-6), [`../research/research-ux-patterns.md`](../research/research-ux-patterns.md) (1.3, 1.7), [`../research/research-native-and-policy.md`](../research/research-native-and-policy.md) (3.1, the call-log decision), [`../research/inventory-foundations.md`](../research/inventory-foundations.md) (roles, envelope, errors). Plan date 2026-11-12.

**Status key:** ✅ API exists today (verified in code 2026-11-12). 📱 the phone has to build it. ⚠ GAP: needs server work before the phone can do it properly.
**Phone app, 2026-11-12:** nothing built yet. This is the design the screens are built from.

**Source abbreviations** (paths from the repo root): **R-L** `apps/api/src/modules/leads/interface/leads.route.ts`; **LA** `apps/api/src/modules/leads/application/services/leadAccess.ts`; **UC-status** `.../leads/application/usecases/changeLeadStatus.usecase.ts`; **UC-calls** `.../usecases/calls.usecase.ts`; **UC-list** `.../usecases/listLeads.usecase.ts`; **UC-update** `.../usecases/updateLead.usecase.ts`; **UC-create** `.../usecases/createLead.usecase.ts`; **UC-assign** `.../usecases/assignLead.usecase.ts`; **C-leads** `packages/contracts/src/leads.ts`; **W-leads** `apps/web/lib/leads.ts`; **W-act** `apps/web/lib/lead-activity.ts`; **SCOPE** `apps/api/src/shared/access/scope.ts`.

## Roles

| Role | Sees | Can do on the phone |
|---|---|---|
| **SALES** | **Only leads assigned to them** (`scopeFor(SALES,'leads') = assigned`, SCOPE; `LeadAccess.load`, LA:22). Gets the **Today** home. | Add lead (auto-assigned to self, UC-create:35), edit, change status (not if WON), call + outcome, log a call, check in a visit, view proposals of the lead. Cannot assign. |
| **ADMIN** | **All leads.** Home is the dashboard (another doc); Leads is a tab. | Everything Sales can on any lead, plus **assign / unassign**, move a WON lead out of WON, filter by assignee. |
| **OFFICE** | **All leads, read-only plus add.** (`sees all`, SCOPE.) | List, detail (Timeline and Details only), quick **add lead** (created unassigned), Call and WhatsApp buttons (plain `tel:` / `wa.me`). **No** edit, status, assign, Calls tab, Visits tab, Proposals tab, outcome sheet (R-L:226-257 gate those routes to ADMIN/SALES). |
| HR, DESIGNER, TECHNICIAN, CUSTOMER | Nothing. The Leads tab is not shown; the API answers `403`. | None. |

## 1. The rules

| # | Rule | Status |
|---|---|---|
| 1 | **Scope.** Sales only ever gets their own leads. `GET /leads?assignedTo=<anything>` is silently overridden to "me" for Sales (UC-list:19-22), so the phone never needs to send `assignedTo` for Sales. Admin and Office may pass `me`, `unassigned` or a user id; only Admin gets the assignee filter in the UI (W-leads `leadPermissions`: "cosmetic, the API is the real gate"). | ✅ |
| 2 | **A lead outside your scope is `404`, not `403`** (LA:12-24: "so ids of other people's leads cannot be probed"). On `404` for a lead id the phone already knows, treat it as "no longer yours" (it was reassigned): drop it from the local cache and any queued writes for it, show "This lead is no longer yours." | ✅ |
| 3 | **Statuses:** `NEW`, `CONTACTED`, `VISIT`, `PROPOSAL_SENT`, `FOLLOW_UP`, `WON`, `LOST`; labels New, Contacted, Visit, Proposal sent, Follow-up, Won, Lost (C-leads:25-34, W-leads `STATUS_LABEL`). **Any status may move to any other**: it is not a strict funnel (UC-status:13). Every change is logged on the timeline and resets `statusChangedAt`. | ✅ |
| 4 | **Changing to the same status is refused**: `400` "This lead is already X." (UC-status:37). The phone disables the current status in the picker, so this only shows after a race. | ✅ |
| 5 | **LOST needs a reason**: `lostReason` 1-500 characters, else `400` on `lostReason` "Give a reason when marking a lead as lost" (C-leads `changeLeadStatusBodySchema` refine). The reason is cleared when the lead leaves LOST (UC-status:45). | ✅ |
| 6 | **WON is final for Sales.** A Sales user cannot move a WON lead: `403` "This lead is won. Ask an admin if its status needs to change." (UC-status:34-36). The phone shows the Change status button disabled with the hint "Won leads are locked" (web does the same, `lead-detail.tsx`) and hides Edit. To work with a won customer again, Sales uses **Start new project** ([`customers.md`](customers.md) rule 7), which puts the lead back to New. Only Admin may move a WON lead to another status, and the project is **not** deleted when they do. | ✅ |
| 7 | **The customer is created on WON.** Moving to WON with no `customerId` finds-or-creates the CUSTOMER account for the lead's phone, stores `customerId` on the lead and emits `lead.won`, which creates the project (UC-status:50-57, 77-86). A later WON creates another project only if the lead was started again (`newProjectRequested`). The phone asks for a **confirmation** before WON (copy in section 2.5) and, on success, shows the customer chip on the lead. | ✅ |
| 8 | **Automatic status moves the phone must expect:** (a) the **first recorded call on a NEW lead moves it to CONTACTED** (timeline row has `auto: true`, UC-calls:63-72); (b) **sending a proposal moves the lead to PROPOSAL_SENT** unless it is WON or LOST, and resets `statusChangedAt` (`proposalHooks.usecase.ts`:31-58). **Visits do NOT move a lead to VISIT** (`visits.usecase.ts` only writes a VISIT activity): see [`visits.md`](visits.md) rule 8. After a call or a send the phone must refetch the lead; it must not guess the new status. | ✅ |
| 9 | **Stuck:** `isStuck` = not WON/LOST and `statusChangedAt` older than `LEAD_STUCK_DAYS` (default 2; `env.ts`:95). The phone only reads the boolean. Stuck leads get a clock icon and the **Stuck** filter chip. | ✅ |
| 10 | **Add lead:** `POST /leads`, allowed for ADMIN, SALES and OFFICE (R-L:204-209). Required: `name` (1-120), `phone`, `source`. Optional: `altPhone`, `email`, `city` (1-500), `notes` (1-2000). Source has **no default**; the user must choose one (web `add-lead-sheet.tsx`). A Sales-created lead is assigned to its creator; an Admin or Office-created lead is **unassigned** until an Admin assigns it (UC-create:35). | ✅ |
| 11 | **One lead per phone number.** A duplicate answers `409` with `data.existingLeadId` (UC-create:18). The phone shows "A lead with this phone number already exists." with **Open existing lead**. For Sales the existing lead may belong to a colleague: opening it returns `404` (rule 2). Then say "This number is already a lead with someone else. Ask your admin." | ✅ |
| 12 | **Phone numbers** are sent in any common format (`+91 98765 43210`, `098765...`, 12-digit `91...`) and stored as 10 digits (`phoneSchema`, `identity.ts:7`). The phone validates with the contracts schema and shows `+91` as a fixed prefix, never typed (foundations 3.6). `tel:` is built as `tel:+91XXXXXXXXXX` and WhatsApp as `https://wa.me/91XXXXXXXXXX` (W-leads `telUrl`, `whatsappUrl`). | ✅ |
| 13 | **Edit:** `PATCH /leads/:id` for ADMIN and SALES (own lead), partial body, send `null` to clear an optional field, empty body is `400` "Nothing to update". On a **WON** lead the **phone number cannot change**: `403` "A won lead's phone number cannot be changed here: the customer signs in with it." (UC-update:19-24). Changing to a number that belongs to another lead is `409` with `data.existingLeadId` (UC-update:27-31). The web hides Edit for WON leads; the phone does the same. | ✅ |
| 14 | **Assign:** `POST /leads/:id/assign` body `{ userId }` or `{ userId: null }` to unassign, **Admin only**. The user must be an **active SALES** user, else `400` "Leads can only be assigned to a sales person." (UC-assign:28). The new assignee is notified (`lead.assigned`, in-app notification). The picker reads `GET /identity/users?role=SALES&active=true&pageSize=100` (Admin/HR route, fine because only Admin sees the picker). | ✅ |
| 15 | **Calls are recorded by the phone, one request per call:** `POST /leads/:id/calls` (ADMIN, SALES; R-L:244). **`201` when new, `200` when that exact call was already recorded**: it is idempotent on lead + user + `startedAt` (controller comment at `leads.controller.ts:109`, UC-calls:45), so retrying after a network failure is safe **as long as the same `startedAt` is sent**. Treat `200` and `201` both as success. | ✅ |
| 16 | **`startedAt` must not be more than 5 minutes in the future** (`CLOCK_SKEW_MS`, UC-calls:12, 39): `400` on `startedAt` "The call start time is in the future." `durationSec` is 0-14400 integer; `answered` boolean required; `outcome` optional from `INTERESTED`, `CALL_BACK`, `NOT_INTERESTED`, `NO_ANSWER`, `WRONG_NUMBER`; `note` 1-1000 characters (C-leads:150-157). | ✅ |
| 17 | **Decision (2026-11-12): the phone does NOT read the call log.** It never requests `READ_CALL_LOG` or `READ_PHONE_STATE`. A CRM is not a permitted use under Google Play's SMS and Call Log policy for a non-default dialer, so the feature would risk rejection or removal of the app (research-native-and-policy 1 and 3.1, accessed 2026-11-12). The `ADR-0005` design (read the log, match numbers) is superseded for the Play build. Calls are logged by **tapping Call** (the phone opens the dialer through a `tel:` link) and then answering a **post-call outcome sheet**. Durations and answered/not answered are **self-reported**; the server cannot tell them from a log read (rule 20). | 📱 |
| 18 | **How a call is recorded (the whole flow):** (1) The user taps **Call**. The phone writes a local *pending call* `{ localId, leadId, startedAt = now (ISO), phone }` **before** opening the dialer. (2) It opens `tel:+91XXXXXXXXXX` with `Linking.openURL`. (3) When the app returns to the foreground (`AppState` becomes `active`) and a pending call from the last 30 minutes exists, it shows the **outcome sheet** (section 2.6). (4) On Save it posts `POST /leads/:id/calls` with the pending call's own `startedAt`, **the same value on every retry**, then clears the pending call. The pending call survives an app kill. | 📱 |
| 19 | **Unanswered sheets are never lost.** If the user closes the sheet without saving, or never returns to the app in time, the pending call stays and appears on Today as "Log your last call" (and as a banner on the lead). A pending call older than 24 hours is dropped locally and nothing is sent ("Skip" and the 24 h expiry record nothing). **The phone never posts a call the user did not confirm.** | 📱 |
| 20 | **Duration is estimated, then confirmed.** The phone measures how long the app was in the background after the Call tap and pre-selects the nearest duration chip (section 2.6). The user can change it. For not-answered calls send `durationSec: 0`. The server has no field saying "estimated" (⚠ gap L3), so it treats the value as fact; the UI must label the control "About how long?" so people do not agonise over seconds. | 📱 |
| 21 | **Mapping the sheet to the API.** "Spoke" sends `answered: true` and an `outcome` of `INTERESTED`, `CALL_BACK` or `NOT_INTERESTED`. "No answer" sends `answered: false`, `outcome: NO_ANSWER`, `durationSec: 0`. "Wrong number" sends `answered: false`, `outcome: WRONG_NUMBER`, `durationSec: 0`. There is no "Busy" in the API: busy maps to "No answer". | 📱 |
| 22 | **Call also changes status only if the user asks.** After a saved call the sheet's optional "Also move to" row sends a separate `POST /leads/:id/status`. Lost still needs its reason. A status move is never bundled into the call request. The server's own NEW to CONTACTED move (rule 8) happens regardless and the phone shows "Moved to Contacted" when the refetched lead says so. | 📱 |
| 23 | **A call can be logged without tapping Call** (the customer rang in, or the rep used another phone). The lead's Calls tab has **Log a call**: same sheet, time defaults to now with a time picker that cannot go into the future (rule 16). The sheet is the same, so it posts the same request. | 📱 |
| 24 | **Office cannot log calls.** Office still sees Call and WhatsApp buttons (they are plain links), but no pending call is created and no sheet appears (the endpoint is `403` for Office). | ✅ |
| 25 | **Today agenda (Sales home) uses only data the API has.** There is **no follow-up date or next-action field** on a lead, and no scheduled-visit data, so "follow-ups due today" cannot be computed (⚠ gap L1). The agenda is built from: pending calls (local), New leads, Stuck leads, Follow-up status leads, and sent proposals not yet seen or just seen (`GET /proposals?status=SENT`, `firstSeenAt`, `lastSeenAt`). See section 2.1. | ✅ for data, ⚠ L1 for dates |
| 26 | **Pagination:** `page`/`pageSize` (`pageSize` max 100, default 20); response `{ items, total, page, pageSize, totalPages }`. The phone uses infinite scroll, stops at `page >= totalPages`, and de-duplicates by `id` (new rows shift pages; foundations 3.3). The server sorts the list by `createdAt` descending; there is **no sort parameter** (`mongoLead.adapter.ts`:122). | ✅ |
| 27 | **Grouping by status is done with chips, not section headers.** A paged list sorted by creation date cannot be grouped by status without loading everything. The list screen shows a horizontal status chip row (All, New, Contacted, Visit, Proposal sent, Follow-up, Won, Lost) and each chip sends `status=`. Won and Lost are at the end and not preselected. | 📱 |
| 28 | **Chip counts** need one request per status: `GET /leads?status=X&pageSize=1` and read `total`. The phone fetches the six open-status counts in parallel when the Leads tab gains focus, shows them as "New 4" and falls back to no number if a request fails. There is no counts endpoint (⚠ gap L2). | 📱 |
| 29 | **Optimistic UI only for a status move** (foundations 3.2 and design-system section 5): the card updates at once with a snackbar "Priya Shah moved to Follow-up" and rolls back with a toast if the call fails. WON and LOST moves are **not** optimistic (they open a sheet and wait for the server). Everything else waits for the server. | 📱 |
| 30 | **Timeline** is `GET /leads/:id/timeline` (ADMIN, SALES, OFFICE; R-L:225), newest first, items `{ id, type, at, by, data }` where `data` is a loose record per type. Activity types: `CREATED`, `ASSIGNED`, `STATUS_CHANGED`, `CALL`, `VISIT`, `PROPOSAL_SENT`, `PROPOSAL_SEEN`, `PROJECT_CREATED`, `PROJECT_CLOSED`. The phone ports `describeActivity` (W-act) so the wording matches the web: read `data` defensively, never crash on a missing key. | ✅ |
| 31 | **Dates and money in IST.** Instants are ISO strings; the phone formats `12 Nov 2026`, `3:40 PM`, relative ages ("5 min ago", "3 h ago", "2 days ago" under 14 days), durations `45 s`, `7 min`, `1 h 20 min`, always in `Asia/Kolkata` whatever the device zone (foundations 3.4). "Today" is the business date, never the device's. | 📱 |
| 32 | **No push yet.** The server writes in-app notifications for `lead.assigned` (and `proposal.seen`) but device push registration does not exist (foundations section 8, item 1). Until it does, the Leads tab and Today refetch on screen focus, on `AppState` active and on pull-to-refresh. | ⚠ |

## 2. What the phone shows

Navigation: bottom tabs by role (research-ux-patterns 1.2): **SALES** Today, Leads, Projects, Alerts, More. **ADMIN** Glance, Projects, Leads, Inbox, More. **OFFICE** Today (a short list of leads to enter), Leads (quick-add button), Customers, Alerts, More. Routes below are expo-router file paths under `src/app/`.

### 2.1 Today (Sales home) — route `(tabs)/index`

Layout, top to bottom, each block hidden when empty:

1. The attendance check-in card (owned by the attendance doc; it sits above everything).
2. **Log your last call** — one row per pending call (rule 19): lead name, "You tapped Call 12 min ago", button **Log it**.
3. **New — call these first** — `GET /leads?status=NEW&pageSize=5`. Header shows `total`.
4. **Stuck — no movement for a while** — `GET /leads?stuck=true&pageSize=5`.
5. **Follow-up** — `GET /leads?status=FOLLOW_UP&pageSize=5`.
6. **Proposals** — `GET /proposals?status=SENT&pageSize=20`; two groups: "Just opened" (`lastSeenAt` within 24 h; the customer is looking now, call them) and "Not opened yet" (`firstSeenAt` null, oldest `sentAt` first). Tapping opens the proposal ([`proposals.md`](proposals.md)).

```
+---------------------------------+
| Today              Thu 12 Nov   |
| [ Attendance: Check in ]        |
|---------------------------------|
| LOG YOUR LAST CALL              |
| Priya Shah        [ Log it ]    |
|   You tapped Call 12 min ago    |
|---------------------------------|
| NEW - CALL THESE FIRST  (4)     |
| Rohan Mehta   Pune    [C] [WA]  |
| Anita Rao     Thane   [C] [WA]  |
|                    See all >    |
| STUCK (2)                       |
| Kiran Patil  Proposal sent  (!) |
| PROPOSALS                       |
| VK-2026-0042 Just opened  (eye) |
+---------------------------------+
```

Each lead row: name, phone (`98765 43210`), city, status chip, stuck clock icon, and two 48 dp buttons **Call** and **WhatsApp**. Pull to refresh; refetch on focus. Empty (everything hidden): "You're all caught up. New leads and follow-ups will show here." Loading: skeleton blocks. Error: per-block "Couldn't load. Retry" so one failure does not blank the screen. Offline: cached blocks with a banner "You're offline. Showing what was loaded at 3:40 PM." Not shown to Admin or Office (Admin has the dashboard; Office home is its own short list).

### 2.2 Leads list — route `(tabs)/leads/index`

Top bar: title "Leads", search icon, filter icon, **+** (add lead). Under it a search field when open ("Search by name, phone or city", debounced 300 ms, `search=`; trimmed, empty is not sent), then the status chip row (rule 27, 28) and a **Stuck** chip (`stuck=true`). Filter sheet: Source (the eight sources; labels Website, Facebook, Instagram, Justdial, Walk-in, Referral, Existing customer, Other), and for Admin only **Assigned to** (Anyone, Me, Unassigned, or a sales person). Sales never sees the assignee control (rule 1).

```
+---------------------------------+
| Leads            [s] [filter] [+]|
| (All)(New 4)(Contacted 7)(Visit)>|
| (Stuck)                         |
|---------------------------------|
| Rohan Mehta            (!)      |
|  98765 43210 . Pune . Walk-in   |
|  [New]  3 days ago   [C]  [WA]  |
|---------------------------------|
| Anita Rao                       |
|  ...                            |
+---------------------------------+
```

Row: name, formatted phone, city, source label, status chip (tones from foundations 4.2), stuck icon, age of `statusChangedAt`, assignee name (Admin and Office only), Call and WhatsApp buttons. Swipe right = Call, swipe left = WhatsApp, **with the visible buttons always present** (discoverability and accessibility). Row tap opens detail. Long-press opens a menu: Change status (Admin/Sales, not WON), Assign (Admin). Empty: "No leads yet" with **Add lead** (everyone who can add) or, when a filter or search is active, "No leads match these filters" with **Clear filters**. Error: "Couldn't load leads" with **Retry**; if cached rows exist show them with a banner. Offline: cached "my leads" list with an "Offline" banner; filters and search work on the cache only for text and status; the stuck filter is hidden offline.

### 2.3 Lead detail — route `leads/[id]`

Header: back arrow, name, status chip, "Stuck: no movement for a while" (warning, clock icon) when `isStuck`, formatted phone, customer chip "Customer" when `customerId` is set. **Sticky bottom action bar** (always visible, 56 dp): **Call**, **WhatsApp**, **Map**, **Status**, **More**.

- **Call**: rule 18. **WhatsApp**: `https://wa.me/91XXXXXXXXXX` (opens the WhatsApp app; no message text for a lead).
- **Map**: a lead has **no street address**, only `city` (⚠ gap L6). Map opens the maps app on the best text the phone has: the `siteAddress` of the newest proposal if there is one, else the city (`geo:0,0?q=<text>`). Disabled with "No address yet" when neither exists. For an exact place use the visit's own coordinates (visits tab).
- **Status** (Admin, Sales; disabled and labelled "Locked" for Sales on a WON lead, rule 6; absent for Office).
- **More**: Edit (Admin, Sales, not WON), Assign (Admin), **Check in visit** ([`visits.md`](visits.md); Admin, Sales), **Log a call** (Admin, Sales), Share lead (shares name and phone as text).

Below the header, a segmented control: **Timeline**, **Calls**, **Visits**, **Proposals**, **Details**. Office sees only Timeline and Details (R-L:226-257, `seesLogs` in `lead-detail.tsx`). Each tab loads only when first opened.

```
+---------------------------------+
| <  Rohan Mehta        [Contacted]|
|    98765 43210   (!) Stuck      |
| (Timeline)(Calls)(Visits)(Prop)(Details)
|---------------------------------|
| Call answered (4 min)           |
|   By You . Interested   2h ago  |
| Contacted                       |
|   New -> Contacted . auto       |
| Lead added by Neha . Source: Walk-in
|---------------------------------|
|[Call][WhatsApp][Map][Status][...]|
+---------------------------------+
```

**Timeline tab** — `GET /leads/:id/timeline`. Titles (from W-act): "Lead added by Neha" with detail "Source: Walk-in"; "Assigned to Rohan" or "Unassigned" with "By Neha"; "New → Contacted" (labels, with "By X", "Reason: ...", note); "Call answered (4 min)" or "Call not answered" with "By X · Interested"; "Site visit" with "By X · note"; "Proposal VK-2026-0042 sent"; "Customer opened proposal VK-2026-0042"; "Project created: <name>"; "Project closed: <name>". Newest first, relative time on the right. Empty: "Nothing here yet." Error: **Retry**.

**Calls tab** — `GET /leads/:id/calls`: row = time, "Answered · 4 min" or "Not answered", outcome label (Interested, Call back, Not interested, No answer, Wrong number), note, who. Header button **Log a call**. Empty: "No calls logged yet. Tap Call to start." (the web's empty text "Calls are logged automatically by the phone app." is wrong now that the phone does not read the call log: ⚠ gap L5.)

**Visits tab** — `GET /leads/:id/visits`: see [`visits.md`](visits.md) section 2.

**Proposals tab** — `GET /proposals?leadId=:id`: cards as in [`proposals.md`](proposals.md). Empty: "No proposals yet. Proposals are created on the web for now."

**Details tab** — Phone, Alternate phone, Email, City, Notes (all from `LeadDto`), then Source, Assigned to (or "Unassigned"), Status changed (relative), Created, and for a Lost lead "Lost reason". For a WON lead: "Customer account created. Won leads are locked." and a row **Open customer** (`customers/[customerId]`; Admin, Sales and Office; see [`customers.md`](customers.md)).

States: loading skeleton; error with **Retry**; `404` shows "This lead is no longer yours." with **Back to leads** (rule 2). Offline: header, Details and last timeline from cache; action bar shows Call and WhatsApp (they do not need data) and disables Status, Edit, Assign with "Needs a connection".

### 2.4 Add lead — route `leads/new` (full-screen modal)

Quick form, phone keyboard on the phone field. Title "Add lead", subtitle "One lead per phone number." Fields in order: **Name \*** (max 120), **Phone \*** (fixed "+91" prefix, `phone-pad`, 10 digits; accepts a pasted `+91 98765 43210` and normalises), **Source \*** (chips with Walk-in first; none preselected; helper "Where did this lead come from?"), then a collapsed **More details**: Alternate phone, Email, City, Notes (max 2000). Primary **Add lead** ("Adding…" while sending). Field errors under the field: "Enter a name.", "Choose a source.", "Enter a 10-digit mobile number.", "Enter a valid email address." (web `add-lead-sheet.tsx`:209-212). On success: toast "Lead added", then open the new lead's detail. A Sales user is the assignee; for Admin and Office add "Unassigned. An admin will assign it." under the button. A duplicate shows the state in rule 11 with **Open existing lead**.
No contacts permission is requested (research-native-and-policy 1 row 7). The user can paste a number copied from anywhere. Whether to offer the system contact picker is an open question (section 7).

### 2.5 Status sheet — bottom sheet from **Status**

Title "Change status", subtitle the lead name. A radio list of the seven statuses with 48 dp rows; the current one is checked, disabled and labelled "Current". Fields: **Note (optional)** (max 1000). Choosing **Lost** reveals **Why was this lost?** (required, max 500, placeholder "e.g. Went with another vendor"); Save stays disabled until filled. Choosing **Won** reveals the explainer "Marking this lead as won creates the customer account and, if enabled in settings, the project. A won lead is then locked." (for Admin on a WON lead moving away: "The project is not deleted."), and the button reads **Mark as won**; this is the confirmation. Other statuses: button **Save**. Success: snackbar "Rohan Mehta moved to Won", sheet closes, lead refetches. Errors in the sheet use the server message (section 4). Won leads for Sales: the Status button is disabled, no sheet.

### 2.6 Post-call outcome sheet — bottom sheet, modal route `leads/[id]/call-outcome`

Opens by itself when the app returns after a Call tap (rule 18), or from **Log it** / **Log a call**. Not dismissible by accident: swipe down keeps the pending call (rule 19).

```
+---------------------------------+
| How did the call with           |
| Priya Shah go?                  |
| (Spoke) (No answer) (Wrong no.) |
|                                 |
| About how long?                 |
| (<1 min)(1-3)(3-10)(10+)        |
| What happened?                  |
| (Interested)(Call back)(Not int.)|
| Note (optional)  ____________   |
| Also move to: (Follow-up)(Visit)(Lost)
| [          Save call          ] |
| [ Not now ]                     |
+---------------------------------+
```

Step 1 chips: **Spoke**, **No answer**, **Wrong number** (rule 21). "Spoke" reveals "About how long?" (Under 1 min = 30 s, 1-3 min = 120 s, 3-10 min = 360 s, 10+ min = 900 s; the nearest chip to the estimate is preselected; custom minutes available through "Other") and "What happened?" (Interested, Call back, Not interested; required when Spoke). **Note** optional, max 1000 characters. **Also move to** is optional and offers only statuses other than the current one; Lost then needs a reason (same field as 2.5). Primary **Save call**, secondary **Not now** (keeps the pending call). Saving shows "Call logged" and, if the lead moved from New, "Moved to Contacted". If the user has no connection, saving says "Saved. Will send when you're back online." and the call goes to the offline queue (section 5).

## 3. Endpoints

All under `/api`, bearer token, `{ success, data }` envelope (foundations 3.1).

| Method and path | Purpose | Request / response DTO (`@vastu/contracts`) | Notes |
|---|---|---|---|
| `GET /leads` | List, search, filter | query `ListLeadsQueryDto` (`page`, `pageSize`, `search`, `status`, `source`, `assignedTo`, `stuck`) → `PaginatedDto<LeadDto>` | ADMIN, SALES, OFFICE. Sales scoped to own (rule 1). Newest created first. |
| `POST /leads` | Add lead | `CreateLeadBodyDto` → `201 LeadDto` | `409` with `data.existingLeadId` (rule 11). |
| `GET /leads/:id` | One lead | `LeadDto` | `404` when out of scope. |
| `PATCH /leads/:id` | Edit | `UpdateLeadBodyDto` → `LeadDto` | ADMIN, SALES. `403` phone change on WON; `409` phone clash. |
| `POST /leads/:id/status` | Change status | `ChangeLeadStatusBodyDto { status, note?, lostReason? }` → `LeadDto` | ADMIN, SALES. `403` WON for Sales; `400` same status or missing reason. |
| `POST /leads/:id/assign` | Assign | `AssignLeadBodyDto { userId \| null }` → `LeadDto` | ADMIN only. |
| `GET /leads/:id/timeline` | Timeline | `LeadActivityDto[]` | ADMIN, SALES, OFFICE. Newest first. |
| `POST /leads/:id/calls` | Record a call | `RecordCallBodyDto { startedAt, durationSec, answered, outcome?, note? }` → `CallDto` | ADMIN, SALES. `201` new, `200` already recorded. Reuse the same `startedAt` on retry. |
| `GET /leads/:id/calls` | Call history | `CallDto[]` | ADMIN, SALES. Newest first. |
| `GET /proposals?leadId=` | Proposals tab and Today block | `PaginatedDto<ProposalDto>` | See [`proposals.md`](proposals.md). |
| `GET /identity/users?role=SALES&active=true&pageSize=100` | Assign picker | users page | Admin/HR route; used by Admin only. |
| `GET /leads/call-stats`, `POST /leads/import` | Not used on the phone | — | Call stats are Admin dashboard (other doc); CSV import is excluded. |

## 4. Errors

| HTTP / code | What the phone says |
|---|---|
| `400 VALIDATION_FAILED` (`data` = zod issues with `path`) | Map `path` to the field and show the server message under it. Unmapped issues go to a banner above the button: "Some of the details provided are not valid." |
| `400` same status | "This lead is already Contacted." (server message as is; refetch the lead). |
| `400` on `startedAt` "The call start time is in the future." | "Your phone's clock looks ahead. Check Date and time, then save again." The pending call is kept. |
| `400` "Leads can only be assigned to a sales person." | Show as is in the assign sheet. |
| `401 UNAUTHENTICATED` | Single-flight refresh and one retry, then sign out (foundations 9). |
| `403 FORBIDDEN` WON-locked | "This lead is won. Ask an admin if its status needs to change." |
| `403 FORBIDDEN` WON phone change | "A won lead's phone number cannot be changed here: the customer signs in with it." |
| `403 FORBIDDEN` other | Toast "You can't do that." (the UI should have hidden the control). |
| `404 NOT_FOUND` on a lead | "This lead is no longer yours." Drop it and its queued writes locally. |
| `409 CONFLICT` with `data.existingLeadId` | "A lead with this phone number already exists." with **Open existing lead** (rule 11). |
| `429 RATE_LIMITED` | "Too many tries. Wait a minute." No automatic retry. |
| `500`, `503`, network (status 0) | "Something went wrong. Please try again." For queued writes the item stays queued and retries with backoff (section 5). |

## 5. Offline behaviour

| Action | Offline |
|---|---|
| Read list, detail, timeline, calls | From the cache of "my leads" (all pages the user opened plus the first page of each status chip). Banner "You're offline. Showing what was loaded at 3:40 PM." Never keep a lead after a `404` or after a refresh no longer lists it. |
| Tap Call, Map, WhatsApp | Work (they do not need the server). Tapping Call still creates the pending call. |
| **Save call (outcome sheet)** | **Queued.** Idempotent on lead + user + `startedAt`, so retry is safe (rule 15). The queue keeps the same `startedAt`. Order of sending: oldest first. `404` drops the item with a note; `400` future time stops it and asks the user to fix the clock. |
| **Add lead** | **Queued** with a local card marked "Waiting to send". A retry after an unknown outcome is safe: the phone number is unique, so a second `POST` returns `409` with `existingLeadId`; when the queued lead's name and phone match that lead, treat it as sent and drop the queue item. Duplicate detection while offline is not possible: the user sees the `409` result later. |
| Change status, Edit, Assign | **Online only.** Buttons stay enabled but say "Needs a connection" on tap. (Optimistic status moves exist only while online, rule 29.) |
| Today | Last loaded blocks plus pending calls (which are local and always correct). |

Queue state per item (WhatsApp model): Waiting, Sending, Sent, Failed with **Tap to retry** and **Discard**. Queue survives app restarts (SQLite, the same outbox engine used elsewhere in the app).

## 6. Acceptance criteria

- [ ] A Sales user's Leads tab returns only their own leads; sending `assignedTo=<colleague>` still returns only their own.
- [ ] Opening a lead id that belongs to someone else shows "This lead is no longer yours." and not a permission error.
- [ ] An Office user sees the list, detail (Timeline and Details only) and Add lead, and sees no Status, Edit, Assign, Calls, Visits, Proposals, outcome sheet or Check in.
- [ ] The status chip row filters the list with `status=`; each open-status chip shows a count; Won and Lost are last.
- [ ] The Stuck chip sends `stuck=true` and the clock icon shows on stuck rows.
- [ ] Marking a lead Lost without a reason is impossible (Save disabled); with one it sends `lostReason`.
- [ ] Marking a lead Won shows the confirmation text; after success the lead shows the Customer chip and the status button is locked for Sales.
- [ ] A Sales user on a WON lead sees Change status disabled ("Won leads are locked") and no Edit.
- [ ] Admin can assign and unassign; the picker lists only active Sales users; the lead then appears in that user's list.
- [ ] Add lead requires name, phone and source; a duplicate phone shows "A lead with this phone number already exists." with a working **Open existing lead**; offline add shows "Waiting to send" and sends once when back online.
- [ ] Tapping Call opens the dialer with `tel:+91…` and, on return, the outcome sheet appears with that lead's name; the app never requests call-log or phone-state permissions (check the manifest).
- [ ] Saving "Spoke / 1-3 min / Interested" sends `answered: true`, `durationSec: 120`, `outcome: INTERESTED`, with `startedAt` equal to the time of the Call tap.
- [ ] Saving the same pending call twice (simulate a timeout) results in one call on the server (second response `200`).
- [ ] After the first call on a NEW lead the lead shows Contacted without any extra tap.
- [ ] Closing the sheet leaves a "Log your last call" row on Today; a pending call older than 24 hours disappears and nothing is posted.
- [ ] Today shows no section for Admin or Office; for Sales empty blocks are hidden.
- [ ] Every list has loading, empty, error and offline states with the copy above.

## 7. Open questions

1. **Follow-up dates (⚠ gap L1).** The API has no `nextFollowUpAt` or reminder on a lead, so Today cannot show "due today". Proposed: add `followUpAt` (date) to `LeadDto`, `POST /leads/:id/status` and `RecordCallBodyDto`, and a `followUpDue=today` filter on `GET /leads`. Until then "Call back" is an outcome with no date, and the note is the only place to write one.
2. **Counts (⚠ gap L2).** Want `GET /leads/counts?...` returning a total per status in one request, instead of six `pageSize=1` calls.
3. **Call source (⚠ gap L3).** Add an optional `source: 'MANUAL' | 'ESTIMATED'` to `RecordCallBodyDto` so reports can tell self-reported durations from measured ones. Admin call stats (`GET /leads/call-stats`) will count self-reported calls.
4. **Own stats for Sales (⚠ gap L4).** `call-stats` is Admin only; Sales cannot see their own calls today. Add a `mine=true` option?
5. **Web empty text (⚠ gap L5).** `lead-detail.tsx`:260 says "Calls are logged automatically by the phone app." That is no longer true under this decision; change the web copy.
6. **No lead address (⚠ gap L6).** A lead only has `city`. Should the lead get an optional address (and, via the first visit, coordinates), so Map is useful before a proposal exists?
7. **Contacts.** The research says not to request Contacts permission (native-and-policy 1, row 7). The earlier inventory suggested contact-picker autofill. Decision needed: paste only, or the system picker if it works without the permission.
8. **Android call-log flavor.** If the business later wants real call evidence, the options are a non-Play internal build with `READ_CALL_LOG` or a cloud-telephony click-to-call service (native-and-policy 3.1). If chosen, the server also needs a bulk upload and a "my assigned numbers" feed (gap from the earlier inventory G1, G3).
9. **Office home.** Office has no agenda defined; the proposal here is a short "Leads to enter" list. Confirm.
10. **Push.** Device push registration does not exist, so a newly assigned lead only appears on refresh (rule 32).
