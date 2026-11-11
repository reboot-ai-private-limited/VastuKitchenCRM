import type { AlertSenderPort, UserDirectoryPort } from '../../domain/ports.js';
import type { Comment, Post } from '../../domain/post.entity.js';
import type { Project } from '../../domain/project.entity.js';

const preview = (text: string | null, images: number): string => {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (t) return t.length > 90 ? `${t.slice(0, 87)}...` : t;
  return images === 1 ? 'sent a photo' : `sent ${images} photos`;
};

/**
 * Who hears about what. The rule, one line: everyone who may SEE it, except the person who did it
 * — and Admins always, because the owner follows every project (often from far away).
 *   CLIENT item → admins + members + the customer      TEAM item → admins + members
 */
export class ProjectAlerts {
  constructor(
    private readonly sender: AlertSenderPort,
    private readonly directory: UserDirectoryPort,
  ) {}

  private async audience(
    project: Project,
    opts: { clientCanSee: boolean; except?: string | null | undefined },
  ): Promise<string[]> {
    const ids = new Set<string>([...(await this.directory.activeAdminIds()), ...project.memberIds]);
    if (opts.clientCanSee) ids.add(project.customerId);
    if (opts.except) ids.delete(opts.except);
    return [...ids];
  }

  async projectCreated(project: Project, except?: string | null): Promise<void> {
    const admins = (await this.directory.activeAdminIds()).filter((id) => id !== except);
    await this.sender.send(admins, {
      type: 'PROJECT_CREATED',
      title: 'New project',
      body: project.name,
      ref: { kind: 'PROJECT', id: project.id },
    });
  }

  /**
   * Auto-create is switched off, so a won lead has no project until an Admin makes one.
   * Keyed per lead: a replayed event, or moving the lead away and back, never re-alerts.
   */
  async leadWonWithoutProject(
    lead: { leadId: string; name: string },
    except?: string | null,
  ): Promise<void> {
    const admins = (await this.directory.activeAdminIds()).filter((id) => id !== except);
    await this.sender.send(admins, {
      type: 'LEAD_WON',
      title: 'Lead won — no project yet',
      body: `${lead.name} was won. Automatic project creation is off: create the project when you are ready.`,
      ref: { kind: 'LEAD', id: lead.leadId },
      dedupeKey: `lead-won-no-project:${lead.leadId}`,
    });
  }

  async membersAdded(project: Project, userIds: string[], except: string): Promise<void> {
    await this.sender.send(
      userIds.filter((id) => id !== except),
      {
        type: 'PROJECT_ASSIGNED',
        title: 'You were added to a project',
        body: project.name,
        ref: { kind: 'PROJECT', id: project.id },
      },
    );
  }

  async postCreated(project: Project, post: Post, authorName: string): Promise<void> {
    await this.sender.send(
      await this.audience(project, {
        clientCanSee: post.visibility === 'CLIENT',
        except: post.authorId,
      }),
      {
        type: 'PROJECT_POST',
        title: `New post in ${project.name}`,
        body: `${authorName}: ${preview(post.text, post.images.length)}`,
        ref: { kind: 'PROJECT', id: project.id, postId: post.id },
      },
    );
  }

  async commentCreated(
    project: Project,
    post: Post,
    comment: Comment,
    authorName: string,
  ): Promise<void> {
    await this.sender.send(
      await this.audience(project, {
        clientCanSee: post.visibility === 'CLIENT',
        except: comment.authorId,
      }),
      {
        type: 'PROJECT_COMMENT',
        title: `New comment in ${project.name}`,
        body: `${authorName}: ${preview(comment.text, comment.images.length)}`,
        ref: { kind: 'PROJECT', id: project.id, postId: post.id },
      },
    );
  }

  async approved(project: Project, post: Post, customerName: string): Promise<void> {
    await this.sender.send(
      await this.audience(project, { clientCanSee: false, except: post.approvedById }),
      {
        type: 'PROJECT_APPROVED',
        title: 'Design approved',
        body: `${customerName} approved a design in ${project.name}`,
        ref: { kind: 'PROJECT', id: project.id, postId: post.id },
      },
    );
  }

  async closed(project: Project, except: string): Promise<void> {
    await this.sender.send(await this.audience(project, { clientCanSee: true, except }), {
      type: 'PROJECT_CLOSED',
      title: 'Project delivered',
      body: `${project.name} is complete.`,
      ref: { kind: 'PROJECT', id: project.id },
    });
  }
}
