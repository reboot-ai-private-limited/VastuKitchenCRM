import { z } from 'zod';
import { paginatedSchema } from './pagination.js';
import { phoneSchema } from './identity.js';

/* ── vocabularies ─────────────────────────────────────────────────────────── */

export const LEAD_SOURCES = [
  'WEBSITE',
  'FACEBOOK',
  'INSTAGRAM',
  'JUSTDIAL',
  'WALK_IN',
  'REFERRAL',
  'EXISTING_CUSTOMER',
  'OTHER',
] as const;
export const leadSourceSchema = z.enum(LEAD_SOURCES);
export type LeadSource = z.infer<typeof leadSourceSchema>;

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'VISIT',
  'PROPOSAL_SENT',
  'FOLLOW_UP',
  'WON',
  'LOST',
] as const;
export const leadStatusSchema = z.enum(LEAD_STATUSES);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

/** Statuses a lead is finished in; these are never "stuck". */
export const CLOSED_LEAD_STATUSES: readonly LeadStatus[] = ['WON', 'LOST'];

export const CALL_OUTCOMES = [
  'INTERESTED',
  'CALL_BACK',
  'NOT_INTERESTED',
  'NO_ANSWER',
  'WRONG_NUMBER',
] as const;
export const callOutcomeSchema = z.enum(CALL_OUTCOMES);
export type CallOutcome = z.infer<typeof callOutcomeSchema>;

export const LEAD_ACTIVITY_TYPES = [
  'CREATED',
  'ASSIGNED',
  'STATUS_CHANGED',
  'CALL',
  'VISIT',
  'PROPOSAL_SENT',
  'PROPOSAL_SEEN',
  'PROJECT_CREATED',
  'PROJECT_CLOSED',
] as const;
export const leadActivityTypeSchema = z.enum(LEAD_ACTIVITY_TYPES);
export type LeadActivityType = z.infer<typeof leadActivityTypeSchema>;

/* ── lead ─────────────────────────────────────────────────────────────────── */

const optionalText = z.string().trim().min(1).max(500);

export const leadSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  altPhone: z.string().nullable(),
  email: z.string().nullable(),
  city: z.string().nullable(),
  notes: z.string().nullable(),
  source: leadSourceSchema,
  status: leadStatusSchema,
  statusChangedAt: z.string(),
  /** Not Won/Lost and unchanged for longer than the configured number of days. */
  isStuck: z.boolean(),
  assignedTo: z.object({ id: z.string(), name: z.string() }).nullable(),
  lostReason: z.string().nullable(),
  /** Set when the lead is won: the CUSTOMER account created for them. */
  customerId: z.string().nullable(),
  createdAt: z.string(),
});
export type LeadDto = z.infer<typeof leadSchema>;

export const leadIdParamsSchema = z.object({ id: z.string().min(1) });

export const createLeadBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  altPhone: phoneSchema.optional(),
  email: z.string().trim().email().optional(),
  city: optionalText.optional(),
  notes: z.string().trim().min(1).max(2000).optional(),
  source: leadSourceSchema,
});
export type CreateLeadBodyDto = z.infer<typeof createLeadBodySchema>;

/** Send `null` to clear an optional field; omit a key to leave it alone. */
export const updateLeadBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    phone: phoneSchema,
    altPhone: phoneSchema.nullable(),
    email: z.string().trim().email().nullable(),
    city: optionalText.nullable(),
    notes: z.string().trim().min(1).max(2000).nullable(),
    source: leadSourceSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateLeadBodyDto = z.infer<typeof updateLeadBodySchema>;

export const assignLeadBodySchema = z.object({
  /** A SALES user's id, or `null` to unassign. */
  userId: z.string().min(1).nullable(),
});
export type AssignLeadBodyDto = z.infer<typeof assignLeadBodySchema>;

export const changeLeadStatusBodySchema = z
  .object({
    status: leadStatusSchema,
    note: z.string().trim().min(1).max(1000).optional(),
    lostReason: z.string().trim().min(1).max(500).optional(),
  })
  .refine((v) => v.status !== 'LOST' || v.lostReason !== undefined, {
    message: 'Give a reason when marking a lead as lost',
    path: ['lostReason'],
  });
export type ChangeLeadStatusBodyDto = z.infer<typeof changeLeadStatusBodySchema>;

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  status: leadStatusSchema.optional(),
  source: leadSourceSchema.optional(),
  /** `me`, `unassigned`, or a user id. Sales users are always limited to their own leads. */
  assignedTo: z.string().min(1).optional(),
  stuck: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ListLeadsQueryDto = z.infer<typeof listLeadsQuerySchema>;
export const leadPageSchema = paginatedSchema(leadSchema);

/* ── calls ────────────────────────────────────────────────────────────────── */

export const MAX_CALL_SECONDS = 4 * 60 * 60;

export const recordCallBodySchema = z.object({
  /** When the call began, from the phone's call log. */
  startedAt: z.coerce.date(),
  durationSec: z.number().int().min(0).max(MAX_CALL_SECONDS),
  answered: z.boolean(),
  outcome: callOutcomeSchema.optional(),
  note: z.string().trim().min(1).max(1000).optional(),
});
export type RecordCallBodyDto = z.infer<typeof recordCallBodySchema>;

export const callSchema = z.object({
  id: z.string(),
  leadId: z.string(),
  user: z.object({ id: z.string(), name: z.string() }),
  startedAt: z.string(),
  durationSec: z.number(),
  answered: z.boolean(),
  outcome: callOutcomeSchema.nullable(),
  note: z.string().nullable(),
});
export type CallDto = z.infer<typeof callSchema>;

export const callStatsQuerySchema = z.object({
  /** Inclusive start / exclusive end of the window; defaults to today (server time). */
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type CallStatsQueryDto = z.infer<typeof callStatsQuerySchema>;

export const callStatSchema = z.object({
  user: z.object({ id: z.string(), name: z.string() }),
  calls: z.number().int(),
  answered: z.number().int(),
  talkSeconds: z.number().int(),
});
export type CallStatDto = z.infer<typeof callStatSchema>;

/* ── visits ───────────────────────────────────────────────────────────────── */

export const recordVisitBodySchema = z.object({
  /** Defaults to now. */
  at: z.coerce.date().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  note: z.string().trim().min(1).max(1000).optional(),
  photoUrl: z.string().url().optional(),
});
export type RecordVisitBodyDto = z.infer<typeof recordVisitBodySchema>;

export const visitSchema = z.object({
  id: z.string(),
  leadId: z.string(),
  user: z.object({ id: z.string(), name: z.string() }),
  at: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  note: z.string().nullable(),
  photoUrl: z.string().nullable(),
});
export type VisitDto = z.infer<typeof visitSchema>;

/* ── timeline ─────────────────────────────────────────────────────────────── */

export const leadActivitySchema = z.object({
  id: z.string(),
  type: leadActivityTypeSchema,
  at: z.string(),
  by: z.object({ id: z.string(), name: z.string() }).nullable(),
  /** Type-specific details, e.g. `{ from, to, note }` for a status change. */
  data: z.record(z.unknown()),
});
export type LeadActivityDto = z.infer<typeof leadActivitySchema>;

/* ── import ───────────────────────────────────────────────────────────────── */

export const MAX_IMPORT_ROWS = 500;

/** Rows are validated one by one on the server, so a single bad row never fails the whole file. */
export const importLeadsBodySchema = z.object({
  /** Used for rows that have no `source` of their own. */
  defaultSource: leadSourceSchema.default('OTHER'),
  rows: z
    .array(
      z.object({
        name: z.string(),
        phone: z.string(),
        altPhone: z.string().optional(),
        email: z.string().optional(),
        city: z.string().optional(),
        notes: z.string().optional(),
        source: z.string().optional(),
      }),
    )
    .min(1)
    .max(MAX_IMPORT_ROWS),
});
export type ImportLeadsBodyDto = z.infer<typeof importLeadsBodySchema>;

export const importResultSchema = z.object({
  created: z.number().int(),
  /** Phone numbers that already exist as leads (or repeat inside the file). Nothing is overwritten. */
  duplicates: z.array(
    z.object({ row: z.number().int(), phone: z.string(), existingLeadId: z.string().nullable() }),
  ),
  invalid: z.array(z.object({ row: z.number().int(), errors: z.array(z.string()) })),
});
export type ImportResultDto = z.infer<typeof importResultSchema>;
