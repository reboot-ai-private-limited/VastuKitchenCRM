# Screen specs

Wireframes are low-fidelity ASCII; spacing/colour come from [design-system](design-system.md), chrome from [layout-and-navigation](layout-and-navigation.md), **endpoints, roles and traps from [api-map](api-map.md)**. Field names and rules come from the module docs in `02-product/`; if they disagree, the module doc wins. Every screen defines loading / empty / error states (design-system §5). Buttons for guarded actions come from the API (`can{}`), or are hidden by role when the API has no such block; they are never "disabled with no reason".

## 0. Sign in
- **`/login`** (staff): centred card on warm bg: logo, "Sign in", phone (10 digits, +91 shown), password (show/hide), primary "Sign in". Error `401`: "Phone or password is incorrect" (never say which; a deactivated or no-login account looks the same). `429`: "Too many attempts. Please wait a few minutes." **No "Forgot password"**: there is no such API. Help line: "Forgot your password? Ask the owner or HR to reset it."
- **`/invite/[token]`** (customer): no form. On load call `POST /identity/auth/invite/redeem`; success → their project (Client feed); `401` → "This link has expired or was already used. Ask Vaastu Kitchen for a new one." with the company phone number (a public config value, since there is no signed-in user yet).
- **Change password** (user menu → dialog): current, new, confirm; success toast "Password changed. Please sign in again." (it signs out everywhere).

## 1. Dashboard (`/`) — [dashboard](../02-product/dashboard.md), one call: `GET /dashboard?from&to`
```
Dashboard                                  [Today ▾ | 7 days | 30 days | Custom]
┌Open leads┐┌Running proj┐┌Complaints pending┐┌Staff present┐
│    6     ││ 2 (D1 · S1)││        2         ││   3 / 10    │   StatCards link to filtered lists
└──────────┘└────────────┘└──────────────────┘└─────────────┘
┌Pipeline┐ ┌Won in range┐ ┌New leads┐                          value row (₹ short form)
│ ₹90 L  │ │  ₹1.5 Cr   │ │   10    │
┌ Needs attention ─────────────┐┌ Staff activity ─────────────────┐
│ Unseen proposals (1)         ││ Person   In   Out  First  Last   │
│  Mr Bose · sent 3 days ago   ││ Anil    9:05   –   9:12   4:40   │
│ Seen, no action (1)          ││  calls 12 (9) · leads 6 · prop 2 │
│ Stagnant leads (1)           ││ ...                              │
│ Overdue complaints (1)       │└──────────────────────────────────┘
│ Overdue to-dos (1)           │
└──────────────────────────────┘
┌ Recent customer activity ───────────────────────────────────────┐
│ Mrs Rao commented on Rao Kitchen: "Please make the island…" 2h  │
└─────────────────────────────────────────────────────────────────┘
```
- **Range:** presets set `from`/`to` (business dates, max 31 days). The range drives *New leads*, *Won in range*, each person's activity and attendance. *Staff present*, *Pipeline* and *Needs attention* are always "now".
- **Counters:** open leads (sub-line: Won/Lost excluded), running projects (Design · Site), pending complaints (Open + Assigned + Resolved awaiting close), staff present today / tracked (+ "Weekly off" chip on an off day). Each card links to the filtered list.
- **Value row:** pipeline (open leads' latest *sent* proposal), won in range. If `pipelineCapped`, add "(first 2,000 leads)". Money in `formatINRShort` with the full amount on hover.
- **Needs attention:** five blocks, each collapsed to its count and expandable to the oldest 10 (title, detail sentence from the API, age from `since`, row click opens `ref`). "50+" when `capped`. Empty block = "Nothing waiting" with a check icon.
- **Staff activity:** sortable table. Attendance columns (days present, in, out) and activity columns (first/last activity, calls with answered in brackets, talk time, leads handled, proposals made/sent, posts/comments). Click a person → their lead list (Admin) or their attendance month (HR).
- **Recent customer activity:** kind icon (post / comment / approval), customer, project, snippet, photo icon, age; click opens the project at the post.
- **Partial failure:** a `null` block with its name in `errors[]` shows an inline "Couldn't load this. Retry" inside that card only.
- **HR:** same page, only *Staff present* counters and the people table's attendance columns (no money, complaints, alerts or activity). **Mobile:** counters 2×2, blocks stacked, tables → cards.

## 2. Leads (`/leads`) — [leads](../02-product/leads.md)
**Toolbar:** search (name/phone/city) · Status chips · Source · Assignee (Me / Unassigned / person: Admin only) · "Stuck" toggle · view toggle **Table | Board** · `Import CSV` (Admin, Office) · primary `Add lead`.

**Table:** Lead (name + phone), Status badge (+ stuck clock from `isStuck`), Source chip, Assigned to, **Status changed** ("3 d ago", from `statusChangedAt`; the API has no "last activity" field), Created; kebab: Assign (Admin), Change status (Admin, Sales), Call (`tel:`), WhatsApp. Row click → detail sheet.

**Board** *(build second)*: columns New · Contacted · Visit · Proposal Sent · Follow-up · Won · Lost, one `GET /leads?status=` per column, count from `total`, "Load more" per column. Won and Lost collapsed by default. Drag between any stages (any → any is allowed); every drag has a keyboard "Move to…" menu. Drop on **Lost** → dialog "Why was this lost?" (required, `lostReason`). **Won** → confirm "Mark as won? This creates the customer account and the project" (text adapts to `projects.autoCreateOnWon`); Won leads are then locked. Optimistic move with rollback toast.

**Add lead:** sheet: name*, phone* (10 digits; a duplicate returns `409`: inline "Already exists: open lead"), alt phone, email, city, source*, notes. Sales owns what they add; Admin can assign right away.
**CSV import (Admin, Office):** drop zone → parse in the browser → preview first 10 rows with row validation → `POST /leads/import` (max 500 rows) → result: **created / duplicates / invalid** with reasons, downloadable list of the rejected rows.

**Role differences:** Sales sees only their own leads (no assignee filter); Office sees all but has **no** status, call or edit actions (hidden); only Admin assigns.

### Lead detail (`/leads/[id]`, also the sheet)
```
← Leads / Rahul Sharma      [Proposal Sent ▾]  [📞 Call] [WhatsApp] [+ Proposal]
┌ Timeline | Proposals | Calls | Visits | Details ──────────┐┌ Summary ───────┐
│ day-grouped: created · assigned · status changes · calls  ││ Assigned: Ravi │
│ · visits · proposal sent / seen · project created         ││ Source: Justdial│
└───────────────────────────────────────────────────────────┘│ Stuck 3 days ⚠ │
                                                             └────────────────┘
```
- Status control: any → any; Lost needs a reason; the change appears in the timeline. Won leads show a **Project** card (link) and the lead journey.
- **Calls / Visits** tabs: read-only lists (calls and visits are logged by the phone app). Web can't place calls; the number is a `tel:` link. Visit rows show time, GPS link, note.
- **Proposals** tab: this lead's proposals (status, total, seen) + `New proposal`.
- No free-form "add note" (the API has none); a note can accompany a status change.

## 3. Proposals (`/proposals`, `/proposals/[id]`, public `/p/[token]`) — [proposals](../02-product/proposals.md)
**List:** number, customer, total (₹), chips (Draft / Sent / Seen / No action; derived: [api-map §4](api-map.md#4-proposals)), sent, seen (first + count), owner. Filters: status, seen state; Sales sees only their own.

**Builder:** split view on `lg`: left form, right live `ProposalPreview`; stacked with a Preview tab on mobile.
- Left: customer snapshot (read-only, "as at creation"), items (title, description, qty, unit price, line total; add / remove / reorder), flat discount, notes, terms (prefilled from the company settings, editable), valid until.
- Totals: subtotal, discount, **Total**.
- Actions: Save draft (autosave indicator), **Send on WhatsApp** (confirm: "This freezes the proposal. To change prices you will duplicate it." → `send`, then open `whatsappUrl`), Copy link, Duplicate.
- **Sent = read-only** with a banner "Sent on 12 Nov · Frozen" and a **seen panel**: "Seen first on … · N views" or "Not seen yet · 2 days".

**Public page (`/p/[token]`, no shell, server-rendered):** paper-like layout; company block (name, tagline, address, phone from the API), number + date, customer, items, subtotal/discount/total, notes, terms, validity, "Prepared by <name>". Playfair Display for headings and total, Jost for body. Print stylesheet (A4, hide buttons); "Download PDF" = `window.print()`; expired notice from `validUntil`. After the page renders in the browser, fire `POST …/seen` (a plain fetch never counts).

## 4. Projects (`/projects`, `/projects/[id]`) — [projects-feed](../02-product/projects-feed.md)
**List:** cards or table (toggle): name, customer, value, `stage` badge (Design / Site / Closed), `designStage` chip, designer, last activity. Filters: stage, designStage, designer ("Design board" = preset `designStage` ≠ Approved), search. Admin: `New project` (existing customer or from a lead).

### Project detail
Header: name, customer, stage badge, value, member avatars, Admin actions (Edit, Members, **Close project**, **Reopen** for a closed one, **Invite customer**). Tabs **Feed · To-dos · Docs · Activity** (customers: Feed and Docs only; Sales: a read-only summary + lead journey instead of the tabs).

**Feed tab** (680px column) with a **Client | Team** switch (customers only ever see Client):
```
[ composer: text · 📷 photos (multi) · Post ]     Client switch shows the banner
                                                   "Visible to the customer"
┌ PostCard ─────────────────────────────────┐
│ (avatar) Name · designation · 2h  [✓ Approved by Mrs Rao]
│ text                                       │
│ [PhotoGrid 1–4, +N]   (💾 Save to Docs)    │
│ 💬 5 comments (latest 3 inline) [Show all] │
│ [ comment input · 📷 ]                     │
└────────────────────────────────────────────┘
```
- Photo upload direct to storage (progress per file, retry). Comments are chat-style, one thread per post, text and/or up to 5 photos. "Load older" uses the `before` cursor.
- **Customer** sees a team post with photos with an **Approve** button (once; then "Approved by … on …"). Customers can also post and comment (always Client).
- **Close project** (Admin): needs a **Final Delivery** post with photos (`kind: FINAL_DELIVERY`, always visible to the customer); the dialog explains and offers to create it. Closed projects hide the composers and show a "Closed" banner.
- **Right rail (xl):** stage and design stage controls (Admin; designer for design stage), members (Admin edits), key dates, lead journey link.

**To-dos tab** (team): lists as cards with "3/8 done", Basecamp-style rows (checkbox, title, assignee avatars, due chip, comments count, photo count). Row → drawer: notes, photos, assignees (from the project's members), "notify when done" people, due date, discussion (comments with photos). Add list / add to-do inline. Check/uncheck is optimistic. Filters: Open / Done / All, "Assigned to me".

**Docs tab:** `DocsBrowser` (folders left, files right, breadcrumb). Upload (drag & drop; type and size errors come from the API), new folder, rename/move (drag), per-file **Shared with client** switch, delete (uploader/Admin; folder only when empty). Photo files show thumbnails. Customer variant: one flat list of shared files + upload (always shared).
- **Save to Docs:** every photo in the feed, comments and to-dos has a "Save to Docs" action; multi-select up to 20 → choose folder + visibility (default = the source's visibility) → toast "Saved 3 · 1 already in Docs".

**Activity tab** (team only): `GET …/timeline`, posts and team activity in one stream: to-dos created/assigned/done, files added/shared/saved, complaints raised/assigned/resolved/reopened/closed. Each line deep-links to its item.

**Lead journey** (Sales/Admin): read-only timeline of the originating lead.

## 5. To-dos: My assignments (`/todos`)
Everything assigned to me across projects, most urgent first (`GET /todos/mine`): grouped Overdue / Today / This week / Later / No date; each row shows the project name; check to complete (optimistic); click → opens the project's to-do drawer. Empty: "Nothing assigned to you."

## 6. Complaints (`/complaints`, `/complaints/[id]`) — [complaints](../02-product/complaints.md)
**List:** status badge (Open / Assigned / Resolved / Closed; "Reopened ×N" chip), project + customer, description snippet, assignee, raised, age; tabs with counts from `GET /complaints/counts`; filters: status, "Assigned to me", project. Technicians see only theirs; customers only their own.
**Raise:** dialog: project select (customers: their projects; staff: projects they can see), description, up to 5 photos (signed upload first). Technicians and HR don't get the button.
**Detail:** header (project, customer, status), photos, **history** (raised → assigned to X → resolved with note + photos → reopened "reason" → closed), side card (assignee, dates). Action buttons are rendered **only from `can{}`**: Assign (Admin; picker of active staff), Resolve (note + ≤5 photos, via the resolve upload ticket), Reopen (reason; customer or Admin), Close (Admin). A `409`: "Someone else just updated this." → refetch.

## 7. Attendance (`/attendance`) — [hr](../02-product/hr.md)
- **Board (Admin/HR):** date picker, chips (Present / Absent / Missing out) from `counts`, an "Off day" banner when `offDay`, table: person, type (GPS / Biometric), in, out, status badge, corrected pencil; kebab → **Correct day** (dialog: in, out, required note) and Remove. `Generate demo attendance` button (Admin/HR; only when the web build has the demo flag, see the implementation guide).
- **Person month** (Admin/HR, or anyone for themselves): `AttendanceCalendar` (Present / Absent / Off / Future, missing-out ring, corrected pencil) + side panel for the selected day: times, method, GPS link (`inLocation`), correction note. *No change history and no leave.*
- **My attendance** (any staff on attendance): own month, read-only. GPS check-in/out is on the **Android app**; the web says "Check in from the Vaastu app".

## 8. Employees and Designations (`/employees`) — Admin, HR
- **Employees:** table (name, phone, role, designation, attendance type, **salary** (Admin/HR), active switch). Add/Edit sheet per hr.md: role limited to what the actor may create (HR cannot create Admin/HR accounts), designation from the master list, attendance type, fixed salary, optional login ("Create login" → password). Reset password action (`PUT …/password`; also gives a no-login employee a login). Deactivate asks confirmation: "They will be signed out immediately."
- **Designations (`/employees/designations`):** list (active/inactive), add, rename (a rename updates everyone who holds it; say so in the confirm), deactivate. Read-only picker elsewhere.

## 9. Salary (`/salary`) — Admin, HR
Month picker (future months are refused). Empty month: "Not generated yet" + **Generate**.
```
November 2026   Weekly off: Sun + 1st/3rd Sat · 23 working days    [Generate] [Finalize] [Export CSV]
Person    Fixed     Present  Computed    Payable (edit)        Note
Ravi     ₹18,000    21/23    ₹16,435    [₹16,435]  Edited ✎    Advance adjusted
...                                      Total ₹x,xx,xxx
```
- **Generate** is safe to repeat: its confirm text says it refreshes untouched rows, keeps hand-edited amounts, and is refused once the month is finalized.
- Inline edit of **payable** with an optional note (a `409` once finalized). Badges: Edited, and a "Finalized" banner that locks everything.
- **Finalize** (confirm: "This locks the month. Attendance changes will no longer affect it."). **Export CSV** fetches with the auth header and downloads a blob.
- Shows the weekly-off rule and working days the sheet was computed with (they are stored per row).

## 10. Notifications (bell + `/notifications`)
Bell popover: last 10, unread dot, "Mark all read", item = icon + sentence + age + deep link (routes in [api-map §10](api-map.md#10-notifications-deep-links)). Page: full list, filter All / Unread, paging. Count refreshes by polling `unread-count` (~30 s and on focus).

## 11. Settings (`/settings`, Admin) — [settings](../03-architecture/settings.md)
Generated from `GET /settings`: sections by `group` (Projects, Leads, Reminders, Proposals, Documents, HR, Company). Each field renders by `type`: switch, number (with unit "days" for time settings; `min`/`max` as limits), text, long text; shows label, description, the **default**, and a "Reset to default" link when `isDefault` is false. One Save for the page (all-or-nothing): if the API names a bad `values.<key>`, scroll to and mark that field with the message.
- **Weekly off** (`hr.weeklyOff`) gets a dedicated `WeeklyOffEditor` (weekday rows; "every" or 1st–5th chips; live preview and a month mini-calendar) that writes the string (`SUN; SAT:1,3`).
- Time settings accept decimals (days); show "≈ 17 min" helper under very small values (used in demos).

## 12. Customer shell
Top bar (bell, name, log out) + bottom bar **Project · Documents · Complaints**; no sidebar. **Project:** the Client feed (read, comment, post, **approve**); **Documents:** the flat shared list + upload; **Complaints:** raise and see their own (with Reopen when resolved). Mobile-first; this is also what the customer sees on desktop.

## 13. Cross-cutting
- **⌘K:** leads (name/phone) and projects via the two search endpoints in parallel (role permitting), plus pages; recent items.
- **Empty-state copy** and **toasts** per design-system §5/§9. **Error pages:** 404 ("We could not find that"; `403` is treated the same), 500 with retry.
- **Offline / slow:** failed requests toast "Connection lost, retrying" and retry GETs with backoff; mutations never auto-retry.
