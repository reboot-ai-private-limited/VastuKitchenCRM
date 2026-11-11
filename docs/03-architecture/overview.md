# Architecture Overview

## Monorepo layout (api + packages exist; web and mobile come later)

```
VastuKitchenCRM/
  apps/
    api/       Express + Node + MongoDB (Mongoose)          [exists]
    web/       Next.js admin panel (Vercel)                 [later]
    mobile/    React Native Android app (direct APK)        [later]
  packages/
    config/    shared tsconfig + eslint bases               [exists]
    contracts/ zod schemas + DTO types, roles, envelope     [exists]
  docs/
```

pnpm workspaces + Turborepo, TypeScript throughout (pnpm 12). `packages/contracts` keeps roles, statuses and validation identical across the apps.

## Stack

| Concern  | Choice                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------- |
| API      | Express (Node, TS) — [ADR-0001](../adr/0001-monorepo.md)                                                  |
| DB       | MongoDB Atlas + Mongoose — [ADR-0002](../adr/0002-mongodb.md)                                             |
| Web      | Next.js (admin), deployed on Vercel; talks to API over REST                                               |
| Mobile   | React Native, Android APK only                                                                            |
| Files    | Cloudinary (MVP) behind a storage interface — [ADR-0003](../adr/0003-cloudinary.md)                       |
| Jobs     | `node-cron` inside the API process (single instance; added with the reminders module)                                                      |
| Hosting  | API on our VPS via PM2 or Docker — [deployment](deployment.md), [ADR-0006](../adr/0006-pm2-and-docker.md) |
| Push     | FCM (optional if time-tight; in-app notifications are the baseline)                                       |
| WhatsApp | `wa.me` link — [ADR-0004](../adr/0004-whatsapp-wa-me.md)                                                  |
| Calls    | Android call log — [ADR-0005](../adr/0005-call-log-tracking.md)                                           |

## Principles

- REST + JSON under `/api`; validate every request with the zod schemas from `@vastu/contracts`.
- Role checks in middleware; no business rules in clients.
- Keep modules flat: `leads`, `proposals`, `projects`, `complaints`, `hr`, `notifications`, `dashboard`.
- Storage and WhatsApp behind thin interfaces so they can be swapped (S3, Cloud API) later.

## Module anatomy (apps/api/src/modules/<name>/)

```
domain/            entities + ports (interfaces). No Express, no Mongoose.
application/       usecases/ — one class per use case, ports injected via constructor
infrastructure/    adapters: Mongoose schemas/repositories, Cloudinary, etc. (only place Mongoose lives)
interface/         <name>.route.ts, <name>.controller.ts, OpenAPI registration
<name>.container.ts  composition root → { contract, buildRouter }
<name>.public.ts     the ONLY file other modules may import
```

Reference implementation: `modules/health/` — copy it for a new module, then register the container in `src/container.ts` and the router in `src/routes.ts`.

SOLID mapping: **S** one use case per class · **O** new behaviour = new use case/adapter · **L** adapters honour port contracts (tests use in-memory fakes) · **I** narrow ports and narrow `.public.ts` · **D** use cases depend on ports; the container wires adapters.

## Module tiers (how modules scale)

A module may import only the `.public.ts` of a **strictly lower** tier — no sideways, upward, or circular imports. Enforced by `apps/api/.dependency-cruiser.cjs` (`pnpm lint`).

```
T0 health, config, settings → T1 identity → T2 notifications, activity → T3 leads, hr
→ T4 proposals → T5 projects → T6 todos, docs, complaints → T7 reminders, dashboard
```

Higher tiers react to lower ones via events (e.g. `LeadWon` → projects creates a project; `ProposalSeen` → notifications), registered in the composition root — never by a lower module importing a higher one. Changing a module's tier is a deliberate edit to `MODULE_TIERS`. See [ADR-0007](../adr/0007-module-tiers.md).

## Contracts: zod-first DTOs

`packages/contracts` holds **zod schemas**; every DTO type is `z.infer<typeof schema>`. The API validates with the same schema (`validate({ body })`), registers it in OpenAPI, and web/mobile forms and clients import it — one definition, no drift. Domain entities stay separate and are mapped to DTOs in `interface/`. See [ADR-0008](../adr/0008-zod-first-contracts.md).

## API docs (Swagger)

Interactive Swagger UI at `http://localhost:4000/api/docs` (development only, disabled in production). Each route registers itself in `shared/http/swagger.util.ts`'s registry next to the route, using the contracts schemas.

## Routing rule: root-mounted routers authenticate per route
Most modules mount at their own prefix (`/api/leads`), where a router-level `router.use(authenticate)` is safe. A module whose paths span prefixes (to-dos: `/projects/:id/todos` and `/todos/:id`) is mounted at the **root** of `/api` and sees every request, so it must authenticate **on each route**, never at router level — and it is mounted **last**. Otherwise it would answer 401 to routes that merely pass through it (the public proposal links, the Swagger docs). A regression test (`todos.route.test.ts`) guards this.
