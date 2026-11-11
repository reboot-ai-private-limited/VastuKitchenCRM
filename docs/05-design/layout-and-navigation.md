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
| Dashboard (LayoutDashboard) | ✅ | attendance only | – | – | – | – | – |
| Leads (Users) | ✅ | – | ✅ mine | – | – | add/view (no status, no calls) | – |
| Proposals (FileText) | ✅ | – | ✅ mine | – | – | – | – |
| Projects (FolderKanban) | ✅ | – | summary of own leads' projects | ✅ | ✅ | ✅ | **own** |
| To-dos (ListChecks) → "My assignments" | ✅ | – | ✅ | ✅ | ✅ | ✅ | – |
| Complaints (LifeBuoy) | ✅ all | – | ✅ own / raise on own projects | ✅ same | ✅ assigned | ✅ all | ✅ own |
| Attendance (CalendarCheck) | ✅ | ✅ | own | own | own | own | – |
| Employees (BadgeCheck) + Designations | ✅ | ✅ | – | – | – | – | – |
| Salary (Wallet) | ✅ | ✅ | – | – | – | – | – |
| Settings (Settings) | ✅ | – | – | – | – | – | – |

Docs live **inside a project** (tab), not in the sidebar. The notification bell is in the top bar for everyone. Show an item only if the role can use it ([api-map §12](api-map.md#12-who-can-call-what-summary)); the API still enforces.

Landing page after login: ADMIN → Dashboard; SALES → Leads; DESIGNER/TECHNICIAN/OFFICE → Projects (or Complaints for TECHNICIAN); HR → Attendance; CUSTOMER → their project (Client tab). **Customers get a stripped shell**: no sidebar, just a top bar (bell, name, log out) and a bottom bar *Project · Documents · Complaints*. They arrive through `/invite/[token]` (one-time link) and land on their project's Client feed; the phone/APK stays their main surface, so this shell is minimal and mobile-first.

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
4. **Dashboard:** counters grid (+ value row) -> two-column (staff activity | needs attention) -> recent customer activity.
5. **Project page:** header + tabs (*Feed · To-dos · Docs · Activity*). Feed = single 680px centred column (Facebook/Basecamp style) with the composer at top and a right rail of project info on `xl`; To-dos and Docs use the full width.
6. **Auth pages:** centred card on warm background, logo above, phone + password, forgot/reset (reuse reference `AuthCard`/`AuthForm`).
7. **Public proposal page:** no shell; branded header, Playfair headings, print-friendly, "Download PDF", WhatsApp contact button.

## URL & state conventions
- Routes: `/` dashboard, `/leads`, `/leads/[id]`, `/proposals`, `/proposals/[id]`, `/projects`, `/projects/[id]` (`?tab=feed|todos|docs|activity`, feed sub-switch `&feed=client|team`, deep links `&post=` `&todo=` `&file=`), `/todos` (My assignments), `/complaints`, `/complaints/[id]`, `/attendance`, `/employees` (`/employees/designations`), `/salary`, `/settings`, `/notifications`, `/login`, **`/invite/[token]`** (customer one-time sign-in), `/p/[token]` (public proposal). There is **no** forgot/reset route.
- Filters, search, sort, page and the Kanban/table toggle live in the **URL search params** so views are shareable and survive refresh.
- **Auth is client-side** (see [implementation-guide §Auth](implementation-guide.md#auth--sessions)): Next middleware only checks that the session cookie exists and redirects to `/login`; the signed-in user (`GET /identity/auth/me`) then drives the nav and landing page. The nav filter is cosmetic only, the API enforces access. A role that opens a page it may not use gets the calm "not found" page (the API's rule).
