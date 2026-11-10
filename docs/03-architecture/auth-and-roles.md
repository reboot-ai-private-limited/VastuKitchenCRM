# Auth & Roles

## Auth
- Staff: phone/email + password → JWT (access token; refresh optional for MVP).
- Customer: magic link / OTP (to confirm — see [open questions](../01-scope/mvp-scope.md)).
- Public proposal view uses an unguessable token, no login.

## Roles
`admin`, `sales` (telecaller / field flag), `designer`, `technician`, `office`, `customer`.

## Access matrix (MVP)
| Area | admin | sales | designer | technician | office | customer |
|---|---|---|---|---|---|---|
| Dashboard | ✅ | – | – | – | – | – |
| Leads & calls & visits | ✅ | own/assigned | – | – | view | – |
| Proposals | ✅ | ✅ | – | – | – | view (link) |
| Projects & feed | ✅ | – | assigned | assigned | – | own (client tab) |
| Design board | ✅ | – | ✅ | – | – | – |
| Complaints | ✅ assign | – | – | assigned | raise | raise/own |
| HR / salary | ✅ | – | – | – | – | – |
| Own attendance | ✅ | ✅ | ✅ | ✅ | ✅ | – |

Enforced in API middleware (`requireRole`), mirrored in UI by `packages/shared`.
