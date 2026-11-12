# Mobile — Sign-in, session and account

Everything between "app opens" and "user sees their first screen", plus the profile screen: splash and session restore, sign-in by WhatsApp code (primary) or password (secondary), customer invite links, role-based landing, change password, sign out, session expiry, account deletion, force-update, languages. The server is the authority: it issues the tokens, decides the role, and rate-limits. The phone only stores tokens safely and shows the right screen.

Plan date 2026-11-12. Companions: [`notifications.md`](notifications.md) (push token is registered right after sign-in and removed at sign-out), [`attendance.md`](attendance.md), [`dashboard-glance.md`](dashboard-glance.md). Research: `../research/inventory-foundations.md` §1, §8; `../research/research-native-and-policy.md` §3.5; `../research/research-ux-patterns.md`.

**Status key:** ✅ API exists today (verified in code) · 📱 phone to build · ⚠ GAP needs server work before the phone can ship it. "Proposed" = a product decision made in these docs, not yet confirmed by the owner.

**Code checked 2026-11-12:** `apps/api/src/modules/identity/{interface/auth.route.ts, application/usecases/{login,otp,refreshSession,changePassword,customers}.usecase.ts}`, `packages/contracts/src/identity.ts`, `apps/web/lib/{auth.tsx,nav.ts}`. Nothing of the mobile app is built yet.

## Roles

| Role | Can sign in | How | Lands on (route) |
|---|---|---|---|
| ADMIN | yes | code or password | Glance `/(app)/(tabs)/glance` |
| HR | yes | code or password | Team attendance `/(app)/(tabs)/team-attendance` (proposed; web lands on the dashboard, which for HR is an attendance overview) |
| SALES | yes | code or password | Leads `/(app)/(tabs)/leads` |
| TECHNICIAN | yes | code or password | Complaints `/(app)/(tabs)/complaints` |
| DESIGNER | yes | code or password | Projects `/(app)/(tabs)/projects` |
| OFFICE | yes | code or password | Projects `/(app)/(tabs)/projects` |
| CUSTOMER | yes | code or invite link (no password exists) | Projects (their own project) `/(app)/(tabs)/projects` |
| Staff with `canLogin = false` (biometric-only, no password) | see rule 9 | open question | — |

Landing mirrors `landingFor(role)` in `apps/web/lib/nav.ts` (ADMIN/HR `/`, SALES `/leads`, TECHNICIAN `/complaints`, others `/projects`), with the two mobile adaptations above. One app, one binary, all roles (decision); the role comes from `user.role` in `GET /me`.

## 1. The rules

| # | Rule | Status |
|---|---|---|
| 1 | **Every auth request sends `X-Client: mobile`** and `Content-Type: application/json`. Without it `login`, `otp/verify`, `invite/redeem`, `refresh`, `logout` answer 400 `VALIDATION_FAILED` ("Send an X-Client header of web or mobile"). With it, the refresh token comes back **in the JSON body** (`AuthTokensDto.refreshToken`); a browser would get a cookie. `otp/request` and `change-password` do not need the header; send it anyway. Source: `shared/http/client.util.ts`, `identity.ts` `authTokensSchema`. | ✅ |
| 2 | **Phone numbers** are typed as 10 digits with `+91` shown as a fixed prefix, not typed. Validate with `phoneSchema` from `@vastu/contracts` (accepts `+91 98765 43210`, `098765…`, `9876543210`; result must match `^[6-9]\d{9}$`, message "Enter a valid 10-digit mobile number"). Send the normalised 10 digits. Source: `identity.ts` `phoneSchema`. | ✅ |
| 3 | **Code login (primary, proposed as the default tab).** Step 1 `POST /api/identity/auth/otp/request {phone}`: always `200` with `{}` and the message "If that number has an account, a code is on its way." whether or not the number has an account (anti-enumeration). The code is 6 digits, valid **5 minutes** (`OTP_TTL_MS`), sent by WhatsApp (WA AGENT template). Step 2 `POST /otp/verify {phone, code}` (`code` = `^\d{6}$`) returns `LoginResponseDto` (tokens + `user`). Works for any **active** user with that phone, staff or customer. Source: `otp.usecase.ts`, `auth.route.ts`. | ✅ |
| 4 | **Resend cooldown 30 s is silent on the server.** A second `otp/request` inside 30 s of the last code returns the same `200` and sends nothing (`OTP_RESEND_COOLDOWN_MS`). So the phone must run its own 30 s countdown on the "Send again" button and must not call early. Each new code replaces the old one. Source: `otp.usecase.ts` `RequestOtpUseCase`. | ✅ (timer 📱) |
| 5 | **5 wrong tries kill the code** (`OTP_MAX_ATTEMPTS = 5`). Wrong, expired, already used, never sent, or the 5th failure all give the same `401 INVALID_OTP` "That code is incorrect or has expired. Ask for a new one." The phone counts its own wrong tries; after 5 it disables the boxes and asks for a new code (rule 4 still applies before the new request). Source: `otp.usecase.ts` `VerifyOtpUseCase`. | ✅ |
| 6 | **OTP request limits (`429 RATE_LIMITED`):** 5 requests per phone and 20 per IP per 10 minutes, **every request counted** (even the silent cooldown ones). 429 message: "Too many code requests. Please wait a few minutes and try again." Verify/login/redeem: 30 **failed** attempts per IP per 15 minutes (successes not counted), message "Too many attempts. Please wait a few minutes and try again." No `retryAfter` field in the body; the `RateLimit-*` response headers exist (`standardHeaders: true`), read `Retry-After`/`RateLimit-Reset` if present (UNVERIFIED exact header names; check with a real 429). **Never auto-retry a 429.** Source: `auth.route.ts` l.105-175. | ✅ |
| 8 | **Password login (secondary).** `POST /login {phone, password}` returns `LoginResponseDto`. Any failure (unknown number, wrong password, no password set, inactive) is `401 INVALID_CREDENTIALS` "Incorrect phone number or password." Customers have no password. There is **no forgot-password route**; staff ask Admin/HR to reset it (web: `PUT /api/identity/users/:id/password`, not in the app). Source: `login.usecase.ts`, `inventory-foundations.md` §1.5. | ✅ |
| 9 | **Biometric-only staff** (`UserDto.canLogin = false`, no password): `RequestOtpUseCase` does not check the password hash, so such a person *appears* able to sign in by code (only checks `active`). UNVERIFIED by test. Whether they should is a product decision (Office persona in the demo data). Until decided the phone does nothing special. | ⚠ decision |
| 10 | **Tokens.** Access token: JWT, **15 min** default (`JWT_ACCESS_TTL_SECONDS`, read `expiresIn` seconds from the response, never hard-code), kept **in memory only**. Refresh token: opaque, **30 days staff / 90 days customers**, kept in `expo-secure-store` (not AsyncStorage). It is **rotated on every refresh** and the new one must be saved **before** the new access token is used. The absolute expiry is not returned; the phone only learns it by `401 TOKEN_INVALID`. Source: `env.ts`, `sessionIssuer.ts`, `refreshSession.usecase.ts`. | ✅ |
| 11 | **Single-flight refresh is mandatory.** Presenting an already-rotated refresh token is treated as theft: **all the user's sessions on all devices (web too) are revoked** and the answer is `401 TOKEN_INVALID`. One replay is tolerated within `REFRESH_GRACE_SECONDS` (default 10 s). So: one module-level promise shared by every caller; refresh when `now >= expiresAt - 30 s` or on a `401 UNAUTHENTICATED`, then retry once; never refresh from a headless/background task. Source: `refreshSession.usecase.ts`, web reference `apps/web/lib/api/session.ts`, Greynote `api.ts` pattern. | ✅ (client 📱) |
| 12 | **Three different 401s.** `UNAUTHENTICATED` = access token dead → refresh and retry once. `TOKEN_INVALID` on `/refresh` = session over → sign out. `INVALID_CREDENTIALS` / `INVALID_OTP` / `TOKEN_INVALID` on `invite/redeem` = show an inline error, do **not** run the refresh loop. Anonymous routes (`login`, `otp/*`, `invite/redeem`, `refresh`) never trigger refresh-and-retry. Source: `errors.ts`, web `client.ts` (`anonymous: true`). | ✅ |
| 13 | **Cold start:** read refresh token from secure storage → `POST /refresh {refreshToken}` → store the NEW refresh token → `GET /me` → pick shell by `user.role` → navigate to the landing route. On a **network** failure (no HTTP response) do not clear anything: keep the stored token, open the app in offline mode with the last cached user (cache `UserDto` **without `fixedSalary`**), and refresh on the first online request. One immediate retry inside the 10 s grace window is safe; a later replay of a token the server already rotated is theft. Source: `inventory-foundations.md` §1.4 and §9, Greynote boot flow. | ✅ (client 📱) |
| 14 | **Session end rules.** Refresh answers `401 TOKEN_INVALID` ("Your session has expired. Please sign in again.") when the token is expired, revoked, deactivated, or stolen. Then: clear secure storage, clear the React Query cache, stop push, go to login with that message. Admin deactivation revokes all sessions at the next refresh; an access token already issued lives on for up to 15 minutes (no instant kick). Source: `refreshSession.usecase.ts`. | ✅ |
| 15 | **Customer invite link.** Admin/Sales create it (`POST /api/identity/customers/:id/invite` → `{token, url, expiresAt}`), valid **7 days**, single use, a new invite revokes older ones. The phone redeems with `POST /invite/redeem {token}` (`X-Client: mobile`) → `LoginResponseDto`. Errors: `401 TOKEN_INVALID` "This link has expired or was already used. Ask for a new one." Today the link is `{WEB_BASE_URL}/invite/{token}` (a web page), so the app only opens from it after the GAP in rule 16 is fixed. The phone must redeem **once** (guard with a ref; React strict-mode style double calls burn a single-use token). Source: `customers.usecase.ts`. | ✅ |
| 16 | **Deep link into the app** (invite `/invite/{token}`, proposal `/p/{token}`). Needs an app scheme (proposed `vastukitchen://invite/{token}`), https App Links with `autoVerify` and `/.well-known/assetlinks.json` on the web domain listing **both** the EAS upload SHA-256 and the Play App Signing SHA-256, and a web fallback page with "Open in app" / install link. A first-time installer loses the token across the Play install (needs install-referrer deferred deep link) so the fallback is: sign in by code with the same phone number. Source: `inventory-foundations.md` §8.4; `research-native-and-policy.md` §3.5. | ⚠ GAP |
| 17 | **Change password.** `POST /change-password {currentPassword, newPassword}` (Bearer). New password: min 8 characters and max 72 **bytes**. Wrong current password is `400 VALIDATION_FAILED` "Your current password is not correct." (not INVALID_CREDENTIALS). Success **revokes every session including this phone's** (`revokeAllForUser`): the app must wipe tokens and go to login with "Password changed. Please sign in again." Not offered to CUSTOMER or `canLogin = false` users (no password to change). Source: `changePassword.usecase.ts`. | ✅ |
| 18 | **Sign out.** `POST /logout {refreshToken}` revokes only this phone's session; it always answers 200 even if the token is unknown, so ignore errors. Then wipe secure storage, memory, query cache, and push token (⚠ no unregister endpoint, see [`notifications.md`](notifications.md)). There is no "sign out other devices" API. Source: `auth.route.ts`. | ✅ |
| 19 | **Rate-limit lockout risk behind carrier NAT.** `trust proxy = 1`, the key is the first `X-Forwarded-For` hop. Indian mobile carriers put many users behind one public IP. `otpByIp` (20 requests / 10 min, all counted) can lock a whole carrier pool out at 9 am; `otpByPhone` (5 / 10 min) blocks a user who retries after a slow WhatsApp delivery for up to 10 minutes. Also `otpByPhone` keys on the raw body string, so `9876543210` and `+91 98765 43210` count separately (always send the normalised 10 digits). Server asks: raise or drop `otpByIp`, add `retryAfterSeconds` to the 429 `data`, ensure the proxy forwards the real IP. | ⚠ GAP |
| 20 | **OTP only works through WhatsApp.** No SMS fallback; a user without WhatsApp, or with delivery delay, cannot get a code and a staff member cannot reset a forgotten password themselves. The phone must always show the password route and the line "No code? Ask your admin." Server ask: SMS/voice fallback (India DLT registration needed, UNVERIFIED) or a self-service reset. | ⚠ GAP |
| 21 | **Account deletion is a store requirement** (Google Play data-safety/account-deletion and Apple 5.1.1(v)). No endpoint exists (`delete-account` is absent in `auth.route.ts`). Needed: an in-app "Delete my account" and a public web URL for the Play listing. Staff accounts are HR records (salary, attendance) so deletion must mean "deactivate and strip personal details, keep payroll/attendance rows anonymised" (the same approach Greynote documents in `greynote/docs/mobile/account.md`). Decide retention with the owner (DPDP). | ⚠ GAP |
| 22 | **App version and force-update.** `GET /api/health` has no version; no `/app/config` route. Needed: public `GET /api/app/config → {minVersion, latestVersion, storeUrl, maintenance?}` and the phone sends `X-App-Version` on every request (add the header to CORS `allowedHeaders` only if web must send it). Until it exists the phone cannot block an outdated build. | ⚠ GAP |
| 23 | **Languages.** English only at launch. All strings go through `i18next` keys from day 1 (`auth.otp.title`, …) so Hindi and Bengali can follow; the language row on the profile is hidden until a second language ships. Server messages are English prose; map `code` to local strings where this doc gives a copy line, otherwise show `message` as is. Source: `research-offline-performance-i18n.md` §1.5. | 📱 |
| 24 | **Reviewer account.** Play and Apple review need a login that works without a real WhatsApp. Provide a whitelisted reviewer phone with a fixed code in a non-production build or a documented bypass; `OTP_DEV_MODE` (code `123456`) is refused in production by `env.ts`, so this needs a server decision. | ⚠ GAP |

(Numbering skips 7 on purpose: it was folded into rule 6. Keep the numbers; other docs cite them.)

## 2. What the phone shows

Route groups (expo-router): `app/index.tsx` (splash/boot), `app/(auth)/{login,otp,password}.tsx`, `app/invite/[token].tsx`, `app/force-update.tsx`, `app/(app)/…` (signed-in shell), `app/(app)/profile/{index,change-password,delete-account}.tsx`. The root layout mounts a signed-out watcher: when the session goes from signed-in to none it dismisses the stack and `router.replace('/(auth)/login')` (so Android back does not reopen the app).

### 2.1 Splash and session restore — `/` (`app/index.tsx`)

Full-screen brand logo on white, a small spinner after 400 ms. Native splash stays up (`SplashScreen.preventAutoHideAsync`) until fonts and the secure-store read are done. Shows for at least 600 ms, at most about 4 s on a normal network.

Flow (rule 13): no refresh token → `/(auth)/login`. Token → refresh → `/me` → landing route. Outcomes:

| Outcome | Result |
|---|---|
| `/me` ok | go to the landing route for the role (table under Roles) |
| `401 TOKEN_INVALID` on refresh | wipe, go to login, banner "Your session has expired. Please sign in again." |
| network error | open the landing route from the cached user; show the offline banner; no logout |
| 5xx / 503 | same as network error, banner "We can't reach the server right now." |
| `/me` returns `active:false` | wipe, login, banner "Your account is not active. Ask your admin." |
| Version below `minVersion` (⚠ GAP, rule 22) | `/force-update` |

Loading state is the splash itself; there is no empty state.

### 2.2 Login by code — `/(auth)/login` (default tab "WhatsApp code")

```
+--------------------------------------+
|            [ Vastu Kitchen logo ]    |
|                                      |
|   Sign in                            |
|   We'll send a code on WhatsApp.     |
|                                      |
|   Mobile number                      |
|   [ +91 | 98765 43210            ]   |
|                                      |
|   [        Send code               ] |  <- primary, lg (44 px), disabled until valid
|                                      |
|   ----------- or -----------         |
|   Sign in with password              |  <- text button, goes to /(auth)/password
|                                      |
|   Customer? Open the link we sent    |
|   you on WhatsApp, or sign in with   |
|   your number above.                 |
+--------------------------------------+
```

- Field: numeric keypad, max 10 digits after stripping a pasted `+91`/`0`; label "Mobile number"; helper under it empty; inline error "Enter a valid 10-digit mobile number" after blur or submit.
- **Send code** → rule 3. While in flight: button shows spinner, field disabled. Success → `router.push({ pathname: '/(auth)/otp', params: { phone } })`. Always succeeds visually (server answers 200 for unknown numbers). Failure: `429` banner (error table); network "Connection lost. Check your internet and try again."
- Keyboard: `Send code` on the IME action. `autoComplete="tel"`, `textContentType="telephoneNumber"`.
- Offline: button disabled, inline note "You need an internet connection to sign in." (login is never offline; `research-offline-performance-i18n.md` §1 item 8.)
- The phone remembers the last number used (AsyncStorage, non-secret) to prefill.

### 2.3 Enter code — `/(auth)/otp` (param `phone`)

```
+--------------------------------------+
|  <  Back                             |
|                                      |
|   Enter the 6-digit code             |
|   Sent on WhatsApp to +91 98765 43210|
|   [Change number]                    |
|                                      |
|   [ _ ][ _ ][ _ ][ _ ][ _ ][ _ ]     |  <- 6 boxes, one hidden input behind
|                                      |
|   [ Paste code ]   [ Open WhatsApp ] |
|                                      |
|   Code valid for 4:32                |
|   Send again in 0:24  / [Send again] |
|                                      |
|   No WhatsApp? Sign in with password |
+--------------------------------------+
```

- One real `TextInput` (`keyboardType="number-pad"`, `maxLength={6}`, `textContentType="oneTimeCode"`, `autoComplete="sms-otp"`) rendered as six boxes. The iOS keyboard suggestion and Android SMS autofill only fire for SMS; the code arrives on WhatsApp, so **autofill will usually not work**. The WhatsApp template's "copy code" button puts the code on the clipboard; the user then taps **Paste code** (explicit tap; do not read the clipboard silently, it triggers the OS paste notice). Do not request `READ_SMS`/`RECEIVE_SMS` (Play restricted).
- **Auto-submit** the moment 6 digits are present: `POST /otp/verify {phone, code}`. While in flight the boxes are disabled and a spinner replaces the hint.
- **Open WhatsApp** (proposed) opens the WhatsApp app so the person can read the code; use `Linking.openURL('whatsapp://')` guarded with `try/catch` (Android 11+ needs a `<queries>` entry for the `whatsapp` scheme in `app.json`; UNVERIFIED on target devices). Hide the button if it fails.
- **Timers** are monotonic and start when the request returns: "Code valid for m:ss" counts down 5:00 (rule 3); "Send again in 0:ss" counts down 30 (rule 4), then becomes a text button **Send again**. After 5:00 the line becomes "This code has expired. Send a new one." and the boxes are disabled. After the 4th resend in 10 minutes show "You can ask for one more code. Then wait a few minutes." (rule 6 allows 5).
- **Wrong code** (`401 INVALID_OTP`): boxes shake once and clear, error under them "That code is incorrect or has expired. Ask for a new one." Count tries; at 5 show "Too many wrong codes. Send a new code." and disable boxes until a new request succeeds.
- **Success:** store both tokens (refresh first, then memory), `GET` nothing extra (the response has `user`), register push (see notifications doc), go to the landing route. If the push permission prompt is due it is **not** shown here (ask after the first meaningful event; `research-native-and-policy.md` §2).
- Leaving the screen and coming back within 30 s must not allow a request: keep `lastRequestedAt` per phone in memory.
- "Change number" pops back with the number prefilled.
- A deactivated or unknown number silently never gets a code: after 60 s without success the screen adds "Not getting a code? Check the number, or sign in with your password. If it still fails, ask your admin."

### 2.4 Login by password — `/(auth)/password`

Fields: **Mobile number**, **Password** (eye icon toggles visibility; no trimming of the password), button **Sign in**, text button **Use WhatsApp code instead**, and the line "Forgot your password? Ask your admin or HR to reset it, or sign in with a WhatsApp code." No "Forgot password" link exists because no route exists. Errors inline under the password: `INVALID_CREDENTIALS` message as is. Offline: disabled with the same note. On success same as 2.3.

### 2.5 Customer invite — `/invite/[token]`

Reached by the deep link (rule 16) or by pasting the link/token on the login screen (a small text button on `/(auth)/login`: **I have an invite link** opens a paste box that accepts the full URL `…/invite/<token>` or the bare token).

```
+--------------------------------------+
|   [ spinner ]                        |
|   Opening your project...            |
+--------------------------------------+
```

- On mount, once (ref guard), call `POST /invite/redeem {token}`. Success → store tokens → `/(app)/(tabs)/projects` (the customer's project).
- Failure `401 TOKEN_INVALID`: card with "This link has expired or was already used. Ask for a new one." and buttons **Sign in with a code** (goes to `/(auth)/login`) and **Ask for a new link** (opens `https://wa.me/<company number>` text "Please send me a new link for my kitchen project" — company number is an open question).
- If someone is already signed in on this phone: ask first "You're signed in as {name}. Open this link as a different person?" **Switch** (signs out the current user, then redeems) / **Cancel**. Do not redeem silently over another session.
- Network error: "Connection lost. Check your internet and try again." with **Try again**. A dropped response after the server consumed the token gives `TOKEN_INVALID` on retry; the person then signs in by code (that is why the copy offers it).

### 2.6 Profile — `/(app)/profile` (staff: top-bar avatar → Profile, or under "More"; customer: top-bar icon)

```
+--------------------------------------+
|  <  Profile                          |
|   (RS)  Ravi Sharma                  |
|         Sales • Telecaller           |
|         +91 90000 00011              |
|--------------------------------------|
|  Notifications            >          |  -> notifications settings (notifications.md)
|  Change password          >          |  (hidden for CUSTOMER / canLogin=false)
|  Language   English       >          |  (hidden until a 2nd language exists)
|  Privacy policy           >          |  (in-app browser)
|  App version 1.0.0 (23)              |
|--------------------------------------|
|  [ Sign out ]                        |
|  Delete my account  (red, text)      |  (⚠ GAP until the endpoint exists)
+--------------------------------------+
```

Fields come from `UserDto` (`name`, `role` label, `designation`, `phone`). **Never show `fixedSalary`** even for ADMIN/HR (salary is not in the mobile scope); strip it before caching. Attendance staff additionally see a read-only row "Attendance: GPS check-in" or "Attendance: biometric device" (from `attendanceType`; hide when null). Loading: skeleton from the cached user. No empty/error state of its own.

### 2.7 Change password — `/(app)/profile/change-password`

Three fields: **Current password**, **New password**, **Confirm new password** (each with an eye icon). Local checks before sending: New is at least 8 characters, at most 72 bytes (use `new TextEncoder().encode`, UNVERIFIED on Hermes, may need a polyfill), Confirm equals New, New differs from Current. Button **Change password**. Wrong current password → field error "Your current password is not correct." on Current. Success: wipe session, navigate to `/(auth)/login` with banner "Password changed. Please sign in again." (the server has revoked every session including this one, rule 17). Needs a network (no offline queue).

### 2.8 Sign out

Profile → **Sign out** → confirm sheet "Sign out of Vastu Kitchen on this phone?" **Sign out** / **Cancel**. If the attendance outbox holds an unsent punch (see [`attendance.md`](attendance.md) rule A12) the sheet adds "1 attendance punch has not been sent yet. Sign out anyway?" with **Send now** first. Then rule 18. Needs a network for the server call but signs out locally regardless.

### 2.9 Delete my account — `/(app)/profile/delete-account` (⚠ GAP, design for when the endpoint exists)

Warning copy (proposed, to be approved by the owner): "Your name, phone number and uploaded files are removed and you can no longer sign in. This cannot be undone. Attendance, salary, complaint and project records are kept without your personal details because the company must keep them." Staff: a second line "You can also ask HR to do this for you." For customers the project history stays with the company. Confirm by typing `DELETE`, then a red **Delete my account** button. For code-only users there is no password to confirm with, so confirm by a fresh OTP (open question). A public web page with the same flow is required as the Play "account deletion URL".

### 2.10 Force update — `/force-update` (⚠ GAP)

Full-screen: "Update needed" / "Please update Vastu Kitchen to keep working." Button **Update** opens `storeUrl`. Shown when `appVersion < minVersion`. Maintenance variant: "We're doing maintenance. Please try again in a few minutes."

### 2.11 Global states the shell owns

- **Offline banner** (root): "You're offline. Some things won't work until you reconnect." Shown from `NetInfo` (`isConnected === false` or `isInternetReachable === false`).
- **Signed-out notice** shown once on login after a forced sign-out (`takeSignedOutNotice` pattern): messages "Your session has expired. Please sign in again." / "Password changed. Please sign in again." / "You've been signed out."
- **App to foreground** (`AppState` → active): if the access token is within 30 s of expiry, refresh through the single-flight; refetch the unread count (notifications doc).

## 3. Endpoints

All under `/api/identity/auth` (`auth.route.ts`), envelope `{success, statusCode, message, data}`; read `data`.

| METHOD path | Purpose | DTO | Notes |
|---|---|---|---|
| ✅ POST `/otp/request` | send WhatsApp code | body `{phone}` → `data {}` | always 200; silent 30 s cooldown; 5/phone + 20/IP per 10 min |
| ✅ POST `/otp/verify` | sign in with code | `{phone, code}` → `LoginResponseDto` | `X-Client` required; `INVALID_OTP` |
| ✅ POST `/login` | sign in with password | `{phone, password}` → `LoginResponseDto` | `INVALID_CREDENTIALS`; 30 failures/IP/15 min |
| ✅ POST `/invite/redeem` | customer invite | `{token}` → `LoginResponseDto` | `TOKEN_INVALID`; single use |
| ✅ POST `/refresh` | rotate tokens | `{refreshToken}` → `AuthTokensDto` | single-flight; no limiter; response has no absolute expiry |
| ✅ POST `/logout` | end this session | `{refreshToken}` → `{}` | always 200 |
| ✅ GET `/me` | current user | → `UserDto` | `fixedSalary` only for ADMIN/HR, never display it |
| ✅ POST `/change-password` | change own password | `{currentPassword, newPassword}` → `{}` | revokes ALL sessions; 400 on wrong current |
| ✅ POST `/api/identity/customers/:id/invite` (Admin/Sales, not a phone job for the customer) | make invite link | → `CustomerInviteDto {token,url,expiresAt}` | used by the leads/customers doc |
| ⚠ GET `/api/app/config` | min/latest version, store URL, maintenance | proposed `{minVersion, latestVersion, storeUrl, maintenance}` | public; rule 22 |
| ⚠ POST `/api/identity/auth/delete-account` (+ public web page) | delete/deactivate own account | proposed | rule 21 |
| ⚠ POST/DELETE device registration | push token | see [`notifications.md`](notifications.md) | called after sign-in / at sign-out |

`LoginResponseDto` = `AuthTokensDto {accessToken, refreshToken?, expiresIn}` + `user: UserDto {id, name, phone, role, designation|null, attendanceType|null, fixedSalary?, active, canLogin, createdAt}`.

## 4. Errors

| Code / status | Where | What the phone says |
|---|---|---|
| 400 `VALIDATION_FAILED` (zod) | any form | `data[]` issues: map `path.join('.')` to fields; leftovers in a banner "Some of the details provided are not valid." |
| 400 `VALIDATION_FAILED` "Your current password is not correct." | change password | under Current password, same text |
| 400 `VALIDATION_FAILED` "Send an X-Client header…" | any auth | a bug: show "Something went wrong. Please update the app." and report it |
| 401 `INVALID_CREDENTIALS` | password login | "Incorrect phone number or password." |
| 401 `INVALID_OTP` | verify | "That code is incorrect or has expired. Ask for a new one." |
| 401 `TOKEN_INVALID` | `/refresh` | sign out: "Your session has expired. Please sign in again." |
| 401 `TOKEN_INVALID` | `/invite/redeem` | "This link has expired or was already used. Ask for a new one." |
| 401 `UNAUTHENTICATED` | any Bearer route | refresh once and retry; if the retry is also 401, sign out with "Please sign in again." |
| 403 / 404 | any | role may not / record hidden: treat both as "not found" (calm), except write actions where a toast is better |
| 429 `RATE_LIMITED` | otp/request | "Too many code requests. Please wait a few minutes and try again." (suggest the password route) |
| 429 `RATE_LIMITED` | login/verify/redeem | "Too many attempts. Please wait a few minutes and try again." |
| 5xx / 503 | any | "Something went wrong. Please try again shortly." |
| status 0 `NETWORK` | any | "Connection lost. Check your internet and try again." |

## 5. Offline behaviour

- **Sign-in is online only** (code, password, invite, change password, delete account): the button is disabled offline with "You need an internet connection to sign in."
- **Cold start offline** with a stored session opens the app from the cached user (no logout, rule 13). Role gating works from the cached role.
- **Sign-out offline:** wipes locally; the server session stays valid until it expires or is revoked (acceptable; warn nothing).
- **Access token expiry while offline:** nothing happens until the next request; queued writes (attendance) refresh first, and if refresh then fails with `TOKEN_INVALID` the queue **pauses and keeps its items** while the person signs in again (`research-offline-performance-i18n.md` §2.5, row 401). A different user signing in on the same phone must not inherit another person's queue: wipe the outbox only on explicit sign-out of a *different* user (Greynote `prepareForUser`).
- Cached for offline: the user (without salary). Never cached: tokens (except the secure-stored refresh token), OTP, invite tokens.

## 6. Acceptance criteria

- [ ] Every auth call carries `X-Client: mobile`; the refresh token is read from the body and stored only in secure storage; Android backup excludes the secure-store file (`allowBackup=false` or backup rules), so a restored spent token cannot trigger theft revocation.
- [ ] Two simultaneous 401s produce exactly **one** `/refresh` call; the second caller reuses the new access token.
- [ ] New refresh token is written to secure storage before the new access token is used; killing the app in between leaves a recoverable session (within the 10 s grace) or a clean login, never a crash loop.
- [ ] Cold start with a valid session reaches the correct landing route for each of the 7 roles; with no network and a stored session it still opens.
- [ ] Code login: 10-digit validation, "Send code" never calls the API twice within 30 s for one number, resend timer 30 s, validity timer 5:00, 5 wrong tries disables input, auto-submit on the 6th digit, **Paste code** works, no clipboard read without a tap.
- [ ] A 429 never triggers an automatic retry and shows the matching server message.
- [ ] Password login works; there is no "Forgot password" link; the "ask your admin" line is visible.
- [ ] Invite link redeems exactly once (double mount does not burn the token), lands the customer on their project, and an expired link offers "Sign in with a code".
- [ ] Change password: validation matches `passwordSchema` (8 chars, 72 bytes); on success the phone returns to login with the banner; the button is hidden for CUSTOMER.
- [ ] Sign out calls `/logout`, wipes secure storage, memory, query cache and push registration; Android back cannot return to a signed-in screen.
- [ ] `fixedSalary` is never rendered or persisted by the app.
- [ ] No string literal in JSX; all copy in this doc is in `en.json` under `auth.*` and `account.*`.
- [ ] Release build uses an HTTPS API origin (Android 9+ blocks cleartext).
- [ ] When the GAPs land: force-update screen blocks an old build; account deletion works in-app and on the public page.

## 7. Open questions

1. Should staff with `canLogin = false` be able to sign in by code (rule 9)? If not, the server must reject them in `RequestOtpUseCase`.
2. SMS or voice fallback for people without WhatsApp, and DLT registration (rule 20).
3. Account-deletion semantics for staff (payroll retention) and how a code-only user proves identity (rule 21).
4. Which domain and package name for App Links; who owns `assetlinks.json` (rule 16). Does the web invite page get an "Open in app" button?
5. Reviewer login for Play/Apple (rule 24).
6. HR landing: day board (proposed) or a Glance variant? See [`dashboard-glance.md`](dashboard-glance.md) rule D8.
7. Company WhatsApp number for the "Ask for a new link" button.
8. Biometric app-lock (optional, `expo-local-authentication`): in v1 or later? Not specified here; `research-native-and-policy.md` §3.6 recommends a settings toggle.
