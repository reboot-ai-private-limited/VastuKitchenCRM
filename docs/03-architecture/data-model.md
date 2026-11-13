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
| `projects` | name, customerId, leadId?, wonLeadId? (unique when set: one auto project per won lead), siteAddress, value, stage (`DESIGN`/`SITE`/`CLOSED`), designStage, designerId, memberIds[], createdById, closedAt |
| `projectposts` | projectId, authorId, visibility (`CLIENT`/`TEAM`), kind (`UPDATE`/`FINAL_DELIVERY`), text, images[{publicId,width,height,bytes}], approvedById/approvedAt, commentCount, deletedAt |
| `projectcomments` | postId, projectId, authorId, text (nullable), images[], deletedAt |
| `projectactivities` | projectId, type (`TODO_*`), actorId, at, data — the team-only timeline lines |
| `todolists` | projectId, name, archived, position, createdById |
| `todos` | projectId, listId, title, notes, images[], assigneeIds[], notifyOnDoneIds[], dueOn (`YYYY-MM-DD`), completedById/At, createdById, commentCount, position, deletedAt |
| `todocomments` | todoId, projectId, authorId, text (nullable), images[], deletedAt |
| `docfolders` | projectId, parentId (null = top level), name, nameKey (lower-case; unique per parent), createdById, deletedAt |
| `docfiles` | projectId, folderId, kind (`IMAGE`/`FILE`), publicId, format, bytes, name, visibility (`TEAM`/`CLIENT`), uploadedById, deletedAt — unique (projectId, publicId) among live rows; a document points at the stored file, nothing is copied |
| `complaints` | projectId, customerId (copied from the project), description, images[], status (`OPEN`/`ASSIGNED`/`RESOLVED`/`CLOSED`), raisedById, assignedToId, resolutionNote, resolutionImages[], activeSince (created or last reopened), assignedAt/resolvedAt/closedAt, reopenCount, events[{type, at, actorId, note, assigneeId}] — the complaint's own history |
| `stock_items` | name, category, unit (`pcs`/`sheet`/`kg`/`m`/`ft`/`box`/`set`/`litre`), quantity (current balance, never below 0), minLevel, archived — updated only by an atomic `$inc`/`$set` together with a movement line |
| `stock_movements` | itemId, type (`IN`/`OUT`/`ADJUST`), quantity (positive for IN/OUT; signed difference for ADJUST), balanceAfter, note, byId, createdAt — append-only |
| `attendances` | userId, date (`YYYY-MM-DD`, business timezone), inAt, outAt, method (`GPS`/`BIOMETRIC_SIM`/`MANUAL`), inLocation, outLocation, correctedById/At, note — unique (userId, date) |
| `salaryrows` | month (`YYYY-MM`), userId, name/designation (as at generation), fixedSalary, presentDays, workingDays, computedPayable, payable, editedById/At, note, weeklyOff (the rule used), finalizedAt/By — unique (month, userId) |
| `salaries` | userId, month, fixed, presentDays, workingDays, payable (editable), finalised |
| `notifications` | userId, type, refType, refId, message, readAt |

## Notes
- **No separate activity log.** The dashboard's "first / last activity" is worked out from the modules' own records (lead timeline, proposals, project posts and comments), so it cannot drift from the real data. Posts and comments carry `(authorId, createdAt)` indexes for it.
- Customers are `users` with role `CUSTOMER`, linked to a project by the projects module.
- Index: `leads.phone` (unique), `proposals.token` (unique), `attendance(userId,date)`.
- Photos stored as Cloudinary URLs; no binary data in Mongo.
