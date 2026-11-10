# Vastu Kitchen CRM — Documentation

All-in-one CRM for a modular kitchen & interior company: leads, proposals, project feed, complaints, HR, admin dashboard. **Status: monorepo scaffolded (api + contracts + config); modules follow the [roadmap](04-roadmap/roadmap.md).** Setup and commands: [root README](../README.md).

## Reading order

1. [Vision](00-vision/brief-summary.md) — who the client is, what we build, goals. Raw notes: [original-notes.md](00-vision/original-notes.md) · [Branding](00-vision/branding.md)
2. [MVP Scope](01-scope/mvp-scope.md) — in / out / open questions
3. Product specs (`02-product/`): [Leads](02-product/leads.md) · [Proposals](02-product/proposals.md) · [Projects Feed](02-product/projects-feed.md) · [Complaints](02-product/complaints.md) · [HR](02-product/hr.md) · [Dashboard](02-product/dashboard.md)
4. Architecture (`03-architecture/`): [Overview](03-architecture/overview.md) · [Data Model](03-architecture/data-model.md) · [Auth & Roles](03-architecture/auth-and-roles.md) · [Notifications & Cron](03-architecture/notifications-and-cron.md) · [Deployment](03-architecture/deployment.md)
5. Roadmap (`04-roadmap/`): [Roadmap](04-roadmap/roadmap.md) · [Risks](04-roadmap/risks.md)
6. [Decisions (ADRs)](adr/) — why we chose what we chose
7. Demo (`demo/`): [Demo script](demo/demo-script.md) · [Dummy data](demo/dummy-data.md)

## Conventions

- English only. Keep docs short; link instead of repeating.
- One topic per file. Product behaviour goes in `02-product/`, technical choices in `03-architecture/`, and any significant decision gets an ADR in `adr/`.
- MVP rule: **shallow, demo-grade, simple.** If a doc grows deep, it's probably out of MVP scope.
