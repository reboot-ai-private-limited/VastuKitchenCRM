import { z } from 'zod';
import {
  MAX_IMAGES_PER_COMMENT,
  MAX_IMAGES_PER_POST,
  imageInputSchema,
  imageSchema,
} from './uploads.js';

const person = z.object({ id: z.string(), name: z.string() });

export const MAX_TODO_IMAGES = 10;

/** A calendar date, `YYYY-MM-DD`, with no time or timezone: "due on the 14th". */
export const todoDueSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the form YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, 'Not a real date');

/** Where a to-do sits in "My assignments". */
export const TODO_BUCKETS = ['OVERDUE', 'TODAY', 'UPCOMING', 'NO_DATE'] as const;
export const todoBucketSchema = z.enum(TODO_BUCKETS);
export type TodoBucket = z.infer<typeof todoBucketSchema>;

/* ── lists ────────────────────────────────────────────────────────────────── */

export const todoListSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  archived: z.boolean(),
  /** "3/8 completed" is `doneCount` of `openCount + doneCount`. */
  openCount: z.number().int(),
  doneCount: z.number().int(),
  createdAt: z.string(),
});
export type TodoListDto = z.infer<typeof todoListSchema>;

export const createTodoListBodySchema = z.object({ name: z.string().trim().min(1).max(120) });
export type CreateTodoListBodyDto = z.infer<typeof createTodoListBodySchema>;

export const updateTodoListBodySchema = z
  .object({ name: z.string().trim().min(1).max(120), archived: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateTodoListBodyDto = z.infer<typeof updateTodoListBodySchema>;

export const listTodoListsQuerySchema = z.object({
  /** `true` also returns archived lists. */
  archived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

/* ── to-dos ───────────────────────────────────────────────────────────────── */

export const todoSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  listId: z.string(),
  title: z.string(),
  notes: z.string().nullable(),
  images: z.array(imageSchema),
  /** Who does it. */
  assignees: z.array(person),
  /** Who is told when it is completed (the creator always is, too). */
  notifyOnDone: z.array(person),
  dueOn: todoDueSchema.nullable(),
  /** Open and past its due date (the business day, not UTC). */
  isOverdue: z.boolean(),
  completed: z.object({ by: person, at: z.string() }).nullable(),
  createdBy: person.nullable(),
  commentCount: z.number().int(),
  /** The creator or an Admin. */
  canDelete: z.boolean(),
  createdAt: z.string(),
});
export type TodoDto = z.infer<typeof todoSchema>;

export const createTodoBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().min(1).max(5000).optional(),
  images: z.array(imageInputSchema).max(MAX_TODO_IMAGES).default([]),
  /** Project members, or an Admin. */
  assigneeIds: z.array(z.string().min(1)).max(20).default([]),
  notifyOnDoneIds: z.array(z.string().min(1)).max(20).default([]),
  dueOn: todoDueSchema.optional(),
});
export type CreateTodoBodyDto = z.infer<typeof createTodoBodySchema>;

/** `null` clears an optional field; omit a key to leave it alone. `listId` moves it to another list of the same project. */
export const updateTodoBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    notes: z.string().trim().min(1).max(5000).nullable(),
    images: z.array(imageInputSchema).max(MAX_TODO_IMAGES),
    assigneeIds: z.array(z.string().min(1)).max(20),
    notifyOnDoneIds: z.array(z.string().min(1)).max(20),
    dueOn: todoDueSchema.nullable(),
    listId: z.string().min(1),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateTodoBodyDto = z.infer<typeof updateTodoBodySchema>;

export const listTodosQuerySchema = z.object({
  status: z.enum(['open', 'done', 'all']).default('open'),
  listId: z.string().min(1).optional(),
  /** `me` or a user id. */
  assignee: z.string().min(1).optional(),
});
export type ListTodosQueryDto = z.infer<typeof listTodosQuerySchema>;

export const todoProjectParamsSchema = z.object({ projectId: z.string().min(1) });
export const todoListParamsSchema = z.object({ listId: z.string().min(1) });
export const todoIdParamsSchema = z.object({ todoId: z.string().min(1) });
export const todoCommentParamsSchema = todoIdParamsSchema.extend({ commentId: z.string().min(1) });

/* ── comments ─────────────────────────────────────────────────────────────── */

export const todoCommentSchema = z.object({
  id: z.string(),
  todoId: z.string(),
  author: person,
  text: z.string().nullable(),
  images: z.array(imageSchema),
  createdAt: z.string(),
  canDelete: z.boolean(),
});
export type TodoCommentDto = z.infer<typeof todoCommentSchema>;

export const createTodoCommentBodySchema = z
  .object({
    text: z.string().trim().min(1).max(2000).optional(),
    images: z.array(imageInputSchema).max(MAX_IMAGES_PER_COMMENT).optional(),
  })
  .refine((v) => v.text !== undefined || (v.images?.length ?? 0) > 0, {
    message: 'Write something or add a photo',
    path: ['text'],
  });
export type CreateTodoCommentBodyDto = z.infer<typeof createTodoCommentBodySchema>;

/* ── my assignments ───────────────────────────────────────────────────────── */

export const myTodoSchema = todoSchema.extend({
  project: person,
  listName: z.string(),
  bucket: todoBucketSchema,
});
export type MyTodoDto = z.infer<typeof myTodoSchema>;

export const myTodosQuerySchema = z.object({
  status: z.enum(['open', 'done', 'all']).default('open'),
  /** `all`: every to-do on every project. Only an Admin gets it; for anyone else it means `mine`. */
  scope: z.enum(['mine', 'all']).default('mine'),
});
export type MyTodosQueryDto = z.infer<typeof myTodosQuerySchema>;

/** Re-exported so apps can size the image picker from one place. */
export { MAX_IMAGES_PER_POST };
