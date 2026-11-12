# Native capabilities and store policy research (Vastu Kitchen mobile app)

Research date / "accessed" date on every citation: **2026-11-12**. Expo docs fetched were for **SDK 58**. Items I could not confirm from a primary page are marked **UNVERIFIED**. Nothing here is legal advice. Policies change often; re-check before each submission.

## 1. Recommendations and fallbacks (read this first)

| # | Capability | Recommendation | Fallback |
|---|---|---|---|
| 1 | Call log tracking | **Do NOT ship READ_CALL_LOG / READ_PHONE_STATE on the Play Store build.** Ship `tel:` (or `Linking.openURL`) + a "How did the call go?" sheet on return (outcome, duration picked from chips, note). Auto-log only the fact that the employee tapped Call. | A separate **non-Play "internal" Android flavor** (sideloaded APK or MDM-pushed) that adds the call-log reader. Optional server-side route: click-to-call / cloud-telephony provider that records call metadata (UNVERIFIED for the chosen vendor). |
| 2 | GPS attendance | Explicit Check-in / Check-out taps, one-shot `getCurrentPositionAsync({accuracy: High})`, **foreground only**, `ACCESS_FINE_LOCATION` (coarse is auto-added by Expo), no background location, no foreground service. Store `mocked` flag + accuracy + client timestamp. | Offline queue with client timestamp + elapsed-realtime; server reconciles and flags. Manual "reason" entry if GPS is denied. |
| 3 | Push | `expo-notifications` + **Expo push service** to start (FCM v1 creds on Expo), dev build required (not Expo Go). Data payload carries `url` for deep links. Create channels before asking for permission. | Direct FCM/APNs later if you need finer control; in-app inbox + polling on open as the reliability backstop. |
| 4 | Camera/files | `expo-image-picker` (system picker, no storage permission) + `expo-image-manipulator` to resize to JPEG before upload; `File.upload` with an app-side persistent queue + retry. | Foreground-only upload with resume-on-launch queue (Android background upload is not documented by Expo). |
| 5 | WhatsApp | `https://wa.me/<number>?text=` via `Linking.openURL`; https App Links / Universal Links on a domain you own for inbound links; SMS OTP with SMS Retriever / User Consent. | Copy-link + share sheet; manual OTP entry. |
| 6 | Biometric / storage | `expo-secure-store` for tokens (Keystore/Keychain) + `expo-local-authentication` as an optional app-lock gate (`USE_BIOMETRIC` auto-added). | PIN screen. |
| 7 | Contacts / clipboard | Do **not** request Contacts. Phone numbers come from CRM leads. Use `expo-clipboard` only for user-initiated copy. | Share sheet. |
| 8 | Data safety / DPDP | Complete Data Safety form (precise location, photos, contacts/call-history if ever collected), privacy policy URL, in-app account deletion, consent notice. | n/a |

**Call-log verdict (plain):** As a non-default dialer, a CRM is **not a listed permitted use** for READ_CALL_LOG, so the feature is **not viable on the public Play listing** and carries a high rejection/removal risk. Safest path: tel: link + post-call outcome prompt (Section 3.1). Distribution outside Play is technically possible but see the caveats below.

### Build/runtime implications
* Push, SecureStore biometrics, Face ID, background anything: **development build / EAS build required**. Expo Go does not support remote push on Android since SDK 53 ([Expo notifications docs](https://docs.expo.dev/versions/latest/sdk/notifications/), accessed 2026-11-12).
* Use Continuous Native Generation (config plugins in `app.config.ts`) so permission strings and manifest entries are reproducible.

---

## 2. Cross-cutting: UX for permission prompts in India

(Project guidance, not from a single source; general Android/Apple rules cited where relevant.)
* Ask in context, never on first launch. Show a one-screen rationale in Hindi/Bengali/English before the system dialog (Play requires a "prominent disclosure" dialog before location-in-background prompts; I recommend the same pattern for all sensitive permissions even though only background location is mandated: [Play Permissions policy page](https://support.google.com/googleplay/android-developer/answer/9799150), accessed 2026-11-12).
* Apple 5.1.2(i): the app may not **require** push, location or tracking to be enabled to use the app; 5.1.1(iv): if location is declined, offer a manual alternative ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), accessed 2026-11-12). Design attendance "manual with reason + manager approval" fallback.
* Customer app (iPhone + Android): request nothing at install. Camera/photos only when the user taps "Add photo". Notifications asked after the first meaningful event (e.g. after viewing a proposal), not at login.
* Staff app: a first-run "setup checklist" screen (notifications, battery-optimization exemption, location) is acceptable because staff are managed users.

---

## 3. Per-capability evidence

### 3.1 Call log tracking

**What Play allows today**
* Source: [Play SMS and Call Log permissions policy](https://support.google.com/googleplay/android-developer/answer/9047303), accessed 2026-11-12.
  * Apps using SMS/Call Log permissions generally "must be actively registered as the default SMS, Phone, or Assistant handler before prompting users." If the app stops being the default handler it must stop using the permissions immediately.
  * Non-default apps can only get a **temporary exception** when the permission enables a listed core function and there is "no alternative method." Listed uses: account verification by phone call (READ_CALL_LOG), anti-smishing, backup/restore, caller ID / spam / blocking, connected-device companion, cross-device SMS or call sync, device automation, enterprise device management (corporate login required), government/MNO quality-of-service reporting, in-vehicle hands-free, and a few SMS/banking items.
  * **A sales/CRM call tracker is not on the list.** The closest candidates are "device automation" and "enterprise device management" (the latter appears aimed at managed corporate devices; UNVERIFIED how Google reviews a CRM claim under either). Treat approval as unlikely.
  * Exceptions are "subject to Google Play review and approval"; apps lacking an approved Permissions Declaration Form "may be removed from Google Play."
  * **Dated change:** from **2027-01-27** account verification via phone call is no longer a permitted READ_CALL_LOG use (move to Digital Credentials API or SMS Retriever). Irrelevant for us but shows the list is shrinking, not growing.
* Declaration process: [Declare permissions for your app](https://support.google.com/googleplay/android-developer/answer/9214102), accessed 2026-11-12. You pick supported use cases that match core functionality, supply review instructions, and a **video demonstration**; test credentials only (never real user creds). Review "may require up to several weeks"; the app sits in pending publication. Testing-track bundles requesting the permission also trigger the alert and **block all publishing** until resolved or the permission is removed. Removing the permission gives a standard policy review (hours).
* Search found no Play policy text specific to CRM or sales apps (WebSearch, accessed 2026-11-12); rejection risk is my inference from the closed use-case list.

**READ_PHONE_STATE:** Not covered by the page above (that page covers SMS and Call Log groups). Whether READ_PHONE_STATE alone needs a declaration is **UNVERIFIED**; we do not need it, so do not request it.

**Distribution outside the public Play listing**
* Sideloaded APK: Play policy does not apply to APKs you distribute yourself (inference, UNVERIFIED in a primary source), but Android still shows the runtime Call Log permission prompt, and Play Protect may warn on unknown-source installs (UNVERIFIED). You carry update, signing and trust burden.
* Managed Google Play private app: Google's help says private apps are auto-approved for your organization (typically ready within ~10 minutes) and that apps published via the iframe "aren't subject to the same checks as other apps" ([Publish private apps from managed Play](https://support.google.com/googleplay/work/answer/9146439), accessed 2026-11-12). **Whether the SMS/Call Log permission policy and Permissions Declaration Form are waived for private apps is UNVERIFIED**; the Play Console Help page on private apps ([answer 6145139](https://support.google.com/googleplay/android-developer/answer/6145139)) was not read in full. Verify with Play support before betting the feature on it. Private apps also require a Google Workspace / managed-Play enrollment for the staff phones, which is an operational cost for a small firm.
* Internal-testing track: per the declaration page, an active test-track bundle that requests the permission triggers the declaration alert and blocks publishing, so internal tracks are **not** a loophole.

**Android 14/15/16 changes:** I found **no official Android 14/15/16 change to CallLog / READ_CALL_LOG** (search of developer.android.com results, accessed 2026-11-12; the call-log-permissions page I tried returned 404). Treat as UNVERIFIED. Known earlier history: Android 9 moved READ_CALL_LOG into its own CALL_LOG permission group ([XDA report](https://www.xda-developers.com/android-p-read-call-log-phone-number/), accessed 2026-11-12). Practical OEM caveat (UNVERIFIED): call-log writes after return can be delayed a few seconds, so any reader needs retry.

**Expo/RN way (if the internal flavor is built)**
* No first-party Expo module reads the call log. Options: a community native module (e.g. `react-native-call-log`, UNVERIFIED maintenance status) or a custom Expo Module (Kotlin) querying `CallLog.Calls` filtered by phone numbers passed in. Requires a development build. Declare `READ_CALL_LOG` only in the internal flavor's manifest via a config plugin gated on an env var, so the Play AAB never contains it (Play flags the manifest permission itself).
* Privacy guardrail from the existing design (upload only calls matching assigned leads) is good practice and also helps DPDP data minimisation, but note Play judges by permission use case, not by what you upload.

**Alternatives compared**

| Option | Play-safe | Accuracy | Effort | Notes |
|---|---|---|---|---|
| `tel:` + post-call prompt | Yes | Self-reported | Low | Recommended. Pre-fill "duration" chips; require outcome to close the follow-up. |
| App-foreground heuristic (time away from app between tap and return via `AppState`) | Yes | Approximate (includes dialing, voicemail, switching apps) | Low | Use as a hint/default duration, flag `source: "estimated"`. Server must not treat as evidence. |
| In-app dialer / ConnectionService (self-managed) | Only for VoIP calls | n/a for GSM | High | Self-managed ConnectionService is for VoIP, not carrier calls. Becoming the **default Phone handler** is the only compliant way to read logs on Play, but means replacing the staff phone dialer: not realistic. |
| Cloud telephony / click-to-call (Exotel/Knowlarity/etc. bridging employee and customer) | Yes | High, server-side records | Medium + per-minute cost | Not researched; vendor docs UNVERIFIED. Likely the best "real" call evidence in India. Customer sees a virtual number. |
| Third-party call-recording APIs/apps | Varies | Varies | n/a | Google restricts call recording APIs for third-party apps (UNVERIFIED primary source; general platform knowledge). Also raises consent/legal issues. Not recommended. |
| Accessibility service scraping | **No** | n/a | n/a | Not acceptable (Play policy and the brief). Do not pursue. |
| CallScreeningService | Needs the call-screening role | Incoming-focused | Medium | Out of scope for outbound CRM tracking (UNVERIFIED details). |

**Recommended UX:** tap Call -> log a pending "call attempt" row immediately (timestamp, lead id) -> on `AppState` returning to active, show a bottom sheet "Did you speak with <lead>? Outcome / Next follow-up date". Overdue pending attempts appear in the employee's to-do list.

### 3.2 GPS attendance

**Permissions (Expo)** ([expo-location docs](https://docs.expo.dev/versions/latest/sdk/location/), accessed 2026-11-12)
* `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION` are added automatically. `FOREGROUND_SERVICE_LOCATION` (Android 14+) and `ACCESS_BACKGROUND_LOCATION` are **optional and off by default** (`isAndroidBackgroundLocationEnabled: false`). Keep them off.
* One-shot fix: `getCurrentPositionAsync` with `Accuracy.High` (~10 m) or `Highest`; "obtaining a fix can take several seconds, especially indoors"; `getLastKnownPositionAsync` is fast but may be stale (never use for attendance).
* iOS (customer app does not need location; staff are Android per the brief): `locationWhenInUsePermission` string only.
* Expo Go includes the library, but background/foreground services are not available there; a one-shot foreground fix works.
* Android shows a user choice of precise vs approximate; the user may grant approximate only. Require `coords.accuracy <= ~50 m` and otherwise prompt to retry or enable precise (my threshold; tune after field tests).

**Play background-location policy** ([Play Permissions policy](https://support.google.com/googleplay/android-developer/answer/9799150), accessed 2026-11-12)
* Background location only if "central to core functionality" and "significant benefit"; request the minimum scope; foreground-service location must start from a user action and end when the action finishes. Declaration needs a <=30 s video, a prominent in-app disclosure containing the word "location" and background use, and only one declared feature.
* Our design (explicit tap, foreground) avoids all of this. Still complete the standard location declaration if prompted and keep the Data Safety entry accurate.
* Do not add periodic or geofenced tracking: it would need background location, review and a stronger DPDP justification (employee monitoring).

**Mock-location / fake-GPS detection**
* `LocationObject.mocked` in expo-location: on Android true when from a mock provider (expo-location docs above). Android's native `Location.isMock()` is the underlying API (reference page fetched but too large to read; exact API level UNVERIFIED, reported as API 31+, with `isFromMockProvider` earlier).
* Limitations: it only detects "mock provider apps" enabled in developer options; rooted/hardware spoofing and some apps evade it (general knowledge, UNVERIFIED). Layer: (a) store `mocked`, accuracy, provider; (b) server flags impossible travel (distance/time between consecutive check-ins) and distance from the site/shop geofence; (c) optionally Play Integrity API to detect rooted/tampered devices (UNVERIFIED, not researched); (d) optional selfie at check-in (adds photo/DPDP burden). Treat mocked=true as "needs manager approval", not an outright block.

**Battery:** one-shot fixes cost negligible battery; no background service means no OEM kill issue. This is the main reason to avoid continuous tracking.

**Offline check-in and reconciliation (design)**
1. On tap, immediately write a local record `{id (uuid), type, deviceTime, elapsedRealtime, lat, lng, accuracy, mocked}` to local storage (SQLite/MMKV) and show "Saved, will sync".
2. Sync queue retries with idempotency key = `id`.
3. Server stores `client_time`, `received_at`, `skew = received_at - client_time` only meaningful for immediate syncs. Because the user can set the device clock, also send `elapsedRealtime` and, on next sync, the server computes a lower/upper bound for the true time; flag if client time is in the future or beyond a tolerance (e.g. 10 min) of the plausible window. Employees can see but not edit synced times; corrections go through a manager approval.
4. If GPS fix fails offline, GPS works without internet (satellite based), so offline check-in is usually fine; only network-assisted indoor fixes degrade.

### 3.3 Push notifications

**Setup facts** ([expo-notifications docs](https://docs.expo.dev/versions/latest/sdk/notifications/), [Expo push overview](https://docs.expo.dev/push-notifications/overview/), [Sending notifications](https://docs.expo.dev/push-notifications/sending-notifications/), all accessed 2026-11-12)
* **Expo Go:** remote push unavailable on Android from SDK 53; dev build needed.
* Config plugin options: `icon`, `color`, `defaultChannel`, `sounds`; iOS `enableBackgroundRemoteNotifications` (default false).
* Android 8+: every notification needs a channel; a fallback "Miscellaneous" channel is created if none given; after creation only name/description can change, so **decide channel ids now** (suggest `leads`, `tasks`, `proposals`, `complaints`, `attendance`).
* Android 13+: the OS permission prompt appears only after at least one channel exists; call `setNotificationChannelAsync` before requesting permission/token. (POST_NOTIFICATIONS is not named on the Expo page; it is the underlying runtime permission, listed in Android docs, not re-fetched: UNVERIFIED from a primary page here.)
* Tokens: `getExpoPushTokenAsync` (needs EAS `projectId`) vs `getDevicePushTokenAsync` (native FCM/APNs). Expo's page says token errors should be wrapped in try/catch and retried when online; `addPushTokenListener` handles token rotation.
* Expo push service: 100 messages/request, 600 msgs/sec/project, receipts available (check ~15 min later, retained 24 h), `DeviceNotRegistered` means stop sending to that token; payload ~4 KiB; `priority: high`; `ttl`; `channelId` must exist on the device or the notification is not shown.
* **Expo service vs direct FCM:** Expo is simpler (one API for Android + iOS, receipts). Direct gives full platform features at more complexity. Start with Expo; the server wraps sending behind one function so switching is contained. FCM v1 credentials (service account) go in Expo's credentials.

**Token lifecycle (design)**
* Register after login: `POST /devices {userId, token, platform, appVersion, locale}` upsert by token. Re-register on app start if changed, on `addPushTokenListener`, and on login switch. Delete the token on logout and on `DeviceNotRegistered` receipts. One user can have several devices.
* Staff tokens are linked to the employee; customer tokens to the customer account/phone.

**Deep links from notification:** put `{ "url": "vastu://projects/123" }` (or https App Link path) in `data`. In the Expo Router root layout read `getLastNotificationResponse()` (cold start) and subscribe to `addNotificationResponseReceivedListener`; `router.push(data.url)` (documented in the expo-notifications page). Define routes: `/projects/:id`, `/complaints/:id`, `/todos/:id`, `/proposals/:id`. Server must send only IDs; the app fetches and authorizes. Don't put private data in the payload (lock-screen visibility).

**iOS APNs:** needs an Apple Developer account (paid), push capability and key; Expo creates/stores the APNs key via EAS credentials. Push needs a physical device build. Customers on iPhone get banners only after granting permission; per Apple 5.1.2(i) the app must work if declined.

**Indian OEM reliability** ([dontkillmyapp.com](https://dontkillmyapp.com/), accessed 2026-11-12): ranks Xiaomi 5/5, OnePlus 5, Samsung 5, Huawei 5, Oppo 4, Vivo 3, realme 3, Tecno 3, Motorola 3 (higher = worse); Pixel/AOSP 0. The page snippet I read did not include fix steps (see per-vendor pages, UNVERIFIED here). Practical mitigations:
1. Use **high-priority FCM** (`priority: high`) for time-sensitive items (new lead assigned, complaint); keep payloads small.
2. Staff onboarding screen with deep links to the OEM's "Autostart / Battery: No restrictions / Lock in recents" settings (`Linking.openSettings()` for app settings; ignore battery-optimization intent unless you add the permission: requesting `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` is itself Play-restricted and UNVERIFIED here; avoid on Play, fine for managed staff phones).
3. Don't rely on push alone: refresh data on app foreground, show an unread badge/inbox, and for critical alerts add a **WhatsApp template or SMS fallback** from the server if a push receipt shows error or the item stays unacknowledged for N minutes (you already have a WA AGENT template client per the repo history).
4. Track per-device delivery stats (receipts + opened events) to find chronically failing devices.

### 3.4 Camera, photos, files

**expo-image-picker** ([docs](https://docs.expo.dev/versions/latest/sdk/imagepicker/), accessed 2026-11-12)
* Android: library manifest adds `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` by default and `RECORD_AUDIO`; plugin settings `cameraPermission: false` / `microphonePermission: false` block the respective permissions. **Strip the storage and audio permissions** with the plugin/`blockedPermissions` so Play review and the Data Safety form stay minimal (the picker uses the system photo picker; the page does not explicitly address Android's Photo Picker, UNVERIFIED). Note Play has a Photo and Video permissions policy for broad media access (not fetched: UNVERIFIED), another reason to avoid READ_MEDIA_*.
* iOS: `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription` (plugin sets them). Apple 5.1.1(iii) asks to prefer the out-of-process picker over full Photos access.
* **HEIC:** since SDK 54 default returns original assets including HEIC/AVIF uncompressed. Sending raw HEIC to a web dashboard is a problem (browsers don't render it). Always convert to JPEG on device with `expo-image-manipulator` (`SaveFormat.JPEG`), e.g. longest edge 1600-2048 px, quality 0.7-0.8, which is typically a few hundred KB (my sizing guidance). `quality` in the picker is applied only on some paths; do the resize step explicitly.
* EXIF: `exif: true` optional; iOS camera-captured images exclude GPS tags. Strip EXIF location of customer photos before upload unless needed (privacy).
* Site-measurement photos: use `launchCameraAsync` (needs CAMERA runtime permission) or `expo-camera` only if a custom viewfinder is needed (not fetched).

**Uploads on flaky networks** ([expo-file-system docs](https://docs.expo.dev/versions/latest/sdk/filesystem/), accessed 2026-11-12)
* New API: `File.upload(url, options)` and `file.createUploadTask` (progress, cancel); multipart or binary; legacy `createUploadTask`-style functions live in `expo-file-system/legacy`.
* **iOS:** `sessionType` defaults to `background` (native transfer continues when suspended) but the JS task is not restored after the app is killed. **Android:** `sessionType` ignored; **the docs do not describe background upload behaviour on Android**. So don't promise true background upload.
* Design: persistent upload queue (SQLite) with states pending/uploading/done/failed; copy picked image to app document dir first; compute checksum; request a presigned/tus-style URL (resumable protocols are UNVERIFIED for our backend; simplest is chunk-less small JPEGs with retry + idempotency key). Retry with backoff on `NetInfo` regained, on app foreground, and from `expo-background-task` (UNVERIFIED: schedule is opportunistic, minimum ~15 min, no guarantees; not fetched). Show "3 photos waiting to upload" so users do not close the app.
* Downloads of PDFs: `File.createDownloadTask` supports pause/resume and persisted state.

**PDF viewing/sharing:** Open via `expo-sharing` (share sheet to WhatsApp, Drive, etc.) or `expo-print`/system viewer via `Linking`/`expo-intent-launcher`; an in-app viewer needs a library (e.g. `react-native-pdf`, needs dev build, UNVERIFIED). Recommended: download to cache, then `Sharing.shareAsync(uri, {mimeType:'application/pdf'})`; also offer "Open in..." For proposals keep sending the **link** via WhatsApp template as already built.
**Receiving shares (share intent into app)** is not built into Expo; community `expo-share-intent` exists (UNVERIFIED maintenance). Defer; low value for v1.

### 3.5 WhatsApp interop, deep links, OTP

* **Open WhatsApp chat:** `https://wa.me/<number>` with the number in international format with country code, no `+`, zeros, brackets or dashes (for India `91XXXXXXXXXX`); `?text=` takes URL-encoded text ([WhatsApp FAQ click-to-chat](https://faq.whatsapp.com/5913398998672934), accessed 2026-11-12). Use `Linking.openURL`. On Android 11+ `Linking.canOpenURL` for custom schemes needs `<queries>`; wa.me https needs no query declaration (UNVERIFIED). On iOS, `whatsapp://` in `canOpenURL` requires `LSApplicationQueriesSchemes`; simply opening the https wa.me link avoids that.
* **Inbound deep links (WhatsApp message -> app):** use https links on a domain you control (e.g. `app.vastukitchen.in/p/<token>`). Android: `android.intentFilters` with `autoVerify: true`, and host `/.well-known/assetlinks.json` (`relation: delegate_permission/common.handle_all_urls`, `package_name`, SHA-256 fingerprints; get from `eas credentials` and from **Play Console > App signing** when Play re-signs; served over HTTPS as `application/json`; changes require a rebuild; verification can take 20 s or more) ([Expo Android App Links](https://docs.expo.dev/linking/android-app-links/), accessed 2026-11-12). iOS: Associated Domains entitlement + `apple-app-site-association` file (iOS Universal Links doc not fetched: UNVERIFIED; standard practice). WhatsApp's in-app browser may open links in its own webview first; keep a web fallback page that offers "Open in app" and an install link. The repo already sends a proposal link through WhatsApp, so the same URL can be the App Link (customers without the app land on the web proposal).
* Expo Router handles the incoming URL path automatically when routes match.
* **OTP / SMS autofill:** Google's SMS Retriever API needs no extra app permissions; the SMS includes an app-hash that routes it to your app ([SMS Retriever overview](https://developers.google.com/identity/sms-retriever/overview), accessed 2026-11-12). The page did not cover the SMS User Consent API (no hash needed; user taps Allow) : UNVERIFIED here. RN libraries (UNVERIFIED maintenance, check at build time): `react-native-otp-verify` / `@eabdullazyanov/react-native-sms-user-consent`. Do **not** use READ_SMS/RECEIVE_SMS (restricted by the same Play policy as call log). iOS: `textContentType="oneTimeCode"` on the TextInput gives keyboard autofill with no permission.
* **OTP via WhatsApp:** autofill is not available from a WhatsApp message (no SMS Retriever); users copy/paste or the WhatsApp authentication template "copy code"/one-tap autofill button (WhatsApp Business feature, UNVERIFIED here; the repo already has a login-code template by id). Provide SMS as a fallback channel and consider India DLT registration for SMS (UNVERIFIED, regulatory requirement for commercial SMS in India).
* **Apple/Google login rules:** Apple 4.8 requires an equivalent privacy-preserving login option only if the app uses **third-party or social login** for the primary account; apps that "exclusively use your company's own account setup and sign-in systems" are exempt. Phone OTP issued by us is our own system, so 4.8 does not apply; do not add Google/Facebook login without adding Sign in with Apple ([App Review Guidelines 4.8](https://developer.apple.com/app-store/review/guidelines/), accessed 2026-11-12). 5.1.1(v): if the app supports account creation it must offer **in-app account deletion**; apps without significant account features should work without login. App Review needs a **demo account** with a fixed OTP (provide reviewer credentials; for phone OTP create a reviewer number whitelist). Google Play also asks for login credentials in App access and, for apps with account creation, an account-deletion URL (UNVERIFIED primary source for the deletion requirement; widely documented in Data safety).
* From 2027-01-27 Play disallows READ_CALL_LOG for call-based verification, so do not plan "missed-call OTP" via call log (Play policy page above).

### 3.6 Biometric, secure storage, app lock
* `expo-secure-store` (SDK 58): Android Keystore-encrypted SharedPreferences, iOS Keychain; `requireAuthentication` ties reads to biometrics/passcode and invalidates values when biometrics change; Android Auto Backup excludes entries; iOS data may persist across reinstall; works in Expo Go but `requireAuthentication` doesn't with Face ID there ([docs](https://docs.expo.dev/versions/latest/sdk/securestore/), accessed 2026-11-12). Store refresh/session token here, never in AsyncStorage.
* `expo-local-authentication`: Android `USE_BIOMETRIC` added automatically; iOS needs `NSFaceIDUsageDescription` (plugin `faceIDPermission`); `biometricsSecurityLevel: 'strong'` for Class 3; `disableDeviceFallback`; Face ID needs a dev build ([docs](https://docs.expo.dev/versions/latest/sdk/local-authentication/), accessed 2026-11-12).
* **App lock design:** optional toggle in Settings (staff default ON for the admin/finance roles). Lock after N minutes in background (track `AppState` timestamps); on unlock call `authenticateAsync`; fallback to device credential; after 5 failures force re-login. Biometric is a **local** gate, not a server auth factor. No store-policy cost beyond a Face ID string.

### 3.7 Contacts and clipboard
* **Contacts:** Apple 5.1.2(iv)/(v) forbids using Contacts to build your own contact database and contacting people from Contacts except at the user's explicit, individual initiative; 5.1.1(iii) prefers the system picker ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), accessed 2026-11-12). On Play, READ_CONTACTS is a sensitive permission and Data Safety counts contacts as collected data (and the Data Safety page lists call history under Contacts: [Data safety help](https://support.google.com/googleplay/android-developer/answer/10787469), accessed 2026-11-12). Recommendation: never read device contacts. To save a lead to the phonebook, use an add-contact intent via share/`Linking` or let the user do it (needs no permission, UNVERIFIED in detail). Show the lead's number from the CRM.
* **Clipboard:** writing text (copy link/address) needs no permission via `expo-clipboard` (library not fetched: UNVERIFIED). Reading the clipboard shows a paste notice on iOS 14+ and Android 12+ toast (general platform behaviour, UNVERIFIED here); avoid reading it, except via an explicit "Paste" button. Don't put OTPs into the clipboard programmatically.

### 3.8 Data safety, privacy policy, DPDP

**Play Data safety** ([help](https://support.google.com/googleplay/android-developer/answer/10787469), accessed 2026-11-12)
* Mandatory for every app, with a privacy policy link; must stay accurate. "Collection" includes data sent off-device by third-party SDKs (Expo, Firebase/FCM, analytics, Sentry).
* Declare: **precise location** (< 3 km2 area counts as precise) for staff attendance; **photos** (Photos and videos); personal info (name, phone, email, address); **user IDs**, device IDs (push token); financial info if payments/quotes; **call history sits under the Contacts type** (only if we ever collect it, e.g. in the internal flavor; that flavor is not on Play, but keep the policy and Data Safety coherent if the app is ever submitted).
* Declare encryption in transit (HTTPS) and a deletion request mechanism (URL plus in-app).
* Staff app and customer app: if published as one app with roles, the form must cover the union of practices; consider two separate listings (customer public; staff via private/closed distribution) to keep the customer app's data profile small. (Recommendation.)

**Apple** ([guidelines](https://developer.apple.com/app-store/review/guidelines/), accessed 2026-11-12): privacy policy in App Store Connect and in the app (5.1.1(i)), consent for data collection and a way to withdraw (5.1.1(ii)), account deletion in-app, location purpose strings (5.1.5), disclose third-party sharing (5.1.2(i)). Apple Privacy Nutrition Labels also required (not fetched: UNVERIFIED details). Apple's rules for private/unlisted distribution (Business Manager custom apps) were in the truncated part of the page: UNVERIFIED; irrelevant if staff are Android-only.

**India DPDP Act 2023 (brief)**
* The DPDP Rules were notified on **2025-11-13** with phased commencement: Data Protection Board provisions immediately; **consent-manager provisions at 12 months (2026-11-13, i.e. tomorrow relative to the research date)**; **substantive obligations (notice, security safeguards, breach intimation, retention/erasure, etc.) at 18 months, 2027-05-13** ([DPDP Rules summary](https://www.consent.in/blog/dpdp-rules), [DPDP Forum bulletin](https://dpdpaforum.org/bulletin/the-rules-2025-notified), [Vinsys summary](https://www.vinsys.com/blog/dpdp-act-compliance-deadline-nov-2026-for-consent-manager), accessed 2026-11-12). These are secondary sources; one searched source gave conflicting dates and was disregarded. Confirm against the Gazette / MeitY text: **UNVERIFIED primary**.
* Implications for us (not legal advice): Vastu Kitchen is a Data Fiduciary for customer and lead data. Plan for: a clear **notice** at first use (purposes: lead follow-up, design/quotation, service), **consent** for optional processing (marketing WhatsApp, photos of the home), withdraw-consent and **deletion** flows, retention schedule, breach process, security safeguards (encryption, role-based access, audit log), and a contact for grievances.
* Employee monitoring (attendance location, call metadata): whether it falls under the employment "legitimate use" ground is **UNVERIFIED** (searches did not address it). Minimise anyway: location only at check-in/out, no background tracking, call data limited to leads, written employee notice, retention limits.
* Children's data: not relevant.
* Cross-border: if the backend/LLM/vendor hosts are outside India, record it in the notice (UNVERIFIED rules detail).

---

## 4. Permissions and store-review checklist

**Android manifest (Play build) target list**
- [ ] `INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE` (default)
- [ ] `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` (staff build only; customer build excludes via plugin/`blockedPermissions`)
- [ ] `CAMERA` (runtime, on tap); `POST_NOTIFICATIONS` (runtime, after channels exist)
- [ ] `USE_BIOMETRIC` (auto)
- [ ] `RECEIVE_BOOT_COMPLETED` is added by expo-notifications automatically; `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` appear in the notifications library docs; remove unless you schedule exact local alarms (exact-alarm permissions have their own Play policy: UNVERIFIED)
- [ ] REMOVE/BLOCK: `READ_CALL_LOG`, `READ_PHONE_STATE`, `READ_SMS`, `RECEIVE_SMS`, `READ_CONTACTS`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_*`, `RECORD_AUDIO`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE*`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. Inspect the merged manifest from the built AAB (`bundletool` or `aapt dump permissions`) before every release; library manifests add permissions silently.
- [ ] App Links `intentFilters` with `autoVerify`; `assetlinks.json` contains both the upload (EAS) and **Play App Signing** SHA-256.

**Play Console**
- [ ] Data safety form completed and matches SDKs (FCM, Sentry, etc.); privacy policy URL live and mentions location, photos, phone numbers, push tokens, retention, deletion, contact.
- [ ] Account deletion URL + in-app deletion.
- [ ] App access: provide a test staff login and OTP bypass number for reviewers.
- [ ] Location declaration form if shown; prominent disclosure dialog before the location prompt.
- [ ] Permissions Declaration Form only if any sensitive permission remains (should be none).
- [ ] Target the current required target API level (current requirement not fetched: UNVERIFIED; check Play Console "App content").
- [ ] Consider staging via Closed testing; remember a bundle with a declared-permission request on any track blocks publishing.

**Apple App Store**
- [ ] Privacy policy URL, Privacy Nutrition Labels, account deletion, demo account.
- [ ] Info.plist strings: camera, photo library, Face ID, location when-in-use (only if used); no tracking prompt unless an ad/analytics SDK tracks.
- [ ] Push capability + APNs key; app works if notifications are declined.
- [ ] No third-party social login (or add Sign in with Apple).
- [ ] Associated Domains + AASA file for Universal Links.
- [ ] Contacts not requested.

**Engineering/QA**
- [ ] Test on Xiaomi/Redmi, Oppo/Realme, Vivo, Samsung and a Pixel: notification arrival with app killed, after a day idle, and with battery saver on.
- [ ] Test on Android 13/14/15/16 for notification and location prompt flows; test deny, "ask every time", approximate-only.
- [ ] Test offline check-in then reconnect, clock-skew case, mock-location app enabled.
- [ ] Test large HEIC from iPhone and camera JPEGs on 2G/3G throttled network, kill-app mid-upload.
- [ ] Test App Link from WhatsApp on a device with and without the app installed.

---

## 5. Open questions to resolve before build
1. Do managed Google Play private apps (iframe or Play Console "private") waive the Call Log Permissions Declaration? Ask Play support; this decides whether the internal call-log flavor can live in managed Play instead of sideloaded APK. (UNVERIFIED.)
2. Which cloud-telephony vendor, if any (cost per minute, recording consent, DLT)?
3. Are staff phones company-owned? If yes, an MDM (e.g. Android Enterprise) makes the internal flavor and battery whitelisting far easier.
4. One app with roles or two apps (customer, staff)? Recommended two listings for a smaller review/Data Safety surface.
5. Confirm Play's current target-API requirement and Android 15/16 call-log behavior from developer.android.com (not located in this research).

## 6. Sources (all accessed 2026-11-12)
- Play SMS/Call Log policy: https://support.google.com/googleplay/android-developer/answer/9047303
- Play Permissions / background location: https://support.google.com/googleplay/android-developer/answer/9799150
- Declare permissions: https://support.google.com/googleplay/android-developer/answer/9214102
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Managed Play private apps: https://support.google.com/googleplay/work/answer/9146439
- Expo: https://docs.expo.dev/versions/latest/sdk/notifications/ , /location/ , /imagepicker/ , /filesystem/ , /securestore/ , /local-authentication/ , https://docs.expo.dev/push-notifications/overview/ , https://docs.expo.dev/push-notifications/sending-notifications/ , https://docs.expo.dev/linking/android-app-links/
- Google SMS Retriever: https://developers.google.com/identity/sms-retriever/overview
- Apple guidelines: https://developer.apple.com/app-store/review/guidelines/
- WhatsApp click-to-chat: https://faq.whatsapp.com/5913398998672934
- OEM battery killers: https://dontkillmyapp.com/
- Android broadcasts/background (cached app states, delivery not guaranteed): https://developer.android.com/develop/background-work/background-tasks/broadcasts
- DPDP: https://www.consent.in/blog/dpdp-rules , https://dpdpaforum.org/bulletin/the-rules-2025-notified , https://www.vinsys.com/blog/dpdp-act-compliance-deadline-nov-2026-for-consent-manager
