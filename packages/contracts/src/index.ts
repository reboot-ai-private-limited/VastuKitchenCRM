/**
 * @vastu/contracts — the wire format, shared by `apps/api` and (later) `apps/web` / `apps/mobile`.
 *
 * ZOD IS THE SOURCE OF TRUTH. Every request/response shape is a zod schema here, and its DTO type
 * is `z.infer<typeof schema>` — never a hand-written interface alongside it. The API validates
 * with the schema; web and mobile forms and clients reuse it; OpenAPI is generated from it.
 *
 * One file per domain. Add `export * from './<domain>.js'` below.
 */
export * from './http.js';
export * from './errors.js';
export * from './pagination.js';
export * from './auth.js';
export * from './health.js';
export * from './identity.js';
