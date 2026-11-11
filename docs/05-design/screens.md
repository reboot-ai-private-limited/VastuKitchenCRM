# Screen specs

Wireframes are low-fidelity ASCII; spacing/colour come from [design-system](design-system.md), chrome from [layout-and-navigation](layout-and-navigation.md). Field names and rules come from the module docs in `02-product/`; if they disagree, the module doc wins. Every screen defines loading / empty / error states (design-system §5).

## 0. Login (`/login`, `/forgot`, `/reset`)
Centred card on warm bg: logo, "Sign in", phone (10 digits, +91 shown), password (show/hide), primary "Sign in", "Forgot password?". Error: "Phone or password is incorrect" (never say which). Deactivated user: "This account is inactive. Contact the owner."

## 1. Dashboard (`/`, ADMIN) — [dashboard](../02-product/dashboard.md)
```
Dashboard                                    [Today ▾]
┌Open leads┐┌Running proj┐┌Pending compl┐┌Staff present┐
│   128    ││ 14 (D9 S5) ││      6      ││   31 / 38   │   StatCards, each links to a filtered list
└──────────┘└────────────┘└─────────────┘└─────────────┘
┌ Alerts ─────────────────┐┌ Staff activity (today) ─────────┐
│ ● Proposal VK-26-0012   ││ Person  First  Last  Calls Leads │
│   not seen · 2d   [Open]││ Rahul   9:05   5:40   24    11   │
│ ● Lead stuck: A. Das 3d ││ ...                       Props  │
└─────────────────────────┘└──────────────────────────────────┘
┌ Recent feed ────────────────────────────────────────────────┐
│ post cards needing owner attention (latest first)           │
└─────────────────────────────────────────────────────────────┘
```
- Counters: open leads, running projects (Design vs Site split in sub-line), pending complaints, staff present today.
- Alerts: unseen proposals, seen-no-action, stagnant leads. Each row: severity dot, text, age, deep link.
- Staff activity table: first/last activity, calls made, leads handled, proposals generated; sortable; click -> person's lead list.
- Mobile: counters 2x2, other blocks stacked, activity table -> cards.
- **HR dashboard:** only today's attendance board (present/absent/missing-out counts + list).

## 2. Leads (`/leads`) — [leads](../02-product/leads.md)
**Toolbar:** search (name/phone/city) · Status chips · Source · Assignee (Me / Unassigned / person) · "Stuck" toggle · view toggle **Table | Board** · `Import CSV` · primary `Add lead`.

**Table columns:** Lead (name + phone), Status badge (+stuck clock), Source chip, Assigned to (PersonCell), Last activity, Created; kebab: Assign, Change status, Call, WhatsApp. Row click -> detail sheet.

**Board:** columns New · Contacted · Visit · Proposal Sent · Follow-up · Won · Lost (Lost/Won collapsed by default, count shown). Drag between any stages (not a strict funnel). Drop on **Lost** -> dialog "Why was this lost?" (required). Won -> confirm "Mark as won? This creates the customer account and project" (respect `projects.autoCreateOnWon`, text adapts).

**Add lead:** dialog/sheet: name*, phone*(10 digits, duplicate -> inline "Already exists: open lead"), alt phone, email, city, source*, notes, assignee (Admin only; Sales = self). **CSV import:** drop zone -> parse in browser -> preview first 10 rows with validation -> import (max 500) -> result summary: created / duplicates (link each) / invalid (with reason), downloadable error list.

**Role differences:** Sales sees only assigned; Office sees all but no status change/call buttons (hide, don't disable-with-no-reason); only Admin sees Assignee filter and assign action.

### Lead detail (`/leads/[id]`, also the sheet)
```
← Leads / Rahul Sharma       [Proposal Sent ▾]  [📞 Call] [WhatsApp] [+ Proposal]
┌ left (tabs: Timeline | Proposals | Calls | Visits | Details) ┐┌ right ────────┐
│ Timeline: created · assigned · status changes · calls ·      ││ Assigned: A.D. │
│ visits · proposals (seen) — day-grouped                      ││ Source: Justdial│
│ [+ Add note?]  (only if API supports)                        ││ Stuck 3 days ⚠ │
└──────────────────────────────────────────────────────────────┘│ Phone / City   │
                                                                └────────────────┘
```
- Status control: dropdown of all statuses (any -> any), logs to timeline. Lost requires a reason; Won locks the lead (see projects "won-lead locks" and lead journey).
- Calls tab: list (time, duration, answered, outcome chip, note). Web can't place calls; the phone number is a `tel:` link. Visits tab: check-in time, GPS pin (map link), note, photo.
- Won leads show a "Project" card linking to the project and the lead journey.

## 3. Proposals (`/proposals`) — [proposals](../02-product/proposals.md)
**List:** number, customer, total (₹), status (Draft/Sent/Seen/No action), sent, seen (first / count), owner. Filters: status, seen state, mine.

**Builder (`/proposals/[id]`):** split view on `lg`: left form, right live `ProposalPreview`; stacked with a Preview tab on mobile.
- Left: customer snapshot (read-only from lead, shows note "snapshot at creation"), items table (title, description, qty, unit price, line total; add/remove/reorder), flat discount, notes, terms (prefilled from settings, editable), valid-until.
- Totals block: subtotal, discount, **Total**; `formatINR`.
- Actions: Save draft (autosave indicator), **Send on WhatsApp** (confirm: "This freezes the proposal. To change prices you will duplicate it." -> marks sent, opens `wa.me`), Copy link, Duplicate.
- **Sent = read-only** view with a banner "Sent on 12 Nov · Frozen"; seen panel: "Seen first on…, N views" or "Not seen yet · 2 days".

**Public page (`/p/[token]`):** no shell. Paper-like layout, company block (logo wordmark, tagline, address, phone), number + date, customer, items table, subtotal/discount/total, notes, terms, validity, "Prepared by <name>". Playfair Display for headings and total; Jost for body. Print stylesheet (A4, hide buttons), "Download PDF" = `window.print()`, expired notice. Fires the `seen` POST after render.

## 4. Projects (`/projects`) — [projects-feed](../02-product/projects-feed.md)
**List:** cards or table (toggle): name, customer, value, `stage` badge (Design/Site/Closed), `designStage` chip, designer, last post time. Filters: stage, designStage, designer ("Design view" = filter preset), mine. Admin: `New project` (existing customer or from lead).

### Project detail (`/projects/[id]`)
Header: name, customer, stage badge, value, members avatars, Admin actions (Edit, Close project, Reopen).
Tabs: **Client** | **Team** (customer sees only Client; Sales sees a read-only summary + lead journey instead of feeds). Feed (680px column):
```
[ composer: text · 📷 photos (multi) · Post ]    Team tab default; Client tab shows
                                                  "Visible to customer" banner
┌ PostCard ───────────────────────────────┐
│ (avatar) Name · designation · 2h        │
│ text                                     │
│ [PhotoGrid 1–4, +N]                      │
│ 💬 5 comments  (latest 3 inline) [Show all]
│ [ comment input ]                        │
└─────────────────────────────────────────┘
```
- Photo upload: direct to Cloudinary via signed ticket, progress per file, thumbnails; max sizes per settings.
- Comments are chat-style, one thread per post, inherit tab. Cursor pagination "Load older".
- **Closing:** Admin only; dialog requires a Final Delivery post with photos; closed projects hide composers and show a "Closed" banner.
- **Right rail (xl):** stage/designStage control (members), members list (Admin edits), key dates, lead journey link.
- **Lead journey** (Sales/Admin): read-only timeline of the originating lead.

## 5. Complaints (`/complaints`) — [complaints](../02-product/complaints.md)
**List:** status badge (Open/Assigned/Resolved/Closed), project + customer, description snippet, assignee, raised, age; filters: status, assignee (Me), project. Raise: dialog with project select, description, up to 5 photos.
**Detail:** timeline (raised, assigned, resolved, reopened +count, closed) + photos. Action buttons come only from the API's `can` block: Assign (Admin picker of active staff), Resolve (note + ≤5 photos), Reopen (reason), Close. A `409` shows "Someone else just updated this. Reloaded." and refreshes.

## 6. Attendance (`/attendance`) — [hr](../02-product/hr.md)
- **Board (Admin/HR):** date picker, summary chips (Present / Absent / Missing out), table: person, type (GPS/Biometric), in, out, status badge, corrected flag; kebab: correct day (dialog: in, out, required note). `Simulate` button in demo only.
- **Person month:** `AttendanceCalendar` with day dots (Present green, Absent red, Off grey, Missing-out amber), side panel with day detail (times, GPS map link, correction history).
- **My attendance (everyone):** own month calendar; GPS staff also get Check in/out on the Android app (web shows read-only).

## 7. Employees (`/employees`) and Salary (`/salary`)
- **Employees:** table (name, phone, role, designation, attendance type, salary (Admin/HR), active switch). Add/Edit sheet: fields per hr.md, role limited by what the actor may create (HR cannot create Admin/HR). Deactivate asks confirmation ("They will be signed out immediately"). Optional login: "Create login" toggle with password.
- **Salary:** month picker, `Generate` (safe to repeat; confirm text explains it refreshes untouched rows, keeps manual edits), table: person, fixed, present/working days, computed, **payable** (editable inline with note), status; refuse future months and finalized months with clear messages.

## 8. Notifications (bell + `/notifications`)
Bell popover: last 10, unread dot, "Mark all read", item = icon + sentence + age + deep link. Page: full list with filters (All/Unread). Types: lead assigned, proposal seen, reminders (unseen / no action / stagnant), complaint events.

## 9. Settings (`/settings`, Admin) — [settings](../03-architecture/settings.md)
Generated from the API registry (`GET /api/settings`): grouped sections (Leads, Reminders, Projects, HR, Documents, Proposals, Company), each field renders by `type` (switch, number-with-unit "days", whole number, text, long text) with label, description, default shown, "Reset to default" link when `isDefault` is false. One Save for the page: all-or-nothing; if the API names a bad key, scroll to and mark that field. Short destructive-free page, no confirmation needed except reset.

## 10. Cross-cutting
- **Global search (⌘K):** leads by name/phone, projects, pages; recent items; role-aware.
- **Empty states copy** and **toasts** per design-system §5/§9.
- **Error pages:** 404 ("We could not find that"), 403 treated as 404, 500 with retry.
- **Customer role:** stripped shell, mobile-first, Client feed + proposal link + raise complaint.
