# Mobile stack and distribution research (Vastu Kitchen)

All sources accessed 2026-11-12. Claims without a URL, or marked UNVERIFIED, were not confirmed against a primary source. Several web fetches were summarised by a small model; re-read the primary page before pinning anything load-bearing.

## 1. Recommendation (read this first)

1. **Start on Expo SDK 58 (RN 0.88, React 19.3) rather than copying the field app's SDK 57 (RN 0.86), unless sharing native code or lockfile with the field app matters more than being current.** SDK 58 went stable 2026-10-15. If the two apps are to share packages/patches, stay on 57 now and upgrade both together within a few weeks. Either way: New Architecture is mandatory and cannot be disabled (SDK 55+). Do not write any code that assumes the legacy bridge.
2. **Monorepo: pnpm with `nodeLinker: hoisted` for the mobile app, no manual Metro watchFolders.** Expo auto-configures Metro for monorepos (SDK 52+). Isolated installs are supported from SDK 54 but Expo itself says some native libs break; hoisted is the low-risk default.
3. **`@vastu/contracts`: keep it source-first but add one small Metro `resolveRequest` hook** that maps relative `.js` specifiers to `.ts/.tsx` for files under `packages/`. Alternative with zero Metro hackery: build contracts to `dist` (ESM + d.ts) and point `exports` at dist. Pick the dist route if the hook proves flaky. Pin one zod major across web, API and mobile (see 3.5).
4. **Navigation/state: expo-router with `Stack.Protected` per role group; TanStack Query v5 with AppState focus manager + NetInfo online manager; persist the cache in expo-sqlite or MMKV; expo-image; FlashList or FlatList for lists (chat: prefer FlatList `inverted` first, see 5.5); react-native-keyboard-controller for the composer.**
5. **Styling: StyleSheet plus a shared token file now; revisit NativeWind v5 once it leaves release-candidate.** NativeWind v4 needs Tailwind v3; v5 targets Tailwind v4 but is still RC. If the web app is on Tailwind v4, a split config would hurt.
6. **Distribution: EAS Build + EAS Update. Android first via a Play Console internal/closed track on an Organization account (needs D-U-N-S, plan ~4 weeks); EAS internal APK as a stop-gap for staff. iOS: Apple Developer Program (USD 99/yr, org needs D-U-N-S) with TestFlight for the customer app, since ad hoc is capped at 100 devices/yr.** Sentry for crashes, no third-party analytics SDK at launch.
7. **Testing: Jest + React Native Testing Library for logic and components; Maestro (YAML flows, runs on EAS Workflows) for 5-10 critical e2e flows. Skip Detox.**
8. **Security: tokens in expo-secure-store (never large blobs), optional biometric gate via `requireAuthentication`, no certificate pinning in v1, no root detection block (log and warn only).**

## 2. Evidence: versions, support, New Architecture

### 2.1 Current versions (verified)
| Item | Value | Source |
|---|---|---|
| Latest Expo SDK | 58.0.0, RN 0.88, React 19.3.0, min Android 7, min iOS 16.4, Xcode 26.4+, compileSdk 37 / targetSdk 36 | https://docs.expo.dev/versions/latest/ |
| SDK 58 release date | 2026-10-15 (beta 2026-09-15) | https://expo.dev/changelog |
| SDK 57 | 2026-06-30, RN 0.86 (patches to 0.86.3), React 19.2, Hermes V1 | https://expo.dev/changelog/sdk-57 |
| SDK 56 | 2026-05-21 | https://expo.dev/changelog |
| Node for SDK 58 | 22.13+ or 24.3+ (also 26+); odd lines (23, 25) unsupported | https://expo.dev/changelog/sdk-58 |
| expo-router | Default router; SDK 58 ships stable data loaders, SSR, middleware, native tabs, toolbars | https://expo.dev/changelog/sdk-58 |

The field app's stack (SDK 57 / RN 0.86) is one SDK behind. Expo Go for SDK 58 supports only SDK 58; store release "within a few weeks" of announcement, and `create-expo-app` defaulted to SDK 57 until then (https://expo.dev/changelog/sdk-58). Re-check which applies today.

### 2.2 Support window
UNVERIFIED. Expo's docs say each SDK targets one RN version and Expo cherry-picks urgent RN fixes into the version used by the latest SDK (https://docs.expo.dev/versions/latest/). The Release statuses page (https://docs.expo.dev/more/release-statuses.md) was not read. Working assumption: only the latest SDK gets fixes; plan to upgrade roughly every 2 SDKs (about 6 months) and always before store targetSdk deadlines.

### 2.3 New Architecture and Hermes
- SDK 55+ always runs the New Architecture; `newArchEnabled: false` is ignored. SDK 54 was the last SDK allowing legacy. SDK 55 = RN 0.83. (https://docs.expo.dev/guides/new-architecture/, https://expo.dev/changelog/sdk-55)
- Hermes is the default engine (https://docs.expo.dev/llms.txt). SDK 57 uses Hermes V1; two regressions (memory with reanimated/worklets, dev startup) were fixed in expo 57.0.9 and 57.0.17 (https://expo.dev/changelog/sdk-57). Hermes V1 status in SDK 58: UNVERIFIED.

### 2.4 Things not to trust memory about (from the SDK 57 and 58 changelogs)
- **iOS scene life cycle**: apps built with the iOS 27 SDK must use UIKit scenes or will not launch on iOS 27. SDK 58 prebuild generates `SceneDelegate.swift` by default; SDK 57 needs `ios.enableSceneSupport` (expo 57.0.23+). Custom AppDelegate code needs migration.
- **`expo prebuild` now cleans and regenerates `android/` and `ios/` by default** (SDK 57); use `--no-clean` to keep edits. Treat native dirs as generated.
- **R8 enabled by default in Android release builds** (SDK 58): reflection-using libs may need keep rules.
- **expo-notifications**: foreground notifications now show by default unless your handler says otherwise (SDK 58).
- **expo-sqlite**: libSQL support removed (SDK 58). Fine for plain SQLite.
- **expo-file-system**: `File.write()` is async; use `writeSync()` for old behaviour.
- **expo-router (SDK 58)**: server output is default when `web.output` unset; some `expo-router/react-navigation` APIs moved; `withLayoutContext` deprecated in favour of `integrateWithRouter`. Mobile-only apps are mostly unaffected.
- **RN 0.87/0.88 removals**: `InteractionManager`, `Touchable` root export, `Modal animated` prop, `StatusBar backgroundColor/translucent`. Deep imports from `react-native/Libraries/*` are now type errors. `ImageBackground` deprecated.
- **`NODE_ENV`** is forced to development/production; `expo login` is browser-based.
- **Expo Go**: login now required to run projects in Expo Go (2026-09-03) and loading behaviour changed (2026-05-13) (https://expo.dev/changelog). Use development builds for anything with native modules anyway.
- Source for all bullets above: https://expo.dev/changelog/sdk-58 and https://expo.dev/changelog/sdk-57. Always check https://docs.expo.dev/llms.txt before trusting remembered APIs.

## 3. Evidence: pnpm monorepo and `@vastu/contracts`

### 3.1 Official guidance (https://docs.expo.dev/guides/monorepos/)
- Since SDK 52 Expo configures Metro automatically if the config extends `expo/metro-config`. Delete manual `watchFolders`, `resolver.nodeModulesPath`, `extraNodeModules`, `disableHierarchicalLookup`; run `npx expo start --clear` once.
- pnpm uses isolated installs by default. SDK 54+ supports isolated deps but "some native libraries may fail". If problems, set `nodeLinker: hoisted` in `pnpm-workspace.yaml`.
- Duplicate react-native versions in a monorepo are unsupported; duplicate react causes runtime errors; duplicate native modules break builds. Force a single peer version with pnpm `overrides`/resolutions.
- `experiments.autolinkingModuleResolution` (SDK 54 opt-in) is automatic for monorepo apps from SDK 55.
- Not covered on that page: `expo install` in monorepos and package `exports`. Run `npx expo install` from inside `apps/mobile` so versions are checked against the SDK's bundled-native-modules list (UNVERIFIED for monorepo edge cases); run `npx expo-doctor` in CI.

### 3.2 Recommended layout
```
apps/mobile/            expo app (package.json has expo, react-native)
packages/contracts/     @vastu/contracts (zod schemas)
pnpm-workspace.yaml     nodeLinker: hoisted   (try isolated later)
```
- Keep `react`/`react-native` only in `apps/mobile` dependencies; web uses its own react. Add pnpm `overrides` to pin `react` to the Expo SDK's version in the mobile app only if a duplicate appears (note the web app may run a different React).
- `metro.config.js`: `const { getDefaultConfig } = require('expo/metro-config'); module.exports = getDefaultConfig(__dirname);` plus the optional `.js`-to-`.ts` hook below. No watchFolders.
- Add `workspace:*` dependency on `@vastu/contracts` in the mobile app.
- turbo: mobile typecheck depends on contracts; do not put `expo start` in the turbo pipeline.

### 3.3 Consuming contracts: source vs dist
| Option | Pros | Cons |
|---|---|---|
| A. Source (`exports` -> `./src/index.ts`) | no build step, instant edits, Metro transpiles TS from outside `node_modules` | Metro cannot resolve `./foo.js` to `foo.ts` by default: needs a resolver hook; web (Next) and Express consume it differently |
| B. Build to `dist` (ESM `.js` + `.d.ts`), `exports` -> dist | identical artifact for all three consumers; no Metro hack; `.js` suffixes are real files | requires `turbo` build before `expo start`/tests; watch-mode for dev |
- The `.js`-suffix problem is real and widely reported: Metro fails with "Unable to resolve" on `./x.js` pointing at `x.ts`. Common fix is a `resolveRequest` hook limited to relative imports originating outside `node_modules`/inside `packages/`, trying the original name first and falling back to `.ts/.tsx` (https://github.com/stella/stella/pull/6911 and https://github.com/1WorldCapture/raft-source/pull/215, accessed 2026-11-12). Not verified on SDK 58 specifically; write a 20-line hook and a smoke test.
- Expo defaults include `.ts/.tsx` in source extensions and package `exports` support (https://mintlify.wiki/expo/expo/reference/metro-config, third-party mirror; UNVERIFIED against official docs). Make sure the package's `exports` map has a `default`/`import` condition Metro understands and no `import.meta` usage (Hermes does not support it; see https://github.com/pmndrs/zustand/discussions/1967).
- Recommendation: build to dist if contracts already has (or can cheaply get) a `tsc`/tsup build used by the API; otherwise Option A plus hook. Decide by a one-day spike.
- tsconfig: mobile extends `expo/tsconfig.base` (https://docs.expo.dev/guides/typescript.md); keep `moduleResolution` compatible with contracts' `.js` suffixes (Bundler or NodeNext); UNVERIFIED which Expo's base sets, check the file.

### 3.4 Pitfalls
- Duplicate zod copies (one in contracts, one in app) break `instanceof` and inferred types; make zod a single hoisted dependency or `peerDependency` of contracts.
- Contracts must be free of Node-only imports (`node:crypto`, `Buffer`) and of `import.meta`.
- Cache: after changing Metro config run `expo start --clear`.
- EAS Build in a monorepo: set the project root properly and install at repo root; UNVERIFIED details, check https://docs.expo.dev/build-reference/ when setting up.

### 3.5 zod v3 vs v4 on RN
- zod's root now exports v4; other subpaths unchanged (https://zod.dev/v4/versioning). Zod 4 is ESM/CJS dual with an `exports` map, which Metro honours when package exports are enabled (https://metrobundler.dev/docs/package-exports, https://reactnative.dev/blog/2023/06/21/package-exports-support).
- I found no confirmed report of zod 4 failing on Hermes/Metro (search 2026-11-12 returned nothing specific): UNVERIFIED, test in a spike. Rule: use whichever major the web and API already use; mixing majors across consumers of the same schemas is the real hazard. Do not import `zod/v3` and `zod/v4` interchangeably.

## 4. Evidence: navigation, state, lists, UI plumbing

### 4.1 expo-router role shells
- Official pattern: `Stack.Protected guard={...}` in the root layout around route groups; unauthenticated access, deep links to protected routes, and a route becoming protected while active all redirect to the anchor/first available route; keep the splash screen up until session loads (`SplashScreen.preventAutoHideAsync`/`hide`) (https://docs.expo.dev/router/advanced/authentication/). The page does not cover roles.
- Role design: groups `(auth)`, `(staff)`, `(customer)`, optionally `(admin)`; root layout renders one `Stack.Protected` per role guard (`session?.role === 'staff'`). Each role group has its own `_layout.tsx` with `Tabs`. Keep shared screens (chat thread, proposal viewer) in a neutral group reachable by both, or duplicate thin route files re-exporting the same screen.
- Guards are UX only; the API must enforce roles (the contracts package should carry the role enum).
- SDK 58 notes: native tabs are stable (no experimental flag) (https://expo.dev/changelog/sdk-58). Android/iOS native tab look is appealing but check feature gaps (badges, per-role dynamic tabs) before adopting: UNVERIFIED.
- Deep links from WhatsApp/notifications land in protected groups: handle the post-login redirect (store intended path, then `router.replace`).

### 4.2 TanStack Query on RN
- Official setup: `focusManager` driven by `AppState` (`setFocused(status === 'active')`, skip on web), `onlineManager.setEventListener` fed by `@react-native-community/netinfo` or `expo-network`; screen-focus refetch via `useFocusEffect` with a first-run guard (https://tanstack.com/query/latest/docs/framework/react/react-native). Page did not cover persistence or version.
- Persistence (UNVERIFIED in this session; general knowledge to confirm in docs): `@tanstack/react-query-persist-client` with an async persister. For this app prefer **expo-sqlite** (already in the field app's stack) or `react-native-mmkv` (sync, fast, but another native dep). Set `gcTime` >= persister `maxAge`, use a `buster` string tied to app version/contracts version, persist only whitelisted query keys (not auth, not large lists of images).
- Offline mutations: set `networkMode: 'offlineFirst'` or default `online` and `resumePausedMutations` after hydrate; give mutations a `mutationKey` plus `setMutationDefaults` so paused mutations can resume after cold start. For anything that must survive reliably (chat send, site-visit notes, photo uploads) use an explicit **outbox table in SQLite** with idempotency keys instead of relying on the Query cache.

### 4.3 Forms
react-hook-form with `@hookform/resolvers/zod` reusing contracts schemas is the conventional choice (UNVERIFIED current versions; check zod 4 resolver support before choosing). Use `Controller` for all inputs; avoid uncontrolled web-style `register`.

### 4.4 Lists and images
- FlashList v2 (new-arch only, no size estimates needed) has `maintainVisibleContentPosition` on by default and removes `inverted` in favour of non-inverted chat patterns (https://shopify.github.io/flash-list/docs/v2-changes/).
- **Chat caveats (open issues, accessed 2026-11-12):** scroll jumps on paginated chat after migrating from `inverted` (https://github.com/Shopify/flash-list/issues/1844); inverted keyboard-inset problems (https://github.com/Shopify/flash-list/issues/1538); keyboard-controller `KeyboardChatScrollView` loses maintainVisibleScrollPosition when inverted (https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1423). Recommendation: use **FlatList `inverted`** for the chat thread (predictable, known), FlashList for long non-chat lists (leads, proposals, catalogue). Re-evaluate after a spike.
- Pagination: cursor-based `useInfiniteQuery`; for inverted lists `onEndReached` loads older messages; prepend new realtime messages to page 0; stable `keyExtractor` on server message IDs plus client temp IDs for optimistic sends.
- Images: `expo-image` (disk+memory cache, blurhash/thumbhash placeholders) - UNVERIFIED in this session, standard Expo package; always request resized thumbnails from the server.

### 4.5 Keyboard and sheets
- `react-native-keyboard-controller` (KeyboardStickyView / KeyboardAvoidingView) is the common choice for a bottom composer; edge-to-edge is the default on Android in recent SDKs so `adjustResize` behaviour differs from older advice - UNVERIFIED, test on a real Android 14/15 device.
- Bottom sheets: `@gorhom/bottom-sheet` v5 depends on reanimated 3/4 and gesture-handler; compatibility with Reanimated 4.5 / SDK 58 UNVERIFIED; alternatives are expo-router modal routes with `presentation: 'formSheet'` (native sheet) which avoids a dependency - check availability on SDK 58.

## 5. Evidence: styling

- **NativeWind v4** (stable) requires Tailwind CSS v3. **v5** targets Tailwind v4, is a thin wrapper over `react-native-css`, pairs `nativewind 5.0.0-rc.0` with `react-native-css 3.1.0-rc.0` for Expo 57, and is explicitly "not intended for production"; rc.1 exists per user reports; a reported ~33% perf regression on SDK 57 was being fixed (https://www.nativewind.dev/v5, https://github.com/nativewind/nativewind/discussions/1818, https://github.com/nativewind/nativewind/releases, accessed 2026-11-12 via search summary). One Medium roundup claims v5 stable in June 2026; contradicted by NativeWind's own docs, so UNVERIFIED/unreliable.
- Uniwind claims up to 5.3x faster than NativeWind (vendor page, https://uniwind.dev/vs-nativewind; UNVERIFIED). Unistyles 3 and Tamagui: no current status obtained.
- **Recommendation**: plain `StyleSheet` + a typed `theme.ts` generated from the same design tokens as the web Tailwind config (colors, spacing, radii, font sizes). Zero runtime risk, works with Reanimated, trivial dark mode via `useColorScheme`. If the team wants class strings, adopt NativeWind v5 only after a stable tag AND when web is on Tailwind v4; otherwise stay on StyleSheet. Revisit at the next SDK upgrade.
- Trade-off summary: NativeWind = familiar classes, shared mental model, but RC churn, build-time CSS pipeline and Metro coupling; StyleSheet = verbose but stable; Unistyles/Tamagui = better perf/theming but a new API to learn and a second source of tokens.

## 6. Evidence: build and distribution (India, B2B)

### 6.1 EAS
- Plans (https://expo.dev/pricing, 2026-11-12): Free USD 0 (15 Android + 15 iOS builds/month, 1,000 update MAUs with no overage, 45 min timeout, low-priority queue); Starter USD 19/mo + usage (USD 45 build credit, 3,000 MAUs); Production USD 199/mo (50,000 MAUs); Enterprise custom. Customer-app MAU will exceed 1,000 quickly; budget Starter or Production, or skip OTA for customers.
- Development builds for daily work; Expo Go cannot load custom native config and now requires login (https://expo.dev/changelog).
- Internal distribution (https://docs.expo.dev/build/internal-distribution/): `distribution: "internal"` gives APK (not AAB) and a shareable install URL; link is public unless "unauthenticated access" is disabled; users accept a security warning. iOS ad hoc needs paid Apple account, UDID-listed devices, new build per added device, max 100 iPhones/year; enterprise program avoids the cap.

### 6.2 Google Play
- Personal accounts created after 2023-11-13 must run a **closed test with 12+ testers opted in continuously for 14 days** before applying for production; review "usually seven days or less" (https://support.google.com/googleplay/android-developer/answer/14151465). Organization exemption: the official page does not mention it; third-party blogs say exempt - UNVERIFIED.
- Organization accounts need a D-U-N-S number matching the Dun & Bradstreet profile; certain categories (financial, health, government, VpnService) must be organisations (https://support.google.com/googleplay/android-developer/answer/10788890). Verification time: sources say up to ~28-30 days; plan for a month (secondary sources via search, e.g. https://goo.gle/developer-verification; UNVERIFIED precise figure). Fee USD 25 one-time (secondary source, UNVERIFIED).
- India RBI KYC: Google's India blog says developers in India needed KYC by 2026-09-15 for cross-border payments (https://blog.google/intl/en-in/products/platforms/complete-merchant-verification-as-per-rbi-regulations/); irrelevant unless the app sells paid apps/in-app purchases, which it will not.
- **Android developer verification**: enforcement starts 2026-09-30 for apps installed from participating stores on certified devices, initially Brazil, Indonesia, Singapore, Thailand; global rollout 2027+; India not named; direct APK sideload not blocked yet, with an "advanced flow" for power users; apps distributed only outside Play register via the Android Developer Console; limited distribution accounts allow up to 20 devices without ID or fee (https://developer.android.com/developer-verification). Implication: internal APKs work today in India but register the package name now to be safe before 2027.
- Closed test tip: since staff are ~10-20 people, use them plus friends/customers as the 12 testers if on a personal account; an organisation account likely avoids this.

### 6.3 Apple
- Apple Developer Program USD 99/yr (enterprise USD 299/yr); India enrolment only through the Apple Developer app; local-currency price shown at checkout. Organisation enrolment needs a legal entity (no trade names/DBAs), D-U-N-S, binding authority, domain email and a public website; no fixed timeline given (https://developer.apple.com/support/enrollment/).
- TestFlight (UNVERIFIED in this session, standard Apple behaviour): internal testers (up to 100 App Store Connect users) need no beta review; external testers need a first-build beta review. A customer app for the public should go to the App Store; a login-only app needs a demo account for App Review.
- Built for the iOS 27 SDK from SDK 58: Xcode 26.4+ is required (https://docs.expo.dev/versions/latest/); EAS Build supplies it.

### 6.4 OTA updates policy
- EAS Update ships JS, styling and images only to builds with a compatible runtime version; native code/dependency/permission changes or SDK upgrades need a new binary. Updates must comply with store guidelines; behaviour changes usually warrant review; rollbacks by republishing a previous update; channels and percentage rollouts supported (https://docs.expo.dev/eas-update/introduction/). The best-practices page returned 404, so staged rollout detail is UNVERIFIED.
- Policy for this app: OTA allowed for bug fixes, copy, layout, new screens using already-installed native modules; never for new permissions, changed core purpose, or anything that would have needed store review. Use `runtimeVersion: { policy: "fingerprint" }` (default fingerprint preset changed to `balanced` in SDK 58) so incompatible updates never reach old binaries.
- Pre-launch: ship with `updates.checkAutomatically: ON_LOAD` and a fallback timeout; UNVERIFIED exact option names, check the expo-updates docs.

### 6.5 Versioning and force update
- Use `appVersion` + EAS remote auto-increment build numbers (`eas.json` `appVersionSource: remote`) - standard EAS feature, UNVERIFIED in this session.
- Force-update: API returns `minSupportedVersion` per platform via a config endpoint (or `X-App-Version` header with HTTP 426); the app shows a blocking "update required" screen linking to the store/internal download. Keep API backward-compatible for N-2 versions; contracts changes must be additive. OTA handles JS-only breaks; store update handles native ones.

### 6.6 Crash reporting and analytics
- Sentry: `npx @sentry/wizard@latest -i reactNative`; set `SENTRY_AUTH_TOKEN` as sensitive env for EAS Build so source maps upload; after `eas update` run `npx sentry-expo-upload-sourcemaps dist`; tag events with update ID/group; optional Expo dashboard integration (https://docs.expo.dev/guides/using-sentry/). Privacy: Sentry privacy options not on that page; set `sendDefaultPii: false`, scrub phone numbers/names in `beforeSend`, disable session replay (UNVERIFIED defaults).
- Analytics: India's DPDP Act applies to personal data of customers (name, phone, home address, floor plans): UNVERIFIED, take legal advice. Recommended: no advertising/analytics SDKs at launch; use first-party events to your own API. Fill the Play Data Safety form and Apple privacy labels truthfully; set `ios.config.usesNonExemptEncryption: false` if only standard HTTPS (https://docs.expo.dev/versions/latest/sdk/secure-store/).

## 7. Evidence: testing

- **Jest + RNTL** (jest-expo preset; standard, UNVERIFIED versions): unit-test schemas, hooks, outbox logic, role guards. Cheap and fast.
- **Maestro** is the documented e2e path for Expo: flows in `.maestro/*.yml`, built via an `e2e-test` EAS profile (APK / simulator build), run by EAS Workflows on PRs, results/flake insights in the Expo dashboard (https://docs.expo.dev/eas/workflows/examples/e2e-tests/). Local runs against an emulator also work. Detox is not covered by Expo docs there; it needs a native test harness and more upkeep.
- Practical plan for a small team: Jest for pure logic; 5-10 Maestro flows (login per role, create lead, send proposal link, chat send/receive, offline capture then sync); run Android only in CI, iOS manually before release; use the ARTEMIS device exploration workflow before authoring flows. Free EAS builds (15/month/platform) are tight; run Maestro locally in CI against a prebuilt APK if limits bite.

## 8. Evidence: security

- **expo-secure-store** (https://docs.expo.dev/versions/latest/sdk/secure-store/): no enforced size limit but some iOS versions historically reject ~2 KB+ values; Android uses Keystore-encrypted SharedPreferences, iOS Keychain; not a primary store; sync `getItem/setItem` block the JS thread (prefer async); Android data is lost on uninstall, iOS may persist across reinstall; Android Auto Backup is auto-excluded; keychain accessibility default `WHEN_UNLOCKED`. Store only refresh/session token and a DB encryption key, not documents.
- **Biometric re-auth**: `requireAuthentication: true` maps to Android `setUserAuthenticationRequired` (API 23+) and iOS `biometryCurrentSet`; enrolling a new fingerprint invalidates those values (user must log in again); not supported in Expo Go; use a real device to test. Option: gate app resume after N minutes with `expo-local-authentication` (UNVERIFIED), and keep token behind `requireAuthentication` only for staff roles handling pricing/customer data.
- **Certificate pinning**: not needed for v1 (UNVERIFIED reasoning, standard industry judgment): data is business CRM over TLS to your own API; pinning adds outage risk (cert rotation, needs native module/config plugin and new builds). Revisit if payments or very sensitive data appear.
- **Obfuscation**: Hermes bytecode plus R8 (default on in SDK 58 release builds) is adequate; do not rely on client-side secrets. No API keys that grant privilege in the bundle; EXPO_PUBLIC_* variables are public.
- **Rooted devices**: policy = detect-and-log (optional Play Integrity check server-side for sensitive actions), do not block staff; UNVERIFIED which Expo-compatible libs are maintained.
- Server side matters most: short-lived access tokens, refresh rotation, per-role authorization in the API, remote session revoke for lost staff phones, rate limiting on OTP endpoints.

## 9. Risks and open questions

1. SDK choice: SDK 57 (matches field app) vs SDK 58 (current, iOS 27 scene lifecycle default, R8 default, Expo Go SDK 58 store availability). Decide and pin; upgrading mid-build is costly. Also check every library used in the field app for SDK 58 compatibility (reanimated 4.x, notifications behaviour change).
2. The `.js`-suffix resolution on Metro was not verified on SDK 57/58; spike needed (also zod 4 on Hermes).
3. Whether web is on Tailwind v3 or v4 determines whether NativeWind is even an option.
4. Org vs personal Play account: Organization exemption from the 12-tester rule UNVERIFIED; D-U-N-S for India can take weeks; is Vastu Kitchen a registered entity with D-U-N-S already? Same for Apple.
5. Android developer verification could reach India in 2027; register package names early; confirm India inclusion at developer.android.com/developer-verification/guides.
6. EAS Update MAU limits: customer-facing OTA at scale needs a paid plan; free tier has no overage (updates would stop).
7. FlashList v2 chat behaviour and keyboard-controller interplay are unresolved upstream; budget time for a chat-list spike on a mid-range Android phone.
8. Bottom-sheet library compatibility with Reanimated 4.5 / RN 0.88: UNVERIFIED.
9. Apple review of a login-only, B2B-ish customer app: provide demo credentials; decide App Store public vs unlisted/Custom Apps (UNVERIFIED).
10. DPDP Act obligations (consent, retention, data localisation) for customer data and photos: needs legal input.
11. Hermes V1 status and release notes for SDK 58 were not fully read; read https://expo.dev/changelog/sdk-58 in full and https://reactnative.dev release notes for 0.87 and 0.88 before upgrading.
12. Several figures (Play verification days, Play fee) came from secondary sources found via search, not Google primary pages.
