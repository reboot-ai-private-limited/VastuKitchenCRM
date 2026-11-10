# Deployment

Targets: **API on our VPS**, **web on Vercel**, **mobile as a direct APK**. The API must support **both PM2 and Docker** so we can pick per environment. See [ADR-0006](../adr/0006-pm2-and-docker.md).

## Topology

```
Android APK ─┐
             ├─► HTTPS ─► Nginx (VPS) ─► api :4000 (PM2 or Docker) ─► MongoDB Atlas
Next.js web ─┘ (Vercel)                         └─► Cloudinary
```

- Nginx reverse proxy + Let's Encrypt SSL on a domain/subdomain (e.g. `api.<domain>`). HTTPS is required for the APK and Vercel web.
- MongoDB Atlas (allow the VPS IP). Cloudinary via env keys.

## Common rules (both modes)

- One build artifact: `pnpm --filter @vastu/api build` → `apps/api/dist`.
- Config only via env vars (`.env`, never committed; `.env.example` is). Includes `PORT`, `MONGO_URI`, `JWT_*`, `CLOUDINARY_*`, `CORS_ORIGINS`, reminder thresholds.
- First-time setup on a new database: `node dist/scripts/seed.js` (or `pnpm --filter @vastu/api seed` in dev) adds the default designations and creates the first Admin, prompting for the password (never read from `.env`).
- Health endpoint `GET /api/health` for checks.
- **Run exactly one instance that runs cron** (see below).

## Option A — PM2

- `apps/api/ecosystem.config.cjs`: app `vastu-api`, `script: dist/server.js`, `instances: 1`, `exec_mode: fork`, `max_memory_restart`, `kill_timeout` above the app's drain timeout.
- Deploy: `git pull` → `pnpm install --frozen-lockfile` → `pnpm --filter @vastu/api build` → `pm2 reload apps/api/ecosystem.config.cjs --env production`.
- Persist across reboot: `pm2 save` + `pm2 startup`.

## Option B — Docker

- `apps/api/Dockerfile`: multi-stage (build → slim runtime), non-root user, `HEALTHCHECK` on `/api/health`.
- `docker-compose.prod.yml` at repo root: `api` service with `env_file`, `restart: unless-stopped`, port `4000` bound to localhost behind Nginx. (Mongo stays on Atlas, so no DB container.)
- Deploy: `git pull` → `docker compose -f docker-compose.prod.yml up -d --build`.

## Cron caveat

Reminder jobs run inside the API process ([notifications-and-cron](notifications-and-cron.md)). Never scale to multiple instances/replicas without moving cron to a single worker or adding a lock — PM2 `instances: 1` / Docker `replicas: 1` for MVP. Controlled by `ENABLE_CRON=true` so a second instance can run without jobs.

## Web & mobile

- **Web:** Vercel, env `NEXT_PUBLIC_API_URL=https://api.<domain>`.
- **Mobile:** APK built with the production API URL baked in via build config; distributed directly (no Play Store).

## Later (optional)

GitHub Actions to SSH-deploy (PM2) or push an image (Docker); not needed for the MVP demo.
