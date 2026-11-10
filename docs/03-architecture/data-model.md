# Data Model (draft, MongoDB collections)

Keep it flat; refine during build.

| Collection | Key fields |
|---|---|
| `users` | name, phone (unique), role (7 roles), designation (text copied from master), attendanceType (`GPS`/`BIOMETRIC`), fixedSalary, passwordHash (optional → no login), active |
| `designations` | name, nameKey (lowercase, unique), active |
| `sessions` | userId, tokenHash (unique), client (`web`/`mobile`), expiresAt (TTL), revokedAt |
| `customerInvites` | userId, tokenHash (unique), expiresAt (TTL), usedAt |
| `leads` | name, phone (unique), altPhone, email, city, notes, source, status, statusChangedAt, assignedToId, lostReason, customerId, createdById |
| `leadCalls` | leadId, userId, startedAt, durationSec, answered, outcome?, note? — unique (leadId, userId, startedAt) |
| `leadVisits` | leadId, userId, at, latitude, longitude, note?, photoUrl? |
| `leadActivities` | leadId, type (`CREATED`/`ASSIGNED`/`STATUS_CHANGED`/`CALL`/`VISIT`), byUserId, at, data |
| `proposals` | number (unique), leadId, status, customer snapshot, title, items[{title,description,quantity,unitPrice,lineTotal}], subtotal, discount, total, notes, terms, validUntil, token (unique), sentAt, sentById, firstSeenAt, lastSeenAt, seenCount, createdById |
| `counters` | _id (`proposal-<year>`), seq — atomic number sequence |
| `projects` | leadId, customerId, name, value, stage (`design`/`site`/`delivered`), designStage, designerId, closedAt |
| `posts` | projectId, authorId, text, photos[], visibility (`client`/`internal`), createdAt |
| `comments` | postId, authorId, text, createdAt |
| `complaints` | customerId/projectId, description, photos[], raisedBy, assignedTo, status, resolutionNote, resolutionPhoto |
| `attendance` | userId, date, inAt, outAt, method (`gps`/`biometric_sim`), location |
| `salaries` | userId, month, fixed, presentDays, workingDays, payable (editable), finalised |
| `notifications` | userId, type, refType, refId, message, readAt |
| `activities` | userId, type, refId, at — feeds dashboard first/last activity |

## Notes
- Customers are `users` with role `CUSTOMER`, linked to a project by the projects module.
- Index: `leads.phone` (unique), `proposals.token` (unique), `attendance(userId,date)`.
- Photos stored as Cloudinary URLs; no binary data in Mongo.
