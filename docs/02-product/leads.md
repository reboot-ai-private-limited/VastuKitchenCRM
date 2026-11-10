# Leads (Module 1)

Replaces Privyr. One central **Lead table**.

## Sources
Website · Facebook/Instagram · Justdial · Manual entry · Bulk CSV/Excel import. (MVP: sources are a tag; manual + CSV are real, others simulated.)

## Pipeline (proposed)
`New → Contacted → Qualified → Visit → Proposal Sent → Follow-up → Won | Lost`
`Won` triggers auto-creation of a Project ([projects-feed](projects-feed.md)).

## Features
- **Add:** single form, or CSV upload (name, phone, source, city, notes). Duplicate phone check.
- **List:** filter by status/source/owner, search by name/phone, "stuck" badge.
- **Assign:** admin assigns lead to a sales person (telecaller or field).
- **Call tracking:** Call button opens the phone dialer; on return the app reads the Android call log and records time, duration, answered/missed. Caller picks outcome + note. Counts feed the dashboard. See [ADR-0005](../adr/0005-call-log-tracking.md).
- **Visit log:** check-in (GPS + time + note + optional photo). Allowed before proposal and after conversion.
- **Activity timeline** per lead (calls, visits, status changes, proposals).

## Out of scope
Lead scoring, auto-assignment rules, real source APIs.
