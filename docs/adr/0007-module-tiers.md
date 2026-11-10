# ADR-0007: Modular monolith with enforced module tiers

**Status:** Accepted

## Context

The API will grow module by module (leads → proposals → projects → complaints…). Without rules, modules couple sideways and cycle, and untangling later is expensive. We mirror the structure that already works in the sibling `greynote` project.

## Decision

Each module follows domain / application / infrastructure / interface layers with a composition-root container and a `.public.ts` contract. Modules are assigned **tiers** and may import only lower-tier `.public.ts` files. `dependency-cruiser` enforces it in `pnpm lint`. Upward reactions use events wired at the composition root.

## Consequences

- New modules slot in without touching existing ones; boundaries fail CI instead of rotting.
  − A genuine same-tier dependency means one module is mis-tiered and must be moved deliberately.
