import { z } from 'zod';
import { paginatedSchema } from './pagination.js';
import { MAX_IMAGES_PER_COMMENT, imageInputSchema, imageSchema } from './uploads.js';

/** Post-delivery service tickets (fittings, parts). OPEN → ASSIGNED → RESOLVED → CLOSED. */
export const COMPLAINT_STATUSES = ['OPEN', 'ASSIGNED', 'RESOLVED', 'CLOSED'] as const;
export const complaintStatusSchema = z.enum(COMPLAINT_STATUSES);
export type ComplaintStatus = z.infer<typeof complaintStatusSchema>;

/** Photos on a complaint (when raised) and on its resolution: up to this many each. */
export const MAX_COMPLAINT_IMAGES = MAX_IMAGES_PER_COMMENT;

const person = z.object({ id: z.string(), name: z.string() });

export const COMPLAINT_EVENT_TYPES = [
  'RAISED',
  'ASSIGNED',
  'RESOLVED',
  'REOPENED',
  'CLOSED',
] as const;
export const complaintEventTypeSchema = z.enum(COMPLAINT_EVENT_TYPES);
export type ComplaintEventType = z.infer<typeof complaintEventTypeSchema>;

/** One line of the complaint's own history. */
export const complaintEventSchema = z.object({
  type: complaintEventTypeSchema,
  at: z.string(),
  actor: person.nullable(),
  /** The assignee on ASSIGNED; the reason on REOPENED; the note on RESOLVED / CLOSED. */
  note: z.string().nullable(),
  assignee: person.nullable(),
});
export type ComplaintEventDto = z.infer<typeof complaintEventSchema>;

/** A message in a complaint's conversation. Everyone who can see the complaint can read and write. */
export const complaintCommentSchema = z.object({
  id: z.string(),
  author: person.extend({ isCustomer: z.boolean() }),
  text: z.string().nullable(),
  images: z.array(imageSchema),
  createdAt: z.string(),
  /** The author or an Admin. */
  canDelete: z.boolean(),
});
export type ComplaintCommentDto = z.infer<typeof complaintCommentSchema>;

export const complaintSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  customer: person,
  description: z.string(),
  images: z.array(imageSchema),
  status: complaintStatusSchema,
  raisedBy: person.nullable(),
  assignedTo: person.nullable(),
  resolutionNote: z.string().nullable(),
  resolutionImages: z.array(imageSchema),
  createdAt: z.string(),
  assignedAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  /** How many times it was reopened after being resolved. */
  reopenCount: z.number().int(),
  history: z.array(complaintEventSchema),
  /** The conversation, oldest first. */
  comments: z.array(complaintCommentSchema),
  /** What the caller may do right now, so clients never re-derive the rules. */
  can: z.object({
    assign: z.boolean(),
    resolve: z.boolean(),
    reopen: z.boolean(),
    close: z.boolean(),
  }),
});
export type ComplaintDto = z.infer<typeof complaintSchema>;

const text = (max: number) => z.string().trim().min(1).max(max);
const photos = z.array(imageInputSchema).max(MAX_COMPLAINT_IMAGES).optional();

export const complaintIdParamsSchema = z.object({ complaintId: z.string().min(1) });
export const complaintCommentParamsSchema = z.object({
  complaintId: z.string().min(1),
  commentId: z.string().min(1),
});

export const addComplaintCommentBodySchema = z
  .object({
    text: z.string().trim().min(1).max(2000).optional(),
    images: z.array(imageInputSchema).max(MAX_IMAGES_PER_COMMENT).optional(),
  })
  .refine((v) => v.text !== undefined || (v.images?.length ?? 0) > 0, {
    message: 'Write something or add a photo',
  });
export type AddComplaintCommentBodyDto = z.infer<typeof addComplaintCommentBodySchema>;
/** Ask for a photo-upload ticket for a complaint about this project. */
export const signComplaintUploadBodySchema = z.object({ projectId: z.string().min(1) });

export const raiseComplaintBodySchema = z.object({
  projectId: z.string().min(1),
  description: text(2000),
  images: photos,
});
export type RaiseComplaintBodyDto = z.infer<typeof raiseComplaintBodySchema>;

export const assignComplaintBodySchema = z.object({ assigneeId: z.string().min(1) });
export type AssignComplaintBodyDto = z.infer<typeof assignComplaintBodySchema>;

export const resolveComplaintBodySchema = z.object({ note: text(2000), images: photos });
export type ResolveComplaintBodyDto = z.infer<typeof resolveComplaintBodySchema>;

export const reopenComplaintBodySchema = z.object({ reason: text(500) });
export type ReopenComplaintBodyDto = z.infer<typeof reopenComplaintBodySchema>;

export const closeComplaintBodySchema = z.object({ note: text(500).optional() });
export type CloseComplaintBodyDto = z.infer<typeof closeComplaintBodySchema>;

export const listComplaintsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: complaintStatusSchema.optional(),
  projectId: z.string().min(1).optional(),
  /** Only the ones assigned to this person (`me` = the caller). */
  assignedTo: z.string().min(1).optional(),
});
export type ListComplaintsQueryDto = z.infer<typeof listComplaintsQuerySchema>;
export const complaintPageSchema = paginatedSchema(complaintSchema);

/** Counts by status, for the dashboard and the list's tabs. Scoped like the list. */
export const complaintCountsSchema = z.object({
  OPEN: z.number().int(),
  ASSIGNED: z.number().int(),
  RESOLVED: z.number().int(),
  CLOSED: z.number().int(),
});
export type ComplaintCountsDto = z.infer<typeof complaintCountsSchema>;
