# Leads (Module 1)

Replaces Privyr. One central **Lead table**.

## Lead fields
`name`, `phone` (10 digits, unique), `altPhone?`, `email?`, `city?`, `notes?`, `source`, `status`, `statusChangedAt`, `assignedTo`, `lostReason?`, `customerId?` (set when won).

## Sources
`WEBSITE`, `FACEBOOK`, `INSTAGRAM`, `JUSTDIAL`, `WALK_IN`, `REFERRAL`, `OTHER`. MVP: manual entry and CSV import are real; the channel is a tag, and website/FB/Justdial leads are seeded for the demo.

## Pipeline
Typical flow: `New → Contacted → Visit → Proposal Sent → Follow-up → Won | Lost`

- **Not a strict funnel:** a lead can move from any stage to any other (e.g. `Proposal Sent → Visit → Proposal Sent → Follow-up`). Every change is logged on the timeline and resets `statusChangedAt` (used by stuck/stagnant reminders).
- `Lost` requires a reason (free text) and can be reopened.
- The **first logged call** on a `New` lead moves it to `Contacted` automatically.
- `Won` finds-or-creates the CUSTOMER account (identity), stores `customerId` on the lead, and emits a `lead.won` event; the projects module reacts to it. The event is emitted **once** per lead (moving a Won lead away and back does not create a second project).
- A lead can have **multiple proposals** over time.

## Features
- **Add:** single form, or CSV import. One lead per phone number: a duplicate is refused with the existing lead's id (import reports duplicates, it does not overwrite).
- **Assignment:** the new assignee gets an in-app **"New lead assigned to you"** notification (not for self-assignment or unassigning). A lead created by a Sales user is assigned to them. Leads from Office/import stay unassigned until the Admin assigns them (only to active SALES users).
- **List:** filter by status / source / assignee (`me`, `unassigned`, or a user) / stuck, search by name, phone or city.
- **Stuck:** not Won/Lost and `statusChangedAt` older than `LEAD_STUCK_DAYS` (default 2).
- **Who sees what:** Admin and Office see all leads; Sales see only leads assigned to them. Office can add and view, but cannot change status or log calls.
- **CSV import:** the web app parses the file in the browser and posts JSON rows (max 500). The result lists `created`, `duplicates` and `invalid` rows with reasons.
- **Visit log:** check-in (GPS + time + note + optional photo URL). Allowed before a proposal and after the lead is won.
- **Activity timeline** per lead: created, assigned, status changes, calls, visits (proposals add theirs later).

## Call tracking
The app does not have its own dialer: the Call button opens the phone's dialer; on return the app reads the Android call log and **uploads only calls whose number matches a lead assigned to that employee** — never the person's other calls (privacy rule; the API also refuses a call for a lead the user cannot access). See [ADR-0005](../adr/0005-call-log-tracking.md).

Each call record: `startedAt`, `durationSec`, `answered`, optional `outcome` (`INTERESTED`, `CALL_BACK`, `NOT_INTERESTED`, `NO_ANSWER`, `WRONG_NUMBER`) and `note`. Uploads are **idempotent** on (lead, user, startedAt), so a retry cannot double-count. The same records give the **performance numbers** for the dashboard: calls, answered calls and talk time per employee per day (`GET /api/leads/call-stats`, Admin).

## Out of scope
Lead scoring, auto/round-robin assignment, real source APIs, budget, Excel upload.
