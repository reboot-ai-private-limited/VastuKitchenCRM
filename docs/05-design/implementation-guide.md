# Implementation guide (for the agent that builds `apps/web`)

## Stack
Next.js (App Router, RSC) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui (`radix-nova`, neutral base, CSS variables) · lucide-react · @tanstack/react-table · sonner · next-themes · react-hook-form + `@hookform/resolvers/zod` · dnd-kit (Kanban) · date-fns (Asia/Kolkata). Deploy on Vercel; the web app talks to the Express API over REST with the zod contracts from `packages/contracts` ([overview](../03-architecture/overview.md)). Do **not** use server actions with direct DB access as the reference project does: all data goes through the API.

> The reference project warns "This is NOT the Next.js you know" (its `AGENTS.md`): it runs a newer Next. Read the docs under the installed `node_modules/next/dist/docs/` before writing routing/caching code.

## Reference project (read-only source of patterns)
`/home/arjit/Work/freelance/furniturewaledada`

| Take | From | Change |
|---|---|---|
| Shell: sticky header + sidebar + mobile drawer | `components/admin/AdminShell.tsx` | Role-filtered nav (`roles[]`), brand, bell, ⌘K, bottom tab bar `<md`, remove "View site" |
| `PageHeader` / `PageBody` / `StatCard` / `EmptyState` | `components/common/*` | Add `loading` variants |
| `DataTable` | `components/admin/DataTable.tsx` | Keep for small lists (employees, settings); build `ServerDataTable` for leads/complaints/proposals |
| Forms: `FormCard`, `FormField`, `FormBar`, `useScrollToError`, `DeleteButton`, `ImageUploader` | `components/admin/*` | Bind to zod contracts; uploader -> signed Cloudinary tickets from API |
| Auth pages `AuthCard` / `AuthForm` | `components/admin/` | Phone + password |
| Tokens / `@theme inline` wiring | `app/globals.css` | Replace neutral + rosewood values with [design-system](design-system.md) tokens; drop the `.store` theme |
| Skip | analytics dashboard, products/woods/banners, Mongoose usage | n/a |

## Build order (suggested)
1. **Scaffold** `apps/web` in the monorepo (pnpm/turbo), Tailwind v4, shadcn init (`components.json` as reference), fonts (Jost; Playfair only on the public proposal), tokens, `cn`, `formatINR`, date helpers.
2. **Shell + auth:** login, session handling against the API (httpOnly cookies or token strategy per [auth-and-roles](../03-architecture/auth-and-roles.md)), `requireRole`, role-filtered nav, 404/500 pages.
3. **Shared components:** StatusBadge, PageHeader, StatCard, EmptyState, Skeletons, ServerDataTable, FilterBar (URL state), FormField set, toasts, confirm dialogs.
4. **Leads** (table, add, CSV import, detail, timeline) then **Board view**.
5. **Proposals** (builder + public page `/p/[token]` + print CSS).
6. **Projects + feed** (PhotoGrid, composer with direct upload, comments, tabs).
7. **Complaints**, then **Attendance/Employees/Salary**, **Dashboard + notifications**, **Settings**.
8. Polish: ⌘K, dark mode, empty/error states audit, a11y pass, mobile pass at 360px.

## Definition of done per screen
- Matches [screens](screens.md); all five states built; works at 360px and 1440px.
- Uses tokens only (no hex in components); status via `StatusBadge`.
- Keyboard-operable, focus visible, contrast AA ([design-system](design-system.md) §8).
- Types come from `packages/contracts`; no hand-written DTOs.
- Role behaviour verified for each role in the access matrix (hide actions the role cannot do; the API still enforces).
- Lint/typecheck/format clean (`pnpm check`).

## Design references (look, don't copy)
- Real CRM screenshots: SaaSUI gallery https://www.saasui.design/crm-dashboard-ui-design (Attio and Close are closest to the calm, dense feel we want; Pipedrive for the Kanban pipeline).
- Dashboard layouts: https://thefrontkit.com/blogs/crm-dashboard-examples , https://adminlte.io/blog/crm-dashboard-examples/
- Dribbble CRM collection: https://dribbble.com/guicoral/collections/6747192-CRM
- Open-source shadcn shells to compare: https://github.com/satnaing/shadcn-admin , https://github.com/arhamkhnz/next-shadcn-admin-dashboard ; Marmelab Atomic CRM (React + shadcn) for Kanban/contact detail ideas.
- Mobile CRM patterns: https://spotio.com/blog/mobile-crm/ (bottom bar, one-tap logging, offline states).
- Feed UX: Basecamp message boards / Facebook group posts (single column, photo grids, inline comments).

## Open questions for the owner/client
1. Confirm brand values (teal, fonts) and get the vector logo ([branding](../00-vision/branding.md)).
2. Dark mode needed for the demo, or phase 2? (assumed phase 2)
3. English-only UI for MVP, or Bengali labels for floor staff/technicians?
4. Does the customer use the web panel, or only the APK + public links? (assumed APK/links; web customer shell is minimal)
5. Kanban required for the demo, or table-only first? (assumed table first, Board second)
