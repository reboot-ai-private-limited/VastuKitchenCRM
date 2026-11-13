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
export * from './leads.js';
export * from './customers.js';
export * from './proposals.js';
export * from './proposalTemplates.js';
export * from './proposalTemplates.seed.js';
export * from './notifications.js';
export * from './uploads.js';
export * from './settings.js';
export * from './projects.js';
export * from './todos.js';
export * from './docs.js';
export * from './complaints.js';
export * from './hr.js';
export * from './dashboard.js';
export * from './stocks.js';
