# 05 · UI / Design (web admin panel)

Design brief for the Next.js admin panel (`apps/web`, not built yet). Docs only; no code was changed to produce this.

| File | What it is |
|---|---|
| [design-system.md](design-system.md) | Tokens (colour, type, spacing, radius), component inventory, status/badge system, states, accessibility |
| [layout-and-navigation.md](layout-and-navigation.md) | App shell, per-role navigation, responsive rules, page templates |
| [screens.md](screens.md) | Screen-by-screen spec for every module (leads, proposals, projects/feed, complaints, HR, dashboard, settings) |
| [implementation-guide.md](implementation-guide.md) | Stack, what to copy from the reference project, build order, references to look at |

## Decision summary
- **Stack:** Next.js (App Router) on Vercel, Tailwind v4, shadcn/ui (Radix), lucide icons, TanStack Table, sonner toasts, next-themes, react-hook-form + the zod schemas in `packages/contracts`.
- **Starting point:** the admin shell and common components of the sibling project `/home/arjit/Work/freelance/furniturewaledada` (see implementation-guide), **re-themed** to the Vaastu brand (see [branding](../00-vision/branding.md)) and extended with CRM components.
- **Look and feel:** premium, precise, calm. Warm-neutral surfaces, one teal accent, generous whitespace, dense tables. No chart-heavy dashboards (see [dashboard](../02-product/dashboard.md)).
- **Mobile:** the web panel must work on a phone (sales staff). The Android app (React Native) is separate and gets its own mobile-first flows later; it should reuse these tokens.

Brand spelling in the UI is **Vaastu Kitchen** (double "a").
