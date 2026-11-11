# Demo Script (~15 min)

Goal: let the client *feel* the product and lock pricing.

1. **Admin dashboard (web):** counters, staff first/last activity, alerts.
2. **Leads:** show lead table, add one manually, upload a small CSV.
3. **Sales app (APK):** open lead → Call → returns with call logged → add outcome. Check in a visit.
4. **Proposal:** build for the ₹45L kitchen, send via WhatsApp link, open link as customer → admin instantly sees "Proposal seen" notification.
5. **Reminders:** show a "2 days, no status change" alert (seeded).
6. **Won → Project:** mark won; project appears automatically.
7. **Project feed:** designer render post → customer comment → owner reply → revised render. Then the electric-board issue thread from the technician.
8. **Design board:** designers and their projects.
9. **Complaint:** raise from reception → assign technician → resolve with photo on technician app.
10. **HR:** employee add, attendance log (GPS + simulated biometric), generated salary table.
11. **Close:** final delivery photo → deal closed.

The same steps, call by call in Swagger, with the seeded cast and what to point out: [api-walkthrough.md](api-walkthrough.md). Seed the data with `pnpm --filter @vastu/api seed:demo`.

Rehearse once end-to-end on the deployed Vercel link and the installed APK before the meeting.
