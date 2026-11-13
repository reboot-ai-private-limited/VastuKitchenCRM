# 07 - Android App Links (deep links) setup

Covers server-work item S-08. The app opens `https://<WEB host>/invite/<token>` and `https://<WEB host>/p/<token>` directly (custom scheme `vastukitchen://` keeps working).

## What is in the repo

- `apps/web/public/.well-known/assetlinks.json` - the Digital Asset Links file, served at `https://<WEB host>/.well-known/assetlinks.json`.
- `apps/web/next.config.ts` - serves it as `application/json`, no redirect, cacheable for an hour. (`proxy.ts` skips paths with a dot, so no login redirect.)
- `apps/mobile/app.json` - `android.intentFilters` with `autoVerify` for `/invite` and `/p` on the web host.

## TODO before release (do not guess these)

1. **SHA-256 fingerprint.** Paste the real value into `assetlinks.json`, replacing the `TODO:REPLACE_WITH_RELEASE_SHA256_FINGERPRINT` entry. One entry per signing key you ship with:
   - Play App Signing (the one that matters for Play builds): Play Console > Setup > App signing > "App signing key certificate" > SHA-256.
   - EAS-built APK / upload key: `eas credentials` (Android) shows the keystore SHA-256.
   - Debug key (testing only): `keytool -list -v -keystore ~/.android/debug.keystore -storepass android`.
   Format is colon-separated uppercase hex, e.g. `AB:CD:...` (32 pairs).
2. **Web host.** In `apps/mobile/app.json`, replace `REPLACE_WITH_WEB_HOST` (two filters) with the public host of the web app, exactly as in `WEB_BASE_URL` of the API (no scheme, no port).
3. Rebuild the app (intent filters are native config) and verify: `adb shell pm get-app-links in.vastukitchen.app` should show `verified`.
4. Check the file is reachable without redirect: `curl -i https://<WEB host>/.well-known/assetlinks.json` returns 200 and `content-type: application/json`.
