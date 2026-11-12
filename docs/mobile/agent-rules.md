# Mobile - Agent rules (AGENTS.md and CLAUDE.md drafts for apps/mobile)

Plan date 2026-11-12. Copy the two blocks below into `apps/mobile/AGENTS.md` and `apps/mobile/CLAUDE.md` when the app is scaffolded. Adapted from Greynote `apps/fieldApp/{AGENTS,CLAUDE}.md` (see `research/reference-greynote-fieldapp.md` section 6). Architecture source: [`03-architecture.md`](03-architecture.md).

## 1. `apps/mobile/AGENTS.md`

````markdown
This is the Vastu Kitchen mobile app (Expo / React Native), one app for every role (staff and customers). Prioritise mobile-first patterns, performance on 2-3 GB Android phones, and patchy 4G.

## Expo has changed: do not trust your training data
Expo ships breaking changes every SDK. Before writing code that touches an Expo, EAS or React Native API:
1. Read the major version of `expo` in `apps/mobile/package.json`.
2. Fetch the versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`.
3. For anything else fetch `https://docs.expo.dev/llms.txt` and follow its links. Never answer from memory.
The same applies to TanStack Query, expo-router, Sentry and i18next: read the current docs for the installed version.

## Commands (run inside apps/mobile)
```bash
npx expo install <package>   # ALWAYS, never pnpm add: resolves SDK-compatible versions
npx expo start               # dev server (dev build, not Expo Go, for push/native modules)
npx expo lint                # lint
npx tsc --noEmit             # typecheck (also: pnpm --filter @vastu/mobile typecheck)
pnpm --filter @vastu/mobile test
npx expo-doctor              # dependency/config diagnosis
npx expo install --fix       # fix incompatible versions
npx expo start --clear       # after any metro.config.js change
```
Run lint, typecheck and tests before declaring any task done.

## Navigation
Expo Router for all navigation. Routes live in `src/app/`; every file is a screen, `_layout.tsx` defines navigators. Non-route code never lives under `src/app/`. Import `Link`, `router`, `useLocalSearchParams` from `expo-router` only.

## Building with EAS
`npx eas-cli@latest <command>` (build, submit, update). Profiles: development, preview (APK), production.

## Rules
- CNG: `ios/` and `android/` are generated. Never create or edit them. Configure native behaviour in `app.json` / config plugins.
- Expo Go only has bundled native modules. After adding native code, use a dev build (`npx expo run:android` or `eas build --profile development`).
- Prefer Expo modules over third-party libraries. Any new permission needs the native-capabilities doc to allow it.
- New permissions or native modules are never shipped by OTA (EAS Update); they need a new binary.
````

## 2. `apps/mobile/CLAUDE.md`

````markdown
# CLAUDE.md
@AGENTS.md

## What this app is
`@vastu/mobile` is the phone app of Vastu Kitchen, a kitchen-design CRM. One app, role-based: ADMIN, HR, SALES, DESIGNER, TECHNICIAN, OFFICE (staff) and CUSTOMER. Part of the pnpm monorepo with `apps/api` (Express), `apps/web` (Next.js) and `packages/contracts` (`@vastu/contracts`, zod schemas, the source of truth for wire types).
Specs live in `../../docs/mobile/`: `00-principles-and-scope.md`, `01-personas-and-navigation.md` (role x feature matrix, tabs, landing), `02-design-system.md`, `03-architecture.md`, `04-native-capabilities.md`, `05-offline-and-sync.md`, `06-server-work.md`, `features/*.md` (one per feature). Read the relevant ones before building a screen. NOT in mobile: proposal template builder, admin settings, CSV import, employee and salary editing.

## Current state
<Keep this honest and dated: which screens call the real API, which are mocked, which endpoints are missing (see 06-server-work.md), what has been run on a phone vs only typechecked.>

## Hard rules
- **Types come from `@vastu/contracts` only.** Never hand-copy a DTO or enum. If a type is missing, it is a contracts change (separate PR), not a local type.
- **A screen never calls `fetch`.** Route file -> feature screen -> feature hook (TanStack Query) -> `src/lib/api/endpoints/<module>.ts` -> `src/lib/api/client.ts`. Only `client.ts` and the upload helper touch `fetch`/`XMLHttpRequest` (lint enforces it).
- **Every request sends `X-Client: mobile`** or the server keeps the refresh token out of the body. Refresh is single-flight; the new refresh token is persisted BEFORE it is used; a network error never signs the user out. Do not touch `src/lib/auth` or `client.ts` without reading 03-architecture.md section 4.
- **The role matrix lives in the docs**, mirrored once in `src/constants/roles.ts`. Never scatter `role === 'X'` checks in screens; use `useRole()`/the config. Guards are UX only; the API enforces (403 never allowed, 404 hidden: show not-found). Render complaint actions from the server's `can{}` block.
- **Branch on error `code`, never on message text.** Show the server `message` as-is. 400 `VALIDATION_FAILED` maps `data[]` issues to fields. 429: no auto retry.
- **Offline:** only kinds listed in 05-offline-and-sync.md go through the outbox; screens never call the server for them; the drain loop is the only sender. Online-only actions are disabled offline with "Needs internet".
- **Money is whole rupees** (integers, no paise). "Today" is the business date in Asia/Kolkata (`businessDate()`), never the phone's zone. Format only through `src/lib/format.ts`.
- **No user-facing literal in JSX:** `t('feature.key')`. **Tokens only** from `src/constants/theme.ts`; no raw hex, light theme only, never import RN's `useColorScheme`.
- `@/*` alias for `src/*`; kebab-case files; read the user only via `useCurrentUser()`.
- Typed routes and the React Compiler are on: regenerate types instead of casting.
- No PII in logs or Sentry (names, phones, addresses, GPS, message text, tokens). Ids only.
- **Never trust training data** for Expo/RN/TanStack APIs (see AGENTS.md) and never invent an endpoint: if `features/*.md` or contracts does not have it, stop and flag it as server work.

## Commands
`pnpm --filter @vastu/mobile <start|android|lint|typecheck|test|doctor|bundle-check>` from the repo root; `pnpm check` runs typecheck + lint for every package. API for dev: `pnpm dev:api` (port 4000), `OTP_DEV_MODE=true` makes every OTP `123456`; demo phones in `docs/mobile/research/inventory-foundations.md` section 5. Android emulator reaches the API at `http://10.0.2.2:4000/api`.
Commit prefix: `mobile:`. Run lint, typecheck and tests before declaring any task done.
````

## 3. Checklist: building a screen from `docs/mobile/features/*.md`

1. Read the feature doc fully, plus `01-personas-and-navigation.md` for which roles see it and from which tab, and `05-offline-and-sync.md` for whether each action is offline-capable or online-only.
2. List every endpoint the screen uses. For each, find the request and response types in `@vastu/contracts` (`packages/contracts/src/<module>.ts`). A missing endpoint or type: stop, record it in the feature doc's gap table / `06-server-work.md`, build against a typed mock only if the doc says so.
3. Add or extend `src/lib/api/endpoints/<module>.ts`: one function per endpoint, contracts types in and out, no React.
4. Add query keys in `src/lib/query/keys.ts`; decide `staleTime`, polling (03-architecture.md section 6 table) and whether the key is on the persistence allow-list (`meta.persist`).
5. Write hooks in `src/features/<module>/` (`useXxxQuery`, `useXxxMutation` with invalidation; optimistic only where 03-architecture.md allows; pagination with `useInfiniteQuery` on `page/totalPages`, de-dupe by `id`).
6. Build the screen in `src/features/<module>/` from design-system primitives; the route file in `src/app/` only renders it. Place it inside the right `Stack.Protected` group.
7. Implement every state: loading skeleton, empty, error with retry, not-found/forbidden (calm), offline (cached data + "Updated x ago", or "Needs internet" for online-only actions).
8. Forms: validate with the contracts zod schema (react-hook-form resolver); map server 400 issues to fields; scroll to the first error.
9. Errors: branch on `code` per the feature doc's error table; show the server message; buttons from `can{}` where provided.
10. Strings via `t()` in the feature's namespace; numbers/dates/money via `format.ts`; accessibility labels, roles and 48 dp targets.
11. Deep link: if the doc lists a URL or notification `ref`, add it to `routeFor(ref)` and test cold start and warm tap.
12. Tests: unit tests for mappers and hooks; a Maestro flow if the doc marks the flow critical (explore on a device first, use real element texts, explicit waits).
13. Run `npx expo lint`, `npx tsc --noEmit`, `pnpm --filter @vastu/mobile test`; check on an Android device/emulator with the role's demo login.
14. Update the feature doc status line (built / typechecked / run on a phone, dated) and the CLAUDE.md "Current state". Never mark "run on a phone" unless it was.
