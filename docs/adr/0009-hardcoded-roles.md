# ADR-0009: Hardcoded roles for the MVP (no permission system)

**Status:** Accepted (revisit if the client asks for custom roles)

## Context
We considered admin-editable roles with module × read/write permissions. That adds a role editor, record-scope rules, a permission cache and permission-aware UI in web and mobile, in a 1–2 week MVP where the client's roles are known.

## Decision
Seven fixed roles: `ADMIN, HR, SALES, DESIGNER, TECHNICIAN, OFFICE, CUSTOMER`. Role is stored as a string enum on the user. Routes gate access with `requireRole(...)`; use cases never check role names. "All vs assigned only" lives in one `scopeFor(user)` helper.
Differences that are **not** access differences are attributes, not roles: `attendanceType` (GPS/BIOMETRIC) and `designation` (a master-data label copied as text onto the user). Staff with no app need (floor staff, office boy) are users without a password.
There is no separate design-team board; "Design" is a filtered project list.

## Consequences
+ Small, fast, easy to explain and test.
+ Role checks are centralised in route files, so a later move to permissions touches only those.
− Client cannot create roles themselves; a new role is a code change.
