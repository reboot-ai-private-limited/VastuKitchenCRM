import { z } from 'zod';
import { complaintCountsSchema } from './complaints.js';
import { dateStringSchema } from './hr.js';
import { LEAD_STATUSES } from './leads.js';
import { notificationRefSchema } from './notifications.js';

/** The longest range one request may cover. */
export const MAX_DASHBOARD_DAYS = 31;

/** Inclusive business dates. Both default to today; at most 31 days. */
export const dashboardQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});
export type DashboardQueryDto = z.infer<typeof dashboardQuerySchema>;

const count = z.number().int();

export const dashboardCountersSchema = z.object({
  leads: z.object({
    /** Not yet Won or Lost. */
    open: count,
    byStatus: z.record(z.enum(LEAD_STATUSES), count),
    /** Created during the range. */
    newInRange: count,
  }),
  projects: z.object({ design: count, site: count, running: count }),
  complaints: complaintCountsSchema.extend({
    /** Open + Assigned + Resolved-but-not-yet-closed: still on someone's plate. */
    pending: count,
  }),
  /** Whole rupees. */
  value: z.object({
    /** Sum of each open lead's latest sent proposal. */
    pipeline: count,
    /** Leads won during the range, by their latest sent proposal. */
    wonInRange: count,
    /** True when there were more open leads than were valued. */
    pipelineCapped: z.boolean(),
  }),
});
export type DashboardCountersDto = z.infer<typeof dashboardCountersSchema>;

/** Always shown (HR sees only this block of counters). Today, whatever the range. */
export const dashboardStaffSchema = z.object({
  date: z.string(),
  offDay: z.boolean(),
  tracked: count,
  present: count,
  absent: count,
});

export const dashboardPersonSchema = z.object({
  userId: z.string(),
  name: z.string(),
  designation: z.string().nullable(),
  /** Over the range: days present, earliest in, latest out. Null when not on attendance. */
  attendance: z
    .object({ daysPresent: count, inAt: z.string().nullable(), outAt: z.string().nullable() })
    .nullable(),
  /** What they did in the range. Null for HR. */
  activity: z
    .object({
      firstAt: z.string().nullable(),
      lastAt: z.string().nullable(),
      calls: count,
      answeredCalls: count,
      talkSeconds: count,
      leadsHandled: count,
      proposalsGenerated: count,
      proposalsSent: count,
      posts: count,
      comments: count,
    })
    .nullable(),
});
export type DashboardPersonDto = z.infer<typeof dashboardPersonSchema>;

export const attentionItemSchema = z.object({
  title: z.string(),
  detail: z.string(),
  /** Since when it has been waiting. */
  since: z.string(),
  ref: notificationRefSchema,
});
export const attentionBlockSchema = z.object({
  /** How many there are (at most 50 are counted). */
  total: count,
  capped: z.boolean(),
  /** The oldest 10. */
  items: z.array(attentionItemSchema),
});
export type AttentionBlockDto = z.infer<typeof attentionBlockSchema>;

export const dashboardAttentionSchema = z.object({
  unseenProposals: attentionBlockSchema,
  noActionProposals: attentionBlockSchema,
  stagnantLeads: attentionBlockSchema,
  overdueComplaints: attentionBlockSchema,
  overdueTodos: attentionBlockSchema,
});

export type DashboardAttentionDto = z.infer<typeof dashboardAttentionSchema>;

export const recentFeedItemSchema = z.object({
  kind: z.enum(['POST', 'COMMENT', 'APPROVAL']),
  at: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  postId: z.string(),
  authorName: z.string(),
  snippet: z.string().nullable(),
  hasPhotos: z.boolean(),
});

export type RecentFeedItemDto = z.infer<typeof recentFeedItemSchema>;

export const DASHBOARD_BLOCKS = ['counters', 'staff', 'people', 'attention', 'recent'] as const;
export type DashboardBlockName = (typeof DASHBOARD_BLOCKS)[number];

export const dashboardSchema = z.object({
  range: z.object({ from: z.string(), to: z.string() }),
  generatedAt: z.string(),
  /** Null for HR, or when that block could not be loaded (see `errors`). */
  counters: dashboardCountersSchema.nullable(),
  staff: dashboardStaffSchema.nullable(),
  people: z.array(dashboardPersonSchema).nullable(),
  attention: dashboardAttentionSchema.nullable(),
  recent: z.array(recentFeedItemSchema).nullable(),
  /** Blocks that failed to load. The rest of the dashboard still renders. */
  errors: z.array(z.enum(DASHBOARD_BLOCKS)),
});
export type DashboardDto = z.infer<typeof dashboardSchema>;
