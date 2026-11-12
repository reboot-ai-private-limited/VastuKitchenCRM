# Research: offline, performance, network, real-time, i18n, a11y, quality (Vastu Kitchen mobile)

Date: 2026-11-12. Scope: Expo / React Native app for staff on 2-4 GB Android 10-14 phones on patchy 4G, plus customers on any phone.
Convention: every external claim has a URL. "UNVERIFIED" = not confirmed on a primary source in this research pass. "(own judgement)" = my engineering recommendation, not a sourced fact.

---------------------------------------------------------------------

## 1. Recommendations (decisions first)

### 1.1 Offline
1. **Hand-roll a small write outbox; do not adopt a sync engine.** The offline-write surface is five action types (attendance, visit log, call-record upload, chat photo, to-do tick). A sync engine (PowerSync, WatermelonDB, ElectricSQL) replicates *data sets*; we need to replay *commands* against an existing REST API. PowerSync is the only one of the four with a GA MongoDB connector, but it adds a separate sync service to run and needs its own storage ([PowerSync/MongoDB summary via search](https://powersync.com/blog/react-native-local-database-options)); WatermelonDB is client-only and you still write the sync backend yourself; ElectricSQL is Postgres-only (all per the comparison summarised in the same search; UNVERIFIED on primary docs). MongoDB's own Atlas Device Sync is reported shut down 30 Sep 2025 ([search result, secondary source](https://frenchydigital.com/blog/offline-first-mobile-architecture-2026), UNVERIFIED). Revisit only if scope grows to offline *editing* of shared records (quotes, proposals).
2. **Read cache: TanStack Query + `PersistQueryClientProvider`, persisted to SQLite (`expo-sqlite/kv-store`) via an async persister, with an allow-list of query keys, `maxAge` = 7 days, `gcTime >= maxAge`, and a `buster` = app build/schema version.** Not MMKV (extra native dependency for little gain) and not raw AsyncStorage (see 4.1).
3. **Outbox table in `expo-sqlite` (not in the query cache)**: one row per action with client UUID (idempotency key), type, payload, `depends_on`, status, attempts, `next_attempt_at`, last error. Drain loop runs in the foreground when online + app active; it is the *only* reliable path. Treat background sync as a bonus.
4. **Server contract for idempotency (needs a small API change)**: accept `Idempotency-Key` header on the 5 offline endpoints and also accept a client-generated `clientId` (UUID v4/v7) stored with a **unique index** per collection. Where the server cannot be changed, make the client probe-before-retry (GET by clientId / list filter) before re-POSTing. Details in 4.2.
5. **Classify outcomes strictly**: network error / timeout / 408 / 429 / 5xx = retry with backoff+jitter; 401 = refresh auth then retry (never drop); 409 with same key = treat as "already applied", mark done; 400/403/404/410/413/422 = refused, move to a visible "Needs attention" list, never auto-retry forever.
6. **Connectivity: trust request results over NetInfo.** Use NetInfo only as a hint to wake the drain loop; the loop must work even if NetInfo says offline-but-wrong. Configure `isInternetReachable` against our own API health URL.
7. **Always show sync state**: a persistent "N waiting to send" chip + per-item status (Queued / Sending / Sent / Needs attention) + "Last synced" timestamp on cached screens.
8. **Do NOT make offline**: login/OTP, payments/quotes/proposal send (WhatsApp templates), user/role admin, anything needing server-side validation of stock/price, deleting records, editing shared records. These show a clear "Needs internet" state.

### 1.2 Performance
9. **Budgets** (own judgement, validate on a real 2-3 GB device): cold start to first interactive list < 3 s on 3 GB device (release build), JS bundle (Hermes bytecode) tracked in CI with a +10% regression gate, scrolling 55+ fps JS/UI on chat and lead lists, steady-state RAM < 250 MB in a 500-message photo chat, APK/AAB download < ~40 MB.
10. **FlashList for lists > ~50 items (leads, chat, call records, tasks); FlatList for short ones.** Hermes + New Architecture are default on current SDKs (see 5.2).
11. **Images**: always request resized Cloudinary URLs (`f_auto,q_auto,w_<size>,c_limit`), thumbnails in lists (w_200..320), full image only on tap; upload-side compress to **<= 1600 px long edge, JPEG q ~0.7, target 300-600 KB** via `expo-image-manipulator`.
12. **Use `expo-image` with disk cache** (UNVERIFIED in this pass; verify `cachePolicy` docs) and recycle-friendly sizing.

### 1.3 Network
13. Per-request timeout 15 s for JSON (10 s on reads that have cached fallback), 60-120 s for uploads with progress; `AbortController` on every query (TanStack passes `signal`); max 2-3 retries for reads with exponential backoff + full jitter; outbox retries run to 24 h then surface to the user.
14. Pagination: **cursor-based, 20-30 rows**, infinite query with `maxPages` cap; refresh = first page only.
15. Data-saver switch in Settings (own judgement): thumbnails only, no auto-download of images/audio, no photo prefetch; also auto-on for `cellular` + `isConnectionExpensive` (NetInfo `details.isConnectionExpensive` on cellular; UNVERIFIED in this pass).

### 1.4 Real-time-ish
16. **FCM push as a doorbell, polling as the safety net.** Push payload carries only `{type, entityId}`; app invalidates that query on receipt/tap. In foreground: chat screen polls every 10-15 s with `refetchIntervalInBackground: false`; lists refetch on focus/foreground with `staleTime` 30-60 s; everything else no interval. Never poll in background.

### 1.5 i18n
17. **Use `expo-localization` + `i18next` + `react-i18next`** (largest ecosystem, plural handling via Intl) from day 1, English-only strings but all copy extracted into `en.json` namespaces; ship `hi` and `bn` as a second phase. Format numbers/dates with `Intl` (`en-IN`) wrapped in one `format.ts`; money stored as integer paise on the wire, displayed with lakh/crore grouping. Fonts: rely on system Noto (Devanagari/Bengali ship on Android), test on low-end devices; bundle Noto Sans Bengali/Devanagari *only if* a device test shows tofu/clipping.

### 1.6 Accessibility
18. Target WCAG 2.2 AA: 48x48 dp touch targets with 8 dp spacing (Android guidance; stricter than WCAG's 24x24 CSS px minimum), 4.5:1 text contrast / 3:1 UI, support system font scale up to 200% (cap with `maxFontSizeMultiplier` ~1.6-2.0 only on tight chrome), labels/roles/state on every control, respect reduce-motion, announce sync results.

### 1.7 Quality
19. **Sentry (`@sentry/react-native`) with PII scrubbing**, root error boundary + per-screen boundaries; structured logs with IDs only (never phone numbers, addresses, GPS, call audio names).
20. **Force-update**: API returns `minAppVersion` / `recommendedAppVersion` (+ `Upgrade-Required` style 426 on removed endpoints); app shows blocking screen for below-min, uses Play In-App Updates (flexible/immediate) for nudges. OTA (EAS Update) restricted to JS-compatible `runtimeVersion` (use `fingerprint` policy).
21. **API compat**: additive-only changes inside `/v1`; send `X-App-Version` / `X-App-Build` on every request; keep old-field behaviour for >= 90 days after min-version bump; remote feature flags for kill-switches.

---------------------------------------------------------------------

## 2. Evidence: offline architecture

### 2.1 Read cache with TanStack Query persistence
Facts (all from https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient):
- `maxAge` defaults to 24 h; older persisted cache is silently discarded.
- You must set `gcTime` on the `QueryClient`; the 5-minute default makes the stored cache get discarded. Keep `gcTime >= maxAge` (practical maximum about 24 days).
- `buster` string: mismatching buster discards the cache. Use app version + cache schema version.
- A persister implements `persistClient`, `restoreClient`, `removeClient`; the async/sync storage persisters throttle writes to at most once per second.
- Use `PersistQueryClientProvider` (not plain `QueryClientProvider`) so queries don't fire during async restore and race.
- `dehydrateOptions` (save) and `hydrateOptions` (restore) are separate; use `dehydrateOptions.shouldDehydrateQuery` for the allow-list.

React Native wiring (https://tanstack.com/query/latest/docs/framework/react/react-native):
- `onlineManager.setEventListener` + NetInfo; `focusManager.setFocused` from `AppState` `'change'`; `useFocusEffect` hook for refetch on screen focus (skip first run).

Storage choice:
- `expo-sqlite/kv-store` is documented as a drop-in AsyncStorage replacement with the same API plus sync methods, in the SDK we already depend on (https://docs.expo.dev/versions/latest/sdk/sqlite/). It means one native storage dependency for both cache and outbox. Whether kv-store enables WAL: UNVERIFIED.
- AsyncStorage on Android has a ~6 MB default total DB limit and a 2 MB per-row cursor window issue (UNVERIFIED in this pass; widely reported). A serialised whole-cache blob in one key is exactly the shape that hits this -> prefer SQLite.
- MMKV: fast and synchronous but a JSI native dependency; no benefit that matters here (own judgement).

What to persist (own judgement):
| Persist | Do not persist |
|---|---|
| my profile/role, today's attendance state, my assigned leads/projects (list + detail, last 7 d), my to-dos, chat messages last ~50 per project (text + thumbnail URLs), static lookups (stages, product categories) | OTP/auth tokens (use `expo-secure-store`), proposals/quotes with prices for customers, other staff's personal data, full-size images (use image disk cache), search results, admin screens |

Staleness / invalidation:
- Show cached data immediately, mark with "Updated 14 min ago" when older than `staleTime` and offline.
- `staleTime`: lookups 24 h; lists 30-60 s; chat 5-10 s while screen focused.
- Invalidate on: successful outbox item for that entity (invalidate its keys), push receipt, logout (clear everything + wipe outbox warning), buster change (app upgrade).
- Logout with pending outbox items: block or warn "3 items not sent yet" (own judgement) - otherwise data is lost or sent under the wrong user.

### 2.2 Write outbox design
Why not persist TanStack mutations: TanStack supports `resumePausedMutations` and `setMutationDefaults` for offline mutations, but paused mutations are serialised functions-by-key and are awkward for uploads, ordering and visible "refused" handling (docs: https://tanstack.com/query/latest/docs/framework/react/guides/mutations - mutation persistence; not fetched in this pass, UNVERIFIED on detail). A dedicated SQLite table is easier to inspect, order and cap.

Suggested table `outbox` (own design):
```
id TEXT PK            -- UUID v4 generated at tap time = idempotency key = server clientId
type TEXT             -- attendance.checkin | attendance.checkout | visit.log | callrecord.upload | chat.photo | todo.tick
payload JSON          -- minimal fields; media as local file URI + meta
entity_key TEXT       -- ordering/coalescing scope, e.g. "attendance:<userId>:<date>", "chat:<projectId>"
depends_on TEXT NULL  -- another outbox id that must be done first
status TEXT           -- queued | sending | done | needs_attention
attempts INT, next_attempt_at INT, last_error JSON
created_at INT        -- device clock + also record monotonic/elapsed for ordering
captured_at INT       -- REAL event time (check-in time), sent to server
```
Rules:
- **Event time vs send time**: always send `capturedAt` (device clock) and GPS fix time; server records `receivedAt`. Server decides whether to trust skewed device time (reject > N hours in the future).
- **Ordering**: process FIFO per `entity_key`, in parallel across keys. Check-out depends on check-in; a photo post depends on nothing but its upload step. Chat photo = two steps: (1) upload media to Cloudinary (signed upload or via API), (2) POST message with returned URL; store step-1 result in the row so retry doesn't re-upload.
- **Coalescing**: to-do tick then untick before sync -> collapse to final state (send final state, idempotent "set done=true/false" not "toggle"). Design endpoints as **set-state, not toggle**.
- **Caps**: warn at 50 queued items or 200 MB queued media (own judgement); delete local media only after confirmed server success.
- **Crash safety**: mark `sending` rows back to `queued` at app start (lease with timeout).
- **Persistence of media**: copy picked/captured files into app documentDirectory before queueing; cache-dir files can be purged by the OS.

### 2.3 Idempotent writes against a server that may not support it
Spec context: the IETF `Idempotency-Key` draft (draft-ietf-httpapi-idempotency-key-header-07, Oct 2025, still a draft, expiry 18 Apr 2026): header is an RFC 8941 string item; server returns 409 if the original request is still in flight and 422 if a key is reused with a different payload (https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header ; https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.html). Draft-level only; the 409/422 wording changed across versions, so treat our own contract as authoritative.

Recommended layered approach (own judgement):
1. **Layer A - natural idempotency through client UUID (works without a generic middleware)**: every create endpoint accepts a `clientId` field; Mongo collection has `unique index {userId, clientId}`; on duplicate-key error the handler returns the **existing document with 200** (not 409). Cheap to implement per-endpoint in Express/Mongoose and survives lost responses.
2. **Layer B - `Idempotency-Key` header middleware** (store `{key, userId, route, requestHash, status, response}` with TTL 24-72 h) for endpoints where a unique-index approach is awkward. Same key + same hash -> replay stored response; same key + different hash -> 422; in-flight -> 409 with `Retry-After`.
3. **Layer C - client-only fallback when endpoint can't change yet**: before retrying a POST after an ambiguous failure (timeout, connection reset after send), GET the resource list filtered by a `clientRef` stored in a free-text/meta field, or compare by (type, capturedAt, userId). Weak; use only as stopgap.
4. Prefer **PUT/PATCH set-state** semantic for to-do and attendance state where possible: naturally idempotent.
5. Attendance specifically: server-side rule "at most one open check-in per user per day" makes duplicates harmless regardless of header.
6. Uploads: Cloudinary uploads are not idempotent per se; use a deterministic `public_id` derived from the outbox UUID (own judgement; Cloudinary supports `public_id` and `overwrite` on upload - UNVERIFIED in this pass) so a retry overwrites instead of duplicating.

### 2.4 Conflict handling
- Offline-capable actions are **append-only events or single-field state sets by the owner** -> conflicts are rare by construction. Policy: server wins on shared state; client events are recorded with their own `capturedAt`.
- To-do tick when the task was reassigned/deleted meanwhile -> server returns 404/409/422 -> outbox item goes to "Needs attention" with human text "This task changed; your tick was not applied", local cache refetched.
- Check-in when already checked in (from another device) -> server replies existing record with 200 (Layer A semantic) or 409 `already_open`; client treats as done.
- No CRDTs, no field-level merge (own judgement; overkill).

### 2.5 Retry / backoff and refused-vs-retry
- Backoff (own judgement): base 2 s, factor 2, cap 5 min, **full jitter** (`random(0, min(cap, base*2^n))`), plus immediate attempt when connectivity returns or app foregrounds. Respect `Retry-After` on 429/503.
- Classification table:
| Outcome | Action |
|---|---|
| fetch throws / timeout / abort-by-timeout | retry |
| 408, 425, 429, 500, 502, 503, 504 | retry (honour Retry-After) |
| 401 | refresh token once; if refresh fails -> pause the whole queue, prompt re-login, keep items |
| 409 with identical key/clientId | success (already applied) |
| 400, 403, 404, 410, 413, 415, 422 | refused -> needs_attention, no auto retry |
| 5xx persisting > 24 h | needs_attention |
- A "Needs attention" screen offers Retry / Edit / Discard per item.

### 2.6 Optimistic updates
- Use for to-do ticks and chat sends (message appears immediately with a clock icon; replaced by server version on success). TanStack `onMutate` + rollback pattern, or simply render outbox rows merged into the list (preferred: the list = server data + pending outbox items; no rollback logic needed) (own judgement).
- Do not optimistically show attendance as "confirmed"; show "Checked in 09:12 (will sync)".

### 2.7 Background sync reality on Android
- `expo-background-task` (WorkManager on Android): default interval 12 h, **minimum 15 min**, inexact (system treats it as a minimum delay), runs only when battery/network conditions are met, varies by vendor, no guarantee, stops if the user kills the app; no documented Android execution time limit (https://docs.expo.dev/versions/latest/sdk/background-task/).
- Doze defers jobs/syncs/network; WorkManager tasks do not run in Doze except in maintenance windows; App Standby gives idle apps network about once a day (https://developer.android.com/training/monitoring-device-state/doze-standby).
- Many low-end OEMs (Xiaomi, Oppo, Vivo, Realme) aggressively kill apps; Expo docs point to https://dontkillmyapp.com for this.
- Background location only works while the app is not terminated; vendors may treat swipe-away as kill (https://docs.expo.dev/versions/latest/sdk/location/).
- **Recommendation**: register one `expo-background-task` (15-30 min) that only drains the outbox for small text items (and maybe uploads when on Wi-Fi) as best-effort; the contractual path is foreground drain on app open/foreground/connectivity change plus a "Send now" button. Tell staff in onboarding: open the app once after returning to coverage. Do not request battery-optimisation exemption (Google Play restricts it unless core function is broken; same Doze doc).
- Large uploads in the background (call records, photos) need an Android foreground service/`WorkManager` expedited work; not provided by Expo core (UNVERIFIED for third-party libs, e.g. `react-native-background-upload`); keep v1 to foreground uploads with a persistent notification only if proven necessary.

### 2.8 GPS for attendance offline
- `getCurrentPositionAsync` "may take several seconds", slower indoors; `getLastKnownPositionAsync` is faster but may be stale; no documented timeout option (https://docs.expo.dev/versions/latest/sdk/location/). Wrap in our own `Promise.race` timeout (10-15 s), accept `Balanced` first then refine, store `{lat,lng,accuracy,fixTimestamp}`; if no fix, allow check-in with `gpsStatus: "unavailable"` flagged for review (policy decision for the owner).
- Foreground-only permission is enough for check-in/out button; background location is not needed (and invites Play review friction). (own judgement)

### 2.9 Connectivity detection pitfalls
- NetInfo `isInternetReachable` is `true/false/null` (null = unknown); default reachability URL `https://clients3.google.com/generate_204`, HEAD, expects 204, checks every 5 s when unreachable and 60 s when reachable, 15 s timeout; native reachability is used where available (`useNativeReachability` default true) (https://github.com/react-native-netinfo/react-native-netinfo).
- Captive portals / "connected but no internet" / throttled 2G: README does not discuss captive portals (UNVERIFIED); a portal returning 200 instead of 204 should fail the test, but do not rely on it. TanStack's documented snippet maps `isConnected` only (`setOnline(!!state.isConnected)`), which will report "online" on captive Wi-Fi.
- **Recommendation**: `NetInfo.configure({reachabilityUrl: '<api>/health' , reachabilityTest: r => r.status === 200 && body has our JSON signature})` (own judgement: custom reachability test exists per README keys `reachabilityUrl/Method/Test`); feed `onlineManager` from `isConnected && isInternetReachable !== false`; and drive TanStack `networkMode: 'offlineFirst'` for queries so a wrong "offline" verdict still attempts the request. Outbox ignores NetInfo "offline" after 60 s and tries anyway.

### 2.10 Sync state in UI
- Header chip: "Offline - 3 waiting" / "Syncing 2..." / "All sent"; list rows with clock/spinner/check/red-exclamation; pull-to-refresh disabled-with-reason when offline; toast on refusal with deep link to Needs attention; accessibility announce on state change (see 7).
- Per-screen "last updated" label sourced from `query.dataUpdatedAt`.

### 2.11 Reference-design comparison (build vs buy)
| Option | Fits our API? | Cost for small team | Verdict |
|---|---|---|---|
| Hand-rolled outbox + TanStack persistence | Yes (REST commands) | ~1-2 weeks incl. tests; we own bugs | **Choose** |
| PowerSync | Has GA MongoDB connector (secondary source) but replicates DB rows, bypassing our REST/auth logic; separate service + client SQLite schema | High (new infra, auth mapping) | Not now |
| WatermelonDB | Client DB only; we write sync endpoints | Medium-high, plus Expo/new-arch setup friction (community guides exist) | Not now |
| ElectricSQL | Postgres-only; vendor direction reportedly changed (UNVERIFIED) | n/a | No |
| Legend State | State + persistence/sync plugins; no outbox semantics for uploads | Medium | No |
| Expo docs | No published offline-outbox reference pattern found in this pass (UNVERIFIED absence) | - | - |
Sources: https://powersync.com/blog/react-native-local-database-options ; https://supabase.com/blog/mongodb-realm-and-device-sync-alternatives ; https://queryplane.com/blog/electricsql-vs-powersync-vs-replicache/ (search results, secondary).

---------------------------------------------------------------------

## 3. Evidence: performance on low-end Android

### 3.1 Runtime and build
- Expo SDK 55 (Feb 2026, RN 0.83) made the New Architecture the only option; Hermes v1 opt-in there with reported memory/startup regressions on SDK 55 (Expo advises SDK 57 / expo@57.0.9+); SDK 56 beta notes say Hermes V1 default (https://expo.dev/changelog/sdk-55 ; https://expo.dev/changelog/sdk-56-beta). The SDK 58 docs are current (https://docs.expo.dev/versions/latest/sdk/background-task/ page says SDK 58). **Recommendation**: start on the latest stable SDK (58 per current docs), keep Hermes default, and verify the exact Hermes V1 status in the SDK 58 changelog (UNVERIFIED here).
- Release builds only for measurement; dev mode is much slower; remove `console.*` in production with `babel-plugin-transform-remove-console`; use native-driven animation; defer non-urgent work (https://reactnative.dev/docs/performance).
- Frame budget 16.67 ms at 60 fps; JS thread vs UI thread (same page).

### 3.2 Budgets (own judgement; calibrate)
| Metric | Budget | How to measure |
|---|---|---|
| Cold start (tap to first usable screen) | <= 3 s on 3 GB / Snapdragon 6xx-class; <= 5 s on 2 GB | `adb shell am start -W`, Android Studio/Perfetto, Sentry app-start |
| Warm start | <= 1.5 s | same |
| JS bundle (Hermes bytecode) | <= 5 MB, CI diff gate +10% | `npx expo export` + size script; `source-map-explorer` |
| Download size (AAB-derived APK) | <= 40 MB | Play Console / bundletool |
| Jank | < 5% frames >16 ms on chat/lead lists | Perf Monitor, Android GPU profile |
| Memory | < 250 MB RSS in 500-msg photo chat | Android Studio Profiler, `adb shell dumpsys meminfo` |
| Startup work | no network call blocks first paint; render from cache | code review |
- Practical levers: lazy-load heavy screens (React `lazy`/Expo Router lazy routes), avoid big libraries (moment -> date-fns/Intl, lodash -> native), no large JSON in bundle, single i18n namespace loaded eagerly + others lazily, keep splash until fonts+cache restore done.

### 3.3 Lists
- RN docs recommend FlashList (and Legend List) for large lists; `getItemLayout` on FlatList to skip measurement (https://reactnative.dev/docs/performance).
- FlashList is built for the new architecture; v1.x docs for old architecture; works in Expo Go from SDK 46 and dev builds, no config plugin (https://shopify.github.io/flash-list/docs/). Whether `estimatedItemSize` is still needed in v2: UNVERIFIED (intro page silent).
- Rules (own judgement): stable `keyExtractor`; memoised row components (`React.memo`) with primitive props; no inline closures in `renderItem` (pass ids, look up in store); `getItemType` for heterogeneous chat rows (text vs photo); `inverted` chat list with pagination in the older direction; avoid nested vertical ScrollViews; keep row layout fixed-height where possible.

### 3.4 Images and Cloudinary
- Cloudinary: put `q_auto` and `f_auto` as the final components of every delivery URL; resize server-side (`c_scale,w_500`) rather than client-side; `w_auto`/`dpr_auto` are for browsers (not usable from RN `Image`; we compute width ourselves); `q_auto` default is `good`, switches to `eco` with the Save-Data header; `f_auto` serves AVIF/WebP/JPEG-XL depending on client (https://cloudinary.com/documentation/image_optimization).
- Whether Android RN image decoders (Fresco/Coil in expo-image) accept AVIF and request headers Cloudinary sniffs on (Accept): UNVERIFIED; test `f_auto` on Android 10 devices, fallback to `f_webp` or `f_jpg` explicitly. WebP is supported on all Android >= 4.0 (own knowledge, UNVERIFIED here).
- Recommended URL builder (own judgement): `.../upload/f_auto,q_auto,c_limit,w_{px},dpr_1/...` with px chosen from buckets {160, 320, 640, 1080}: list thumbnail 320 (2 dp-density phones), chat bubble 640, viewer 1080 (cap even on 1440p phones). Cache keys by bucket so each URL is fetched once.
- Memory: decoded bitmap = w*h*4 bytes. A 4000x3000 photo = 48 MB decoded; a 640x480 thumb = 1.2 MB. Never show full-resolution in lists (arithmetic, own).
- Upload compression (client): use `expo-image-manipulator` to resize (long edge 1600 px) and compress (JPEG 0.7); check the SDK 58 API (contextual/`manipulateAsync`) in https://docs.expo.dev/versions/latest/sdk/image-manipulator/ (page not retrievable in this pass: 404 on my fetch path, UNVERIFIED). Targets: chat/site photos 300-600 KB; documents/drawings that need legibility 1-1.5 MB at q 0.8; strip EXIF except what we explicitly send (GPS leakage; own judgement).
- Call records: audio files can be large; do not transcode on device; upload as-is, resumable if possible (Cloudinary chunked upload `upload_large` - UNVERIFIED for RN), with size cap and Wi-Fi-preferred option.

### 3.5 Avoiding re-renders
- Colocate state; use TanStack `select` to subscribe to slices; avoid putting server data into global store; `useCallback` only where passed to memoised children; React Compiler (UNVERIFIED availability/stability on SDK 58 - check Expo docs); profile with React DevTools profiler + "Show Perf Monitor" (https://reactnative.dev/docs/performance).
- Context providers: split by update frequency (auth vs sync-state vs theme) so the sync chip updates don't re-render whole tree.

### 3.6 Reanimated limits
- Reanimated runs worklets on the UI thread, which keeps animations smooth even if JS is busy (https://reactnative.dev/docs/performance explains JS vs UI threads). On low-end devices (own judgement): limit to simple transforms/opacity, <= 1-2 concurrent animations, no animated blur/shadows, no layout animations inside long lists, skip entirely when reduce-motion is on. Prefer plain `Animated` with `useNativeDriver: true` for trivial cases to avoid an extra dependency.

### 3.7 Profiling toolchain
- Perf Monitor (dev menu), React DevTools Profiler, Android Studio Profiler/Perfetto, `adb shell dumpsys gfxinfo <pkg>` for jank, Sentry performance (app start, slow/frozen frames), `expo-atlas` / `source-map-explorer` for bundle analysis (Atlas: UNVERIFIED in this pass). Test device matrix: one 2 GB Android Go-ish phone, one 3-4 GB mid phone (own judgement).
- Device-class reality for market: Google Play Console/Android Studio distribution dashboards; I could not fetch current Android version share for India in this pass (UNVERIFIED). Use the owner's own staff device list plus Play Console stats after launch.

---------------------------------------------------------------------

## 4. Evidence: network handling

### 4.1 Timeouts, cancellation, retries
- `fetch` in RN has no built-in timeout: implement with `AbortController` + `setTimeout` (own judgement; standard). TanStack Query passes an `AbortSignal` into `queryFn`; unmounting/key change cancels (https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation - not fetched, UNVERIFIED).
- TanStack retries by default 3 times with exponential delay; set `retry` function: no retry on 4xx; `retryDelay: attempt => random(0, min(30000, 1000*2**attempt))` (own judgement; full jitter).
- Query `networkMode`: `'offlineFirst'` (try cache first, attempt fetch, pause only after first failure) fits patchy coverage (https://tanstack.com/query/latest/docs/framework/react/guides/network-mode - not fetched, UNVERIFIED on exact semantics).
- Mutations that are not outbox-backed (online-only): disable button + "Needs internet" when offline, single in-flight guard, no auto-retry of non-idempotent POSTs.
- Large file uploads: use `expo-file-system` upload tasks/`FileSystem.uploadAsync` for progress and binary streaming (UNVERIFIED API names on SDK 58; check docs) rather than base64 in JSON.

### 4.2 Slow-network UX
- Skeletons over spinners, render cached data first, optimistic row for sends, explicit "Slow connection - still trying" after 8 s, cancel button on long uploads, per-item progress, avoid modal spinners blocking the screen, never auto-play media on cellular in data-saver.
- Compress response size: ensure API gzip/brotli enabled; trim list payloads to list-needed fields (`fields=` param) (own judgement).

### 4.3 Pagination
- Cursor-based (`?limit=25&cursor=<lastId or updatedAt+id>`) because offset pagination skips/duplicates on live data; Mongo `_id`-ordered cursors are cheap. Infinite query + `maxPages: 5-8` to bound memory; chat: load older on scroll up; "new messages" fetched by `since=<lastId>` to minimise bytes.
- Total counts only on demand (count queries are slow in Mongo at scale).

---------------------------------------------------------------------

## 5. Evidence: real-time-ish updates without websockets

- `focusManager` + AppState triggers refetch of stale queries when app becomes active; `useFocusEffect` refetch on screen focus (https://tanstack.com/query/latest/docs/framework/react/react-native).
- Push as trigger: Expo notifications background task fires on notification receipt in foreground/background/terminated states, but when the app is terminated only a *headless background notification* (data-only payload, no title/body) triggers the task; OS may not deliver (e.g. Doze) (https://docs.expo.dev/versions/latest/sdk/notifications/ ; note: page partially read). Android Doze doc: FCM `RemoteNotification` messages (user-visible) are delivered in Doze with brief network access; `BackgroundSync` (data-only) messages are intentionally low priority and may be delayed/throttled; don't use RemoteNotification for pure data sync (https://developer.android.com/training/monitoring-device-state/doze-standby).
- **Recommendation**:
  - Chat/lead assignment/task assigned: send a *visible* notification (RemoteNotification) with `{type, entityId}`; on tap or foreground receipt, `invalidateQueries` for that entity. Don't rely on silent pushes to update caches.
  - Polling table (own judgement):
| Screen state | Interval |
|---|---|
| Project chat open, foreground | 10 s (15 s on cellular+data-saver), pause when offline |
| Lead/task list visible | refetch on focus + `staleTime` 30 s, no interval |
| Dashboard/home | refetch on focus, 60 s `staleTime` |
| Anything backgrounded | none |
  - Exponential slow-down on empty polls (10 -> 20 -> 30 s) and reset on user activity.
- Battery effects: each poll wakes the radio; 10 s polling while the screen is on is acceptable, polling when backgrounded is prohibited by Doze anyway (jobs/network suspended). Use `If-None-Match`/`since` params so empty polls are ~200 bytes (own judgement).
- Upgrade path if chat becomes heavily used: SSE/WebSocket only on the chat screen in foreground (not needed for v1).

---------------------------------------------------------------------

## 6. Evidence: localisation (English, Hindi, Bengali)

### 6.1 Stack
- `expo-localization`: `getLocales()` returns locales in user preference order; per-app language selection on Android/iOS requires declaring `supportedLocales` through the config plugin; on Android the app does not reset on a device language change, so listen to `AppState` changes and re-call `getLocales()` (https://docs.expo.dev/guides/localization/). The guide's example uses `i18n-js`.
- Library choice (own judgement; library docs not fetched in this pass):
| Library | Pros | Cons | Verdict |
|---|---|---|---|
| i18next + react-i18next | biggest ecosystem, namespaces, lazy-load, plurals via Intl, many TMS integrations | runtime JSON, no compile step, slightly larger | **Choose** |
| Lingui | ICU messages, extraction CLI, compiled catalogues, small runtime | RN/Expo + Metro/babel macro setup friction | Reasonable alternative |
| FormatJS (react-intl) | ICU standard | heavier; Intl polyfill concerns on Hermes | No |
| i18n-js (Expo guide's example) | trivial | weak plural/ICU | Only for tiny apps |
- Interpolation uses named placeholders, never string concatenation; plural keys (`_one/_other`) even for English; Hindi/Bengali plural categories follow CLDR (https://cldr.unicode.org/ - general; specifics UNVERIFIED).

### 6.2 Extract copy now (cheap later)
- Rule: no user-facing literal in JSX; `t('namespace.key', {count})` from day 1; keys are semantic (`attendance.checkIn.button`), not the English text; one JSON per feature namespace; lint rule (`eslint-plugin-i18next` `no-literal-string`; UNVERIFIED version) in CI; error codes from the API are mapped to keys on the client (`errors.visit.duplicate`), server sends `code`, not prose; push payloads carry `titleKey`/params or server localises by user locale.
- Pseudo-localisation build flag (e.g. `[!!! Ṫĥîś ìś !!!]` + 30% length) to catch truncation; Hindi/Bengali strings are typically longer and taller than English (own judgement).
- Store user language preference on the profile; default from device (`getLocales()[0].languageCode`), fall back to `en`.
- Data content (lead names, notes) is user-entered and not translated.

### 6.3 Indian number/date/currency
- Use `Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0})` for lakh/crore grouping (12,34,567); for Hindi `hi-IN`; Bengali `bn-IN` uses Bengali digits by default in CLDR (assumption, UNVERIFIED; the CLDR page fetch 404'd). Hermes `Intl` coverage on Android/iOS: my fetch of the RN JS-environment page did not document it (https://reactnative.dev/docs/javascript-environment says avoid relying on runtime specifics); **verify on device that `en-IN`, `hi-IN`, `bn-IN` group and digit output is correct on Android 10** (UNVERIFIED), else use a tiny own formatter (regex grouping 3 then 2s) for INR, which is trivial and deterministic.
- Policy: always show Western digits (0-9) in money and phone numbers even in Bengali/Hindi UI, unless the owner asks otherwise (reduces mistakes; own judgement; use `-u-nu-latn` extension, e.g. `bn-IN-u-nu-latn`).
- Money on the wire: integer paise or string decimal; never float arithmetic client-side.
- Dates: store ISO UTC, display `Asia/Kolkata`, `dd MMM yyyy`, 12-hour time with am/pm for staff (own judgement); use `Intl.DateTimeFormat` with `timeZone: 'Asia/Kolkata'` explicitly (Hermes Intl.DateTimeFormat timeZone support: UNVERIFIED). Relative times via `Intl.RelativeTimeFormat` if available else date-fns locale.

### 6.4 Fonts / scripts on Android
- Android ships Noto fonts including Devanagari and Bengali since long ago (own knowledge; UNVERIFIED with primary source in this pass). Risks: low-end OEM ROMs with reduced font sets, Bengali conjunct (juktakkhor) rendering, line-height clipping of tall matras with fixed `lineHeight`.
- Recommendations: use system font by default (zero APK cost); never set fixed `lineHeight` less than 1.5x font size for Indic text; test Bengali compounds on Android 10 + a Xiaomi/Realme device; if tofu or clipping is observed, bundle Noto Sans Bengali / Noto Sans Devanagari via `expo-font` (each ~200-400 KB per weight; UNVERIFIED sizes) subset to needed weights (Regular, SemiBold).
- Inter/Latin brand font + Noto Indic as fallback is a design decision for the visual design doc; RN cannot declare a per-script font fallback stack in one `fontFamily` (Android falls back to system fonts automatically; UNVERIFIED).
- RTL: not needed (no Arabic/Urdu in scope); keep `I18nManager.allowRTL(false)` (own judgement).

### 6.5 Pragmatic plan
1. Phase 0 (now): English only, i18next wired, `en.json` complete, lint for literals, `format.ts` for INR/dates, pseudo-locale in dev.
2. Phase 1: Hindi for staff (largest benefit), translated by a native speaker/PM, not machine-only; use a spreadsheet/TMS (Crowdin/Lokalise free tier; UNVERIFIED pricing).
3. Phase 2: Bengali (Siliguri market, strong for customers) + per-user language switch + translated push/WhatsApp templates (WA templates need separate approval per language: UNVERIFIED, check WhatsApp Business policy).
4. Ship OTA string updates through EAS Update (JS-only changes) (https://docs.expo.dev/eas-update/runtime-versions/ explains JS-vs-native compatibility).

---------------------------------------------------------------------

## 7. Evidence: accessibility

### 7.1 Standards
- WCAG 2.2 AA relevant SCs: 1.4.3 text contrast 4.5:1 (3:1 large text); 1.4.11 non-text contrast 3:1 for UI components and states; 2.4.11 Focus Not Obscured (Minimum) AA; 2.5.7 Dragging Movements AA; 2.5.8 Target Size (Minimum) AA (https://www.w3.org/TR/WCAG22/). WCAG 2.2 is a web spec; apply to mobile as guidance (W3C's mobile mapping: https://www.w3.org/TR/mobile-accessibility-mapping/ - not fetched, UNVERIFIED).
- 2.5.8: targets at least 24x24 CSS px, with exceptions (spacing, equivalent, inline, user-agent, essential) (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Android guidance is stricter: 48x48 dp minimum and 8 dp spacing between targets; `TouchDelegate`/`hitSlop` to enlarge touch area without enlarging visuals (https://support.google.com/accessibility/android/answer/7101858). In RN use `hitSlop` (own judgement) and a `<Pressable style={{minHeight:48,minWidth:48}}>` base component.

### 7.2 RN APIs (https://reactnative.dev/docs/accessibility)
- `accessible`, `accessibilityLabel` (defaults to concatenated child text on touchables), `accessibilityRole` (`button`, `link`, `header`, `checkbox`, `switch`, `adjustable`...; `role` prop takes precedence), `accessibilityState` (`disabled/selected/checked/busy/expanded`), `AccessibilityInfo.isScreenReaderEnabled()`.
- Not on that page (UNVERIFIED, verify in AccessibilityInfo docs): `AccessibilityInfo.isReduceMotionEnabled()` + `reduceMotionChanged`, `announceForAccessibility`, `Text` props `allowFontScaling` / `maxFontSizeMultiplier`.

### 7.3 Checklist for this app (own judgement, derived from above)
- Every icon-only button has label + role; photo bubbles: label "Photo from Ravi, 4:12 pm"; to-do rows: `role=checkbox` + `checked` state; sync chip announces changes politely (live region on Android).
- Font scaling: honour system setting; Android supports large scale; test at 130% and 200%; use `maxFontSizeMultiplier` ~1.6-2.0 only for tab bar/badges; layouts must wrap rather than clip (Android text-scaling doc 404'd in my fetch path: https://developer.android.com/guide/topics/ui/look-and-feel/text-scaling UNVERIFIED).
- Contrast: check brand palette against 4.5:1 and 3:1; bright-sunlight use on construction sites -> prefer >= 7:1 for primary actions (own judgement). Do not rely on colour alone for sync states (icon + text).
- Reduce motion: skip Reanimated/Lottie when enabled; no auto-playing carousels.
- Focus order = visual order; modals trap focus; after navigation move focus to screen title; error summaries announced; no dragging-only interactions (2.5.7): provide buttons for reorder/swipe actions.
- Test with TalkBack on a real device for the 5 offline flows; Android Accessibility Scanner; Hindi/Bengali TalkBack voices depend on the user's installed TTS (UNVERIFIED).
- Time limits: OTP screens should allow resend and not expire silently.

---------------------------------------------------------------------

## 8. Evidence: quality, versioning, force-update

### 8.1 Crash reporting & logging
- Sentry for Expo: wizard `npx @sentry/wizard@latest -i reactNative`; source maps upload automatically on EAS Build with `SENTRY_AUTH_TOKEN`; for EAS Update run `sentry-expo-upload-sourcemaps`; tag events with `expo-update-id` etc.; Expo dashboard integration shows crashes per deployment (https://docs.expo.dev/guides/using-sentry/ - fetch hit a different path; content as returned by tool, treat as UNVERIFIED on URL stability).
- Alternatives: Firebase Crashlytics (free, native-only reports, needs dev build config plugin; UNVERIFIED), Bugsnag. Recommendation: Sentry (JS + native + performance in one), cost-check against free tier (UNVERIFIED).
- Error boundaries: a root boundary (reload button + report) and per-screen boundaries around lists/media viewers; boundaries don't catch async/event-handler errors, so also set `ErrorUtils.setGlobalHandler` via Sentry (own knowledge).
- **No PII in logs** (own judgement): log ids (leadId, projectId), event names, status codes, durations, outbox counts; never names, phone numbers, addresses, GPS coordinates, message text, file names of call recordings, auth tokens. Configure Sentry `sendDefaultPii: false`, `beforeSend` scrub URL query/body, disable breadcrumbs for text inputs, hash user id. Mention in privacy policy (India DPDP Act applicability: UNVERIFIED, get legal advice).
- Local diagnostic log: ring buffer in SQLite (last 500 lines, ids only) with "Send diagnostics" button in Settings for support.

### 8.2 Feature flags / remote config
- Keep it simple: `GET /v1/app-config` returns `{minAppVersion, recommendedAppVersion, flags:{}, pollingIntervals, uploadMaxBytes, maintenance:{active,message}}`; cached (persisted) and fetched on launch/foreground (stale 15 min). Use for kill-switches (e.g. disable call-record upload), polling intervals, photo-size targets.
- Third-party flag services (Firebase Remote Config, GrowthBook, PostHog) are optional; server-driven JSON is enough for a small team (own judgement).

### 8.3 Force-update / version compat
- Google Play In-App Updates: flexible (background download, app usable) and immediate (full-screen, blocks use); supported on Android 5.0+ (API 21), phones/tablets/ChromeOS (https://developer.android.com/guide/playcore/in-app-updates). Expo wrapper libraries exist (e.g. `sp-react-native-in-app-updates`; UNVERIFIED maintenance) - or a plain "Update" screen deep-linking to the Play Store.
- Pattern: (1) app sends `X-App-Version`, `X-App-Build`, `X-Platform`, `X-Api-Compat: 1`; (2) `/app-config` compare; (3) below `minAppVersion` -> blocking screen with Play link, but **allow outbox drain to finish first** if the API still accepts old writes (don't strand queued field data); (4) server may also reply `426 Upgrade Required` with `{minAppVersion}` for removed endpoints.
- OTA: `runtimeVersion` policy `fingerprint` changes when native runtime may change, making incompatible updates unlikely; `appVersion` policy risks shipping incompatible JS to old binaries if the version isn't bumped; roll out gradually and monitor errors (https://docs.expo.dev/eas-update/runtime-versions/). **Recommendation**: `fingerprint`, staged rollout, preview channel first.
- **API compat strategy** (own judgement): old app versions stay installed for months on staff phones with Play auto-update off. Therefore: additive-only changes (new optional fields; never rename/remove or tighten validation); version in path only for breaking change (`/v2`) with `/v1` supported >= 90 days after min-version raise; tolerant reader (ignore unknown fields; unknown enum values map to "other"); outbox payloads carry `schemaVersion` so a newer app can still drain rows written by an older build after upgrade (write a migration in the outbox reader); contract tests in CI replaying last 2 released app versions' request fixtures against the API.

---------------------------------------------------------------------

## 9. Risks and open questions

1. **Idempotency on the server is the critical dependency.** Without the `clientId` unique index (or header middleware), outbox retries can create duplicate visits/photos/calls. Need an API task list per offline endpoint. Open: which endpoints already honour `Idempotency-Key` (user says "some places only")?
2. **Background sync is best-effort on low-end OEMs.** Staff may believe data is sent when it is queued. Mitigation: loud UI state, reminder notification "3 items waiting" after N hours (local notification), onboarding copy. Open: is a foreground service for uploads acceptable for Play policy/UX?
3. **Device clock tampering/skew for attendance** (fraud/regulation): need server policy (time source, max skew, flag-for-review). Open: owner policy for no-GPS check-ins and mock locations (Android `isMockLocation`: UNVERIFIED availability).
4. **Media storage growth** offline (call recordings, photos) on 32 GB phones; need quota, cleanup and warnings. Open: max call-record size/length and whether upload is Wi-Fi-only.
5. **Auth expiry while offline for days**: refresh-token lifetime must exceed longest expected offline stretch or queued items stall; decide on 30-day refresh and device-bound sessions.
6. **Hermes Intl and font rendering** for en-IN/hi-IN/bn-IN on Android 10 are unverified; add a device test in the first sprint (cheap) before committing to `Intl` vs own formatter, and decide bundled fonts.
7. **SDK/Hermes V1 status**: current SDK is 58 per Expo docs; Hermes V1 default status and its memory/startup profile on 2 GB devices must be measured, not assumed (Expo flagged regressions for SDK 55 opt-ins).
8. **Cloudinary `f_auto` on Android client** (AVIF/WebP decode) and cost/transformation quota (f_auto multiplies derived assets: https://cloudinary.com/documentation/image_optimization) - confirm plan limits and test on Android 10.
9. **WhatsApp/push templates per language** and push permission UX on Android 13+ (runtime POST_NOTIFICATIONS permission; UNVERIFIED here).
10. **Data-protection/consent** for GPS + call recordings (DPDP Act, employee monitoring; call recording legality/consent in India): needs legal review (UNVERIFIED, out of scope).
11. **Testing**: need an offline test matrix (airplane mode, captive portal, 2G throttling, kill during upload, clock change, token expiry) automated where possible; Android `adb shell dumpsys deviceidle force-idle` for Doze tests (documented in the Doze page).
12. **Build-vs-buy trigger**: if product asks for offline editing of quotes/proposals or multi-user shared offline edits, re-evaluate PowerSync (only candidate with MongoDB connector) - a spike then, not now.

## 10. Source list (fetched this pass)
- https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient
- https://tanstack.com/query/latest/docs/framework/react/react-native
- https://docs.expo.dev/versions/latest/sdk/background-task/
- https://docs.expo.dev/versions/latest/sdk/sqlite/
- https://docs.expo.dev/versions/latest/sdk/location/
- https://docs.expo.dev/versions/latest/sdk/notifications/
- https://docs.expo.dev/guides/localization/
- https://docs.expo.dev/eas-update/runtime-versions/
- https://docs.expo.dev/guides/using-sentry/
- https://reactnative.dev/docs/performance
- https://reactnative.dev/docs/accessibility
- https://reactnative.dev/docs/javascript-environment
- https://shopify.github.io/flash-list/docs/
- https://github.com/react-native-netinfo/react-native-netinfo
- https://cloudinary.com/documentation/image_optimization
- https://developer.android.com/training/monitoring-device-state/doze-standby
- https://developer.android.com/guide/playcore/in-app-updates
- https://support.google.com/accessibility/android/answer/7101858
- https://www.w3.org/TR/WCAG22/ ; https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header (via search)
- https://expo.dev/changelog/sdk-55 ; https://expo.dev/changelog/sdk-56-beta (via search)
- https://powersync.com/blog/react-native-local-database-options ; https://queryplane.com/blog/electricsql-vs-powersync-vs-replicache/ ; https://supabase.com/blog/mongodb-realm-and-device-sync-alternatives (via search, secondary)
