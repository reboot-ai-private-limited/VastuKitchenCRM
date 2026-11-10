import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';
import { z } from 'zod';
import { isProduction } from '@/config/env.js';

// Patches zod with `.openapi(...)`; must run before any route file uses it.
extendZodWithOpenApi(z);

/**
 * Shared OpenAPI registry. Each module calls `openApiRegistry.registerPath(...)` in its own
 * `interface/*.route.ts` next to the route, using the SAME zod schema from `@vastu/contracts` that
 * validates the request — one definition, not two. Registration is a side effect of importing a
 * route file, so `mountSwagger` must run after every router is built (see `app.ts`).
 */
export const openApiRegistry = new OpenAPIRegistry();

/** Referenced by authenticated routes via `security: [{ bearerAuth: [] }]`. */
openApiRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

/** Declared in order so Swagger UI groups routes by module. Add a tag per new module. */
const TAGS = [
  { name: 'Health', description: 'Service health check.' },
  {
    name: 'Identity / Auth',
    description: 'Login, refresh, logout, current user, customer invite sign-in.',
  },
  { name: 'Identity / Users', description: 'Staff accounts (Admin and HR).' },
  {
    name: 'Identity / Designations',
    description: 'Designation master data shown in the user form.',
  },
  { name: 'Identity / Customers', description: 'Customer accounts and one-time invite links.' },
  {
    name: 'Leads',
    description: 'Lead table, status pipeline, calls, visits, timeline, CSV import.',
  },
];

const requestMetaSchema = z.object({
  method: z.string(),
  url: z.string(),
  requestId: z.string(),
  ip: z.string().optional(),
});

/** The success envelope around `data`, so Swagger shows what the API really returns. */
export const envelopeSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.literal(true),
    statusCode: z.number(),
    request: requestMetaSchema,
    message: z.string(),
    data,
  });

export const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  statusCode: z.number(),
  code: z.string(),
  request: requestMetaSchema,
  message: z.string(),
  data: z.unknown().optional(),
});

export const okResponse = <T extends z.ZodTypeAny>(description: string, data: T) => ({
  description,
  content: { 'application/json': { schema: envelopeSchema(data) } },
});

export const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorEnvelopeSchema } },
});

export const SWAGGER_DOCS_PATH = '/api/docs';

function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(openApiRegistry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: { title: 'Vastu Kitchen CRM API', version: '0.1.0' },
    tags: TAGS,
  });
}

/** Interactive docs at /api/docs — development only. */
export function mountSwagger(app: Express): void {
  if (isProduction) return;
  app.use(SWAGGER_DOCS_PATH, swaggerUi.serve, swaggerUi.setup(buildOpenApiDocument()));
}
