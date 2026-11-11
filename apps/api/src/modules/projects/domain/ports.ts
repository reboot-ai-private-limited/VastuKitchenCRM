import type { NotificationRefDto, NotificationType, RoleName } from '@vastu/contracts';
import type { ActivityListQuery, NewProjectActivity, ProjectActivity } from './activity.entity.js';
import type { Comment, NewComment, NewPost, Post, PostListQuery } from './post.entity.js';
import type { NewProject, Project, ProjectListFilter, ProjectPatch } from './project.entity.js';

export interface ProjectRepositoryPort {
  create(project: NewProject): Promise<Project>;
  /** Idempotent on `wonLeadId`: a second call for the same lead returns the existing project, `created: false`. */
  createFromWonLead(
    project: NewProject & { wonLeadId: string },
  ): Promise<{ project: Project; created: boolean }>;
  findById(id: string): Promise<Project | null>;
  findByIds(ids: string[]): Promise<Project[]>;
  update(id: string, patch: ProjectPatch): Promise<Project | null>;
  list(filter: ProjectListFilter): Promise<{ items: Project[]; total: number }>;
}

export interface PostRepositoryPort {
  create(post: NewPost): Promise<Post>;
  /** A post that has not been deleted. */
  findById(id: string): Promise<Post | null>;
  /** Hides the post. False when it does not exist or was already deleted. */
  softDelete(id: string): Promise<boolean>;
  /** Newest first. */
  list(query: PostListQuery): Promise<Post[]>;
  /** Marks approved if it is not yet, atomically. Null when it was already approved (or is gone). */
  approve(id: string, byId: string, at: Date): Promise<Post | null>;
  hasFinalDelivery(projectId: string): Promise<boolean>;
  adjustCommentCount(id: string, delta: 1 | -1): Promise<void>;
}

export interface CommentRepositoryPort {
  create(comment: NewComment): Promise<Comment>;
  findById(id: string): Promise<Comment | null>;
  softDelete(id: string): Promise<boolean>;
  /** The whole thread, oldest first. */
  listByPost(postId: string): Promise<Comment[]>;
  /** The latest `n` comments of each post, each list oldest first. */
  recentByPosts(postIds: string[], n: number): Promise<Map<string, Comment[]>>;
}

export interface ActivityRepositoryPort {
  add(activity: NewProjectActivity): Promise<void>;
  /** Newest first, strictly before `before` when given. */
  list(query: ActivityListQuery): Promise<ProjectActivity[]>;
}

export interface ActorRef {
  id: string;
  role: RoleName;
}

export interface LeadInfo {
  id: string;
  name: string;
  phone: string;
  city: string | null;
}

export interface JourneyEntry {
  id: string;
  type: string;
  at: Date;
  byUserId: string | null;
  byName: string | null;
  data: Record<string, unknown>;
}

/** What projects needs from leads (the adapter wraps leads' public contract). */
export interface LeadsGatewayPort {
  /** The lead if `actor` may access it; throws NOT FOUND otherwise. */
  getLead(actor: ActorRef, leadId: string): Promise<LeadInfo>;
  canAccess(actor: ActorRef, leadId: string): Promise<boolean>;
  recordEvent(
    leadId: string,
    event: {
      type: 'PROJECT_CREATED' | 'PROJECT_CLOSED';
      projectName: string;
      byUserId: string | null;
    },
  ): Promise<void>;
  /** The lead's story, oldest first. NOT FOUND if `actor` may not access the lead. */
  journey(actor: ActorRef, leadId: string): Promise<JourneyEntry[]>;
}

/** What projects needs from proposals. */
export interface ProposalsGatewayPort {
  latestSentTotal(leadId: string): Promise<number | null>;
}

export interface DirectoryUser {
  id: string;
  name: string;
  phone: string;
  role: RoleName;
  designation: string | null;
  active: boolean;
}

/** What projects needs from identity (the adapter wraps identity's public contract). */
export interface UserDirectoryPort {
  find(ids: string[]): Promise<DirectoryUser[]>;
  /** Find-or-create the CUSTOMER account for a phone number. */
  ensureCustomer(input: { name: string; phone: string }): Promise<{ id: string }>;
  activeAdminIds(): Promise<string[]>;
}

export interface Alert {
  type: NotificationType;
  title: string;
  body: string;
  ref: NotificationRefDto;
  /** Same key + same person = delivered once, however often it is sent. */
  dedupeKey?: string;
}

/**
 * Delivers alerts to people. It must never throw: a notification problem must not fail the post,
 * comment or project change that caused it.
 */
export interface AlertSenderPort {
  send(userIds: string[], alert: Alert): Promise<void>;
}

/** What projects needs from system settings (the adapter wraps the settings contract). */
export interface ProjectSettingsPort {
  /** Whether winning a lead creates its project automatically. Read each time it matters. */
  autoCreateOnWon(): Promise<boolean>;
}
