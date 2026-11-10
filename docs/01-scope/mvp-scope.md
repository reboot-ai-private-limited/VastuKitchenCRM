# MVP Scope

**Timeline:** 1–2 weeks. **Principle:** demo-grade, shallow, simple.

## In scope
| Module | Included |
|---|---|
| Leads | Central lead table; sources: website, Facebook/Instagram, Justdial, manual, bulk CSV import; status pipeline; call tracking (call log); visit log |
| Proposals | In-app builder → PDF/web view; send via WhatsApp link; "seen" tracking; reminders (unseen 2d, seen-no-action 2d, stagnant status) |
| Projects | Auto-create on lead won; Facebook-style feed (unlimited photos + chat-style comments); client vs internal tab; design-team board; final delivery photo → deal closed |
| Complaints | Raise (customer / reception) with photo → admin assigns technician → technician resolves with photo |
| HR | Add/edit employee (role, attendance type, fixed salary); attendance log (GPS for field sales, simulated biometric for others); simple salary table (fixed salary × attendance) |
| Dashboard | Org-wide counters, staff first/last activity, calls/leads/proposals per person, pending complaints, present staff |
| Apps | Web admin (Next.js on Vercel); Android APK (sales, technician, customer views) |

## Out of scope (MVP)
- Real biometric integration (Hikvision SDK) — live phase after pricing is final
- Leave management, payroll deductions/tax/complex calculation
- Warranty engine, inventory, manufacturing, accounting/payments
- WhatsApp Cloud API automation (use `wa.me` link instead)
- Play Store release, iOS app
- TODO/docs/announcements/scheduling beyond a basic note (optional, only if time remains)

## Open questions
1. Customer login: magic link / OTP (recommended) vs password?
2. Lead pipeline statuses — confirm list (proposed in [leads](../02-product/leads.md)).
3. Do website/FB/Justdial leads arrive via API/webhook, or only manual/CSV for the demo? (Assume manual/CSV + simulated sources.)
4. Which hosting for the API (Render / Railway / VPS)?
5. Branding (logo, colours, proposal template) from client?
6. Push notifications: FCM in MVP, or in-app notifications only if time is tight?
