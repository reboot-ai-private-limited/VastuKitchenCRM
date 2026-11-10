# ADR-0008: Zod-first contracts shared across apps

**Status:** Accepted

## Context

API, web and mobile all exchange the same request/response shapes. Hand-written DTO interfaces next to separate zod schemas can drift silently.

## Decision

`packages/contracts` defines zod schemas; DTO types are `z.infer` of them. The API's `validate()` middleware and OpenAPI registry use the same schemas; web/mobile reuse them for forms and clients. Domain entities are separate and mapped to DTOs in `interface/`.

## Consequences

- One definition; a change is a type error in every consumer.
  − `contracts` depends on `zod` (acceptable; already required everywhere).
