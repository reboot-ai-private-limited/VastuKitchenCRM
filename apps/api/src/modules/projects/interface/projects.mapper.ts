import type { CommentDto, LeadActivityDto, PostDto, ProjectDto } from '@vastu/contracts';
import type { CommentView, PostView } from '../application/services/feedViews.js';
import type { ProjectView } from '../application/services/projectViews.js';
import type { JourneyEntry } from '../domain/ports.js';

export const toProjectDto = ({
  project: p,
  customer,
  designer,
  members,
}: ProjectView): ProjectDto => ({
  id: p.id,
  name: p.name,
  customer,
  leadId: p.leadId,
  siteAddress: p.siteAddress,
  value: p.value,
  stage: p.stage,
  designStage: p.designStage,
  designer,
  members,
  createdAt: p.createdAt.toISOString(),
  closedAt: p.closedAt ? p.closedAt.toISOString() : null,
});

export const toCommentDto = (v: CommentView): CommentDto => ({
  id: v.comment.id,
  postId: v.comment.postId,
  author: { id: v.comment.authorId, name: v.authorName, isCustomer: v.authorIsCustomer },
  text: v.comment.text,
  createdAt: v.comment.createdAt.toISOString(),
  canDelete: v.canDelete,
});

export const toPostDto = (v: PostView): PostDto => ({
  id: v.post.id,
  projectId: v.post.projectId,
  author: {
    id: v.post.authorId,
    name: v.authorName,
    designation: v.authorDesignation,
    isCustomer: v.authorIsCustomer,
  },
  visibility: v.post.visibility,
  kind: v.post.kind,
  text: v.post.text,
  images: v.images,
  commentCount: v.post.commentCount,
  recentComments: v.recentComments.map(toCommentDto),
  approval:
    v.post.approvedById && v.post.approvedAt
      ? {
          by: { id: v.post.approvedById, name: v.approvedByName ?? 'Customer' },
          at: v.post.approvedAt.toISOString(),
        }
      : null,
  canDelete: v.canDelete,
  canApprove: v.canApprove,
  createdAt: v.post.createdAt.toISOString(),
});

export const toJourneyDto = (e: JourneyEntry): LeadActivityDto => ({
  id: e.id,
  type: e.type as LeadActivityDto['type'],
  at: e.at.toISOString(),
  by: e.byUserId ? { id: e.byUserId, name: e.byName ?? 'Unknown' } : null,
  data: e.data,
});
