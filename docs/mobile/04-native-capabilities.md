# 04 - Native capabilities (Vastu Kitchen mobile app)

Status: design proposal, 2026-11-12. Audience: the mobile team and coding agents. Source: `docs/mobile/research/*` (cited as research-native, inventory-*), ADR-0005, `docs/02-product/hr.md`. Expo SDK 58 docs were the reference in research. Anything marked **UNVERIFIED** was not confirmed from a primary page by the research; verify against the versioned Expo docs (https://docs.expo.dev/versions/v58.0.0/ or the SDK you pin) before coding. Never invent an API: if a signature is not in the pinned docs, stop and check.

Conventions: every "Decision (proposed)" is a recommendation from research, open to review. Copy strings in quotes are the exact English text the app shows (all strings go through i18n, `en.json` first; hi/bn later). "GAP" ids refer to the inventories (named per capability). All native features need a **development build** (EAS), not Expo Go, unless said otherwise. Config lives in `app.config.ts` (config plugins, Continuous Native Generation).

Roles: the staff app serves ADMIN, SALES, DESIGNER, TECHNICIAN, OFFICE, HR; the customer app serves CUSTOMER. Customers see no calls, visits, attendance or location prompts.

---

## 1. Call + post-call outcome sheet (SALES, ADMIN)

**Decision (proposed):** place the call with a `tel:` link and capture the result in a "How did the call go?" bottom sheet when the app returns to the foreground. Alternative: an internal, sideloaded Android flavour that reads the call log (the current ADR-0005 design), or cloud telephony (click-to-call) later. Why: `READ_CALL_LOG` is restricted by Google Play to default phone/SMS handlers plus a closed list of use cases; a CRM call tracker is not on the list, so the public Play listing would risk rejection or removal (research-native 3.1). This **supersedes ADR-0005 for the Play build**; ADR-0005 stays valid only for the optional internal flavour. Record this as a new ADR before build.

### User flow
1. Lead detail has a sticky action bar: Call, WhatsApp, Status, +Proposal. Lead list rows have a swipe action Call.
2. Tap Call. The app first writes a local "call attempt" row `{clientId (uuid), leadId, startedAt (device time), source: 'tel_tap'}` to the SQLite outbox, then `Linking.openURL('tel:+91XXXXXXXXXX')` (number built from the 10-digit stored phone; `altPhone` offered as a second button). The system dialer opens (no Android permission needed for `tel:` opening the dialer).
3. The app goes to the background. On `AppState` change to `active`, if a pending attempt is younger than 60 minutes, the sheet opens over the lead screen:
   - Title "How did the call go?" with the lead name and number.
   - "Did you speak with <name>?" Yes / No (maps to `answered`).
   - Outcome chips: Interested, Call back, Not interested, No answer, Wrong number (API enum `INTERESTED, CALL_BACK, NOT_INTERESTED, NO_ANSWER, WRONG_NUMBER`). Choosing No defaults to No answer.
   - Duration chips: "Under 1 min", "1-3 min", "3-10 min", "10+ min" (self-reported); the app also computes the time away from the app between tap and return as a hint (`estimated`), shown as "About 4 min away from the app".
   - Note (optional, 1000 chars).
   - Next follow-up: chips Today, Tomorrow, In 3 days, In a week, Pick date. Required when the outcome is Call back or Interested.
   - Buttons "Save" and "Skip for now".
4. Save writes the outbox row (status `queued`), closes the sheet, shows a toast "Call saved". The sync loop POSTs it.
5. Skip leaves the attempt pending: the Today/To-do list shows "Log your call with <name>" until saved or dismissed ("Discard attempt" asks for confirmation).
6. If the lead is NEW the server moves it to CONTACTED on the first call (existing behaviour); the lead screen refetches.

### What the API stores today (inventory-leads, section 5)
`POST /leads/:id/calls` (ADMIN, SALES) body `{startedAt (ISO), durationSec 0..14400, answered, outcome?, note? <=1000}`. 201 when new, 200 when already recorded (idempotent on lead + user + startedAt, so retry is safe). 400 if `startedAt` is more than 5 minutes in the future. Side effect: timeline `CALL` row, NEW to CONTACTED. `GET /leads/:id/calls` returns `{id, leadId, user, startedAt, durationSec, answered, outcome, note}`.

**Missing on the server (propose):**
- **Next follow-up date has nowhere to go.** The call body has no follow-up field. Options: add `followUpAt` to `RecordCallBodyDto` and the lead; or, interim, write the follow-up through the existing lead/status route and a to-do. Needs a product decision (open question 1).
- **`source` and `estimated`** (`self_reported | estimated`) so Admin call-stats can distinguish self-reported duration from a measured one. `GET /leads/call-stats` currently sums talk seconds as if measured.
- No batch upload (GAP G1) and no server check that the number matches the lead; matching is client-side. With `tel:` the app already knows the lead, so no matching is needed.
- Role scope: OFFICE cannot log calls (hidden sheet and button).

### Expo/RN implementation
- `Linking` from `react-native` (`openURL`); `AppState` for the return event; bottom sheet via an Expo Router modal route with `presentation: 'formSheet'` or `@gorhom/bottom-sheet` v5 (compatibility with the pinned Reanimated is UNVERIFIED; research-stack 5). Outbox in `expo-sqlite`; ids by `expo-crypto` UUID (verify the function name in the docs).
- No config plugin and no dev build needed for this capability alone. Android 11+ `<queries>` for `tel:` are not needed because the app only opens the link, never calls `canOpenURL` (UNVERIFIED on all OEMs; test on a Xiaomi and a Samsung).
- Edge cases: user returns after hours (attempt older than 60 min: sheet still offered from the to-do entry, `startedAt` stays the tap time); app killed while on the call (pending attempt is in SQLite, sheet offered on next launch); dual SIM chooser is OS-side; if no dialer exists (tablet) show "This device cannot place calls" and offer Copy number.

### Permissions and copy
None requested. No `READ_CALL_LOG`, no `READ_PHONE_STATE` (research: do not request; READ_PHONE_STATE declaration need is UNVERIFIED, we avoid it anyway).
In-app notice shown once on first Call tap (not an OS prompt): "Vastu Kitchen records that you called this customer, when, and what you tell us after the call. It does not read your phone's call history."

### Failure / offline
- Offline: Save always succeeds locally; chip "1 waiting to send". Retry on NetInfo regained, on foreground. Idempotent by (lead, user, startedAt), so double sends are harmless.
- 404 (lead reassigned meanwhile): item moves to "Needs attention" with "This lead was reassigned, your call was not saved."; 400 clock skew: correct `startedAt` to now minus elapsed and retry once.

### Store policy / privacy
No sensitive permission, no Play declaration. Calls recorded are the employee's own statements about their own leads; DPDP notice to employees must say so (section 9). Internal-flavour caveat: a bundle on any Play track that declares `READ_CALL_LOG` blocks publishing (research-native 3.1), so the permission must be added only by a config plugin gated on an env var, and the Play AAB must be checked with `aapt dump permissions`.

### Acceptance criteria
- Tap Call opens the dialer within 1 s and creates a local attempt before leaving the app.
- Returning to the app shows the sheet in under 500 ms; Save works in airplane mode and syncs exactly once after reconnect (verify no duplicate in `GET /leads/:id/calls`).
- Killing the app during the call and relaunching still offers the sheet.
- The built Play AAB contains none of READ_CALL_LOG, READ_PHONE_STATE, READ_CONTACTS.
- Outcome required to close a follow-up task; OFFICE role sees no Call logging.

---

## 2. Visit check-in / check-out with GPS and photo (SALES, ADMIN)

**Decision (proposed):** a visit is recorded with one explicit foreground high-accuracy GPS fix plus an optional site photo, queued offline. Alternative: derive visits from background location (rejected: needs background location and a Play declaration). Why: matches the existing `POST /leads/:id/visits`; minimal permissions.

### User flow
1. Lead detail, button "Check in visit" (also on a WON lead and on Customer detail for a returning customer).
2. First time: location rationale screen (copy in section 8). Then the OS prompt. Then the sheet "Checking in at <lead name>": spinner "Finding your location...", live accuracy "Accuracy 12 m".
3. One fix via the foreground one-shot call with high accuracy and a 20 s timeout (see section 3 implementation). If accuracy is worse than about 50 m, show "Location is not accurate yet. Move near a window or step outside." with Retry and "Use this anyway" (stores accuracy).
4. Sheet then shows a map-free summary (lat/lng rounded, time), note field (1000 chars), "Add photo" (camera or gallery, section 5), and a toggle "Also mark this lead as Visit" (default on, calls `POST /leads/:id/status {status:'VISIT'}` because the visit endpoint does not move the status).
5. Save: outbox row; toast "Visit saved". Check-out is not an API concept for visits today: **there is no visit check-out**. A "Check out" button is shown only if the product adds `endedAt` (open question 2); until then the screen is "Check in" only and the doc says "visit".

### API today and gaps
`POST /leads/:id/visits {at? , latitude, longitude, note?, photoUrl?}`; `at` is client-supplied (the phone can set the time). Writes timeline `VISIT`. GAPs (inventory-leads section 15):
- **G2: no lead-scoped upload ticket.** `photoUrl` is a plain URL; signed uploads exist only under `/projects/:id/uploads/sign`. Propose `POST /leads/:id/uploads/sign` returning the same `UploadTicketDto`, then the visit body accepts `photoPublicId` (checked to be inside the lead folder), as posts do.
- **G4: not idempotent.** Add `clientId` (unique per lead + user) or dedupe on (lead, user, at). Until fixed the app must not auto-retry a timed-out visit POST without first listing `GET /leads/:id/visits` and matching on `at`.
- **G5: lat/lng required, no accuracy, no mock flag, no address.** Propose optional `accuracy`, `mocked`, `reason` (when location is denied, with `latitude/longitude` made optional for a "manual" visit that a manager sees flagged).
- Photo is optional: the visit saves first, the photo uploads after and attaches by a follow-up call (needs an attach endpoint, or order the outbox: upload, then POST visit with the id).

### Failure / permission states
- Permission denied once: sheet shows "Location is off. You can still record the visit with a reason." with Retry and "Record without location" (needs G5). Denied with "Don't ask again": button "Open settings" via `Linking.openSettings()`.
- Approximate-only grant (Android lets the user choose): treat accuracy as bad, show "Allow precise location in Settings".
- GPS timeout: Retry, or "Record without location".
- Mock location detected (`mocked: true` on the fix): still saved, flagged for the manager (never an outright block).

### Offline, battery, privacy
GPS works without data; queue the visit with `{clientId, at, lat, lng, accuracy, mocked}`. One-shot fix, negligible battery. Photos: EXIF location stripped before upload; the visit's own lat/lng are the declared location. Photo of a customer's home is personal data: notice and retention in section 9.

### Acceptance criteria
- Check-in completes in under 15 s outdoors on a mid-range phone; accuracy shown; offline save then single record on the server.
- Denied permission never crashes and offers the documented alternatives.
- Photo is a JPEG of at most about 1600 px (section 5); no EXIF GPS in the uploaded file.
- A forced retry produces one visit (after G4) or is detected by the list-and-match guard (before G4).

---

## 3. Attendance check-in / check-out (GPS-tracked staff)

**Decision (proposed):** two explicit buttons, each taking one foreground high-accuracy fix, with the location permission limited to `ACCESS_FINE_LOCATION` (coarse comes with it automatically) and no background location or foreground service. Client timestamps are sent for offline replay, the mock-location flag is stored, the server does plausibility checks. Alternative: periodic or geofenced background tracking (rejected: Play background-location review, battery, and employee-monitoring risk under DPDP). Why: smallest permission footprint and an auditable, user-initiated action (research-native 3.2).

Eligibility: only active staff with `attendanceType = GPS` (hr.md). Others get 403. The owner has `attendanceType null` and `GET /attendance/me` returns 404: hide the Attendance screen when `user.attendanceType !== 'GPS'` (GAP G15); never show 404 as an error.

### User flow
1. Attendance tab shows today's card: status (Not checked in / Checked in at 09:04 / Checked out at 18:10), the big button, and the month calendar below.
2. Tap "Check in". Button disables ("Getting location..."). The app takes one fix (high accuracy, 20 s timeout), builds `{location:{lat,lng,accuracy}, capturedAt, elapsedMs, mocked, clientId}`, writes it to the outbox, and POSTs.
3. Success: haptic + "Checked in at 9:04 AM" using the **server time** returned (the server clock is authoritative online; hr.md). Offline: "Saved at 9:04 AM. Will send when you are online." with a Pending chip.
4. Check-out is the same; the last check-out of the day wins. Check-out before check-in: "Check in first." (409).
5. Double tap keeps the first time (server idempotent for check-in). The app also disables the button while a row is in flight.
6. Local reminders (client-only, since the server has none): optional "Did you forget to check out?" local notification at 19:00 if checked in and not out (scheduled with the local notification API of `expo-notifications`; verify the trigger types in the docs). Setting is a toggle, default on.

### Server work (GAPs in inventory-people)
- **G1 (main gap): the server clock is the only clock.** `POST /attendance/check-in|check-out` ignore client time (hr.md: "the server's clock sets every time"), so an offline punch replayed hours later records the replay time. Propose an optional `capturedAt` (ISO) and `elapsedRealtimeMs`/`clientId`; the server accepts it only when on the same business day, not in the future, no older than about 12 h, computes a plausible window using elapsed time since boot, stores both `capturedAt` and `receivedAt`, and marks the day `clientCaptured: true`. Corrections stay with Admin/HR `PUT`. This is a deliberate change to the hr.md rule and needs product sign-off.
- Location sub-document gets `mocked`, `provider` (optional) in addition to `accuracy`; server flags: `mocked`, accuracy > 100 m, impossible travel against the previous punch, client time skew > 10 min. Flagged days show "Needs manager review" to Admin/HR; flagged never means rejected.
- **G9**: no "today" endpoint; the screen fetches the whole month. Add `GET /attendance/today` with server time.
- **G12**: no attendance notification types ("missed check-out", "late"). Later.
- Geofence is explicitly out of scope in hr.md; plausibility is a flag, not a rule.

### Expo/RN implementation
- `expo-location`: permission request for foreground, then a one-shot current-position call with high accuracy; `LocationObject.mocked` on Android. Plugin config: leave `isAndroidBackgroundLocationEnabled` and `isAndroidForegroundServiceEnabled` false (defaults). Never use the last-known-position call for attendance (can be stale). Verify exact function and enum names against the versioned expo-location docs.
- Accuracy rule: accept at most about 50 m (research threshold, tune after field tests); else retry/precise prompt.
- Outbox rows persisted in SQLite; the drain loop is foreground only, plus a best-effort `expo-background-task` (interval minimum 15 min, inexact, no guarantee; not to be relied on).
- Customer build excludes location via `blockedPermissions`/a separate app variant.

### Permissions and copy
Rationale screen before the OS prompt (title "Location for attendance"):
"Vastu Kitchen uses your phone's location only at the moment you tap Check in or Check out, to record where you were. It does not track you in the background."
Buttons: "Continue" / "Not now". Android system dialog follows. Staff first-run setup checklist may ask in advance (staff are managed users).

### Failure / denied
- Denied: card shows "Location is off." Button "Check in without location" opens a reason field ("Why no location?", required, 200 chars) and the punch is saved with `location: null` plus the reason as a note, flagged for review (Apple 5.1.1(iv) requires a manual alternative; the API already allows no location). "Open settings" when permanently denied.
- Precise denied: "Turn on Precise location for Vastu Kitchen in Settings."
- GPS off in system settings: prompt "Turn on Location (GPS) in quick settings".
- Airplane mode: GPS still works; save locally.

### Battery / OS
Single fix, no service, so no OEM killer problem. Battery saver can degrade fix quality: surface accuracy, do not block.

### Store policy / privacy
Precise location is declared in Data Safety (collected, tied to the user, purpose: app functionality/attendance). Employee notice required (hr.md has no consent text today). Retention schedule for location history proposed: 12 months, then keep only the day record.

### Acceptance criteria
- Online check-in updates the server day within 3 s and shows server time; double tap yields one record.
- Offline check-in at T, sync at T+3 h: the day shows T (after G1), flagged `clientCaptured`; with device clock set into the future the server flags/rejects the stamp.
- Enabling a mock-location app sets `mocked` and the day is flagged.
- Denied location path completes with a reason; no crash; the owner account never sees the tab.
- The merged manifest has `ACCESS_FINE_LOCATION`/`COARSE` only, no background or foreground-service location.

---

## 4. Push notifications

**Decision (proposed):** `expo-notifications` with the Expo push service (FCM v1 credentials stored on Expo; APNs key via EAS), a development build, notification channels created before the Android 13 prompt, an in-app inbox as the source of truth, and a server-side WhatsApp fallback for critical alerts on OEM battery killers. Alternative: direct FCM/APNs behind the same server `PushSender` port later. Why: one API for Android and iOS plus receipts; the repo's notifications are in-app rows only (research-native 3.3).

### Current server state (inventory-people section 6)
No push channel exists: no token field, no register endpoint, no `PushSender`. Notifications are rows polled every 30 s on web, TTL 30 days, `ref {kind,id,postId?,projectId?,fileId?}`, 26 types, created by `notify()`.

### Server work
1. `POST /notifications/devices {token, platform, appVersion, locale, deviceName?}` (upsert by token, linked to the user) and `DELETE /notifications/devices/:token` (logout, account deletion). Multiple devices per user. Also revoke on user deactivation.
2. `PushSender` port called from `NotifyUseCase` after a created (not deduped) row. Payload: `{notificationId, type, ref, url}` IDs only, no private content on the lock screen (no prices or addresses). Collapse/batch reminders per type per run (GAP G5) so an hourly cron does not send N pushes.
3. Handle Expo receipts (about 15 min later, kept 24 h); on `DeviceNotRegistered` delete the token. Send with `priority: high` for lead assigned and complaint; use `channelId`.
4. Fix G6 first: `fileId` is dropped by the Mongoose ref sub-schema, so file deep links break.
5. G4: cursor/`since` for notifications; `unread-count` for the OS badge.
6. WhatsApp fallback (existing WA AGENT client): if a receipt shows an error, or a critical item is unopened after N minutes, send a template message. Critical = NEW lead assigned, COMPLAINT raised/overdue.

### Token registration lifecycle
1. After login (and after the user grants notification permission), create channels, request permission, obtain the Expo push token (needs the EAS `projectId`), wrapped in try/catch with retry when online.
2. `POST /notifications/devices`. Store the last registered token in SecureStore; re-register on app start if it changed, on a token-change listener (`addPushTokenListener`), on login as a different user.
3. On logout call `DELETE` first (best effort, then clear local state regardless). On `DeviceNotRegistered` the server prunes.
4. If permission is denied, do not retry silently; the in-app inbox and refetch-on-foreground still work (Apple 5.1.2(i): app must work without push).

### Channels (ids fixed now; after creation only the name/description can change)
`leads`, `tasks`, `proposals`, `complaints`, `attendance`, plus a low-importance `general`. Create them at app start before any permission request (Android 13+ shows the prompt only once at least one channel exists; `POST_NOTIFICATIONS` is not named on the Expo page: UNVERIFIED from a primary page here). Users can mute a channel in OS settings; the in-app Settings page deep-links there.

### Notification categories mapped to deep-link targets
Route names follow the mobile router convention `/projects/[id]?tab=&todo=&complaint=&post=&file=` (inventory-project) and web `refHref`. All unknown or forbidden targets fall back to the notifications list.

| Types (prefix) | Channel | Roles | Ref -> mobile route |
|---|---|---|---|
| LEAD_ASSIGNED, LEAD_* | leads | SALES, ADMIN | LEAD -> `/leads/:id` |
| PROPOSAL_UNSEEN, PROPOSAL_SEEN, no-action | proposals | SALES, ADMIN | LEAD or PROPOSAL (UNVERIFIED which per type) -> `/leads/:id` or `/proposals/:id` |
| PROJECT_* (post, approval, comment) | general | project members, CUSTOMER | PROJECT -> `/projects/:projectId?post=<postId>` |
| FILE_*, FILES_SAVED | general | staff | PROJECT + fileId -> `/projects/:id?tab=docs&file=` (needs G6) |
| TODO_* | tasks | assignees | TODO with projectId -> `/projects/:projectId?tab=todos&todo=:id`; else `/todos` |
| COMPLAINT_* | complaints | technician, Admin, CUSTOMER (own) | COMPLAINT -> `/complaints/:id` (customer: `/projects/:id?tab=complaints&complaint=:id`) |
| attendance (new, G12) | attendance | GPS staff | `/attendance` |

(The type list is 26 and the docs list only 14; generate the final table from `NOTIFICATION_TYPES` in `packages/contracts`.) Customers receive only PROJECT/COMPLAINT refs.

### Handling taps
In the root layout: read the last notification response for the cold-start case and subscribe to the response-received listener while running, then `router.push(data.url)` (documented in the expo-notifications page; verify names). If signed out, store the pending URL and replay after login. If the role cannot open the target, go to the inbox. In foreground, show an in-app banner and bump the unread badge (SDK 58: foreground notifications show by default unless the handler says otherwise).

### OEM battery behaviour (India)
dontkillmyapp ranks Xiaomi, OnePlus, Samsung, Huawei worst; Oppo/Vivo/realme/Tecno/Motorola middling; Pixel best. Mitigations: high-priority sends; staff first-run checklist "Allow notifications / Set battery to No restrictions / Allow autostart" with `Linking.openSettings()` (the exact OEM intents are UNVERIFIED; do not request `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` on Play, it is Play-restricted, UNVERIFIED); refetch on foreground; unread badge; per-device delivery stats (receipts plus opened events) to find failing devices; WhatsApp fallback above.

### Copy
Notification pre-prompt (shown after the first meaningful event for customers, in setup checklist for staff): "Get alerts for new leads, tasks and customer messages. You can change this any time in Settings." Buttons "Allow notifications" / "Not now". Denied banner on inbox: "Notifications are off. Turn them on in Settings to get alerts."

### Offline / policy
Push is best effort; inbox sync on foreground and pull-to-refresh is the guarantee; 30-day TTL means at most 30 days of history. iOS needs a paid Apple account and a physical device; push token and user id are declared in Data Safety (device or other identifiers). Remove `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` from the manifest unless exact local alarms are used (Play policy UNVERIFIED).

### Acceptance criteria
- Token registered once per device/user; second login on the same device replaces the owner; logout removes it (server shows no token).
- A tapped push opens the right screen from cold start, background and foreground, signed in and signed out.
- Fresh Android 13+ install: no prompt until a channel exists; denying shows the inbox banner and the app works.
- Xiaomi, Samsung, Vivo, Oppo test: a push arrives with the app swiped away; if not, the WhatsApp fallback fires within the agreed window.
- A batch of 20 stale leads yields one collapsed push.

---

## 5. Camera, gallery, files, PDF, sharing

**Decision (proposed):** `expo-image-picker` (system picker, no storage permission) for camera and gallery, `expo-image-manipulator` to convert HEIC/AVIF to JPEG and shrink to about 1600 px long edge at quality 0.7, upload through the existing signed-ticket and relay flow with a persistent outbox queue. Alternative: `expo-camera` custom viewfinder (only if a custom UI is needed, UNVERIFIED), direct upload to Cloudinary skipping the relay (decide with backend; research keeps the relay for v1). Why: smallest permission set; the picker since SDK 54 returns originals including HEIC which browsers cannot render.

### User flow (photo)
1. Composer/visit/complaint/to-do: "Add photo" opens a sheet "Take photo" / "Choose from gallery".
2. Camera: CAMERA permission rationale then OS prompt; capture; preview with Retake/Use. Gallery: system picker (multi-select where the feature allows; limits: 20 per post, 5 per comment, 10 per to-do, 5 per complaint).
3. Each pick is copied into the app document directory (cache files can be purged), converted and resized, checksummed, and inserted into the outbox as `queued`. Thumbnails show a progress ring; chips "3 photos waiting to upload".
4. Upload per file: sign lazily at upload time (tickets last about 55 min; one ticket per batch is allowed), POST multipart to the relay, then the post/comment/etc. references the `publicId`. Failed items keep a Retry. Removing a finished-but-unattached photo calls `DELETE /uploads?publicId=`.
5. Documents (any file type, docs tab): system document picker (`expo-document-picker`, UNVERIFIED not fetched; verify), same queue, `POST /projects/:id/files/uploads/sign` then register file.

### Implementation notes
- Android manifest: the picker library adds `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `RECORD_AUDIO` by default; block storage and audio permissions via the plugin options and `blockedPermissions`; confirm in the merged manifest. Avoid `READ_MEDIA_*` (Play photo/video policy, UNVERIFIED).
- iOS plugin strings (section 8). iOS prefers the out-of-process picker (Apple 5.1.1(iii)).
- Always run the manipulator step; do not trust the picker `quality` option (applies on some paths only). Typical result: a few hundred KB.
- Strip EXIF location of customer photos before upload; keep only the visit's own recorded coordinates.
- Upload API: `File.upload`/upload tasks from `expo-file-system` (new API; legacy functions under `expo-file-system/legacy`). **iOS** background session continues when suspended but the JS task is not restored after a kill; **Android background upload is not documented**: do not promise it. Foreground drain loop + resume on launch + opportunistic `expo-background-task` (UNVERIFIED reliability).
- Idempotency: deterministic `public_id` from the outbox UUID so a retried upload overwrites instead of duplicating (Cloudinary behaviour UNVERIFIED); doc registration is already idempotent.
- Server gaps: G2 lead-scoped upload ticket (visits); relay limit 60 MB with a missing content-length read as 0 (do not rely on it); "no `can` block" and closed-project 409 on signing must show "This project is closed; photos cannot be added."
- Caps: warn at 50 queued items or 200 MB.

### PDF viewing, sharing, saving
- Proposal PDF: there is no server PDF; "Download PDF" on web is the browser print. Mobile v1 shares the **public link** (`publicUrl` from `POST /proposals/:id/send`) rather than a file. If a server PDF is added later: download to cache with `File.createDownloadTask` (pause/resume), then open the share sheet via `expo-sharing` (`shareAsync` with `application/pdf`); the sheet offers "Save to Files/Drive", WhatsApp, etc. An in-app PDF viewer needs a native library (`react-native-pdf`, UNVERIFIED) and is not v1.
- Project documents: tap opens via the OS "Open in..." intent (`expo-intent-launcher` on Android, UNVERIFIED) or the share sheet; "Save to Docs" is the share sheet's save target; no storage permission needed.
- Sending a proposal: confirm the number in a bottom sheet (lead's number by default, editable), generate a `requestId` UUID once per confirm tap and keep it for retries, `POST /proposals/:id/send-whatsapp`. On `delivery:'sent'` show "Sent to +91 XXXXX XXXXX" with Copy link and Share. On `not_configured` or a 503 the proposal is already frozen: offer "Share the link myself" (native share sheet) and "Open WhatsApp" (`whatsappUrl`). Copy via `expo-clipboard` (write only; UNVERIFIED not fetched). Never read the clipboard except behind an explicit Paste button.
- Receiving shared files into the app (share intent) is deferred.

### Copy
- Camera: "Vastu Kitchen needs your camera to take photos of the site, snags and finished work. Photos are shared only with your project team." (iOS `NSCameraUsageDescription` same text.)
- Gallery (iOS `NSPhotoLibraryUsageDescription`): "Choose photos from your library to attach to a project, visit or complaint."
- Denied camera: "Camera access is off. Turn it on in Settings, or choose from your gallery."

### Offline / failure
Capture works offline; uploads wait. Out of space on copy: "Not enough storage to save this photo." Corrupt/unsupported file: "This file cannot be used." 401 during upload pauses the queue and prompts re-login without losing items. Cancelled mid-upload: the item restarts from the beginning (no resumable protocol, UNVERIFIED backend support).

### Policy / privacy
Photos are "Photos and videos" in Data Safety (collected, shared with project members and the Cloudinary processor). Customer home photos: DPDP notice and deletion on request. No `READ_MEDIA_*`.

### Acceptance criteria
- A 12 MP iPhone HEIC and a 12 MP Android JPEG upload as JPEG of at most about 1600 px, under about 500 KB, and display in the web dashboard.
- Kill the app mid-upload: relaunch resumes; no duplicate in the post.
- Merged manifest has `CAMERA` but no storage/media/audio permissions.
- Proposal share: double tap sends one WhatsApp template (same `requestId`); not_configured path falls back to wa.me.

---

## 6. WhatsApp interop

**Decision (proposed):** open chats with `https://wa.me/<number>?text=`; receive links via https App Links on an owned domain with a web fallback; autofill the login code from SMS where possible. Alternative: custom-scheme links only (not verifiable, rejected). Why: works with or without WhatsApp installed and needs no `canOpenURL` queries.

### Flows
- **Open chat (staff):** WhatsApp button on lead/customer opens `Linking.openURL('https://wa.me/91XXXXXXXXXX?text=' + encodeURIComponent(msg))` (international format, no `+`, zeros, brackets; stored phone is 10 digits). Text prefilled from a template ("Namaste <first>, ..."). If WhatsApp is missing, the browser page shows; show a toast "WhatsApp is not installed." only if the open fails.
- **Proposal sends:** server template send first (section 5); wa.me is the explicit "send from my own WhatsApp" or fallback.
- **Customer invite link:** staff creates the invite (`POST /identity/customers/:id/invite`, URL `{WEB_BASE_URL}/invite/{token}`, 7 days, single use), shares it via the share sheet or wa.me. The link opens the app if installed (App Link) else the web invite page. The app redeems with `POST /invite/redeem`, guarding against double redemption (single use). Expired: "This link has expired or was already used. Ask Vastu Kitchen for a new one."
- **Proposal/project links from WhatsApp:** `https://<domain>/p/<token>` stays a public web page (customers may not have the app); an "Open in app" banner on the web page.
- **OTP login:** the code arrives via WhatsApp (existing template), 6 digits (`^\d{6}$`). WhatsApp messages cannot be read by SMS Retriever, so autofill is not available from them. Options: the WhatsApp authentication template with a "copy code" button (UNVERIFIED), a notification-based paste prompt, or an SMS channel fallback with SMS Retriever / User Consent (`react-native-otp-verify` or similar, maintenance UNVERIFIED; no `READ_SMS`/`RECEIVE_SMS` ever). iOS: `textContentType="oneTimeCode"` for SMS autofill. Always keep manual entry. India SMS needs DLT registration (UNVERIFIED).

### App Links (Android) and Universal Links (iOS)
- Needs an https domain owned by the business (open: the VPS domain and SSL are an open item in `docs/01-scope/mvp-scope.md`; the API must also be https because Android 9+ blocks cleartext).
- Android: `android.intentFilters` with `autoVerify: true` for `/p/*`, `/invite/*`, `/projects/*`, `/leads/*`; host `/.well-known/assetlinks.json` (`delegate_permission/common.handle_all_urls`, package name, SHA-256 of **both** the EAS upload key and the Play App Signing key); served as `application/json`; verification takes at least about 20 s; changes need a rebuild.
- iOS: Associated Domains entitlement plus `apple-app-site-association` (not fetched: UNVERIFIED, standard practice).
- WhatsApp may open links in its in-app browser first: the web fallback page must offer "Open in app" and the install link.
- Expo Router maps the path automatically when routes match; protected routes redirect to login and then replay the target.

### Permissions, copy
No permission. No contacts: phone numbers come from the CRM; the number field in "Add lead" or "Send proposal" may use the system contact picker (Apple prefers it; Play: do not request `READ_CONTACTS`). Don't read the clipboard.

### Failure / offline
Offline: wa.me and invite links still open WhatsApp (WhatsApp handles its own connectivity); invite redeem needs network ("You are offline. Connect to sign in."). Server 503 on template send: proposal already frozen, use the manual path.

### Policy
Apple 4.8 does not apply (phone OTP is our own sign-in); adding Google/Facebook login would require Sign in with Apple. Apple review needs a demo account with a fixed OTP (reviewer number whitelist); Play "App access" also needs test credentials.

### Acceptance criteria
- With and without the app installed, tapping a proposal link from WhatsApp opens the app or the web page.
- assetlinks verified (`adb shell pm get-app-links <package>` shows verified; verify command in the Android docs).
- OTP can be entered manually in all cases; on SMS fallback it autofills on a physical device.
- Invite redeemed once; a second tap shows the expired message, no double sign-in.

---

## 7. Biometric app lock and secure storage

**Decision (proposed):** keep session tokens in `expo-secure-store` (Android Keystore, iOS Keychain), with an optional app-lock gate using `expo-local-authentication` (default ON for ADMIN, HR; optional for others). Alternative: tokens behind `requireAuthentication` for staff roles handling pricing (UNVERIFIED pattern). Why: no store-policy cost beyond a Face ID string.

### Token storage (inventory-foundations)
- Access token (15 min) kept in memory only. Refresh token (30 days staff, 90 days customers, rotated on every refresh, reuse revokes all sessions) in SecureStore. Mobile sends `X-Client: mobile` and the refresh token in the body (no cookies).
- Persist the **new** refresh token before using the new access token (the grace window is only 10 s). On a network error during refresh keep the old token, mark the session unknown, and retry; only on 401 TOKEN_INVALID clear SecureStore and the React Query cache and go to login.
- SecureStore values are small (about 2 KB limit on some iOS versions, UNVERIFIED), async calls only; Android data is lost on uninstall, iOS may persist across reinstall (clear on first launch after install, UNVERIFIED approach). Never store documents, photos or the cache here. The cache in SQLite is not encrypted by default; keep personal data minimal and clear on logout (open question 3).

### App lock flow
1. Settings > Security: toggle "Lock the app with fingerprint or face". Turning on runs an authentication check first.
2. When the app is backgrounded more than 2 minutes (setting: Immediately / 1 min / 5 min), the lock screen covers on return and calls the authenticate function; the screen shows the logo only and hides content in the app switcher.
3. Fallback: device PIN/pattern; no biometrics enrolled: "Set up a screen lock on your phone to use app lock."
4. Five failures: "Too many attempts. Sign in again." clears the session and returns to login.
5. Enrolling a new fingerprint invalidates `requireAuthentication`-bound values (user must sign in again); an unbound token does not have this behaviour.

### Implementation
`expo-secure-store` (works in Expo Go but `requireAuthentication` with Face ID does not), `expo-local-authentication` (Android `USE_BIOMETRIC` added automatically; iOS `NSFaceIDUsageDescription` via the plugin `faceIDPermission`; `biometricsSecurityLevel` 'strong' for Class 3 and device-fallback options: verify names in the docs; Face ID needs a dev build). Lock state via `AppState` timestamps. Biometric is a local gate, not a server auth factor. Set `ios.config.usesNonExemptEncryption: false` (HTTPS only).

Copy: "Use Face ID to unlock Vastu Kitchen" (iOS usage string); Android prompt title "Unlock Vastu Kitchen", subtitle "Confirm it is you".

### Failure / offline
Biometric hardware missing: toggle hidden. Lock works fully offline. If the keystore is corrupted (rare OEM), read fails: treat as signed out.

### Acceptance criteria
- Tokens never appear in AsyncStorage/SQLite; logout clears SecureStore and the query cache.
- Backgrounding past the timeout locks; wrong biometric five times signs out.
- Killing the app between refresh response and persist does not lose the session when retried within the grace window (test with a delay).

---

## 8. Permissions matrix

| Permission (Android / iOS) | Why | When asked | If denied | Play declaration needed? |
|---|---|---|---|---|
| `ACCESS_FINE_LOCATION` (+ `ACCESS_COARSE_LOCATION`) / `NSLocationWhenInUseUsageDescription` | Attendance and visit check-in fix | First Check in tap, after the rationale screen | Manual path with reason (flagged); Open settings | No special form; Data Safety "precise location"; location declaration form if the console shows it; the prominent-disclosure screen is our pattern |
| `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_*` | Not used | Never | n/a | Would need declaration; blocked in manifest |
| `CAMERA` / `NSCameraUsageDescription` | Site and complaint photos, visit photo | First Take photo tap | Gallery picker offered | No (Data Safety photos) |
| Gallery: system picker (no permission) / `NSPhotoLibraryUsageDescription` | Attach existing photos | Opens the picker | Cannot attach: "Open settings" (iOS limited access still works) | No; `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_*` blocked |
| `POST_NOTIFICATIONS` (UNVERIFIED named on Expo page) / push | Alerts | After first meaningful event (customers) or setup checklist (staff), channels created first | Inbox banner; in-app inbox only | No; token and user id in Data Safety |
| `USE_BIOMETRIC` / `NSFaceIDUsageDescription` | Optional app lock | When enabling the toggle | Lock stays off | No |
| `INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED` (added by library) | Network, haptics, notification reschedule | Install time | n/a | No |
| `READ_CALL_LOG`, `READ_PHONE_STATE` | Not requested on Play (internal flavour only, optional later) | Never on Play | n/a | Yes, and a CRM is not a permitted use: do not ship |
| `READ_SMS`, `RECEIVE_SMS` | Not used (SMS Retriever / User Consent instead) | Never | n/a | Restricted; blocked |
| `READ_CONTACTS` / contacts | Not used; picker only | Never | n/a | Sensitive; blocked |
| `RECORD_AUDIO` | Not used | Never | n/a | Blocked from the picker library |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Not used on Play | Never | n/a | Restricted; blocked |
| `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` | Not used | Never | n/a | Own policy (UNVERIFIED); remove |

CI check: after every release build, dump merged permissions from the AAB (`bundletool` or `aapt dump permissions`) and fail the build on any blocked permission, because library manifests add permissions silently.

---

## 9. Google Play / App Store / DPDP readiness checklist

**Decision (proposed):** two separate listings: customer app (public, small data profile) and staff app (closed track / private distribution), so the customer Data Safety form is not the union of staff practices. Alternative: one app with roles (union of declarations, more review surface; open question per research). Staff are Android-first; Apple is for customers.

### Accounts and lead time
- [ ] Play Console **Organization** account needs a D-U-N-S number: plan **about 4 weeks** (research-stack); start now. Interim: EAS internal APK for staff.
- [ ] Apple Developer Program USD 99/yr; Organization enrolment needs a legal entity (no trade names), D-U-N-S, binding authority, domain email and a public website; no fixed timeline given. TestFlight for customers (ad hoc is capped at 100 devices/yr).
- [ ] Owned https domain with SSL for the API, App Links and the privacy policy page.

### Google Play
- [ ] Data Safety form complete and equal to what SDKs send (Expo, FCM, Sentry): precise location (staff), photos, personal info (name, phone, email, address), user IDs, device or other IDs (push token), financial info if quotes count, encryption in transit, deletion mechanism.
- [ ] Privacy policy URL live: lists location, photos, phone numbers, push tokens, WhatsApp messaging, retention, deletion, grievance contact.
- [ ] **Account deletion**: URL plus in-app flow (Settings > Delete my account). Server gap: no deletion or sessions endpoints exist (inventory-foundations item 9); design: anonymise PII, revoke sessions, delete devices; staff deletion stays an Admin action (Play wording for non-customer accounts UNVERIFIED).
- [ ] App access: test staff login and a reviewer number with a fixed OTP.
- [ ] Location form if shown (explicit foreground use; no background).
- [ ] Permissions Declaration Form: none expected; confirm by the manifest dump.
- [ ] Target API level: current Play requirement not fetched (UNVERIFIED; check Play Console "App content"); SDK 58 targets API 36.
- [ ] Use Closed testing for staging; remember a bundle requesting a declared permission blocks publishing on any track.
- [ ] 2027-01-27: Play no longer allows READ_CALL_LOG for call-based verification (irrelevant, noted).

### Apple App Store
- [ ] Privacy policy in App Store Connect and in the app (5.1.1(i)); privacy nutrition labels (details UNVERIFIED); consent and a way to withdraw (5.1.1(ii)).
- [ ] In-app account deletion (5.1.1(v)); demo account with fixed OTP.
- [ ] Info.plist strings: camera, photo library, Face ID, location when-in-use (only if used); no tracking prompt.
- [ ] Push capability and APNs key via EAS; app works if notifications declined (5.1.2(i)); location denied path exists (5.1.1(iv)).
- [ ] Associated Domains + AASA; no third-party social login; no Contacts access.
- [ ] Review notes: describe roles, test credentials, the reviewer OTP, that location is user-initiated and foreground only, no background modes.

### India DPDP Act 2023 (not legal advice)
- Rules notified 2025-11-13 (secondary sources; primary UNVERIFIED): consent-manager provisions from 2026-11-13 (tomorrow), substantive obligations (notice, safeguards, breach, retention/erasure) from **2027-05-13**. Plan to be ready by then.
- [ ] Notice at first use (purposes: lead follow-up, design/quotation, service) in plain language, English now, Hindi/Bengali later; consent for optional processing (marketing WhatsApp, home photos); withdrawal and deletion flows; retention schedule; breach process; role-based access and audit log; grievance contact.
- [ ] Employee notice for attendance location and call notes: data collected, why, who sees it, retention. Whether employment "legitimate use" covers it is UNVERIFIED; minimise (location only at check-in/out, no background tracking, calls limited to leads).
- [ ] Record cross-border hosting (backend, WhatsApp provider, Cloudinary, Expo, Sentry) in the notice (rules detail UNVERIFIED).
- [ ] Sentry: `sendDefaultPii: false`, scrub phone numbers and names, no session replay (defaults UNVERIFIED); no advertising/analytics SDKs at launch.

### QA matrix before each submission
- [ ] Notification arrival with the app killed and after a day idle on Xiaomi/Redmi, Oppo/Realme, Vivo, Samsung, Pixel.
- [ ] Android 13/14/15/16: notification and location prompts: deny, ask every time, approximate-only.
- [ ] Offline check-in then reconnect; device clock skew; mock-location app on.
- [ ] iPhone HEIC photo and a camera JPEG on throttled 2G/3G; kill mid-upload.
- [ ] App Link from WhatsApp with and without the app.

---

## Open questions
1. Next follow-up date: where does it live (new `followUpAt` on calls/lead vs a to-do), and who is notified?
2. Does a visit need a check-out (end time) or is it check-in only?
3. Are staff phones company-owned (MDM allows an internal call-log flavour and battery whitelisting) and is the local SQLite cache to be encrypted?
4. Product sign-off to change the "server clock only" attendance rule for offline punches (G1).
5. Which cloud-telephony vendor, if any, and one app with roles or two listings.
