# Mobile - Architecture (apps/mobile)

Plan date 2026-11-12. Audience: the mobile team and coding agents that build the app from these docs. Mirrors Greynote's `apps/fieldApp` (the same-to-same base) with Vastu changes. Facts are cited to `docs/mobile/research/*` (short names: **foundations** = `inventory-foundations.md`, **greynote** = `reference-greynote-fieldapp.md`, **stack** = `research-stack-and-distribution.md`, **offline** = `research-offline-performance-i18n.md`, **native** = `research-native-and-policy.md`). Anything not confirmed in code or docs is marked UNVERIFIED. Items marked **Decision (proposed)** need owner confirmation; each lists the alternative and why not.

Out of scope here (other docs): role x feature matrix and tab sets (scope/navigation doc), tokens and components (design system), native permissions (native capabilities), outbox internals (offline doc), per-screen specs (`features/*.md`), server work (server doc).

## 1. Stack and versions

One role-based app. React Native + Expo, New Architecture only (mandatory since SDK 55; stack 2.3). Expo-managed packages are never pinned by hand: `npx expo install <pkg>` resolves the SDK-compatible version.

| Layer | Choice | Version / note |
|---|---|---|
| SDK | Expo SDK 58 | RN 0.88, React 19.3.0, Node 22.13+ or 24.3+ (stack 2.1). **Decision (proposed):** greynote is on 57 (RN 0.86, React 19.2.3). Alternative: stay on 57 to share lockfile/patches with fieldApp. Why 58: current, a 57 app would need a mid-build upgrade, and web already runs React 19.3.x so the React override is a patch, not a minor (section 2.4). Re-verify SDK 58 package availability with `npx expo-doctor` on day 1. |
| Language | TypeScript strict | the Expo-compatible version from `npx expo install typescript`; contracts keeps its own TS 5.7 check |
| Navigation | expo-router (typed routes on) | file routes in `src/app`; imports only from `expo-router` |
| Server state | TanStack Query v5 | same range as web (`^5.107.1`) + `@tanstack/react-query-persist-client` |
| Persistence | `expo-sqlite` (`expo-sqlite/kv-store` for the query cache; a real SQLite DB for the outbox) | one native storage dependency (offline 2.1) |
| Secrets | `expo-secure-store` | refresh token only (section 4.3) |
| Network state | `@react-native-community/netinfo` | feeds `onlineManager`, custom reachability URL (offline 2.9) |
| Forms / validation | `react-hook-form` + `@hookform/resolvers/zod` (web uses `^7.65` / `^5.2.2`) using `@vastu/contracts` schemas | alternative: greynote's `useFormErrors` + hand validation; kept as the scroll-to-first-error helper only |
| Schemas / types | `@vastu/contracts` (zod **3.24.x**, one major across api, web, mobile) | section 2 |
| Lists | FlashList for long lists; FlatList `inverted` for the chat thread | stack 4.4 (FlashList v2 chat bugs are open upstream) |
| Images | `expo-image`, resized Cloudinary URLs from the API (`ImageDto.thumbUrl`) | foundations 3.7 |
| Styling | `StyleSheet` + typed tokens in `src/constants/theme.ts` | **Decision (proposed)**, see design-system doc. Alternative NativeWind v5: still RC and web is on Tailwind v4 but v5 is "not for production" (stack 5). |
| i18n | `expo-localization` + `i18next` + `react-i18next` | English first, hi/bn later (section 9) |
| Observability | `@sentry/react-native` | section 11 |
| Unit / component tests | `jest-expo` + React Native Testing Library | section 12 |
| E2E | Maestro (YAML flows, Android only in CI) | alternative Detox rejected: heavier harness |
| Build / OTA | EAS Build + EAS Update | section 13 |
| Animation | `react-native-reanimated` + `react-native-worklets` (SDK-pinned) | at most 1-2 concurrent animations on 2 GB phones |
| Compiler | React Compiler on (as greynote); turn off per file only with a comment | drop to off if the build fails with it |

## 2. Monorepo wiring (concrete)

Today (verified): `pnpm-workspace.yaml` = `apps/*`, `packages/*` + an `allowBuilds` block; root `packageManager: pnpm@12.16.1`; turbo tasks `build typecheck lint test dev` (all but `dev` have `dependsOn: ["^build"]`); root scripts `dev dev:api build typecheck lint test check format`. `@vastu/contracts` has `"type":"module"`, `exports: {".": "./src/index.ts"}`, **no build script**, files import siblings as `./http.js` (NodeNext style), zod `^3.24.1`. The API bundles contracts with esbuild; web uses `transpilePackages` plus a webpack `extensionAlias` `.js -> .ts` (`apps/web/next.config.ts`). `packages/config` holds the NodeNext `tsconfig.base.json` and `eslint.base.cjs`.

### 2.1 What is added (and nothing else is touched)

```
apps/mobile/                new workspace member, package name @vastu/mobile
pnpm-workspace.yaml         + nodeLinker: hoisted, + overrides (react, react-dom, @types/react)
turbo.json                  unchanged (mobile only defines typecheck, lint, test)
package.json (root)         + "mobile": "pnpm --filter @vastu/mobile start"   (optional convenience)
apps/web/package.json       react/react-dom pinned to the SDK's React (one-line change, separate PR)
```

### 2.2 `apps/mobile/package.json` rules

- `name: "@vastu/mobile"`, `private: true`, `main: "expo-router/entry"`, **no `"type": "module"`** (Metro and `metro.config.js` are CommonJS).
- Scripts: `start` (`expo start`), `android`, `ios`, `lint` (`expo lint`), `typecheck` (`tsc --noEmit`), `test` (`jest`), `doctor` (`expo-doctor`), `bundle-check` (`expo export --platform android --output-dir .expo-export`).
- **Do not define `dev` or `build`.** Root `turbo run dev` would start `expo start` as a persistent task, and `turbo run build` has nothing to build (Expo emits no `dist` for turbo). Greynote's fieldApp had no `typecheck` script so turbo silently skipped it; ours must have one.
- Dependencies: `"@vastu/contracts": "workspace:*"`, `"zod": "^3.24.1"` (same range as contracts/web), everything else via `npx expo install`, run from `apps/mobile`.
- Dependency rules: mobile may import `@vastu/contracts` (and a future `@vastu/format`, see 10.2). Mobile never imports from `apps/web` or `apps/api` (copy-paste of web helpers is allowed only until they move to a package). Nothing else imports `apps/mobile`. `@vastu/contracts` must stay free of Node-only imports (`node:*`, `Buffer`) and `import.meta`; today the only suspect is `TextEncoder` in `passwordSchema` (`identity.ts:21`), which recent Hermes provides (UNVERIFIED: smoke-test on a release build; fallback is a byte-length helper).

### 2.3 Consuming contracts: source plus a Metro resolver

**Decision (proposed): consume `@vastu/contracts` from source, add a `.js -> .ts` resolver in `apps/mobile/metro.config.js`.** Why: both existing consumers already use source (esbuild bundle, webpack alias), contracts has no build step, and a `dist` build would add a turbo build to every mobile edit loop and change `exports` under two working consumers. Alternative: build contracts to `dist` (ESM + d.ts) and point `exports` at it (zero Metro hack, identical artifact for all three). Switch to it if the spike below fails or Metro flakes on SDK 58. Day-1 spike (1 day): resolver + `expo export` + a smoke import of `phoneSchema`.

```js
// apps/mobile/metro.config.js  (CommonJS; keep Expo's monorepo defaults, no watchFolders)
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
const contractsSrc = path.resolve(__dirname, '../../packages/contracts/src');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // contracts is NodeNext source: './http.js' means './http.ts'. Metro does not know that.
  if (moduleName.startsWith('.') && moduleName.endsWith('.js') &&
      context.originModulePath.startsWith(contractsSrc)) {
    return context.resolveRequest(context, moduleName.slice(0, -3), platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
```

`apps/mobile/tsconfig.json`: `extends: "expo/tsconfig.base"`, `strict: true`, `paths: {"@/*": ["./src/*"]}`, include `**/*.ts(x)`, `.expo/types/**/*.ts`, `expo-env.d.ts`. It does not extend `@vastu/config/tsconfig.base.json` (NodeNext, `exactOptionalPropertyTypes`); contracts' own `typecheck` keeps guarding its source under its strict flags. Check that `TextEncoder` type-resolves under Expo's `lib` (UNVERIFIED).

### 2.4 pnpm linker, React and zod

- **Decision (proposed): `nodeLinker: hoisted` in `pnpm-workspace.yaml`.** Why: Expo supports isolated installs from SDK 54 but says some native libs break; hoisted is its documented fallback (stack 3.1). Alternative: keep isolated and fix breakages one by one. Risk: the linker is workspace-wide, so web and API lose strict isolation (phantom dependencies become importable). Gate: after the change, `pnpm install && pnpm check && pnpm build` at the root and `pnpm dev:api` must still pass; if web/api break, revert to isolated and use `public-hoist-pattern` for the offenders.
- **React single copy.** `apps/web` has `react`/`react-dom` `19.3.1`; SDK 58 wants `19.3.0`, SDK 57 `19.2.3` exactly (greynote). Two Reacts in one tree throw "Cannot read properties of null (reading 'useRef')". Add in `pnpm-workspace.yaml`: `overrides: { react: <sdk react>, react-dom: <sdk react>, "@types/react": <matching ^19> }` and set web's two versions to the same string. On SDK 58 that moves web 19.3.1 -> 19.3.0 (a patch). Alternative: leave the override off and rely on hoisting luck (rejected: duplicates are unsupported, stack 3.1). Confirm Next 16.4.6 accepts it (`pnpm why react`).
- **react-native** exists only in `apps/mobile` dependencies; never in the root or other packages.
- **zod 3.24.x everywhere**: do not mix `zod` v3 and v4 across consumers of the same schemas; never import `zod/v4` in mobile. (zod 4 on Hermes is UNVERIFIED.) The hoisted linker guarantees one copy; `pnpm why zod` must show one version.
- Add Expo postinstall packages to `allowBuilds` only as `pnpm install` demands (UNVERIFIED which ones).

### 2.5 CI and local checks

`pnpm check` (typecheck + lint) now covers mobile via turbo. Extra CI job on mobile changes: `pnpm --filter @vastu/mobile doctor`, `test`, and `bundle-check` (proves Metro resolves contracts). After any Metro config change run `expo start --clear` once. EAS monorepo settings are in section 13.

## 3. Folder layout and rules (`apps/mobile`)

```
apps/mobile/
  AGENTS.md  CLAUDE.md  README.md  app.json (or app.config.ts)  eas.json  metro.config.js
  package.json  tsconfig.json  eslint.config.js  jest.config.js  expo-env.d.ts  .env.example
  .maestro/            e2e flows (one yml per flow)
  assets/              icons, splash, notification icon, fonts
  src/
    app/               ROUTES ONLY, thin (each file renders a component from src/features)
      _layout.tsx      root: providers, splash hold, Stack.Protected (signed-out vs signed-in)
      (auth)/          login (phone -> OTP / password), invite/[token], force-update
      (app)/           signed-in shell
        _layout.tsx    Stack; Stack.Protected per capability group (staff-only, admin-only, customer-only)
        (tabs)/        ONE tab layout; visible tabs come from the role config (section 7.1)
        projects/[id], complaints/[id], leads/[id], proposals/[id], notifications, profile, ...
      +not-found.tsx
    lib/               NON-UI logic, one file per concern
      api/             client.ts, errors.ts, upload.ts, endpoints/<module>.ts (typed calls)
      auth/            session.ts, secure-store.ts, auth.ts (OTP/password/invite/logout/delete)
      query/           client.ts, persister.ts, keys.ts, managers.ts
      format.ts config.ts (app-config, version gate) push.ts log.ts
    offline/           outbox, sqlite store, drain engine, connectivity (see offline doc)
    components/        ui/ (primitives from design system) + shared composites; no data fetching
    features/<module>/ screen components, hooks (useXxxQuery/useXxxMutation), local types, mappers
      leads/ proposals/ customers/ projects/ complaints/ todos/ attendance/ notifications/ dashboard/ account/
    hooks/             cross-feature hooks: useCurrentUser, useRole, useOnline, useTheme, useResponsive
    constants/         theme.ts, roles.ts (role -> tabs/landing), config.ts, routes.ts
    i18n/              index.ts, en.json (namespaces per feature), hi.json, bn.json
    types/             app-only types (never wire types)
```

What lives where:

| Place | Contains | Must not contain |
|---|---|---|
| `src/app/**` | route files, layouts, guards, `Stack.Screen` options | business logic, `fetch`, queries beyond one `useXxxScreen` call |
| `src/features/<m>/` | screen UI, TanStack hooks for that module, mappers wire -> view model | cross-module imports except via `lib`/`components` |
| `src/lib/api/endpoints/<m>.ts` | one function per endpoint: path, method, contracts types in/out | UI, React, caching policy |
| `src/lib/api/client.ts` | the only place that calls `fetch`/`XMLHttpRequest` | module-specific knowledge |
| `src/offline/` | outbox, drain loop, store | UI beyond banner/chip hooks |
| `src/components/` | presentational primitives and composites | server calls, role checks |

**Rule: a screen never calls `fetch`.** Path of a call: route file -> feature screen -> feature hook (`useQuery`/`useMutation`) -> `lib/api/endpoints/<m>.ts` -> `lib/api/client.ts` -> contracts type. ESLint `no-restricted-globals: fetch` and `no-restricted-imports` (`XMLHttpRequest`, `lib/api/client` outside `lib/`) enforce it. Other conventions (from greynote): kebab-case files; `@/*` alias; platform forks by suffix; `useCurrentUser()` is the only way a screen reads the user; no user-facing string literal in JSX (`t()`); tokens only, no raw hex.

## 4. Auth and session

### 4.1 Facts the client depends on (foundations 1.1-1.7)

- Endpoints under `/api/identity/auth`: `POST /login {phone,password}`, `POST /otp/request {phone}`, `POST /otp/verify {phone,code}` (6 digits), `POST /invite/redeem {token}`, `POST /refresh {refreshToken}`, `POST /logout {refreshToken}`, `GET /me`. Login/verify/redeem/refresh/logout require `X-Client` (`mobile`), otherwise 400 `VALIDATION_FAILED`. Responses: `LoginResponseDto = AuthTokensDto + user`; `AuthTokensDto = {accessToken, refreshToken?, expiresIn}`. Mobile gets `refreshToken` in the body only with `X-Client: mobile`.
- Access JWT 15 min (read `expiresIn`, do not hard-code). Refresh token opaque, 30 days staff / 90 days customers, **rotated on every refresh** (sliding). Presenting an already-rotated token revokes ALL the user's sessions (theft rule); one replay is tolerated within `REFRESH_GRACE_SECONDS` (default 10 s). There is no absolute-expiry field: the app learns by a 401 `TOKEN_INVALID`.
- 401 has three meanings: `UNAUTHENTICATED` (access dead: refresh and retry), `TOKEN_INVALID` on refresh (sign out), `INVALID_CREDENTIALS` / `INVALID_OTP` (inline error). Anonymous endpoints never enter the refresh loop.
- OTP: 6 digits, 5 min TTL, 30 s resend cooldown (inside it the API still answers 200 and sends nothing, so the app enforces its own 30 s timer), 5 wrong tries kill the code; `/otp/request` always 200 (anti-enumeration). Limits: 429 `RATE_LIMITED` (otp 5 per 10 min per phone). No `retryAfter` field in the body today (server doc).
- No self-signup, no forgot-password; staff passwords are set by HR/ADMIN. OTP works for any ACTIVE user, staff or customer.

### 4.2 Session module (`src/lib/auth/session.ts`)

Module-level store (as greynote), no React context. State machine: `booting -> signedOut | signedIn`, plus `refreshState: ok | unknown` (unknown = the last refresh died on the network; tokens kept).

| Item | Where | Notes |
|---|---|---|
| access token + `expiresAt` | memory only | never persisted (foundations 1.4); `expiresAt = now + expiresIn*1000` |
| refresh token | SecureStore key `auth.refreshToken` | async API only |
| user (id, role, name, phone) | SecureStore key `auth.user` (JSON, < 1 KB) | lets cold start render offline; refreshed by `/me` |
| anything else | not in SecureStore | prefs go in the SQLite kv-store |

SecureStore keys allow only letters, digits, `.`, `-`, `_` (greynote: a `push:off` key crashed). Never store large blobs. `useSessionUser()` is `useSyncExternalStore` over listeners. `clearSession({byServer})` wipes both keys, clears memory, emits, and lets the login screen show "You were signed out" once.

**Android backup:** `app.json` `android.allowBackup: false` (verify the exact key in the SDK 58 docs). Auto Backup restoring a spent refresh token onto another phone would trigger theft revocation of every session (foundations 8.6). iOS keychain may survive reinstall: on first launch after install, if the SQLite marker `installId` is missing, wipe `auth.*` before booting.

### 4.3 Boot flow (`src/app/_layout.tsx`)

1. `SplashScreen.preventAutoHideAsync()`; restore `auth.refreshToken` + `auth.user` + the persisted query cache in parallel.
2. No refresh token -> `signedOut` -> `(auth)`. Otherwise `signedIn` immediately with the cached user (offline-first, no spinner on a bad network), `refreshState = unknown`.
3. In the background the first authenticated call finds no access token and triggers the single-flight refresh, then `GET /me` updates the user (role changes take effect here). `TOKEN_INVALID` -> `clearSession({byServer:true})`. Network error or 5xx -> stay signed in, cached data, offline banner. Never sign out for these.
4. Hide splash when step 1 finishes (target under 1 s on a 3 GB phone). Signed in -> redirect to `landingFor(role)` (foundations 2.5) unless a deep link or notification target is present.
5. Signed in -> signed out while the app runs: `router.dismissAll()` then `router.replace('/(auth)/login')` so Android back cannot reopen the app (greynote `_layout.tsx`); also `queryClient.clear()` and remove the persisted cache.

### 4.4 Single-flight refresh rules

1. One module-level promise; every caller awaits it (`refreshing ??= run().finally(() => refreshing = null)`). Never refresh from a headless/background task.
2. Refresh when `now >= expiresAt - 30_000` (web's `EARLY_MS`) or on a 401 `UNAUTHENTICATED`.
3. After the promise resolves, a caller whose token is already newer than the one it used does not refresh again.
4. **Persist the new refresh token BEFORE using the new access token or resolving the promise:** `await SecureStore.setItemAsync('auth.refreshToken', next)` first; the rotated old token is dead (the 10 s grace is the only safety net).
5. Retry a failed request **once** after a refresh; a second 401 -> sign out.
6. Network error during refresh: do **not** sign out and do not clear anything. Retry the same call once after about 2 s (inside the 10 s grace window, which tolerates exactly one replay); if it fails again set `refreshState = unknown` and let the next foreground/online event try. Residual risk: if the server rotated but the response was lost and the retry lands after 10 s, the server sees theft and revokes all sessions (the user must sign in again). Open server question: is a longer grace for mobile acceptable? (UNVERIFIED that one replay after a dropped response is safe beyond the tests.)
7. A write to SecureStore that throws: keep the pair in memory, retry the write on next foreground, report to Sentry (no token in the event).

### 4.5 Login, invite, logout, deletion

- **OTP login (default):** `(auth)/login` phone step (validate with `phoneSchema` from contracts; send 10 digits, show "+91" as a fixed prefix) -> `POST /otp/request` -> code step (6 boxes, `textContentType="oneTimeCode"`, 30 s resend timer owned by the app) -> `POST /otp/verify` -> `setSession(login response)`. The code arrives on WhatsApp, so there is no SMS autofill; offer paste. Show "If that number has an account, a code is on its way." as the server does.
- **Password login (alternate tab):** `POST /login {phone,password}`; inline error on `INVALID_CREDENTIALS`. Staff with `canLogin=false` (biometric-only) are an open server/product question (foundations 1.5; UNVERIFIED that OTP works for them).
- **Customer invite:** link `{WEB_BASE_URL}/invite/{token}` today points at the web app. App: custom scheme `vastukitchen://invite/{token}` plus Android App Links for the same https path (section 7.3). Route `(auth)/invite/[token]` calls `POST /invite/redeem {token}` exactly once (guard with a ref: the token is single use; web does the same) then `setSession`. Error `TOKEN_INVALID` -> "This link has expired or was already used. Ask your designer for a new one." Fallback: a paste-token field on the login screen. If a different user is signed in, ask before replacing the session. First-install deferred links (Play install referrer) need server/native work (server doc).
- **Logout:** warn if the outbox has unsent items (offline doc owns the policy: block or back up); `POST /logout {refreshToken}` best effort (revokes this session only; swallow errors); `clearSession()`; `queryClient.clear()` + drop persisted cache; wipe outbox for that user; unregister the push token (server gap). A session that merely expires keeps queued records; only an explicit logout or a different user clears the phone (greynote).
- **Account deletion (store requirement):** Apple 5.1.1(v) and Google Play require an in-app deletion path plus a deletion URL (native 3.5/3.8). No delete-account endpoint exists in the API today (not in foundations 1.1): **server dependency, P0 for store review.** App side: `profile` -> "Delete my account" -> confirm -> calls the future endpoint, then behaves like logout. Until it exists the screen opens the deletion-request URL/support form so the path is present. Staff accounts are HR/ADMIN-managed; the server decides who may self-delete.
- Change password exists (`POST /change-password`, revokes all sessions, wrong current = 400 `VALIDATION_FAILED`): include it on Profile for staff; after success clear the local session (server message "Password changed. Please sign in again.").

## 5. API client rules

Envelope (contracts `http.ts`): success `{success:true, statusCode, request, message, data}`, error `{success:false, statusCode, code, request, message, data?, trace?}`; read `body.data`. `x-request-id` header = `request.requestId`.

Base URL: `EXPO_PUBLIC_API_URL` = `https://<api-host>/api` (no trailing slash; absolute HTTPS, no proxy on mobile). Dev fallbacks as greynote (Metro host IP, `10.0.2.2` for the Android emulator, API on port 4000 per foundations 5). Android 9+ blocks cleartext, so a release build needs the real TLS domain (foundations 8.10); dev builds may set `usesCleartextTraffic`. No secrets in `EXPO_PUBLIC_*`.

**Pseudo-code (`src/lib/api/client.ts`):**

```ts
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string,
              readonly data?: unknown, readonly requestId?: string) { super(message); }
  get fieldErrors() { return this.status === 400 && Array.isArray(this.data) ? zodIssuesToMap(this.data) : {}; }
  get isNotFound() { return this.status === 404 || this.status === 403; }   // API hides records as 404
}
export class NetworkError extends Error {}           // status 0: no HTTP response, timeout, abort-by-timeout
export class CancelledError extends Error {}         // caller aborted (query cancelled): never shown, never retried

type Opts = { anonymous?: boolean; timeoutMs?: number; signal?: AbortSignal };

async function send(method, path, body, token, o: Opts) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort('timeout'), o.timeoutMs ?? 15_000);
  o.signal?.addEventListener('abort', () => ctl.abort('cancel'));
  let res: Response;
  try {
    res = await fetch(API_BASE_URL + path, { method, signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'X-Client': 'mobile',
                 'X-App-Version': APP_VERSION, ...(token && { Authorization: `Bearer ${token}` }) },
      body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { if (o.signal?.aborted) throw new CancelledError(); throw new NetworkError('Cannot reach the server'); }
  finally { clearTimeout(timer); }
  if (res.status === 204) return undefined;
  const json = await res.json().catch(() => null);              // non-JSON error body => code 'HTTP_ERROR'
  if (!res.ok || !json?.success)
    throw new ApiError(res.status, json?.code ?? 'HTTP_ERROR',
      json?.message ?? (res.status >= 500 ? 'Something went wrong on our side' : 'Request failed'),
      json?.data, res.headers.get('x-request-id') ?? undefined);
  return json.data;
}

let refreshing: Promise<boolean> | null = null;
function refreshTokens() {
  return (refreshing ??= (async () => {
    const rt = session.refreshToken(); if (!rt) return false;
    try {
      const next = await send('POST', '/identity/auth/refresh', { refreshToken: rt }, undefined, { anonymous: true });
      await session.setTokens(next);          // 1. persist new refresh token  2. then set memory access token
      return true;
    } catch (e) {
      if (e instanceof NetworkError) { session.markUnknown(); throw e; }   // never sign out on a dropped connection
      if (e instanceof ApiError && e.status === 401) { await session.clear({ byServer: true }); return false; }
      return false;
    }
  })().finally(() => { refreshing = null; }));
}

export async function request<T>(method, path, body?, o: Opts = {}): Promise<T> {
  if (o.anonymous) return send(method, path, body, undefined, o);
  let token = await session.accessTokenOrRefresh(refreshTokens);       // refreshes if missing or within 30 s of expiry
  try { return await send(method, path, body, token, o); }
  catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || e.code !== 'UNAUTHENTICATED') throw e;
    if (!(await refreshTokens())) throw e;
    return send(method, path, body, session.accessToken(), o);          // exactly one retry
  }
}
```

Rules:
- **Error branching is by `code` and status, never by message text.** Render the server's `message` as-is. Mapping: `VALIDATION_FAILED` 400 -> map `data[]` zod issues (`path.join('.')` -> field), unmapped to a banner; `UNAUTHENTICATED` -> refresh path; `TOKEN_INVALID` -> sign out (refresh) or inline (invite); `INVALID_CREDENTIALS` / `INVALID_OTP` -> inline; `FORBIDDEN` 403 -> hidden record or, on a write action, a toast; `NOT_FOUND` 404 -> calm not-found view; `CONFLICT` 409 -> toast "Someone else just updated this" and refetch (complaint actions); `PAYLOAD_TOO_LARGE` 413; `RATE_LIMITED` 429 -> show message, **no auto retry**, countdown on OTP; `SERVICE_UNAVAILABLE` 503 -> "not set up / try later" (e.g. photo uploads); `INTERNAL` 500 -> generic + request id in Sentry (foundations 1.6, 3.2).
- **Timeouts:** 15 s JSON, 10 s for reads that have a cached fallback, 60-120 s uploads with progress (offline 1.3). **Cancellation:** every query passes TanStack's `signal`; unmount/key change cancels; `CancelledError` is silent.
- **Retries (reads only):** 2-3 with exponential backoff + full jitter, none on 4xx; writes are never auto-retried outside the outbox (the API has no idempotency key today, foundations 8.13).
- **Pagination:** page-based, matching the API (not cursor): query `page`, `pageSize` (<=100, UI uses 20-30), `search`, `sortOrder`; response `PaginatedDto<T> = {items,page,pageSize,total,totalPages}` from contracts. Use `useInfiniteQuery` with `getNextPageParam = last.page < last.totalPages ? last.page + 1 : undefined`, `maxPages` 5-8, de-dupe by `id` (rows shift between pages). Some endpoints return plain arrays (`GET /api/todos/mine`): check each DTO. (The offline research suggested cursors: not available server-side today.)
- **Types come from contracts only:** response `Dto` types and zod schemas imported from `@vastu/contracts`; validate request bodies with the schema before sending; do not `.parse` responses in production paths (cost); parse in tests against fixtures. Hand-copied wire types are forbidden (greynote's copy is dropped).
- **Uploads:** port greynote's XHR `apiUpload` for multipart (RN `fetch` refuses `{uri,name,type}` parts), text fields before the file, same 401-refresh-once wrapper. The signed-ticket flow (sign -> POST to `ticket.url` with `ticket.fields` first then the file in `ticket.fileField` -> send `ImageInputDto`) is in foundations 3.7. Direct-to-Cloudinary vs API relay is a decision for the native/offline docs.
- **Money and dates:** money is whole rupees (integers), not paise, unlike greynote (foundations 3.5). "Today" is the business date in `Asia/Kolkata` (`businessDate()`), never the phone's zone; calendar fields travel as `YYYY-MM-DD` / `YYYY-MM`; instants as ISO UTC (foundations 3.4).
- Never client-filter for security: trust 404 as "not yours"; render action buttons from server `can{}` blocks where present (complaints), from the role only for navigation.

## 6. Data layer (TanStack Query)

`src/lib/query/client.ts`: one `QueryClient`, `defaultOptions.queries`: `staleTime` 30 s, `gcTime` 7 days (must be >= persister `maxAge`), `retry` per section 5, `networkMode: 'offlineFirst'`, `refetchOnReconnect: true`. Provider is `PersistQueryClientProvider` (so queries do not race the async restore) with an async persister on `expo-sqlite/kv-store`, `maxAge` 7 days, throttle 1 s, `buster` = `${APP_VERSION}-${CACHE_SCHEMA}` (bump on contracts changes that alter cached shapes).

- **Managers:** `focusManager.setEventListener` from `AppState` (`active` = focused; skip on web); `onlineManager.setEventListener` from NetInfo with `NetInfo.configure({reachabilityUrl: <api>/health, reachabilityTest})` and `online = isConnected && isInternetReachable !== false` (captive portals report "connected"; offline 2.9). The outbox must still try after 60 s even when NetInfo says offline.
- **Query keys:** `[module, entity, params]` defined in `src/lib/query/keys.ts`; all invalidation goes through helpers.
- **Persistence allow-list** (`dehydrateOptions.shouldDehydrateQuery`: only keys flagged `meta.persist === true`, status `success`): my profile/role, today's attendance state, my assigned leads/projects (list + detail), my to-dos, last ~50 chat messages per project (text + thumb URLs), static lookups (stages, designations). **Never persisted:** tokens (SecureStore), proposals with prices for customers, other staff's personal data, salary/dashboard money, search results, admin/HR lists, full-size images (expo-image disk cache). Cache and outbox are per user; a user switch or logout clears both.
- **Staleness:** lookups 24 h; lists 30-60 s; chat 5-10 s while focused; dashboard 60 s. Show "Updated 14 min ago" from `dataUpdatedAt` when offline and older than `staleTime`.
- **Polling policy** (foreground only, `refetchIntervalInBackground: false`; no push exists yet, foundations section 6):

| Screen state | Policy |
|---|---|
| Notification unread count (header bell) | 30 s while foreground + on focus (web parity) |
| Project chat/feed thread open | 10 s (15 s on cellular), pause offline, slow down 10 -> 20 -> 30 s on empty polls |
| Lead / proposal / complaint / to-do lists | refetch on focus + `staleTime` 30 s, no interval |
| Dashboard | refetch on focus, 60 s `staleTime`, no interval (web polls 60 s; mobile does not) |
| Anything in the background | none |

  When FCM lands the push is a doorbell: payload `{type, entityId}` -> `invalidateQueries`; never trust a push for state (greynote principle).
- **Optimistic updates:** only the web's three: lead status move, to-do check/uncheck, notification reads (rollback with a toast on error). Everything else waits for the server. Offline-capable writes are rendered as server data merged with pending outbox rows (no rollback logic; offline doc). Endpoints for offline writes should be set-state, not toggle.
- Mutations that are online-only disable their button offline with "Needs internet" and a single in-flight guard.

## 7. State, navigation and deep links

### 7.1 Role detection and route groups

Role comes from `user.role` (login response, then `/me`); the JWT carries only `sub` and `role`, so decode nothing client-side beyond that. `src/constants/roles.ts` holds `role -> { landing, tabs[] }` (the scope/navigation doc owns the matrix; code mirrors foundations 2.5: ADMIN/HR land on the dashboard, SALES on leads, TECHNICIAN on complaints, DESIGNER/OFFICE/CUSTOMER on projects).

**Decision (proposed): one `(tabs)` layout whose visible tabs derive from the role config, plus `Stack.Protected` guards around capability groups** (`staff`, `admin`, `customer`) for the screens only they may open. Alternative from research: one top-level group per role, each with its own `Tabs`. Why not: staff and customer both need `/projects` and `/complaints` tab URLs, and Expo Router cannot hold the same URL in two groups; per-role groups would also duplicate seven layouts. Tabs: at most 5 slots, over 5 shows the first 4 plus a "More" sheet, slot height >= 56 (web parity); customers get two fixed tabs (Project, Complaints).

Guards are UX only: the API enforces roles (403 = never, 404 = hidden). A screen shows the calm not-found view on `isNotFound`. Role changes at `/me` re-evaluate guards automatically (protected route becoming inaccessible redirects).

### 7.2 Error boundaries

Root boundary in `_layout.tsx` (reload button + Sentry report); `ErrorBoundary` export in each `(app)` group layout; per-screen boundaries around lists, media viewers and the chat. Boundaries do not catch async/handler errors: Sentry's global handler does. Every list has loading (skeleton), empty, error-with-retry, forbidden/not-found and offline states (foundations 3.2).

### 7.3 Deep links and App Links

- Scheme `vastukitchen://` (set in `app.json`) for dev and fallback; production links are https on the web domain (`WEB_BASE_URL`, TBD with the owner) with Android `intentFilters` `autoVerify: true` and `/.well-known/assetlinks.json` listing both the EAS upload and the **Play App Signing** SHA-256 (native 3.5). iOS Associated Domains only if iOS ships.
- Routes that must resolve: `/invite/[token]`, `/projects/[id]?tab=feed|todos|docs|activity&feed=client|team&post=&todo=&file=`, `/complaints/[id]`, `/leads/[id]`, `/proposals/[id]`, `/todos/[id]`. The public proposal link `/p/{token}` keeps opening in the web (in-app browser) unless a native renderer is designed.
- Notification `ref` kinds `LEAD|PROPOSAL|PROJECT|TODO|COMPLAINT` (+ `postId`, `projectId`, `fileId`) map to those routes in one function `routeFor(ref)`; the app fetches and the API authorizes, no private data in payloads. Handle cold start with `getLastNotificationResponse()` and warm taps with a response listener, deduped by notification id; fall back to the notifications list.
- A link opened while signed out: store the intended path in memory, run login, then `router.replace(path)`; if the user lacks access, show not-found, not an error.
- WhatsApp's in-app browser may open links in its own webview first: the web page keeps an "Open in app" button and a store link.

## 8. Offline and background (pointer)

The offline doc owns the SQLite outbox, drain loop, idempotency and conflict rules. Constraints this doc fixes: outbox rows live in a SQLite database separate from the query-cache kv-store; the drain loop is the only code that sends queued writes; `useAutoSync` equivalents mount in the root layout (start, reconnect, AppState active, debounce after outbox change); background tasks are best-effort and never refresh tokens (4.4 rule 1). Offline is **not** offered for login/OTP, proposal send, deletes, admin/HR actions or shared-record edits.

## 9. i18n and formatting

- `i18next` + `react-i18next` + `expo-localization`, initialised in `src/i18n/index.ts` before the splash hides. English only at launch but **no literal in JSX**: `t('attendance.checkIn.button')`, semantic keys, one namespace per feature, named placeholders and `_one/_other` plurals. Lint with `eslint-plugin-i18next` `no-literal-string` (version UNVERIFIED). Pseudo-locale in dev. Phase 1 hi (staff), phase 2 bn; `I18nManager.allowRTL(false)`.
- Server `message` is shown as returned (English); client copy for its own states goes through `t()`. Branch on `code`, never write copy per message string.
- `src/lib/format.ts` is a port of `apps/web/lib/format.ts` (`formatINR`, `formatINRShort`, `formatDate` `12 Nov 2026`, `formatTime` `3:40 PM`, `businessDate`, `addDays`, `relativeAge`, `formatDuration`, `initials`); all in `Asia/Kolkata` regardless of device zone. **Decision (proposed):** extract it to a new `packages/format` (`@vastu/format`, pure TS) used by mobile now and by web later, with the web's existing `format.test.ts` moving with it. Alternative: copy into mobile (drift risk). Hermes `Intl` for `en-IN` grouping and `timeZone: 'Asia/Kolkata'` is UNVERIFIED on Android: write `formatINR` as a deterministic lakh/crore grouper (`₹12,50,000`) and verify dates in a release build on Android 10 in sprint 1. Digits: always Western 0-9 for money and phones (`-u-nu-latn`). Phone: send 10 digits, display `+91 98765 43210`.
- Fonts: Plus Jakarta Sans discrete weights 400/500/600/700 via `@expo-google-fonts` (no variable fonts on Android); Indic text uses system Noto; never a fixed `lineHeight` under 1.5x for Indic (offline 6.4). Design-system doc owns the rest.

## 10. Performance budgets (own judgement, validate on a real 2-3 GB Android 10-14 phone; offline 3.2)

| Metric | Budget |
|---|---|
| Cold start to first usable screen (release) | <= 3 s on 3 GB, <= 5 s on 2 GB; no network call blocks first paint |
| Warm start | <= 1.5 s |
| JS bundle (Hermes bytecode) | <= 5 MB; CI fails on +10% vs main |
| Download size | <= 40 MB |
| Jank | < 5% frames over 16 ms on lead/chat lists; 55+ fps |
| Memory | < 250 MB RSS in a 500-message photo chat |

Levers: memoised rows with primitive props, `getItemType` for mixed chat rows, no inline closures in `renderItem`, thumbnails only in lists (w 160/320/640/1080 buckets, `f_auto,q_auto`; test `f_auto` on Android 10, fall back to `f_jpg`), upload compression to <= 1600 px long edge JPEG q 0.7 (300-600 KB) via `expo-image-manipulator`, lazy routes, no moment/lodash, strip `console.*` in release, split contexts by update frequency. Measure with `adb shell am start -W`, Sentry app-start, `dumpsys gfxinfo`.

## 11. Observability and PII

- `@sentry/react-native` via the Expo plugin; `SENTRY_AUTH_TOKEN` as an EAS secret for source maps; after `eas update` upload source maps; tag `role`, `appVersion`, `updateId`, `apiRequestId`. `sendDefaultPii: false`, session replay off, `user.id` = the Mongo user id only.
- **PII rules:** log ids, event names, status codes, durations, outbox counts. Never names, phone numbers, addresses, GPS, message text, file names, OTP codes, tokens, Authorization headers or request bodies. `beforeSend` and `beforeBreadcrumb` scrub URL query strings (phone/search), bodies and text-input breadcrumbs. Sentry data is declared in the Play Data Safety form.
- Capture `x-request-id` from every `ApiError` into the event so support can find the server log. A local ring buffer (last 500 lines, ids only) with a "Send diagnostics" button in Profile.
- No analytics or ad SDK at launch; first-party events to our own API only if needed.

## 12. Testing strategy

| Layer | Tool | Targets |
|---|---|---|
| Pure logic | `jest-expo` | `lib/api` (envelope parsing, error mapping, single-flight refresh with a fake fetch, persist-before-use order, no sign-out on network error), `lib/format`, role config, outbox state machine and ordering |
| Contract fixtures | `jest-expo` + contracts zod | parse recorded API responses for the last 2 released app versions against current schemas |
| Components / hooks | React Native Testing Library | forms (errors map to fields), role-gated nav, offline banner, query hooks with a mocked client |
| E2E | Maestro, Android emulator, `.maestro/*.yml` | 5-10 flows: login per role (use `OTP_DEV_MODE=true`, code `123456`, demo phones in foundations 5), create lead, send proposal link, complaint raise/resolve, chat send, offline capture then sync |
| Manual matrix | real devices | Xiaomi/Realme/Vivo/Samsung + Pixel; airplane mode, captive portal, 2G throttle, kill mid-upload, clock change, token expiry, Doze (`dumpsys deviceidle force-idle`) |

Author Maestro flows only after exploring the screen on a device or emulator and confirming the real element texts; use explicit waits, never fixed sleeps. Contracts and `lib/` tests must not need a device. Free EAS build minutes are tight: run Maestro against a prebuilt APK locally in CI.

## 13. Build, release, versioning, OTA

- `eas.json`: profiles `development` (developmentClient, internal), `preview` (internal, `android.buildType: "apk"` for staff sideload), `production` (`app-bundle`, auto increment), `appVersionSource: "remote"`; each sets `env.EXPO_PUBLIC_API_URL` (dev LAN / staging / production). `google-services.json` (FCM) is an EAS file secret, never in git. Unique `android.package` (and `ios.bundleIdentifier` if iOS ships); register the package with Android developer verification before 2027 (stack 6.2).
- EAS in a monorepo: install at the repo root, project root `apps/mobile`; verify against the EAS build reference at setup (UNVERIFIED details).
- Expo Go cannot run push or custom native config: use dev builds from day 1. Native dirs are generated (CNG): never edit `ios/` or `android/`; configure in `app.json`/config plugins. Inspect the merged manifest of every release AAB (`aapt dump permissions`) against the native doc's blocked list.
- **OTA (EAS Update)** with `runtimeVersion: { policy: "fingerprint" }`, `preview` channel first, staged rollout. Allowed: bug fixes, copy, layout, new screens using already-installed native modules, i18n strings. Forbidden: new permissions, new native modules, changed core purpose, SDK upgrades (need a new binary). Roll back by republishing. Customers' MAUs will pass the free 1,000 limit (no overage = updates stop): budget Starter/Production or skip OTA for customers (stack 6.1).
- **Force update:** the app sends `X-App-Version` / `X-App-Build` / `X-Platform` on every request and reads `GET /api/app/config` `{minVersion, latestVersion, storeUrl|apkUrl, maintenance}` on launch and foreground (cached 15 min, persisted). **That endpoint does not exist** (foundations 8.2): server doc. Below `minVersion`: blocking `(auth)/force-update` screen with the store/APK link, but let the outbox drain first if the API still accepts old writes. API rule: additive-only inside the current version, N-2 app versions supported, tolerant reader (unknown enum -> "other"). Outbox rows carry `schemaVersion`.
- Version = `app.json` version + EAS remote build number. Release checklist: `pnpm check`, `doctor`, `test`, `bundle-check`, manifest permission diff, Play Data Safety and privacy policy updated, reviewer demo login with a fixed OTP, account deletion path present.

## 14. Security checklist

- [ ] Refresh token only in SecureStore (`auth.refreshToken`); access token in memory only; no tokens in logs, Sentry, query cache, AsyncStorage, URLs.
- [ ] `android.allowBackup: false`; `installId` marker wipes stale keychain entries on iOS.
- [ ] HTTPS only in release; no cleartext flag outside the development profile; no certificate pinning in v1 (outage risk; revisit with payments).
- [ ] `X-Client: mobile` on every auth request; refresh single-flight; persist-before-use; network error never signs out.
- [ ] Logout and delete clear SecureStore, query cache, persisted cache, outbox, push token.
- [ ] No privileged secret in the bundle; `EXPO_PUBLIC_*` is public.
- [ ] Role guards are UX; every sensitive screen tolerates 403/404; no client-side filtering for security.
- [ ] Optional app lock (`expo-local-authentication`) after N minutes in background; local gate only, not an auth factor; default on for ADMIN/HR (native 3.6).
- [ ] Deny-list the permissions in native 4 (`READ_CALL_LOG`, `READ_SMS`, `READ_CONTACTS`, `READ_MEDIA_*`, background location ...); review the merged manifest per release.
- [ ] Rooted devices: detect and log only, do not block.
- [ ] Payload hygiene: strip photo EXIF location before upload; no PII in push payloads or deep links beyond ids.
- [ ] Sentry scrubbing verified with a test event containing a phone number.

## 15. Greynote: copy as is / adapt / drop

| Verdict | Item |
|---|---|
| **Copy as is** | `AGENTS.md` rules (opener edited); `storage.ts` (SecureStore key rule); `session.ts` store pattern; `api.ts` single-flight + XHR `apiUpload`; `use-form-errors` + `form-field` + `screen-shell`; themed primitives, `primary-button`, `text-field`, `skeleton`, `notice`, `segmented-tabs`, `choice-chips`, `use-responsive`; `use-color-scheme` (light only); root-layout pattern (splash, signed-out redirect, autosync mount); `lib/pdf-delivery.ts`, `lib/proof-picker.ts`, `lib/csv.ts` (only if a CSV export is in scope); `eslint.config.js`; `@/*` alias; `.env.example` pattern; `.claude/settings.json` |
| **Adapt** | `auth.ts` (OTP/password/invite, no device info, `LoginResult` kept); `api.ts` (envelope `code`, `ApiError.code`, timeouts, `AbortController`, `X-App-Version`, drop `X-Financial-Year`, access token memory-only); boot flow (offline-first cached user, refresh via first call); `types/auth.ts` -> contracts `UserDto`; `profile` (delete account + change password); `theme.ts` (Vastu tokens, same names); `features/catalog.ts` -> role tab config; offline engine (kinds, per-record auto-push, no single daily Submit); `public-config` -> `app-config`; `push.ts` (channels `leads`, `tasks`, `proposals`, `complaints`, `attendance`; endpoint is a server gap); hand-rolled `useCachedFetch` and stores -> TanStack Query + persister; Metro config (new); tsconfig; CLAUDE.md |
| **Drop** | Everything pharma (DCR, doctors, chemists, plans, leave, TA/DA, geofence, day-gate, financial year, targets, approvals); `device.ts` approval flow and `DEVICE_*` reasons; hand-copied `types/sync.ts` and "app does not depend on contracts"; `reset-project.js`, `animated-icon`, `web-badge`, `external-link`, `collapsible`, `tab-placeholder`; web output (`react-native-web`) unless a web target is chosen; `expo-glass-effect`, `@expo/ui`, `expo-symbols`, `expo-linear-gradient` unless design needs them; `brand-logo-data`, `payslip-html` |
| **Add (not in greynote)** | `eas.json`; `typecheck` and `test` scripts; Metro `.js` resolver; pnpm React override; turbo wiring; TanStack Query + persistence; Sentry; i18n; force-update gate; account deletion; Maestro flows; docs per feature |

## 16. Open items for the owner

1. SDK 58 vs 57, and `nodeLinker: hoisted` (touches web/api installs): confirm before the spike.
2. Contracts from source + Metro resolver vs dist build: confirm after the one-day spike.
3. Account deletion endpoint, `/api/app/config`, push-token registration, idempotency keys, OTP `retryAfter`: server work (server doc) that blocks release or offline.
4. Web domain for App Links and invite links (`WEB_BASE_URL`), Play/Apple organisation accounts (D-U-N-S lead time about 4 weeks), customer-app vs one-app-with-roles listing (native doc recommends two listings for a smaller Data Safety profile; the decision here is one app).
