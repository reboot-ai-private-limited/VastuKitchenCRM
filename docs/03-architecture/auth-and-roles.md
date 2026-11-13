# Auth & Roles

Roles are **hardcoded** for the MVP ([ADR-0009](../adr/0009-hardcoded-roles.md)). No permission matrix and no role editor. Access is decided by `requireRole(...)` in route files and a single `scopeFor(user)` helper for "all vs assigned only".

## Roles (7)
| Role | Who | Access |
|---|---|---|
| `ADMIN` | Owner | Everything; the only one who can create Admin/HR accounts |
| `HR` | HR person | Employees (create/edit non-Admin/HR), designations master, attendance, **salary** |
| `SALES` | Telecaller + field sales | Leads, calls, visits, proposals |
| `DESIGNER` | Design team | Assigned projects, design stage |
| `TECHNICIAN` | Site technicians | Assigned projects + complaints |
| `OFFICE` | Receptionist, front desk, floor staff, office boy | Add/view leads, raise complaints |
| `CUSTOMER` | Client | Own project feed + proposal only |

Role is **what you can do**. Two per-person attributes are separate:
- `attendanceType` — `GPS` (field people, any role) or `BIOMETRIC` (office).
- `designation` — display label from the designations master list (Receptionist, Telecaller, …); never affects access.

## Access matrix (MVP)
| Area | ADMIN | HR | SALES | DESIGNER | TECHNICIAN | OFFICE | CUSTOMER |
|---|---|---|---|---|---|---|---|
| Dashboard | full | attendance only | – | – | – | – | – |
| Leads, calls, visits | all | – | assigned | – | – | add/view | – |
| Proposals | all | – | own | – | – | – | view (link) |
| Projects & feed | all | – | summary + lead journey (own leads) | member | member | member | own (client tab) |
| Complaints | all, assign, close | – | raise (own projects), see own | raise (own projects), see own | assigned: resolve | all, raise | raise/own, reopen |
| Stocks | all, manage | – | – | – | – | all, manage | – |
| Employees | all | non-Admin/HR | – | – | – | – | – |
| Attendance (all staff) | ✅ | ✅ | – | – | – | – | – |
| Salary | ✅ | ✅ | – | – | – | – | – |
| Designations master | ✅ | ✅ | read | read | read | read | – |
| Own attendance (GPS check-in, own calendar) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | – |

"Assigned" = records assigned to me. `scopeFor(user)` returns `all` for ADMIN and `assigned` for SALES/DESIGNER/TECHNICIAN; list/get use cases call it, so scoping lives in one place.

## Staff accounts
- Created by Admin (any staff role) or HR (SALES, DESIGNER, TECHNICIAN, OFFICE). No self-signup.
- Login identifier is the **phone number** + password. `passwordHash` is optional: a user with no password **cannot log in** (floor staff / office boy tracked by biometric need no app account).
- First Admin comes from a seed script that prompts for the password (never stored in `.env`).
- Deactivating a user (`active=false`) revokes all their sessions; an already-issued access token lives until it expires (≤15 min).

## Tokens
- **Access token:** JWT (HS256), 15 min, payload `{ sub, role }`, sent as `Authorization: Bearer`.
- **Refresh token:** opaque random value, stored **hashed** server-side, 30 days (customers 90), **rotated on every refresh**. Presenting an already-used token is treated as theft and revokes all of that user's sessions, **except** for a one-time grace replay: within `REFRESH_GRACE_SECONDS` (default 10, `0` = off) of a rotation, the spent token is accepted once more and gets a *fresh* token pair (raw tokens are never stored, so it cannot be the same successor) without revoking anything. A second replay, or one after the window, is theft. Tokens revoked by logout, password change or deactivation are never eligible.
- **Delivery by client**, chosen with the `X-Client` header (`web` | `mobile`, required on login/refresh):
  - `web` → refresh token in an httpOnly cookie (`SameSite=Strict`, `Secure` in prod, path `/api/identity/auth`); never in the body. The required custom header doubles as CSRF protection.
  - `mobile` → refresh token in the JSON body; the app keeps it in secure storage.
- The web app and API must share a registrable domain (e.g. `admin.<domain>` / `api.<domain>`) so the cookie is sent; otherwise configure `SameSite=None; Secure`.

## Customers
Not self-registered. A `CUSTOMER` user is created by Admin/Sales (or automatically by the projects flow). Admin/Sales generate a **one-time invite link** (valid 7 days) and send it with the `wa.me` button. Opening it signs the customer in with a long session (no password). Full OTP login is out of MVP scope.

## Designations (master data)
Admin/HR manage a list of names (`designations`). The create/edit user form shows active entries; the chosen **text** is stored on the user (no ID reference). Rename updates matching users; deactivate only hides from the dropdown; no delete.

## Public proposal links
Unrelated to login: unguessable token, no account ([proposals](../02-product/proposals.md)).
