# ADR-0011: Admin-editable system settings with env defaults

**Status:** Accepted

## Context
Several behaviours the client will want to tune (automatic project creation, reminder days, proposal terms, company details) were fixed in code or `.env`, so changing them meant a developer and a redeploy.

## Decision
A `settings` module (tier 0) with a typed registry in code, an Admin-only API, and a typed public contract. Only changed values are stored; defaults live in the registry and, for the reminder days, come from the existing `.env` values, so nothing changes until an Admin acts. Writes are all-or-nothing and clear a read cache immediately. Secrets and infrastructure stay in `.env`.

## Consequences
+ Admin changes apply at once, without a restart; adding a setting is two lines.
+ Leads and reminders share one "stuck days" value, so the flag and the alerts can never disagree.
− Settings reads add a (cached) lookup on hot paths.
− A multi-instance deployment sees another instance's change after at most the cache limit (30 s). We run one instance.
