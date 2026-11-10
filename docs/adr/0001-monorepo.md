# ADR-0001: Monorepo with separate API and web apps

**Status:** Accepted

## Context
Express API, Next.js admin, and React Native app share roles, statuses and validation. Reminders need cron, which doesn't suit Vercel serverless.

## Decision
Single repo (pnpm workspaces, TypeScript): `apps/api` (Express), `apps/web` (Next.js), `apps/mobile` (React Native), `packages/shared`. API runs on a persistent host; web on Vercel.

## Consequences
+ Shared types/schemas prevent drift; one place for docs.
+ Cron and long-running work live in the API.
− Slightly more initial tooling than a single Next.js app.
