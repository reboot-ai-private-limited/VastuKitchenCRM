# 05 · UI / Design (web admin panel)

Design brief for the Next.js admin panel (`apps/web`, not built yet). Docs only; no code was changed to produce this. The backend is complete, so every screen here is specified against the **real API** (114 operations, [api-map](api-map.md)).

| File | What it is |
|---|---|
| [design-system.md](design-system.md) | Tokens (colour, type, spacing, radius), component inventory, status/badge system, states, accessibility |
| [layout-and-navigation.md](layout-and-navigation.md) | App shell, per-role navigation, responsive rules, page templates, routes |
| [screens.md](screens.md) | Screen-by-screen spec for every module (dashboard, leads, proposals, projects with feed / to-dos / docs, complaints, HR, salary, settings, customer shell) |
| [api-map.md](api-map.md) | **Screen → endpoints**, role gates, conventions and traps (auth, uploads, errors, `can{}`, polling) |
| [implementation-guide.md](implementation-guide.md) | Stack, architecture decisions (proxy, client-side auth, refresh rules), build order, definition of done |

## Decision summary
- **Stack:** Next.js (App Router) on Vercel, Tailwind v4, shadcn/ui (Radix), lucide icons, TanStack Query + TanStack Table, sonner toasts, next-themes, react-hook-form + the zod schemas in `packages/contracts`.
- **Starting point:** the admin shell and common components of the sibling project `/home/arjit/Work/freelance/furniturewaledada`, **re-themed** to the Vaastu brand ([branding](../00-vision/branding.md)) and extended with CRM components.
- **Look and feel:** premium, precise, calm. Warm-neutral surfaces, one teal accent, generous whitespace, dense tables. No chart-heavy dashboards ([dashboard](../02-product/dashboard.md)).
- **Mobile:** the web panel must work on a phone (sales staff). The Android app (React Native) is separate and gets its own mobile-first flows later; it reuses these tokens.
- **Agreed defaults** (change any of them before the build starts):
  1. **Same-origin proxy:** Next rewrites `/api/*` to the VPS, so the httpOnly refresh cookie works and there is no CORS.
  2. **Authenticated pages are client-rendered** (TanStack Query); server rendering only for the shell and the public proposal page.
  3. **Customer web shell is minimal** (invite page, feed + approve, documents, complaints); the Android app is their main surface.
  4. **Table first, Board second.** Light mode first. English only for now.

## What this revision fixed (against the first draft)
- Removed things the backend does not have: forgot/reset password, "In progress" complaint status, attendance "leave" and correction history, likes, a last-activity field on leads.
- Added what it has but had no screen: **to-dos** (project tab + My assignments), **docs** (folders, sharing, Save to Docs), the project **Activity** timeline, **designations**, **customer invites** and the `/invite/[token]` page, salary **Finalize / CSV / weekly-off**, a dedicated **weekly-off editor**, the dashboard's **value row, five attention blocks and date range**.
- Added the architecture the first draft skipped: cookie/proxy approach, rotating-refresh rules (verified against the API), data fetching, `transpilePackages`.

Brand spelling in the UI is **Vaastu Kitchen** (double "a").
