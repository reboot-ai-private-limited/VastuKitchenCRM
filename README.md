# Vastu Kitchen CRM

CRM, project feed, complaints and HR for a modular kitchen & interior company. Monorepo: `apps/api` (Express + MongoDB), `packages/contracts` (zod schemas + DTO types), `packages/config` (shared tsconfig/eslint). `apps/web` (Next.js) and `apps/mobile` (React Native) follow later. Docs: [`docs/README.md`](docs/README.md).

## Setup

```bash
pnpm install                       # pnpm 12 (see packageManager in package.json)
cp apps/api/.env.example apps/api/.env   # set MONGO_URI (Atlas)
pnpm dev:api                       # http://localhost:4000
```

- Health: `curl localhost:4000/api/health`
- **Swagger UI:** http://localhost:4000/api/docs (dev only)

## Commands

|                            |                                                |
| -------------------------- | ---------------------------------------------- |
| `pnpm check`               | typecheck + lint (incl. module-boundary check) |
| `pnpm build` / `pnpm test` | build / unit tests                             |
| `pnpm format`              | prettier                                       |

Deploy (PM2 or Docker): [`docs/03-architecture/deployment.md`](docs/03-architecture/deployment.md).
