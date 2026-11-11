import { z } from 'zod';
import { leadActivitySchema } from './leads.js';
import { MAX_IMAGES_PER_POST, imageInputSchema, imageSchema } from './uploads.js';

/* ── vocabularies ─────────────────────────────────────────────────────────── */

export const PROJECT_STAGES = ['DESIGN', 'SITE', 'CLOSED'] as const;
export const projectStageSchema = z.enum(PROJECT_STAGES);
export type ProjectStage = z.infer<typeof projectStageSchema>;

export const DESIGN_STAGES = ['NOT_STARTED', 'IN_DESIGN', 'SHARED', 'APPROVED'] as const;
export const designStageSchema = z.enum(DESIGN_STAGES);
export type DesignStage = z.infer<typeof designStageSchema>;

/** Who sees a post: `CLIENT` = the team and the customer; `TEAM` = staff on the project only. */
export const POST_VISIBILITIES = ['CLIENT', 'TEAM'] as const;
export const postVisibilitySchema = z.enum(POST_VISIBILITIES);
export type PostVisibility = z.infer<typeof postVisibilitySchema>;

export const POST_KINDS = ['UPDATE', 'FINAL_DELIVERY'] as const;
export const postKindSchema = z.enum(POST_KINDS);
export type PostKind = z.infer<typeof postKindSchema>;

const person = z.object({ id: z.string(), name: z.string() });

/* ── projects ─────────────────────────────────────────────────────────────── */

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  customer: z.object({ id: z.string(), name: z.string(), phone: z.string() }),
  /** The lead this project came from, if any (a repeat customer's new project has none). */
  leadId: z.string().nullable(),
  siteAddress: z.string().nullable(),
  /** Rupees. */
  value: z.number().int().nullable(),
  stage: projectStageSchema,
  designStage: designStageSchema,
  designer: person.nullable(),
  /** Staff with access to the project (includes the designer). */
  members: z.array(person.extend({ designation: z.string().nullable() })),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
});
export type ProjectDto = z.infer<typeof projectSchema>;

export const projectIdParamsSchema = z.object({ id: z.string().min(1) });

/** Pick an existing customer, or a lead (its customer is found or created). Exactly one. */
export const createProjectBodySchema = z
  .object({
    customerId: z.string().min(1).optional(),
    leadId: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(160),
    siteAddress: z.string().trim().min(1).max(500).optional(),
    value: z.number().int().min(0).max(10_000_000_000).optional(),
  })
  .refine((v) => (v.customerId === undefined) !== (v.leadId === undefined), {
    message: 'Give either customerId or leadId, not both',
    path: ['customerId'],
  });
export type CreateProjectBodyDto = z.infer<typeof createProjectBodySchema>;

export const updateProjectBodySchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    siteAddress: z.string().trim().min(1).max(500).nullable(),
    value: z.number().int().min(0).max(10_000_000_000).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateProjectBodyDto = z.infer<typeof updateProjectBodySchema>;

/** Replaces the member list. The designer, if given, is added to the members automatically. */
export const setMembersBodySchema = z.object({
  memberIds: z.array(z.string().min(1)).max(50),
  designerId: z.string().min(1).nullable(),
});
export type SetMembersBodyDto = z.infer<typeof setMembersBodySchema>;

export const changeStageBodySchema = z.object({ stage: z.enum(['DESIGN', 'SITE']) });
export const changeDesignStageBodySchema = z.object({ designStage: designStageSchema });

export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  stage: projectStageSchema.optional(),
  designStage: designStageSchema.optional(),
  designerId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  /** Everyone who can access the lead may list its projects (a summary, never the feeds). */
  leadId: z.string().min(1).optional(),
});
export type ListProjectsQueryDto = z.infer<typeof listProjectsQuerySchema>;

/* ── feed ─────────────────────────────────────────────────────────────────── */

export const commentSchema = z.object({
  id: z.string(),
  postId: z.string(),
  author: person.extend({ isCustomer: z.boolean() }),
  text: z.string(),
  createdAt: z.string(),
  /** The author or an Admin. */
  canDelete: z.boolean(),
});
export type CommentDto = z.infer<typeof commentSchema>;

export const postSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  author: person.extend({ designation: z.string().nullable(), isCustomer: z.boolean() }),
  visibility: postVisibilitySchema,
  kind: postKindSchema,
  text: z.string().nullable(),
  images: z.array(imageSchema),
  commentCount: z.number().int(),
  /** The latest few comments (oldest first); open the post for the whole thread. */
  recentComments: z.array(commentSchema),
  /** Set once the customer has approved the post's design. */
  approval: z.object({ by: person, at: z.string() }).nullable(),
  /** What the current viewer may do, so apps never guess. */
  canDelete: z.boolean(),
  canApprove: z.boolean(),
  createdAt: z.string(),
});
export type PostDto = z.infer<typeof postSchema>;

export const createPostBodySchema = z
  .object({
    text: z.string().trim().min(1).max(5000).optional(),
    images: z.array(imageInputSchema).max(MAX_IMAGES_PER_POST).default([]),
    /** Defaults to TEAM, so nothing reaches the customer by accident. A customer's posts are always CLIENT. */
    visibility: postVisibilitySchema.default('TEAM'),
    /** FINAL_DELIVERY needs at least one photo and is always visible to the customer. */
    kind: postKindSchema.default('UPDATE'),
  })
  .refine((v) => v.text !== undefined || v.images.length > 0, {
    message: 'Write something or add a photo',
    path: ['text'],
  })
  .refine((v) => v.kind !== 'FINAL_DELIVERY' || v.images.length > 0, {
    message: 'A final delivery post needs at least one photo',
    path: ['images'],
  });
export type CreatePostBodyDto = z.infer<typeof createPostBodySchema>;

export const listPostsQuerySchema = z.object({
  /** Only one tab. Omit for everything the viewer may see. */
  visibility: postVisibilitySchema.optional(),
  /** `nextCursor` from the previous page. */
  before: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListPostsQueryDto = z.infer<typeof listPostsQuerySchema>;

export const postPageSchema = z.object({
  items: z.array(postSchema),
  /** Pass as `before` to load older posts; null when there are no more. */
  nextCursor: z.string().nullable(),
});
export type PostPageDto = z.infer<typeof postPageSchema>;

export const postIdParamsSchema = z.object({
  id: z.string().min(1),
  postId: z.string().min(1),
});
export const commentIdParamsSchema = postIdParamsSchema.extend({ commentId: z.string().min(1) });

export const createCommentBodySchema = z.object({ text: z.string().trim().min(1).max(2000) });
export type CreateCommentBodyDto = z.infer<typeof createCommentBodySchema>;

/** The lead's story so far, oldest first — shown collapsed on the project (Admin and the lead's owner). */
export const journeySchema = z.array(leadActivitySchema);

/* ── project timeline (posts + team activity, one stream) ─────────────────── */

/** Compact "change log" lines the team sees in the feed. Never shown to the customer. */
export const PROJECT_ACTIVITY_TYPES = [
  'TODO_CREATED',
  'TODO_ASSIGNED',
  'TODO_DUE_CHANGED',
  'TODO_COMPLETED',
  'TODO_REOPENED',
] as const;
export const projectActivityTypeSchema = z.enum(PROJECT_ACTIVITY_TYPES);
export type ProjectActivityType = z.infer<typeof projectActivityTypeSchema>;

export const projectActivitySchema = z.object({
  id: z.string(),
  type: projectActivityTypeSchema,
  at: z.string(),
  actor: person.nullable(),
  /** Type-specific, e.g. `{ todoId, todoTitle }`. */
  data: z.record(z.unknown()),
});
export type ProjectActivityDto = z.infer<typeof projectActivitySchema>;

export const timelineItemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('POST'), at: z.string(), post: postSchema }),
  z.object({ kind: z.literal('ACTIVITY'), at: z.string(), activity: projectActivitySchema }),
]);
export type TimelineItemDto = z.infer<typeof timelineItemSchema>;

export const listTimelineQuerySchema = z.object({
  /** `nextCursor` from the previous page. */
  before: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListTimelineQueryDto = z.infer<typeof listTimelineQuerySchema>;

export const timelinePageSchema = z.object({
  items: z.array(timelineItemSchema),
  nextCursor: z.string().nullable(),
});
export type TimelinePageDto = z.infer<typeof timelinePageSchema>;
