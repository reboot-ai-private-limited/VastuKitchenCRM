# Leads (Module 1)

Replaces Privyr. One central **Lead table**.

## Sources
Website · Facebook/Instagram · Justdial · Manual entry · Bulk CSV/Excel import. (MVP: sources are a tag; manual + CSV are real, others simulated.)

## Pipeline
Typical flow: `New → Contacted → Visit → Proposal Sent → Follow-up → Won | Lost`

- No separate "Qualified/Interested" stage; the caller's first-call result is captured as the call outcome + note, then the lead moves to `Contacted`.
- **Not a strict funnel:** a lead can move from any stage to any other (e.g. `Proposal Sent → Visit → Proposal Sent → Follow-up → Proposal Sent`). Every change is logged in the lead timeline and resets `statusChangedAt` (used by stagnant reminders).
- A lead can have **multiple proposals** over time.
- `Won` triggers auto-creation of a Project ([projects-feed](projects-feed.md)); `Lost` can be reopened.

## Features
- **Add:** single form, or CSV upload (name, phone, source, city, notes). Duplicate phone check.
- **List:** filter by status/source/owner, search by name/phone, "stuck" badge.
- **Assign:** admin assigns lead to a sales person (telecaller or field).
- **Call tracking:** Call button opens the phone dialer; on return the app reads the Android call log and records time, duration, answered/missed. Caller picks outcome + note. Counts feed the dashboard. See [ADR-0005](../adr/0005-call-log-tracking.md).
- **Visit log:** check-in (GPS + time + note + optional photo). Allowed before proposal and after conversion.
- **Activity timeline** per lead (calls, visits, status changes, proposals).

## Out of scope
Lead scoring, auto-assignment rules, real source APIs.
