# Design system

Source of truth for brand values is [branding](../00-vision/branding.md). Everything below is expressed as CSS variables so shadcn components pick it up automatically (`app/globals.css`, `@theme inline`). **Never hardcode hex in components**; use tokens.

## 1. Colour tokens

### Light (default)
| Token | Value | Use |
|---|---|---|
| `--background` | `#FFFFFF` | Page background (white canvas) |
| `--card` / `--popover` | `#FFFFFF` | Cards, tables, sheets, menus |
| `--foreground` | `#0F1C1A` | Body text (cool ink) |
| `--heading` | `#000000` | Page titles only (optional) |
| `--primary` | `#0E8F78` | Primary buttons, links, active nav, focus ring |
| `--primary-hover` | `#0B7563` | Hover/pressed |
| `--primary-foreground` | `#FFFFFF` | Text on primary |
| `--primary-soft` | `#E4F5F0` | Active nav background, selected row, soft badges |
| `--secondary` / `--muted` | `#F0F5F4` | Subtle fills, table header, skeletons |
| `--muted-foreground` | `#566865` | Secondary text (darker than brand `#9A8B7E` to pass contrast; use `#9A8B7E` only for placeholders / disabled) |
| `--border` | `#DCE6E3` | Dividers, card borders |
| `--input` | `#CBD8D4` | Input borders (slightly stronger) |
| `--ring` | `#0E8F78` | Focus ring (2px, offset 2px) |
| `--destructive` | `#C0392B` | Delete, errors |
| `--sidebar` | `#F5FAF8` | Sidebar background |
| `--sidebar-accent` | `#DCF1EA` | Active nav item |

### Dark (optional, phase 2; the toggle exists in the reference shell)
Background `#171310`, card `#211C18`, foreground `#F2ECE4`, border `#352E28`, primary `#2BB59B` (lightened for contrast), primary-soft `#12352F`. Define under `.dark`. Ship light first.

### Semantic colours
Used for badges, alerts and status. Each has `fg` / `bg` (soft) / `border` so a badge is always tinted background + dark text, never colour alone.

| Meaning | fg | bg | Use |
|---|---|---|---|
| Info | `#1D5FA8` | `#E8F1FB` | New, informational |
| Success | `#1E7A46` | `#E7F5EC` | Won, present, resolved, approved |
| Warning | `#9A6200` | `#FDF3DC` | Stuck, pending, seen-no-action |
| Danger | `#B3261E` | `#FBE9E7` | Lost, overdue, error |
| Neutral | `#4A5B58` | `#EDF2F1` | Closed, inactive, draft |
| Accent | `#0B7563` | `#E4F5F0` | Brand highlight, selected |

### Lead status colours (see [leads](../02-product/leads.md))
| Status | Badge |
|---|---|
| New | Info |
| Contacted | Info (outlined) |
| Visit | Violet `#5B3FA6` on `#EFEAFB` |
| Proposal Sent | Warning |
| Follow-up | Orange `#A24A10` on `#FCEBDD` |
| Won | Success |
| Lost | Danger |
| Stuck (flag, additive) | small Warning clock icon next to the status |

Project `stage`: DESIGN = Violet, SITE = Info, CLOSED = Neutral. Complaint (API statuses): OPEN = Danger, ASSIGNED = Warning, RESOLVED = Success, CLOSED = Neutral; a *reopened* complaint is ASSIGNED with a small "Reopened ×N" chip.
Proposal: DRAFT = Neutral, SENT = Info, SEEN = Accent, NO ACTION = Warning. The API only stores `DRAFT`/`SENT`; SEEN and NO ACTION are **derived** ([api-map §4](api-map.md#4-proposals)).
Attendance day: PRESENT = Success, ABSENT = Danger, OFF (weekly off) = Neutral, FUTURE = no badge, `missingOut` = Warning icon, `corrected` = small pencil icon. Todo: open = none, done = Success check, overdue = Danger.
Alert severity (dashboard): proposal unseen / no action = Warning, stagnant lead = Warning, overdue complaint / to-do = Danger.

### Chart palette (only counters/small bars in MVP)
Teal `#0E8F78`, ink-blue `#2A78D6`, amber `#E0A02B`, terracotta `#D4694A`, grey `#9A8B7E`. Load the `dataviz` skill before writing any real chart.

## 2. Typography
| Role | Font | Size / weight |
|---|---|---|
| UI (everything) | **Plus Jakarta Sans** (via `next/font/google`, variable) | base 14px (`text-sm`), line-height 1.5 |
| Page title | Plus Jakarta Sans | `text-xl` 20px / 600, tracking-tight |
| Section/card title | Plus Jakarta Sans | `text-sm` 14px / 600 |
| Table header | Plus Jakarta Sans | `text-xs` 12px / 600, muted-foreground, tinted header row, uppercase off |
| Counter value | Plus Jakarta Sans, `tabular-nums` | `text-2xl` 24px / 600 |
| Caption/meta | Plus Jakarta Sans | `text-xs` 12px, muted |
| Display (proposal **only**) | **Playfair Display** | 28-40px / 600 |

Numbers (money, counts, phones) use `tabular-nums`. Money is always `₹` with Indian grouping (`₹12,50,000`; helper `formatINR`) and, in tight places such as counter cards, a short form (`₹90 L`, `₹1.5 Cr`; helper `formatINRShort`). The API sends whole rupees. Dates: `12 Nov 2026`, time `3:40 PM` (IST, see the time helper in `apps/api/src/shared/time`).

## 3. Spacing, radius, elevation
- 4px base grid. Page padding `p-4 lg:p-6`; vertical rhythm between blocks `space-y-5`; card padding `p-4`; form field gap `space-y-4`.
- Radius: `--radius: 0.625rem` (10px). Inputs/buttons `md`, cards `lg`, sheets/dialogs `xl`, avatars/pills full.
- Elevation: white canvas, so depth comes from a cool border plus a soft shadow. Cards, stat cards, tables panels and kanban cards = `border` + `shadow-card` (hover on clickable ones: `shadow-card-hover`, teal-tinted). Stat cards carry a thin teal top accent. Kanban lanes are `muted` tinted columns holding white cards. Popovers = `shadow-lg`, dialogs = `shadow-xl`. Sticky header = bottom border + blur.
- Min touch target 40px (44px on mobile bottom bar).
- Content max width: forms 720px, detail pages 1100px, tables/dashboard fluid.

## 4. Components
Base = shadcn/ui (Radix), already available in the reference project: accordion, alert-dialog, avatar, badge, button, card, checkbox, collapsible, dialog, dropdown-menu, input, label, popover, progress, radio-group, scroll-area, select, separator, sheet, skeleton, sonner, switch, table, tabs, textarea, tooltip. **Add:** `command` (⌘K), `calendar` + date-range picker, `toggle-group`, `breadcrumb`, `pagination`, `form`.

### Shared (copy/adapt from reference `components/common` + `components/admin`)
`PageHeader`, `PageBody`, `StatCard`, `EmptyState`, `DataTable`, `FormCard`, `FormField`, `FormBar` (sticky save bar), `ImageUploader` (Cloudinary direct upload, see [ADR-0010](../adr/0010-direct-uploads.md)), `DeleteButton` (alert-dialog), `FlashToast`.

### New CRM components (build)
| Component | Notes |
|---|---|
| `StatusBadge` | One component, `kind` + `value` -> colour/label from the table above. Always text + optional icon. |
| `LeadCard` | Kanban card: name, phone, source chip, assignee avatar, "stuck N d" flag, last activity |
| `KanbanBoard` | Columns = pipeline statuses; drag-and-drop (dnd-kit) with keyboard fallback and a "Move to…" menu; Lost asks a reason in a dialog. Mobile: horizontal snap scroll |
| `Timeline` | Vertical activity list: icon, actor, text, relative time; groups by day |
| `DetailSheet` | Right-side sheet (480-560px) for quick lead view; full page at `/leads/[id]` |
| `PersonCell` | Avatar + name + designation |
| `PhoneLink` | `tel:` link + copy; WhatsApp button (`wa.me`, see [ADR-0004](../adr/0004-whatsapp-wa-me.md)) |
| `FilterBar` | Search + chip filters + "Clear"; state in URL search params |
| `ServerDataTable` | Server-side pagination/sort/filter (cursor or page); the reference `DataTable` is client-side only |
| `PostCard` / `PhotoGrid` / `CommentThread` | Project feed: 1-4 photos grid, "+N" overlay, lightbox, chat-style comments |
| `TabSwitch` | Client / Team feed tabs, with a visible "Visible to customer" notice on the Client tab composer |
| `Alert` / `AlertRow` | Dashboard alerts and notification items |
| `NotificationBell` | Count badge + popover list + "mark all read" |
| `ProposalPreview` | Paper-like A4 preview used in builder and public link |
| `CommandMenu` | ⌘K: jump to lead by name/phone, to pages |
| `AttendanceCalendar` | Month grid from `GET /attendance/…`: a dot per day (Present / Absent / Off / Future), amber ring for missing out, pencil for corrected; tap for the day's times and note. **No leave state** (the product has none). |
| `AttentionCard` | Dashboard "Needs attention": title + count badge (`total`, "50+" when `capped`), oldest 10 rows (title, detail, age, deep link from `ref`) |
| `TodoList` / `TodoRow` | Basecamp-style: checkbox, title, assignee avatars, due chip (overdue = Danger), comment count; "3/8 done" header; inline add |
| `DocsBrowser` | Folder tree (left, depth ≤ 5) + file list (right); breadcrumb; per-file "Shared with client" switch; photo files show thumbnails. Customer variant = flat list, no tree |
| `SaveToDocsButton` | On every photo in posts, comments and to-dos; multi-select up to 20; shows "Saved" when `created: false` |
| `ActionButtons` (pattern) | Renders buttons **only from the API's `can{}` block** (complaints); a `409` toast "Someone else just updated this" then refetch |
| `WeeklyOffEditor` | Builds the `hr.weeklyOff` string: weekday rows, each "every" or 1st–5th chips; live preview "Off: every Sunday; 1st & 3rd Saturday" and a month mini-calendar; shows the server's hint on `400` |
| `InviteLinkDialog` | After `POST …/invite`: link, Copy, Send on WhatsApp, expiry. Warns that a new link replaces nothing but must be shared |
| `SalaryTable` | Month picker, rows with computed vs payable (inline edit + note), badges Edited / Finalized, totals, Generate / Finalize / Export CSV |

### Buttons
Primary (teal solid, one per view), Secondary (white + border), Ghost (toolbar/icons), Destructive (red, only inside confirm dialogs or clearly destructive rows), Link. Sizes `sm` 32px (tables, toolbars), `default` 40px, `lg` 44px (mobile primary actions). Icon-only buttons need `aria-label` + tooltip. Loading state: spinner replaces icon, button stays same width, disabled.

### Forms
Label above input, helper text below, error text in `--destructive` with an icon, never colour alone. Required marked with `*`. Validate with the zod schema from `packages/contracts` (same rules as the API) for instant feedback; **the API's `400` is still authoritative**: its `data[].path` maps to fields, unmapped ones go to a banner above the form. Sticky `FormBar` (Cancel / Save) on long forms. Unsaved-changes guard on navigation. Phone fields: 10 digits, +91 prefix shown, not typed.

### Tables
Header row `muted` bg, row hover `primary-soft/40`, selected `primary-soft`. Row height 48px (compact 40px toggle later). Sticky header on scroll. First column = identity (name + sub-line), last = actions menu (kebab). Click row opens detail. Numeric columns right-aligned. **Below `md` every table becomes a stack of cards** (title, 2-3 key fields, status badge, chevron).

## 5. States (every list/page must define all five)
1. **Loading**: skeletons matching final layout (no spinners for page loads).
2. **Empty**: icon + one sentence + primary action ("No leads yet. Add your first lead").
3. **Error**: inline alert with retry; never a blank screen.
4. **Forbidden / not found**: calm message; follow the API rule that unauthorised = "not found".
5. **Offline / slow**: toast "Connection lost, retrying" on failed requests.

Feedback: success toast (sonner, bottom-right, 3s) for saves; destructive actions need an alert-dialog naming the object. Optimistic updates only for lead status moves, to-do check/uncheck and notification reads; roll back with a toast on failure. Everything else waits for the server.

## 6. Iconography & imagery
(Photo uploads go straight to storage with a signed ticket; show per-file progress and a retry. Without storage credentials the ticket call is `503`: show "Photo uploads are not set up yet".)

lucide-react, 16px in nav/buttons, 20px in empty states, stroke 1.75. Photos are first-class (project feed): lazy-load, Cloudinary transformed thumbnails (`w_400,q_auto,f_auto`), blurred placeholder, fixed aspect boxes to prevent layout shift. Avatars show initials on `primary-soft` when no photo.

## 7. Motion
Subtle only: 150ms ease for hover/focus, 200ms for sheets/dialogs, skeleton shimmer. Respect `prefers-reduced-motion`. No page transitions.

## 8. Accessibility (non-negotiable)
- WCAG 2.2 AA contrast; the table above was chosen for it (check any new colour).
- Visible focus ring on every interactive element; logical tab order; `aria-current="page"` on active nav; `aria-sort` on sortable headers.
- Kanban fully usable by keyboard (Move to… menu); drag is an enhancement.
- Status never colour-only. Dialogs trap focus and restore it.
- Form errors announced (`aria-live`) and focus moves to the first error (reference has `useScrollToError`).
- Language: English UI for MVP; leave room for Bengali (Noto Sans Bengali fallback in the font stack, avoid fixed-width labels).

## 9. Voice
Short, plain, action-first: "Add lead", "Send on WhatsApp", "Mark as won". No jargon or exclamation marks. Errors say what happened and what to do next.
