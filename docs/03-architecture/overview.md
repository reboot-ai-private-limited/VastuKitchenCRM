# Architecture Overview

## Planned monorepo (not created yet)
```
VastuKitchenCRM/
  apps/
    api/       Express + Node + MongoDB (Mongoose), node-cron, JWT auth
    web/       Next.js admin panel (Vercel)
    mobile/    React Native Android app (direct APK)
  packages/
    shared/    TypeScript types, zod schemas, role/status constants
  docs/
```
pnpm workspaces, TypeScript throughout. `packages/shared` keeps roles, statuses and validation identical across the three apps.

## Stack
| Concern | Choice |
|---|---|
| API | Express (Node, TS) — [ADR-0001](../adr/0001-monorepo.md) |
| DB | MongoDB Atlas + Mongoose — [ADR-0002](../adr/0002-mongodb.md) |
| Web | Next.js (admin), deployed on Vercel; talks to API over REST |
| Mobile | React Native, Android APK only |
| Files | Cloudinary (MVP) behind a storage interface — [ADR-0003](../adr/0003-cloudinary.md) |
| Jobs | `node-cron` inside the API process (single instance) |
| Hosting | API on our VPS via PM2 or Docker — [deployment](deployment.md), [ADR-0006](../adr/0006-pm2-and-docker.md) |
| Push | FCM (optional if time-tight; in-app notifications are the baseline) |
| WhatsApp | `wa.me` link — [ADR-0004](../adr/0004-whatsapp-wa-me.md) |
| Calls | Android call log — [ADR-0005](../adr/0005-call-log-tracking.md) |

## Principles
- REST + JSON, one `/api/v1` prefix; validate every request with zod from `shared`.
- Role checks in middleware; no business rules in clients.
- Keep modules flat: `leads`, `proposals`, `projects`, `complaints`, `hr`, `notifications`, `dashboard`.
- Storage and WhatsApp behind thin interfaces so they can be swapped (S3, Cloud API) later.
