# Complaints (Module 4)

Client's first requested feature: post-delivery service tickets for fittings/parts issues.

## Flow
1. **Raise:** customer (app/link) or reception adds complaint — customer, description, photos.
2. **Assign:** admin assigns a technician.
3. **Resolve:** technician sees it in their app, visits, completes work, uploads photo, marks `Resolved`.
4. Admin can `Close`.

## Status
`Open → Assigned → Resolved → Closed`

## Fields
Customer/project (optional link), description, photos, raised by, assigned technician, timestamps, resolution note + photo.

## Out of scope
Warranty rules, SLAs, parts inventory, billing.
