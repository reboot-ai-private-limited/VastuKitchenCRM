# Complaints

Post-delivery service tickets for fittings and parts. Each complaint is about **one project** (its customer comes from the project), so a customer with several kitchens says which one.

## Flow
`OPEN → ASSIGNED → RESOLVED → CLOSED`

1. **Raise** — the customer (own project), Office or Admin (any project), or a Sales / Designer who is on the project. Description plus up to 5 photos. Technicians and HR cannot raise.
2. **Assign** — Admin picks any active staff member (normally a technician). Can be re-assigned while `ASSIGNED`; assigning the same person again does nothing.
3. **Resolve** — the assigned person (or an Admin) adds a note and up to 5 photos.
4. **Reopen** — if it is still broken, the customer (or an Admin) sends it back to the same technician with a reason. The resolution is cleared and the reopen is counted.
5. **Close** — Admin, once resolved. A closed complaint is final.

Each step is one atomic change, so two people acting at once cannot both win: the second gets `409`.

## Who sees what
- **Admin and Office:** every complaint.
- **Everyone else:** only complaints assigned to them, raised by them, or (customer) about their own project. Anything else is `404`.
- Each complaint returns a `can` block (assign / resolve / reopen / close) so apps never re-derive the rules.

## Photos
Uploaded direct to storage with a signed ticket (`POST /complaints/uploads/sign` to raise; `POST /complaints/:id/uploads/sign` to resolve), into the **project's photo folder** — so a complaint photo can be kept in [Docs](docs.md) with Save to Docs like any other project photo.

## Alerts and timeline
| Event | Told |
|---|---|
| Raised | every Admin |
| Assigned | the technician |
| Resolved | Admins, the customer, whoever raised it |
| Reopened | the technician and Admins |
| Closed | the customer |
| Unresolved after `reminders.complaintDays` (default 3) | the technician, else every Admin — once; a reopen restarts it |

Whoever acted is never told about their own action. The project's **team timeline** gets a line for each event; the customer's timeline stays posts only (they see their complaints in their own list). The complaint also keeps its own history (`history[]`).

## API
`POST /complaints` · `GET /complaints` (`status`, `projectId`, `assignedTo=me`, paged) · `GET /complaints/counts` · `GET /complaints/:id` · `POST /complaints/:id/{assign,resolve,reopen,close}`. See Swagger.

## Out of scope
Warranty rules, SLAs, parts inventory, billing, comments on a complaint (resolution is a note plus photos).
