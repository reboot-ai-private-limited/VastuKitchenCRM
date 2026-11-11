# Layout & navigation

## App shell
Adapted from the reference `AdminShell` (sticky top bar + left sidebar; drawer below `lg`).

```
┌──────────────────────────────────────────────────────────────┐
│ ☰  [V] Vaastu Kitchen         🔍 Search ⌘K    🔔(3)  ◐  (AD)▾ │  56px sticky, blur, border-b
├──────────┬───────────────────────────────────────────────────┤
│ Dashboard│  Page title                          [Actions]     │
│ Leads    │  description                                       │
│ Proposals│  ─────────────────────────────────────────────     │
│ Projects │  PageBody (p-6, space-y-5)                         │
│ Complaint│                                                    │
│ ──────── │                                                    │
│ People   │                                                    │
│ Settings │                                                    │
└──────────┴───────────────────────────────────────────────────┘
 224px sidebar, bg-sidebar, border-r, sticky
```
- **Top bar:** logo chip + wordmark (teal "V" mark), global search/command palette, notification bell (unread count), theme toggle (phase 2), user menu (name, role, designation, Log out). Remove "View site" from the reference.
- **Sidebar:** icon + label, 14px; active = `primary-soft` background + teal text + 2px left indicator; counts as small pills (open complaints, unseen proposals). Group labels (small caps, muted) separate Work / People / Admin. Collapsible to icon rail (≥`xl`), state remembered.
- **Breadcrumbs** on detail pages (Leads / Rahul Sharma).
- **Main:** fluid; content width rules from [design-system](design-system.md).

## Navigation per role
Nav is filtered by role (the reference does this with an `ownerOnly` flag; generalise to `roles: Role[]`). Source of truth: [auth-and-roles](../03-architecture/auth-and-roles.md).

| Item (icon) | ADMIN | HR | SALES | DESIGNER | TECHNICIAN | OFFICE | CUSTOMER |
|---|---|---|---|---|---|---|---|
| Dashboard (LayoutDashboard) | ✅ | attendance view | – | – | – | – | – |
| Leads (Users) | ✅ | – | ✅ mine | – | – | add/view | – |
| Proposals (FileText) | ✅ | – | ✅ mine | – | – | – | – |
| Projects (FolderKanban) | ✅ | – | summary | ✅ | ✅ | ✅ | **own** |
| Complaints (LifeBuoy) | ✅ | – | ✅ | ✅ | ✅ assigned | ✅ | ✅ |
| Attendance (CalendarCheck) | ✅ | ✅ | own | own | own | own | – |
| Employees (BadgeCheck) | ✅ | ✅ | – | – | – | – | – |
| Salary (Wallet) | ✅ | ✅ | – | – | – | – | – |
| Settings (Settings) | ✅ | – | – | – | – | – | – |

Landing page after login: ADMIN → Dashboard; SALES → Leads; DESIGNER/TECHNICIAN/OFFICE → Projects (or Complaints for TECHNICIAN); HR → Attendance; CUSTOMER → their project (Client tab). **Customers get a stripped shell**: no sidebar, just top bar + their project feed and proposal link (the phone/APK is their main surface).

## Responsive rules
| Breakpoint | Behaviour |
|---|---|
| `< md` (phone) | Sidebar -> **bottom tab bar** (max 5: Home/Leads, Projects, Complaints, Alerts, More). "More" opens a sheet with the rest. Tables -> cards. Detail sheets -> full-screen. FormBar sticks above the tab bar. Kanban -> single column with a status tab strip or horizontal snap. |
| `md`-`lg` | Hamburger drawer (as reference), tables stay tables, 2-column grids. |
| `≥ lg` | Fixed sidebar + full tables. |
| `≥ xl` | Optional collapse to icon rail; dashboard counters in one row. |

Phone rules: primary action is a floating "+" (Add lead) bottom-right above the tab bar for SALES; tap-to-call and WhatsApp are the largest buttons on a lead; no hover-only controls; safe-area padding.

## Page templates
1. **List page:** `PageHeader` (title, primary action) -> `FilterBar` -> `ServerDataTable` (or Kanban toggle) -> pagination.
2. **Detail page:** breadcrumb -> header (title, status badge, key actions) -> two columns on `lg` (left: main content/tabs; right: 320px summary card, assignee, dates, quick actions); stacked on mobile.
3. **Form page:** centred 720px `FormCard` sections, sticky `FormBar`.
4. **Dashboard:** counters grid -> two-column (staff activity | alerts) -> recent feed.
5. **Feed page:** single 680px centred column (Facebook/Basecamp style) with composer at top and a right rail of project info on `xl`.
6. **Auth pages:** centred card on warm background, logo above, phone + password, forgot/reset (reuse reference `AuthCard`/`AuthForm`).
7. **Public proposal page:** no shell; branded header, Playfair headings, print-friendly, "Download PDF", WhatsApp contact button.

## URL & state conventions
- Routes: `/` dashboard, `/leads`, `/leads/[id]`, `/proposals`, `/proposals/[id]`, `/projects`, `/projects/[id]` (`?tab=client|team`), `/complaints`, `/attendance`, `/employees`, `/salary`, `/settings`, `/login`, `/p/[token]` (public proposal).
- Filters, search, sort, page and the Kanban/table toggle live in the **URL search params** so views are shareable and survive refresh.
- Auth is checked in the server layout (reference `requireAdmin` pattern, generalised to `requireRole`); the nav filter is cosmetic only, the API enforces access.
