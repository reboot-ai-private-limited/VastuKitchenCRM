# Proposals (Module 2)

Proposals are generated **inside the software** (not uploaded PDFs). 2D/3D designs remain in AutoCAD/Maya.

## Builder
From a lead: customer details, line items (service/module, description, qty, price), discount, notes/terms, total. Simple template with company branding. Output: web view + printable/downloadable PDF.

## Sending & seen tracking
1. "Send" creates a public link with an unguessable token (`/p/:token`).
2. App opens WhatsApp with a prefilled message + link (`wa.me`) — see [ADR-0004](../adr/0004-whatsapp-wa-me.md).
3. First open of the link marks the proposal **Seen** (timestamp, count) and notifies the owner in app + web.

## Reminders (cron)
| Rule | Trigger |
|---|---|
| Unseen | Sent, not seen after 2 days |
| Seen, no action | Seen, lead status unchanged for 2 days |
| Stagnant | Any lead status unchanged beyond threshold (default 2 days, configurable) |

Details: [notifications-and-cron](../03-architecture/notifications-and-cron.md).

## Out of scope
E-signature, payments, versioned proposals, template editor.
