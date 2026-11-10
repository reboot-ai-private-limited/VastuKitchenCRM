# Vision & Brief Summary

## Client
Vastu Kitchen (Siliguri): the largest, long-established premium modular kitchen & interior company in the city. Uses branded parts plus its own manufacturing unit. Kitchen projects range ₹40L – ₹1Cr. Team of 40–50: sales, callers, reception, floor staff, technicians, and 7–8 in-house designers (AutoCAD/Maya).

## Current pain
Leads in Privyr, project talk scattered across WhatsApp groups, separate biometric machine for attendance.

## Goal
One customised software: **Lead CRM + Proposals + Basecamp/Facebook-style Project Feed + Complaint Management + HR/Attendance**, with a 1-click admin dashboard.

## Why an MVP
A clean working demo is needed to **lock final pricing** with the client. Web panel live on Vercel; Android app as a direct `.apk` (no Play Store).

## Product goals
1. Cleanest UI · 2. Best UX · 3. Very easy to use · 4. Very simple, not complicated.

## Golden rules
- Keep it lean: only the screens/flows needed to explain the business. Skip or simplify deep logic.
- Designs (2D/3D) stay in AutoCAD/Maya; **proposals are generated inside our software**.

## Roles
Admin/Owner · HR · Sales (telecaller + field) · Designer · Technician · Office staff (reception, front desk, floor) · Customer. See [auth-and-roles](../03-architecture/auth-and-roles.md).

## Modules
1. Lead management + call tracking + visits → [leads](../02-product/leads.md)
2. Proposal generator + seen tracking + reminders → [proposals](../02-product/proposals.md)
3. Project feed + design board → [projects-feed](../02-product/projects-feed.md)
4. Complaints → [complaints](../02-product/complaints.md)
5. HR (attendance, employees, basic salary) → [hr](../02-product/hr.md)
6. Admin dashboard → [dashboard](../02-product/dashboard.md)

## Note
The original developer brief is in Bengali and is kept local only (gitignored). This summary is the English source of truth.
