# Mobile — Visits

A visit records a salesperson at a customer's site: where, when, a note. Sources: `research/inventory-leads-customers-proposals.md`, `research-native-and-policy.md`. Related: [`leads-and-calls.md`](leads-and-calls.md), [`../04-native-capabilities.md`](../04-native-capabilities.md).

**Status key:** ✅ API exists. 📱 phone builds it. ⚠ GAP needs server work.

## Roles

| Role | Can do |
|---|---|
| SALES | Record and list visits on their own leads. |
| ADMIN | Any lead. |
| OFFICE, HR, DESIGNER, TECHNICIAN, CUSTOMER | Nothing. Tab hidden; API answers 403. |

## 1. The rules

| # | Rule | Status |
|---|---|---|
| 1 | A visit is allowed on any lead, before a proposal or after Won. | ✅ |
| 2 | `POST /leads/:id/visits`: `latitude` -90..90, `longitude` -180..180 required; `at` defaults to now; `note` ≤ 1000; `photoUrl` a valid URL. | ✅ |
| 3 | Recording a visit does **not** move the lead to VISIT. The phone offers "Mark lead as Visit" (a normal status change), never automatically. | ✅ 📱 |
| 4 | Check-in only: the API has no end time, so no check-out in release 1. | ⚠ §7 |
| 5 | **Not idempotent**: a retry makes a second visit. Send once; never silently retry until the server dedupes (S-20 in `06-server-work.md`). | ⚠ |
| 6 | Location is one explicit foreground fix on tap (high accuracy, 15 s timeout). No background tracking. Never send 0,0. | 📱 |
| 7 | Photo: no lead-scoped upload ticket exists, so release 1 hides the photo field. | ⚠ |
| 8 | Out-of-scope lead → `404`; drop it from the cache. | ✅ |

## 2. What the phone shows

Route `(staff)/leads/[id]/visits`, a tab on lead detail (Sales, Admin).

```
Visits                       [ Check in ]
Today 11:20 · Ravi          [ Map ]
Measured the L-shaped wall. Window at 7 ft.
2 Nov 16:05 · Ravi          [ Map ]
```

- List newest first: user, time, note, **Map** (opens the maps app).
- **Check in** opens a bottom sheet: "Getting your location…", then "±12 m", a note field, **Save visit**.
- After saving: snackbar "Visit saved" with **Mark lead as Visit** (hidden if already Visit or later).
- Empty: "No visits yet. Check in when you reach the site."
- Permission denied: "Location is off. Allow it in Settings to check in." with **Open settings**.
- Offline: saved to the outbox with the captured time; "Saved. It will send when you're online."

## 3. Endpoints

| Method | Path | Purpose | DTO |
|---|---|---|---|
| POST | `/leads/:id/visits` | Record | `RecordVisitBodyDto` → `VisitDto` |
| GET | `/leads/:id/visits` | List | `VisitDto[]` |
| POST | `/leads/:id/status` | Optional "mark as Visit" | `ChangeLeadStatusBodyDto` |

## 4. Errors

| Error | Phone says |
|---|---|
| 400 on coordinates | "We couldn't read your location. Try again." |
| 403 | "You can't record visits on this lead." |
| 404 | "This lead is no longer yours." |

## 5. Offline

Queued with the captured `at`; sent once on reconnect. If the app was killed mid-send, show "Check whether this visit was saved" and let the user confirm from the list before retrying. This goes away once the server dedupes.

## 6. Acceptance criteria

- [ ] Check in takes one fix, saves, shows the row on top.
- [ ] Denied permission shows the settings prompt and sends nothing.
- [ ] Offline save shows "Waiting to send".
- [ ] The lead's status only changes if the user taps "Mark lead as Visit".
- [ ] OFFICE and customers never see the tab.

## 7. Open questions

1. Add `endedAt` for check-out? Needs an API field.
2. Visit photo: add a lead-scoped upload ticket, or leave photos to the project chat?
