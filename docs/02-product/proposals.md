# Proposals (Module 2)

Proposals are generated **inside the software** (not uploaded PDFs). 2D/3D designs remain in AutoCAD/Maya. **No server-side PDF:** a proposal is a public web page with a print stylesheet; "Download PDF" is the browser's Save-as-PDF. Nothing heavy runs on the server.

## What a proposal holds
- `number` — `VK-<year>-<0001>`, sequential per year.
- Link to the lead, plus a **snapshot** of the customer (name, phone, city, site address) so later lead edits never alter a proposal the customer already saw.
- A **flat list of items**: title, optional description, quantity, unit price (whole rupees). Flat discount. No GST line — the default terms say prices exclude taxes.
- `notes`, `terms` (default text, editable per proposal), optional `validUntil`.
- `status`: `DRAFT` → `SENT`. Seen tracking: `firstSeenAt`, `lastSeenAt`, `seenCount`.

## Rules
- **Drafts are editable; a sent proposal is frozen.** To change a price, **Duplicate** it into a new draft (new number, new link). The customer always sees exactly what was sent.
- Access: Admin, or the Sales person who may access the lead (checked through the leads module, so the "own leads only" rule lives in one place).
- A lead can have many proposals.

## Sending
`POST /proposals/:id/send` marks it sent, moves the lead to **Proposal Sent** (unless it is already Won/Lost), logs it on the lead timeline, and returns the public URL plus a prefilled **`wa.me`** link (customer's number + message). The app opens that link ([ADR-0004](../adr/0004-whatsapp-wa-me.md)). Sending again returns the **same** link and changes nothing.

The public link is an unguessable token stored as-is (it must be resendable unchanged); it shows one proposal only.

## Seen tracking
- `GET /public/proposals/:token` returns the page data and **records nothing** — WhatsApp (and other chat apps) fetch links to build previews, which would otherwise mark every proposal "seen" the moment it is sent.
- The customer's browser then sends `POST /public/proposals/:token/seen` after the page renders. Crawlers do not run JavaScript, and known bot user agents are ignored too.
- The sales person previews through the logged-in `GET /proposals/:id`, which never counts.
- **First view only:** sets `firstSeenAt`, writes "proposal seen" on the lead timeline and emits a `proposal.seen` event. The notifications module turns that into the in-app alert; later views only bump `lastSeenAt` and `seenCount`.

## Public page content
Company block (name, tagline, address, company phone), proposal number and date, customer name, items with line totals, subtotal / discount / total, notes, terms, validity, and the **name** of the sales person who sent it. No lead ids, no staff phone numbers, no other customers' data. An expired proposal is still viewable with a notice.

## Reminders (with the notifications module)
Unseen 2 days after sending; seen but lead status unchanged for 2 days; stagnant status — using `sentAt`, `firstSeenAt` and the lead's `statusChangedAt` ([notifications-and-cron](../03-architecture/notifications-and-cron.md)).

## Out of scope
GST/tax lines, customer Accept button (the sales person moves the status), e-signature, payments, item catalog/templates, server-side PDF.
