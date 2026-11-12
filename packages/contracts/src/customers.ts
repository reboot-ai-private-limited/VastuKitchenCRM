import { z } from 'zod';
import { phoneSchema } from './identity.js';
import { leadStatusSchema } from './leads.js';
import { paginatedSchema } from './pagination.js';
import { projectStageSchema } from './projects.js';

const person = z.object({ id: z.string(), name: z.string() });

export const MAX_CUSTOMER_IMPORT_ROWS = 500;

/**
 * A customer: a person with an account (`id` is the CUSTOMER user). Their lead is their record and
 * their timeline: one phone, one lead, so there is nothing to merge.
 */
export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  city: z.string().nullable(),
  /** The lead behind this customer: its timeline is the customer's timeline. */
  leadId: z.string(),
  leadStatus: leadStatusSchema,
  /** The Sales person who owns the lead. */
  owner: person.nullable(),
  /** Newest first. */
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      stage: projectStageSchema,
      createdAt: z.string(),
    }),
  ),
  projectsCount: z.number().int(),
  /** Not closed yet. */
  activeProjects: z.number().int(),
  /** `leadStatus` is not WON/LOST: a new project is being worked on. */
  startedAgain: z.boolean(),
  lastActivityAt: z.string(),
  createdAt: z.string(),
});
export type CustomerDto = z.infer<typeof customerSchema>;

export const customerIdParamsSchema = z.object({ customerId: z.string().min(1) });

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
  search: z.string().trim().min(1).optional(),
});
export type ListCustomersQueryDto = z.infer<typeof listCustomersQuerySchema>;
export const customerPageSchema = paginatedSchema(customerSchema);

export const addCustomerBodySchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(120),
  phone: phoneSchema,
  city: z.string().trim().max(120).optional(),
});
export type AddCustomerBodyDto = z.infer<typeof addCustomerBodySchema>;

/** Rows come from a CSV the web app parsed; each is validated on its own, so one bad row never fails the file. */
export const importCustomersBodySchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string(),
        phone: z.string(),
        city: z.string().optional(),
      }),
    )
    .min(1)
    .max(MAX_CUSTOMER_IMPORT_ROWS),
});
export type ImportCustomersBodyDto = z.infer<typeof importCustomersBodySchema>;

export const importCustomersResultSchema = z.object({
  /** New customers (an account and a lead were made). */
  created: z.number().int(),
  /** Already a lead: it was linked to the new account instead of duplicated. */
  linked: z.number().int(),
  /** Already a customer (or repeated in the file): left as they were. */
  existing: z.array(z.object({ row: z.number().int(), phone: z.string(), customerId: z.string() })),
  invalid: z.array(z.object({ row: z.number().int(), errors: z.array(z.string()) })),
});
export type ImportCustomersResultDto = z.infer<typeof importCustomersResultSchema>;
