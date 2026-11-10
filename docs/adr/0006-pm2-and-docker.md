# ADR-0006: API deployable with both PM2 and Docker on our VPS

**Status:** Accepted

## Context
API runs on our own VPS (persistent process for cron, later LAN access for biometric). The team wants flexibility: quick PM2 deploys now, containers when the environment needs it.

## Decision
Support both from day one: `apps/api/ecosystem.config.cjs` for PM2 and `apps/api/Dockerfile` + `docker-compose.prod.yml`. Same build, same env vars, same health endpoint. Nginx fronts either.

## Consequences
+ Pick per environment; easy to migrate PM2 → Docker.
− Two deploy paths to keep working. Mitigation: both documented in [deployment](../03-architecture/deployment.md) and verified once before the demo.
− Cron must stay single-instance (`ENABLE_CRON` flag).
