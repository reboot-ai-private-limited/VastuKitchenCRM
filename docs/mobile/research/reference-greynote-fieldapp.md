# Reference study: Greynote `apps/fieldApp` (what Vastu mobile copies)

Read-only study of `/home/arjit/Work/rebootai/greynote` (apps/fieldApp, docs/mobile, docs/engineering, docs/LLD/sync.md). Paths below are relative to that repo unless marked VK (this repo). The Vastu mobile app should be "same to same" in architecture; section 9 is the copy / adapt / drop checklist.

Facts first (surprises worth knowing):
- fieldApp does **not** use `@greynote/contracts`, NativeWind or Tailwind, TanStack Query, zod, or EAS config. Types are hand-copied (`src/types/sync.ts`: "the app doesn't depend on that package, keep in step"), styling is `StyleSheet` + a theme hook, server state is a hand-rolled `useCachedFetch` + `useSyncExternalStore` stores. `global.css` is only CSS variables for web fonts.
- There is **no `eas.json`**, no tests, no `metro.config.js`, no `babel.config.js`; it is the stock `create-expo-app` template (the `reset-project.js` script and `AnimatedSplashOverlay` are template leftovers) grown into a product.
- The app is Expo SDK 57, React Native 0.86, React 19.2.3, TypeScript 6, React Compiler + typed routes on.

## 1. Folder layout (`apps/fieldApp`)

```
apps/fieldApp/
  AGENTS.md  CLAUDE.md  README.md  app.json  package.json  tsconfig.json  eslint.config.js
  expo-env.d.ts  .env.example  .gitignore  .claude/settings.json (enables expo plugin)  .vscode/
  assets/                images (icon, android-icon-*, splash-icon*, notification-icon), expo.icon (iOS)
  docs/mobile-app-plan.md   the staged plan (Stage 0..7) + per-stage "built / phone-tested / NOT yet run" status
  scripts/reset-project.js  template leftover (drop)
  src/
    app/                 expo-router ROUTES ONLY (flat, ~50 files) 
      _layout.tsx        root Stack (headerShown:false), ThemeProvider, mounts useAutoSync + usePush + OfflineBanner,
                         signed-out redirect effect
      index.tsx          in-app splash: restoreSession -> loadCurrentUser -> /(tabs) or /login
      login.tsx, device-status.tsx, profile.tsx, change-password.tsx, inbox.tsx ...
      (tabs)/_layout.tsx -> <AppTabs/>;  (tabs)/{index,docs,reports,team}.tsx
      feature/[key].tsx, approval/[id].tsx, dcr-report/[id].tsx   dynamic routes
      <feature>.tsx      one flat file per stack screen (daily-plan.tsx, expenses.tsx, ...). Big screens
                         are thin: they render a component from src/components (e.g. dr-call.tsx -> CallScreen)
    components/          ~70 flat files, kebab-case.tsx; sub-folders only team/ and ui/
                         primitives: themed-text/view, primary-button, text-field, date-field, form-field,
                         choice-chips, segmented-tabs, skeleton, notice, screen-shell, offline-banner, sync-chip,
                         user-avatar, zoomable-image, ...; app-tabs.tsx (+ app-tabs.web.tsx)
    hooks/               use-theme, use-color-scheme (always 'light'), use-responsive, use-form-errors,
                         use-current-user, use-push, use-day-gate, use-is-manager, feature hooks
    lib/                 NON-UI logic, one file per concern: api.ts auth.ts session.ts storage.ts device.ts
                         push.ts location.ts public-config.ts csv.ts exports.ts pdf-delivery.ts proof-picker.ts
                         doctor-photo.ts inbox.ts money.ts ... plus one data-access file per feature
                         (approvals.ts, planning.ts, leave.ts ...)
    offline/             the offline engine (section 4): types store(.web).ts sqlite-store memory-store outbox
                         engine cache cached-fetch connectivity hooks index settings order day ...
    constants/theme.ts   Colors{light,dark}, Accents, Gradients, Fonts, Spacing, MaxContentWidth
    features/catalog.ts  the Home tile catalogue (key -> route, section, gate)
    types/               auth.ts (SessionUser, LoginResponse, DeviceBlockReason), sync.ts (hand-copied server shapes)
    global.css           CSS vars for web fonts only (imported from theme.ts)
```

Conventions: kebab-case files; `@/*` -> `src/*` alias (tsconfig paths); import `router/Link/useLocalSearchParams` from `expo-router` only; non-route code never under `src/app/`; platform forks by suffix (`store.web.ts`, `app-tabs.web.tsx`, `animated-icon.web.tsx`); light theme only (`userInterfaceStyle: "light"` + `useColorScheme` hard-wired to 'light'; never import RN's `useColorScheme`); screens read the user only through `useCurrentUser()`; tablet-ready via `useResponsive()` (`TABLET_MIN_WIDTH` 768, columns 2/3/4) + centred `MaxContentWidth`.

## 2. Versions (package.json, verbatim)

expo `~57.0.31`; react / react-dom `19.2.3` (exact); react-native `0.86.3`; react-native-web `~0.21.0`; expo-router `~57.0.29`; react-native-reanimated `4.5.1`; react-native-worklets `0.10.1`; react-native-gesture-handler `~2.32.0`; react-native-screens `~4.26.0`; react-native-safe-area-context `~5.7.0`; @react-native-community/netinfo `12.0.1`. Expo modules all `~57.0.x`: application, asset, constants, crypto, device, document-picker, file-system, font, glass-effect, image, image-picker, intent-launcher, linear-gradient, linking, location, notifications, print, secure-store, sharing, splash-screen, sqlite, status-bar, symbols, system-ui, web-browser; `@expo/ui ~57.0.26`.
Dev: typescript `~6.0.3`, eslint `^9.39.5`, eslint-config-expo `~57.0.2`, @types/react `~19.2.2`.
Scripts: `start|android|ios|web` (`expo start ...`), `lint` (`expo lint`). No `typecheck`/`test` script (run `npx tsc --noEmit`). Package name `fieldapp`, `private: true`, `main: expo-router/entry`.
`app.json`: `scheme`, `userInterfaceStyle: light`, `orientation: default`, android `package` + `googleServicesFile ./google-services.json` + `predictiveBackGestureEnabled:false`, `web.output:static`, `experiments: { typedRoutes:true, reactCompiler:true }`. Plugins: expo-router; expo-notifications (icon, color, defaultChannel); expo-location, expo-image-picker (permission strings, `microphonePermission:false`); expo-splash-screen (image + android padded variant); expo-sqlite; expo-sharing.
`tsconfig.json`: `extends expo/tsconfig.base`, `strict:true`, paths `@/*`->`./src/*`, `@/assets/*`->`./assets/*`, include `**/*.ts(x)`, `.expo/types/**/*.ts`, `expo-env.d.ts`. No project references; it does not extend the monorepo base. `eslint.config.js`: `defineConfig([expoConfig, {ignores:['dist/*']}])` (eslint-config-expo/flat).
`.env.example`: only `EXPO_PUBLIC_API_URL` (with `/api`, no trailing slash); never put secrets in `EXPO_PUBLIC_*`.

## 3. Auth / session / refresh (reimplementable spec)

Files: `src/lib/{api,auth,session,storage,device}.ts`, `src/types/auth.ts`, `src/app/{index,login,_layout}.tsx`.

**storage.ts** `storage.get/set/remove(key)` - `expo-secure-store` on native, `localStorage` on web. SecureStore keys allow only letters, digits, `.`, `-`, `_` (a `push:off` key threw on every read; use `push.off`). Keys in use: `accessToken`, `refreshToken`, `user` (JSON), `deviceId` (web fallback), `push.off`.

**session.ts** (module-level store, no React context):
- Memory: `user`, `tokens`, `listeners`. `setSession(loginResponse)` stores both tokens + user in memory and storage then `emit()`. `setTokens({accessToken, refreshToken})` stores a rotated pair (no emit). `setUser(u)`. `getTokens()`. `restoreSession(): Promise<boolean>` loads all three keys; false if any missing or JSON bad (says "exists", not "valid"). `clearSession({byServer?})` nulls memory, removes the 3 keys, emits, and sets an `endedByServer` flag read once by `takeSignedOutNotice()` so Login can show "you were signed out". `useSessionUser()` = `useSyncExternalStore` over `listeners`.

**api.ts**:
- `API_BASE_URL`: `EXPO_PUBLIC_API_URL` (trailing `/` stripped) else `http://<Constants.expoConfig.hostUri host>:3000/api` (phone in Expo Go reaches the PC LAN IP) else `10.0.2.2` (Android emu) / `localhost`.
- `ApiError(status, message, data?)` and `NetworkError` (no HTTP response). Envelope: `{success:false, statusCode, code, message, data?}`; success `{success:true, data}`. `send()` always sets `Content-Type: application/json` and **`X-Client: mobile`** (without it the server treats the caller as a browser and keeps the refresh token out of the body), adds `Authorization: Bearer <access>` when given, throws `ApiError` when `!response.ok || !json.success` using `json.message` and `json.data` (this is how login device-block `data.reason` reaches the UI), `NetworkError` when `fetch` throws.
- **Single-flight refresh**: module var `refreshing: Promise<boolean> | null`; `refreshTokens()` does `refreshing ??= (async()=>{...})().finally(()=>refreshing=null)`. Inside: `POST /identity/auth/refresh` with `{refreshToken}` (unauthenticated `send`), `setTokens(next)`, return true. On `NetworkError` it rethrows (never log out on a dropped connection); on `ApiError 401` it calls `clearSession({byServer:true})` and returns false; other errors return false. Reason: the server rotates refresh tokens and reuse of a rotated one is treated as theft and revokes every session, so parallel 401s must share one promise.
- `request(method,path,body,{auth,fy})`: if `!auth` plain send; else send with current token; on `ApiError` with status 401 -> `await refreshTokens()`; if it returned false rethrow the original 401; else retry **once** with the new token. Exports `apiGet/apiPut/apiPatch/apiDelete` (auth default true) and `apiPost` (auth only when `{auth:true}` is passed, because login/refresh are unauthenticated POSTs). `X-Financial-Year` header is Greynote-only (drop).
- `apiUpload(path, file:{uri,name,mimeType}, method, fields)`: multipart via RN `XMLHttpRequest` + `FormData.append('file', {uri,name,type})` (RN fetch refuses that part form, and Expo Go refuses FileSystem READ on picker cache); sets `X-Client`, Bearer, no Content-Type (boundary auto), 60 s timeout, text fields appended **before** the file, same 401-refresh-once wrapper. Reuse for Vastu photo uploads.

**auth.ts**: `login(employeeCode,password)` -> `getDeviceInfo()` + `apiPost('/identity/auth/login', {..., ...device})` -> `setSession(data)` -> `prepareForUser(user.id)` (wipes offline data if a different user logs in on this phone); returns a discriminated `LoginResult {ok:true} | {ok:false,kind:'device',reason,retryAfter,limit} | {ok:false,kind:'error',message}`. `loadCurrentUser()` = `GET /identity/auth/me` + `setUser`. `changePassword()` posts the current `refreshToken` so this phone stays signed in. `logout()`: if online try `backupDrafts()` (best effort), `POST /identity/auth/logout {refreshToken}` (swallow errors), `clearSession()`, `resetOfflineData()`. A session that merely *expires* keeps queued records; only explicit logout or a different user clears the phone.

**device.ts** `getDeviceInfo()` -> `{deviceId (Application.getAndroidId / getIosIdForVendorAsync / web generated+stored), deviceName, deviceModel, platform: ANDROID|IOS|WEB}` for the server's device-approval registry. **Drop for Vastu** unless the API has device approval (it does not per this study); keep `deviceId` only for the push-token registration.

**Boot flow** (`src/app/index.tsx`): `Promise.all([restoreSession(), 600ms delay])`; if a session: `loadCurrentUser()` (refreshes the token transparently); `ApiError 401` -> `/login`; any other error (offline/5xx) -> trust the saved user, open `/(tabs)` (offline-first). Native splash: `SplashScreen.preventAutoHideAsync()` in `_layout.tsx` + `AnimatedSplashOverlay`.
**Signed-out redirect** (`_layout.tsx`): `useSessionUser()`; a `wasSignedIn` ref; on signed-in -> null, `if (router.canDismiss()) router.dismissAll(); router.replace('/login')` (clear the stack first or Android back reopens the app).

**Vastu adaptation (OTP, X-Client: mobile, refresh in body):** keep `api.ts`, `session.ts`, `storage.ts`, single-flight refresh verbatim; replace `login()` with two calls (`requestOtp(phone)` -> `verifyOtp(phone, code)` returning the same `setSession` payload; keep the discriminated `LoginResult` for errors such as wrong code / rate limited / `retryAfter`); replace `employeeCode/password` and device-block reasons with OTP errors; `changePassword` and `delete-account` become `delete-account` only (Play Store requirement; Greynote has `docs/mobile/account.md` for it). Take paths and body shapes from `@vastu/contracts` auth (`packages/contracts/src/auth.ts`, `identity.ts`), not from Greynote.

## 4. Offline outbox / sync (src/offline) - reuse vs pharma-specific

**Model** (docs/LLD/sync.md, docs/hld/01): the phone creates records locally with client UUIDs (`expo-crypto randomUUID`, also the server idempotency key); nothing counts until a single **Submit** pushes the set; a private **draft backup** runs whenever online so a lost phone loses nothing; the server's answer wins.

**State machine** (`offline/outbox.ts`):
```
DRAFT --queueRecord--> QUEUED --pushPending--> SYNCED
  ^                      |  \--> FAILED (server refused; stays editable)
  +---- updateRecord ----+<------+  (FAILED + edit => QUEUED again; DRAFT edit => DRAFT)
removeRecord (DRAFT/FAILED only) => deleted=true tombstone until the backup tells the server, then purged
SYNCED / QUEUED cannot be edited or removed (throws)
```
`OutboxRecord` fields: `clientId, kind, payload, dependsOn[], status, clientCreatedAt, clientUpdatedAt, serverId, serverData, errorCode, errorMessage, attempts, deleted, dirty`. API: `createRecord(kind,payload,{dependsOn,clientCreatedAt,status})`, `updateRecord`, `queueRecord`, `removeRecord`, `forgetSyncedRecord`, `getRecord`, `listRecords`, `countByStatus`, `countUnsent` (logout warns when non-zero), `subscribeOutbox/notifyOutboxChanged`.

**Store** (`offline/types.ts` `Store` interface; `store.ts` = `SqliteStore`, `store.web.ts` = memory): `upsertRecord/getRecord/listRecords/listTombstones/purgeRecords`, `getCache/setCache/touchCache/listCacheVersions`, `getMeta/setMeta`, `clearAll`. SQLite (`expo-sqlite`, `PRAGMA user_version = SCHEMA_VERSION`): table `outbox(client_id PK, kind, payload JSON text, depends_on JSON text, status, client_created_at, client_updated_at, server_id, server_data, error_code, error_message, attempts, deleted, dirty)` + index `(status, client_created_at)`; `cache(source PK, version, data, fetched_at)`; `meta(key PK, value)`. All DB calls are serialised through a promise queue (overlapping calls on one connection made expo-sqlite reuse a released statement).

**Engine** (`offline/engine.ts`):
- `pull()` `GET /sync/pull?v[source]=<version>`: response `{serverTime, sources:{name:{version,unchanged}|{version,data}|{error}}}`; stores snapshots in `cache` (a failing source keeps its old snapshot; `unchanged` -> `touchCache`); stores `clockOffsetMs` (phone vs server) and `lastPullAt`; `notifyCacheChanged`.
- `pushPending(only?, {skipFailed})` `POST /sync/push {records:[{clientId,kind,dependsOn,clientCreatedAt,payload}]}`: selects QUEUED + FAILED (minus permanent refusals), `orderForPush` (topological, parents first; `offline/order.ts`), chunks of setting `SYNC_MAX_BATCH`, holds back children whose parent failed (`DEPENDENCY_FAILED`), per-record result `SYNCED | ALREADY_SYNCED | FAILED{reason}`; SYNCED -> store `serverId/serverData`, `dirty=false`; FAILED -> `errorCode/errorMessage`, `attempts+1`; a `NetworkError` sets `summary.offline` and stops (rest stays queued). Returns `PushSummary{sent,synced,failed,held,offline,error}`. Safe to rerun (idempotent).
- `backupDrafts()` `PUT /sync/drafts` (dirty non-SYNCED records as envelopes `{v:1,status,dependsOn,clientCreatedAt,payload}` + tombstones `{deleted:true}`; size cap `SYNC_MAX_DRAFT_BYTES`; results `STORED|STALE|SUBMITTED|REJECTED`; last-write-wins on `clientUpdatedAt`); `restoreDrafts()` `GET /sync/drafts` on a new phone; `pruneSynced()` drops SYNCED older than `SYNC_MAX_AGE_DAYS`.
- `runSync()` = single-flight `running ??=`: `sendStandalone` -> `pull` -> `refreshColleagues` -> `backupDrafts` -> `pruneSynced`; never submits. `refreshNow()` = a pull that never joins an in-flight sync. `resetOfflineData()` = `store.clearAll()` + reset status.
- `useAutoSync()` (`offline/hooks.ts`, mounted in root layout): `startConnectivityWatch()`; when signed in runs `runSync()` at start, on `onReconnect`, on `AppState` -> active, and 5 s debounced after any outbox change.
- `connectivity.ts`: NetInfo; `online = isConnected !== false && isInternetReachable !== false` (null = assume online); `isOnline()`, `onReconnect(fn)`, `useOnline()` (`useSyncExternalStore`).
- `cached-fetch.ts` `useCachedFetch<T>(key, fetcher, refreshKey)` -> `{data, fetchedAt, loading, error, stale, refreshing, reload}`: online-only data keeps its last copy in `meta` under `fetch:<userId>:<key>` (per user, so shared phones never leak); offline shows the copy marked `stale`; a failed fetch keeps the copy. `public-config.ts` is the same idea for `GET /config/public` flags (60 s refresh, persisted in meta).
- UI: `OfflineBanner` (root), `SyncChip`, `useOutboxCounts`, `useSyncStatus`, `useRecords(kinds)`.

**Reuse for Vastu** (domain-neutral): Store interface + SqliteStore + memory store + schema, `outbox.ts`, `order.ts`, `connectivity.ts`, `cached-fetch.ts`, `public-config.ts` pattern, `hooks.ts` (`useAutoSync` minus the `role==='FIELD'` check), `engine.ts` push/backup/pull skeleton, `OfflineBanner`/`SyncChip`, "online-only actions are disabled offline, no queued fallback" rule.
**Pharma-specific, drop**: `SyncKind` values (NEW_DOCTOR, DCR_SUBMIT, DOCTOR_CALL ...), `calls.ts`, `geofence.ts` (on-device Haversine), `day.ts`/`use-day-gate` (plan-approved gating, business day), `final-submit.ts` (the day-report Submit), `doctor-photos.ts`, `colleagues.ts`, `team.ts`, `local-draft.ts`, `STANDALONE_KINDS`, settings keys `DAY_START_TIME` / `DOCTOR_VISIT_GAP_DAYS`, `PERMANENT_REFUSALS` (DCR_SUBMIT_LATE ...), financial-year header, TA/DA, paise helpers only if Vastu stores money as paise (check VK contracts).
**Decision for Vastu**: Greynote commits everything at one daily Submit, which suits a daily report. Vastu (kitchen CRM: leads, quotes/proposals, complaints, site visits) likely wants per-record commit: reuse the same outbox but add an `autoPush` (standalone kinds sent immediately when online, then by background sync; Greynote's `STANDALONE_KINDS` does exactly this for orders/stock/gifts) and decide per kind which are online-only. Needs a `/sync/push` (+ optional `/sync/pull`, `/sync/drafts`) on `apps/api`; verify what VK API offers before designing.

## 5. Other `src/lib` patterns worth copying

- **Forms/validation**: validation is hand-written per screen (no zod). `useFormErrors(order: string[])` -> `{errors, fail(next), clear(name), clearAll, register, setScroll}`; `fail()` sets messages then after 100 ms scrolls to the first field in `order` (measureInWindow against `ScrollAreaContext` provided by `ScreenShell`). `<FormField form name outline>` wraps each input (registers its View; draws red outline+message for pickers/chips; `outline={false}` for `TextField`/`DateField`, which draw their own from an `error` prop). Server `message` is rendered as-is; branch on `code`/`status`, never write copy per code. Vastu: keep both, but validate with the `@vastu/contracts` zod schemas inside `fail()` mapping `issue.path[0]` -> field name.
- **Push** (`lib/push.ts`, `hooks/use-push.ts`): `notifications()` lazily `require`s `expo-notifications` and returns null on web and Expo Go (`ExecutionEnvironment.StoreClient`; importing it there crashes). `setUpForegroundPush()` handler (banner+list+sound). `registerForPush()`: Android only, real device only, honours `push.off`, `ensureChannel('default', HIGH)`, permission, `getDevicePushTokenAsync()` (raw **FCM** token, not Expo push token), `PUT /identity/auth/push-token {deviceId, token}` (404 = no live session yet, ignore). `watchPushToken` (token rotation), `watchPushArrived` (refresh unread count), `watchPushTaps` (+ `getLastNotificationResponse()` for cold start, deduped by notification id) -> `router.push(screenFor(data.route))` via a server-route -> app-route map, fallback `/inbox`. `disablePush/enablePush`. `getPushStatus()` shown on Profile for diagnosis. Principle: every push is also an Inbox message; the phone never trusts a push for state.
- **Location** (`lib/location.ts`): expo-location with a permission string in app.json. **Pickers**: `expo-image-picker` (`mediaTypes:['images']`, square crop, quality 0.7; gallery needs no permission, camera does; client-side type + 5 MB check, throws `PhotoPickError` with a displayable message) and `expo-document-picker` for PDFs (`proof-picker.ts`).
- **Files/PDF/CSV** (`lib/csv.ts`, `pdf-delivery.ts`, `exports.ts`): CSV built on the phone (`toCsv` adds BOM + CRLF for Excel), written with `expo-file-system` `new File(Paths.cache, name)`. PDFs: HTML string -> `expo-print printToFileAsync({html,width,height,base64:true})` -> write to cache. `chooseCsvAction` Alert -> Open / Share / Download. Open on Android: `getContentUriAsync` (from `expo-file-system/legacy`) + `expo-intent-launcher startActivityAsync('android.intent.action.VIEW',{data,type,flags:1})`, iOS falls back to share sheet. Share: `expo-sharing shareAsync`. Download: `Directory.pickDirectoryAsync()` then `createFile` (name clash -> timestamp suffix). File names carry person + kind + month + code. Vastu proposals/quotes PDFs: reuse `pdf-delivery.ts` as is, or download server PDFs with `File.downloadFileAsync` then share.
- **Theme** (`constants/theme.ts`, `hooks/use-theme.ts`): `Colors.light/dark` semantic tokens (text, background, backgroundElement/Selected, textSecondary, primary, onPrimary, border, placeholder, danger, warning), `Accents` pastel tile palettes, `Gradients`, `Fonts` (Platform.select), `Spacing` scale (`Spacing.one..`), `MaxContentWidth`. `ThemedText` takes `type` + `themeColor`, `ThemedView`. Components use only tokens.

## 6. AGENTS.md / CLAUDE.md rules to carry over

**AGENTS.md (Expo template; keep verbatim, only the opener is edited):**
- "Expo has changed - do not trust your training data": read `expo` major from package.json, fetch `https://docs.expo.dev/versions/v<major>.0.0/`, and `https://docs.expo.dev/llms.txt` for anything else; never answer from memory.
- Commands: `npx expo install <pkg>` ALWAYS instead of pnpm add (SDK-compatible versions); `npx expo start|lint`, `npx tsc --noEmit`, `npx expo-doctor`, `npx expo install --fix`. "Run lint and typecheck before declaring any task done."
- Expo Router for all navigation; routes in `src/app/`, non-route code outside; imports from `expo-router`.
- EAS: `npx eas-cli@latest <cmd>`; CNG rule: if `ios/` and `android/` do not exist never create/edit them, configure in `app.json` + config plugins.
- Expo Go only has bundled native modules; after adding native code use a dev build (`npx expo run:android` / `eas build --profile development`).
- Prefer Expo modules over third-party libs.

**CLAUDE.md (adapt):** `@AGENTS.md` import line; "What this app is" paragraph; "Current state" (keep a live, honest status: which screens/endpoints are real vs mocked); list of backend endpoints that exist; screens/tab structure; conventions - Expo Router; `@/*` alias; light-theme-only + `useTheme()/ThemedText/ThemedView` and never RN `useColorScheme`; typed routes + React Compiler on ("don't fight either; regenerate types rather than cast"); offline rules ("screens create records with `createRecord/queueRecord`, never call the server for queued kinds; `pushPending()` is the only sender; `runSync()` runs by itself"); "Every request must send `X-Client: mobile` or the server withholds the refresh token"; "Money is integer paise" (Vastu: confirm with `@vastu/contracts`); commands incl. `pnpm --filter <name> <script>`. Replace GPS/geofence and HLD references with Vastu equivalents; delete the stale line saying the local store is undecided.

**Repo-level docs/engineering** worth mirroring in VK: `monorepo-layout.md` (where-new-code-goes table), `frontend-architecture.md` ("rule for a new screen": route -> Screen -> hook -> endpoint -> contracts type; "render the server's `message`, branch on `code`"; money paise; Asia/Kolkata dates; tokens only; "`/design`" gallery), `coding-standards.md` (strict TS, errors, comments explain why, commit prefix by app e.g. `fieldApp:` / `mobile:`). Greynote's apps/fieldApp CLAUDE.md says "Run lint and typecheck before declaring any task done" - keep.

## 7. Monorepo and contracts wiring (and pitfalls)

Greynote: `pnpm-workspace.yaml` = `apps/*`, `packages/*`; `turbo.json` tasks build/typecheck/lint/test/dev (`dependsOn ["^build"]`, dev not cached); root `package.json` scripts `dev|build|typecheck|lint|check|format`; `devEngines.packageManager` pnpm 11.18; `allowBuilds` block for postinstalls. fieldApp is a workspace member (`pnpm --filter fieldapp <script>`) but is **isolated from the other packages**: no `@greynote/*` dependency, no Metro config, no tsconfig reference. Root `pnpm-workspace.yaml` holds:
```yaml
overrides:
  react: 19.2.3
  react-dom: 19.2.3
```
with the comment: a second React in one render gives "Cannot read properties of null (reading 'useRef')" during prerender, so `apps/web` follows the mobile app's React.

**Pitfalls for Vastu (checked in VK):**
1. **React version clash.** `VK apps/web/package.json` has `react 19.3.1` / `react-dom 19.3.1`; Expo SDK 57 needs `19.2.3` exactly. Add the same pnpm `overrides` (and pin web to 19.2.3) or the app will break at runtime. Also check `react-native`/`@types/react` single-copy; if resolution still duplicates React under pnpm, add `node-linker=hoisted` for the app or Metro `resolver.extraNodeModules` pinning `react`.
2. **Contracts are ESM TypeScript source with `.js` import specifiers.** `VK packages/contracts` has `"type":"module"`, `exports: {".": "./src/index.ts"}`, `src/index.ts` does `export * from './<domain>.js'`, base tsconfig is `module/moduleResolution: NodeNext`. Metro does **not** map `./auth.js` to `auth.ts`: a mobile import of `@vastu/contracts` will fail to resolve. Options: (a) add a `resolver.resolveRequest` in a new `apps/mobile/metro.config.js` that retries `.js` -> `.ts/.tsx` for relative specifiers inside `packages/contracts`; (b) have contracts emit a built `dist` (JS + d.ts) and point `exports` at it (turbo `^build` already runs before typecheck); (c) hand-copy types as Greynote does (rejected: the VK contracts header says zod is the source of truth). Recommended (a) or (b); decide in the monorepo doc.
3. **Metro monorepo config** (needed because the app will import a workspace package; Expo SDK 52+ auto-configures `watchFolders` and `nodeModulesPaths` for monorepos, so start with the default `expo/metro-config` `getDefaultConfig(__dirname)` and only add the `.js` resolver). Package must be in `dependencies` as `"@vastu/contracts": "workspace:*"`. Also `unstable_enablePackageExports` behaviour: `exports` with a plain string works.
4. **tsconfig**: the app extends `expo/tsconfig.base` (bundler resolution, `jsx: react-native`), not `@vastu/config/tsconfig.base.json` (NodeNext, `noEmit`, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`). Type-checking contracts source from the app under bundler resolution is fine with `.js` specifiers (TS maps them) but the app's looser flags apply to that code; contracts' own `typecheck` still guards it.
5. **zod 3.24** is what VK contracts uses; web too. Mobile must use the same major (single copy via `workspace:*` + same range) so `z.infer` types stay compatible. Zod runs fine under Hermes; keep schemas free of Node-only imports (`types:["node"]` in contracts tsconfig - make sure no `node:` imports leak into schemas the app imports).
6. `pnpm add` can pick non-SDK versions: always `npx expo install`. Put `expo`-managed packages through `expo install --fix` after any change. pnpm `minimumReleaseAgeExclude` was needed in Greynote for fresh Expo patch versions.
7. Add the app to `turbo.json` only for `typecheck`/`lint` (no `build`: Expo does not emit `dist` for turbo; Greynote's outputs `dist/**`,`.next/**` do not apply). Greynote's root `check` = `turbo run typecheck lint`; its fieldApp has no `typecheck` script, so turbo skipped it - give VK's mobile app `"typecheck": "tsc --noEmit"` so it is actually covered.

## 8. Build / distribution notes

- Greynote has **no `eas.json` and no recorded build pipeline**; docs/engineering/build-and-deploy.md covers only api/web Docker. AGENTS.md says "Use EAS ... `eas build --profile development`". `app.json` carries `android.package: com.greynote.app` and `googleServicesFile ./google-services.json` (FCM; the file is gitignored/secret) which means builds are native (dev build or APK), not Expo Go, for push. In Expo Go: push, and anything native outside the bundled set, does nothing - the code guards for it (`notifications()` returns null).
- Dev loop: `pnpm start`, phone in Expo Go on the same LAN (API URL derived from the Metro host, API on port 3000), Android emulator via `10.0.2.2`.
- Vastu should add: `eas.json` with profiles `development` (developmentClient, internal), `preview` (internal distribution, `android.buildType: "apk"` for sideload/WhatsApp-able testing), `production` (`app-bundle`, autoIncrement), each setting `env.EXPO_PUBLIC_API_URL`; `runtimeVersion` policy + `expo-updates` only if OTA is wanted (not used in Greynote); keep `google-services.json` out of git and supply it as an EAS file secret; unique Android `package` and iOS `bundleIdentifier`; Play requires an in-app account-deletion path.
- No tests exist in fieldApp; logic was verified by throwaway checks (e.g. geofence "matches the server on 20,000 random cases") and phone runs, with status recorded in `docs/mobile-app-plan.md` ("NOT yet run on a phone"). Vastu: add `vitest` or `jest-expo` for pure `lib/` and `offline/` logic (outbox order, state machine, refresh single-flight) since those are React-free by design.

## 9. Doc format template (`docs/mobile/*.md`)

Representative files: `docs/mobile/doctors.md`, `account.md`, `dcr.md`; roll-up: `field-app-gaps.md`; plan: `apps/fieldApp/docs/mobile-app-plan.md`. They are server-contract docs written for the (other) mobile team. Structure to copy:

```markdown
# Mobile - <Feature name>

<One-paragraph purpose: what the field app must do and which rules the server enforces. The server is the authority.>
Companion to [`other.md`](other.md). Plan date YYYY-MM-DD. Related: decision-log YYYY-MM-DD.

**Status key:** ✅ built on the server and web. The phone app is <who>; this is the contract it builds against. 📱 = the phone shows it.
**Field app, checked YYYY-MM-DD (typechecked and linted, not yet run on a phone):** <what is built / not built>.

## 1. <Section, e.g. Adding a doctor>

| # | Rule | Status |
|---|---|---|
| 1 | <Rule in one paragraph: the endpoint (`POST /api/...` body `{...}`), who may do it, offline-first or online-only, the refusal code (`MANAGER_NOT_ALLOWED`, `403 FORBIDDEN`)> | ✅ |
| 2 | **Required:** `field`, ... **Optional:** ... | ✅ new |
| 3 | ... | ✅ changed |

Errors worth a message: `400` on `routeId` - "That route isn't one of yours."; `409` `data.reason = "X"` - <what to tell the user>; `429` ...

## 2. What the snapshot / list carries
<fields the phone reads; how to render them; offline behaviour: "keeps working offline from the snapshot's `x`">

## 2a. When <edge event> happens (YYYY-MM-DD)
| # | What happens | What the phone should do | Status |
|---|---|---|---|
| D1 | ... | ... | ✅ |

## 3. <Report/Screen>
`GET /path?month=YYYY-MM` - who reads what. Per-row field table (| Field | Use |). Bullet list of display rules.

## Route (for small docs, as account.md)
| Route | What it does |
|---|---|
| ✅ `POST /api/identity/auth/xyz` body `{...}` | ... `200` on success: the phone must ... |
Errors: `403` ...; `409` with `data.reason = "..."` ...

**Screen (📱):** <Where in the app, fields, buttons, copy, toast text, online/offline behaviour.>
```
Format rules visible across the files: dated headings and "(YYYY-MM-DD)" suffixes for every change; status marks ✅ built / 📱 phone shows / "new" / "changed"; numbered rules tables for contract rules, "what the phone should do" columns for events; exact endpoint + body + error code + `data.reason` strings; "Offline" or "needs a network connection (no offline queue)" stated per action; example copy in quotes; each doc ends with errors/edge cases; a gap tracker (`field-app-gaps.md`: tables A must change / B new / C needs server change / D requested / "Not a phone job") and a staged plan with per-stage "Built ... phone-tested / NOT yet run on a phone" honesty.

## 10. Copy as is / adapt / drop checklist for Vastu

**Copy as is**
- `src/lib/{api,session,storage}.ts` (rename envelope fields if VK differs; verify `{success,data}` / `message` / `data.reason` against `VK packages/contracts/src/http.ts` + `errors.ts`), single-flight refresh, `apiUpload` XHR multipart.
- `src/offline/{types,store,store.web,sqlite-store,memory-store,outbox,order,connectivity,cached-fetch,cache}.ts` and `hooks.ts`, `OfflineBanner`, `SyncChip`.
- `use-form-errors.ts`, `form-field.tsx`, `ScrollAreaContext`/`screen-shell.tsx`, `themed-text/view`, `primary-button`, `text-field`, `skeleton`, `notice`, `segmented-tabs`, `choice-chips`, `use-responsive.ts`, `use-theme.ts`, `use-color-scheme.ts` (light-only), `lib/csv.ts`, `lib/pdf-delivery.ts`, `lib/proof-picker.ts`, `lib/push.ts` + `use-push.ts` (change channel name, route map, endpoint).
- `AGENTS.md` verbatim; `.env.example` pattern (`EXPO_PUBLIC_API_URL`); `tsconfig` alias; `eslint.config.js`; `app.json` plugin set (router, notifications, image-picker, splash-screen, sqlite, sharing; add location only if used); `.claude/settings.json`; root-layout pattern (splash, signed-out redirect, useAutoSync, usePush).
- Package versions in section 2 (Expo 57 line), installed with `npx expo install`.

**Adapt**
- `auth.ts` (OTP request/verify instead of employeeCode+password; drop device approval), `types/auth.ts` (`SessionUser` from `@vastu/contracts`), `app/login.tsx` (phone -> OTP screens), `index.tsx` boot flow (same logic), `profile.tsx` (delete-account instead of change-password), `theme.ts` (Vastu brand tokens; keep names), `app.json` (name, slug, scheme, `android.package`, permission strings, notification colour/icon), `features/catalog.ts` -> Vastu home tiles, `(tabs)` set (Vastu roles/tabs from VK docs), `engine.ts` (kinds, endpoints, per-record auto-push vs single Submit), `public-config.ts` (Vastu flags), `exports.ts`/`slug.ts` file naming, CLAUDE.md, `docs/mobile/*.md` (VK has no `docs/mobile` yet: this research file's section 9 is the template).
- Types: import wire types and zod schemas from `@vastu/contracts` (departure from Greynote; see section 7 pitfalls) instead of hand copying.

**Drop**
- Everything pharma: DCR/doctor/chemist/plan/leave/expense/TA-DA/geofence/day-gate/financial-year/secondary-sales/targets/team-approval screens and libs; `device.ts` approval flow and `DEVICE_*` reasons; `X-Financial-Year`; `scripts/reset-project.js`; template components (`animated-icon*`, `web-badge`, `external-link`, `ui/collapsible`, `tab-placeholder`, `app-tabs.web.tsx` unless web is a target); `reactCompiler` stays on only if the build passes with it; `expo-glass-effect`, `@expo/ui`, `expo-symbols`, `expo-linear-gradient` unless the design uses them; `brand-logo-data.ts` and `payslip-html.ts`.

**Add (not in Greynote)**
- `eas.json` (dev / preview APK / production), a `typecheck` script, tests (vitest/jest-expo) for `lib/` and `offline/`, `metro.config.js` with the `.js`->`.ts` resolver (or built contracts), pnpm `overrides` for React 19.2.3, turbo `typecheck`/`lint` wiring for the app, and a `docs/mobile/` set following section 9 plus a gap tracker.
