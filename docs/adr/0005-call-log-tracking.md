# ADR-0005: Call tracking via Android call log

**Status:** Accepted

## Context
Need call counts/duration per sales person. We won't build our own dialer.

## Decision
Call button opens the phone's dialer for the lead's number. On return to the app, read the Android call log (`READ_CALL_LOG`) to match number, time and duration, then ask for outcome + note. App is a sideloaded APK, so Play Store call-log restrictions don't apply.

## Consequences
+ Accurate duration without telephony cost.
− Android only; relies on permission. Fallback: manual outcome entry. Cloud telephony (e.g. Exotel) is a later option for recordings.
