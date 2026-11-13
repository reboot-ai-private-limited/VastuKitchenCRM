# MVP Scope

**Timeline:** 1–2 weeks. **Principle:** demo-grade, shallow, simple.

## In scope
| Module | Included |
|---|---|
| Leads | Central lead table; sources: website, Facebook/Instagram, Justdial, manual, bulk CSV import; status pipeline; call tracking (call log); visit log |
| Proposals | In-app builder → PDF/web view; send via WhatsApp link; "seen" tracking; reminders (unseen 2d, seen-no-action 2d, stagnant status) |
| Projects | Auto-create on lead won; Facebook-style feed (unlimited photos + chat-style comments); client vs internal tab; design view (project list filtered by designer/stage, no separate board); final delivery photo → deal closed |
| Complaints | Raise (customer / reception) with photo → admin assigns technician → technician resolves with photo |
| HR | Add/edit employee (role, attendance type, fixed salary); attendance log (GPS for field sales, simulated biometric for others); simple salary table (fixed salary × attendance) |
| Dashboard | Org-wide counters, staff first/last activity, calls/leads/proposals per person, pending complaints, present staff |
| Apps | Web admin (Next.js on Vercel); Android APK (sales, technician, customer views) |

## Added after the MVP brief
- **Stocks** — a lean stock ledger (items, stock in/out/recount, low-stock flag) for Admin and Office. See [stocks](../02-product/stocks.md). Vendors, purchase orders, costs and per-project usage are still out.

## Out of scope (MVP)
- Real biometric integration (Hikvision SDK) — live phase after pricing is final
- Leave management, payroll deductions/tax/complex calculation
- Warranty engine, manufacturing, accounting/payments
- WhatsApp Cloud API automation (use `wa.me` link instead)
- Play Store release, iOS app
- TODO/docs/announcements/scheduling beyond a basic note (optional, only if time remains)

## Decisions (resolved)
1. **Customer login:** magic link / OTP, no passwords.
2. **Lead statuses:** bidirectional, any-to-any; no Qualified/Interested stage (`New → Contacted → Visit → Proposal Sent → Follow-up → Won | Lost`) — see [leads](../02-product/leads.md).
3. **Lead sources:** simulated for the demo (manual + CSV real, website/FB/Justdial are source tags with seeded leads). Build real integrations only if the client approves after the demo.
4. **Push notifications:** in-app first; FCM only if time allows.
5. **API hosting:** our own VPS (persistent process for cron; also suits the later Hikvision/LAN phase). Deployable with **either PM2 or Docker** — see [deployment](../03-architecture/deployment.md).
6. **Biometric:** simulated for the MVP; no device integration yet.
7. **Branding:** taken from the client website https://vaastukitchen.com/ — see [branding](../00-vision/branding.md).

## Open questions
1. VPS details: provider, OS, domain name and SSL (needed before the APK/Vercel web can call the API over HTTPS).
