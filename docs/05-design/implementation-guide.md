# Implementation guide (for the agent that builds `apps/web`)

Read first: [design-system](design-system.md) · [layout-and-navigation](layout-and-navigation.md) · [screens](screens.md) · **[api-map](api-map.md)** (every call, role gate and trap).

## Stack
Next.js (App Router) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui (`radix-nova`, neutral base, CSS variables) · lucide-react · **TanStack Query** (all authenticated data) · @tanstack/react-table · sonner · next-themes (dark later) · react-hook-form + `@hookform/resolvers/zod` · dnd-kit (Board) · date-fns. Deploy on Vercel; the web app talks to the Express API over REST with the zod contracts from `packages/contracts` ([overview](../03-architecture/overview.md)).

- **No server actions with direct DB access** (the reference project does that): all data goes through the API.
- **`packages/contracts` ships TypeScript source with no build step** (`exports: ./src/index.ts`): add it to `transpilePackages` in `next.config`. Import schemas and DTO types from it; no hand-written DTOs. Add `apps/web` to `pnpm-workspace`/turbo; `pnpm check` must stay green.
- The reference project warns "This is NOT the Next.js you know" (its `AGENTS.md`): it runs a newer Next. Read the docs under the installed `node_modules/next/dist/docs/` before writing routing/caching code.

## Architecture decisions (agreed defaults)
1. **Same-origin proxy.** The web app (Vercel) and the API (VPS) are different sites, so a cross-site httpOnly cookie is unreliable. Configure a Next **rewrite** `/api/:path*` → `${API_ORIGIN}/api/:path*`. The browser then talks only to its own origin: the refresh cookie is host-only on the web domain (`SameSite=Lax`, `Secure`), there is no CORS, and `WEB_BASE_URL` for invite links is the web origin. Keep `COOKIE_SAMESITE` and `CORS_ORIGINS` in the API for local development.
2. **Authenticated pages are client-rendered** (TanStack Query). Server components are used for the shell, static pages and the **public proposal page** (`/p/[token]`, SSR, `no-store`). Reason: the refresh token **rotates**, and a server component cannot set cookies, so refreshing there would burn the token.
3. **Customer web shell is minimal** (invite page, feed + approve, documents, complaints) and mobile-first; the Android app stays their main surface.
4. **Table first, Board second.** Light mode first; English only (leave room for Bengali: Noto Sans Bengali fallback).

## Auth & sessions
- **Login:** `POST /api/identity/auth/login` with header `X-Client: web` → `{ accessToken, user }` in the body, refresh token as an httpOnly cookie. Keep `accessToken` **in memory only** (never localStorage). Customers: `/invite/[token]` calls `…/invite/redeem` the same way.
- **On load / reload:** the access token is gone; call `POST …/auth/refresh` (cookie, no body), then `GET …/auth/me`. If refresh returns `401`, go to `/login`.
- **Refresh is rotating, and any second use of a refresh token signs the user out on every device.** *Verified against the API:* after `rt1 → rt2`, presenting `rt1` again (even a moment later) returns `401` **and revokes all of that user's sessions**, so `rt2` and every other device's token die too. Two requests presenting the same token at the same instant: one wins, the other gets `401`. There is **no grace window**. Therefore:
  - **Single-flight:** one in-flight refresh promise per tab; every request that gets a `401` awaits it, then retries once.
  - **One tab at a time:** guard refresh with the Web Locks API (`navigator.locks.request('vastu-refresh', …)`), and share the new access token with other tabs via `BroadcastChannel`. Two tabs refreshing with the same cookie at once (or one tab retrying) is the classic way to log yourself out everywhere. The guard is mandatory.
  - **Never auto-retry a refresh call** on a network error or timeout: the server may already have rotated the token, and the retry would be a replay. Treat a failed refresh as "signed out": go to `/login` with a calm "Please sign in again".
  - *Recommended backend tweak (not done; decide before the web build):* a ~10-second grace window in which the just-rotated token is accepted once and returns the same successor, so a lost response or a second tab doesn't cost a full sign-out. Until then the client rules above are the protection.
  - Refresh proactively shortly before the access token expires (decode `exp`), not only on `401`.
- **Middleware** (edge): if there is no session cookie, redirect protected paths to `/login`. It does not call the API.
- **Roles:** `GET /identity/auth/me` returns `role`; the nav, landing page and button visibility derive from it. Never trust it for security.
- Staff passwords are reset by Admin/HR; there is no forgot-password flow.

## API client
- One typed `api()` wrapper over `fetch`: adds `Authorization`, `X-Client: web`, JSON; unwraps `data`; on non-2xx throws an `ApiError { status, code, message, fieldErrors }` built from the envelope (`data[].path` → field errors). It centralises the `401 → refresh → retry` and `429`/network handling.
- **Query keys** per resource (`['leads', filters]`, `['project', id, 'feed', tab]`). Mutations invalidate precisely; only lead status moves, to-do checks and notification reads are optimistic ([design-system §5](design-system.md)).
- **Polling:** `unread-count` every ~30 s (`refetchInterval`) and on window focus; nothing else.
- **Filters, search, sort, page in the URL** (`nuqs` or `useSearchParams`); queries read from the URL.
- **Uploads:** a shared `uploadWithTicket(kind, signCall, file, onProgress)` helper: sign → `XMLHttpRequest`/`fetch` POST to the ticket `url` (fields first, file last) → return `{ publicId, bytes, width?, height? }`. Handle `503` ("not set up").
- **CSV export** (`export.csv`) needs the bearer header: fetch → `Blob` → download.
- **Time:** never use the browser's local zone for business dates; use the `YYYY-MM-DD` / `YYYY-MM` strings from the API and format in IST (`Asia/Kolkata`).

## Demo flag
`NEXT_PUBLIC_DEMO=1` shows the demo-only controls (Generate demo attendance). Off in production builds.

## Reference project (read-only source of patterns)
`/home/arjit/Work/freelance/furniturewaledada`

| Take | From | Change |
|---|---|---|
| Shell: sticky header + sidebar + mobile drawer | `components/admin/AdminShell.tsx` | Role-filtered nav (`roles[]`), brand, bell, ⌘K, bottom tab bar `<md`, remove "View site"; customer shell variant |
| `PageHeader` / `PageBody` / `StatCard` / `EmptyState` | `components/common/*` | Add `loading` variants |
| `DataTable` | `components/admin/DataTable.tsx` | Keep for small lists (employees, designations, settings); build `ServerDataTable` for leads/complaints/proposals |
| Forms: `FormCard`, `FormField`, `FormBar`, `useScrollToError`, `DeleteButton`, `ImageUploader` | `components/admin/*` | Bind to zod contracts + API field errors; uploader → signed tickets from the API |
| Auth pages `AuthCard` / `AuthForm` | `components/admin/` | Phone + password; no forgot/reset |
| Tokens / `@theme inline` wiring | `app/globals.css` | Replace neutral + rosewood values with [design-system](design-system.md) tokens; drop the `.store` theme |
| Skip | analytics dashboard, products/woods/banners, Mongoose usage, server actions | n/a |

## Build order (suggested; each step is demoable)
1. **Scaffold** `apps/web` (pnpm/turbo, Tailwind v4, shadcn init, fonts, tokens, `cn`, `formatINR`/`formatINRShort`, date helpers, `transpilePackages`, API rewrite).
2. **Auth + shell:** `api()` client with single-flight refresh, login, `/invite/[token]`, middleware, `me`, role-filtered nav, customer shell, 404/500 pages, notification bell (polling).
3. **Shared components:** StatusBadge, PageHeader, StatCard, EmptyState, Skeletons, ServerDataTable, FilterBar (URL state), form field set, toasts, confirm dialogs, `ActionButtons` (from `can{}`), uploader.
4. **Dashboard** (one call; the demo's opening screen) with all five states; HR variant.
5. **Leads** (table, add, CSV import, detail + timeline) → **Proposals** (builder, send, public `/p/[token]` + print CSS).
6. **Projects:** list, detail header, **Feed** (PhotoGrid, composer with direct upload, comments, approve, Client/Team), then **To-dos**, **Docs** (+ Save to Docs), **Activity**, invite dialog; **My assignments**.
7. **Complaints** → **Attendance / Employees / Designations / Salary** → **Settings** (+ `WeeklyOffEditor`).
8. Board view, ⌘K, a11y pass, mobile pass at 360 px, dark mode (phase 2).

## Local development
Start the API and demo data ([demo/api-walkthrough](../demo/api-walkthrough.md)): `pnpm dev:api` then `pnpm --filter @vastu/api seed:demo` (Owner `9000000001` / `demo-admin-123`; staff `demo-pass-123`). Photo upload needs Cloudinary credentials in `apps/api/.env`; without them the sign endpoints return `503` and seeded photos are placeholders.

## Definition of done per screen
- Matches [screens](screens.md); all five states built (loading, empty, error, forbidden/not-found, offline); works at 360 px and 1440 px.
- Every call matches [api-map](api-map.md); actions come from `can{}` where the API provides it; errors map to fields.
- Uses tokens only (no hex in components); status via `StatusBadge`.
- Keyboard-operable, focus visible, contrast AA ([design-system §8](design-system.md)).
- Types come from `packages/contracts`; no hand-written DTOs.
- Role behaviour verified for each role in the access matrix (hide what the role cannot do; the API still enforces). Test with the seeded cast.
- Lint/typecheck/format clean (`pnpm check`).

## Design references (look, don't copy)
- Real CRM screenshots: SaaSUI gallery https://www.saasui.design/crm-dashboard-ui-design (Attio and Close are closest to the calm, dense feel we want; Pipedrive for the Kanban pipeline).
- Dashboard layouts: https://thefrontkit.com/blogs/crm-dashboard-examples , https://adminlte.io/blog/crm-dashboard-examples/
- Dribbble CRM collection: https://dribbble.com/guicoral/collections/6747192-CRM
- Open-source shadcn shells to compare: https://github.com/satnaing/shadcn-admin , https://github.com/arhamkhnz/next-shadcn-admin-dashboard ; Marmelab Atomic CRM (React + shadcn) for Kanban/contact detail ideas.
- Mobile CRM patterns: https://spotio.com/blog/mobile-crm/ (bottom bar, one-tap logging, offline states).
- Feed UX: Basecamp message boards / Facebook group posts (single column, photo grids, inline comments); Basecamp to-dos and Docs & Files for the project tabs.

## Open questions for the owner/client
1. Confirm brand values (teal, fonts) and get the vector logo ([branding](../00-vision/branding.md)).
2. Bengali labels for floor staff/technicians later? (assumed English only now)
3. Does the customer need the web panel at all? (assumed a minimal shell; the APK and links are the main surface)
4. Dark mode for the demo, or phase 2? (assumed phase 2)
5. Board required for the demo, or table first? (assumed table first)
