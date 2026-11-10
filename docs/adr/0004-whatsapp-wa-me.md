# ADR-0004: WhatsApp via `wa.me` link for MVP

**Status:** Accepted (revisit post-pricing)

## Context
WhatsApp Cloud API requires Meta business verification and approved message templates — too slow for a 1–2 week MVP.

## Decision
"Send" opens WhatsApp with a prefilled message containing the tokenised proposal link. Seen-tracking comes from the link itself, not WhatsApp.

## Consequences
+ Zero setup, works today.
− Sender must tap send; no delivery receipts. Replace with Cloud API behind a `whatsapp` interface in the live phase.
