import type { AlertSenderPort, ProjectAccess, UserDirectoryPort } from '../../domain/ports.js';
import type { DocFile } from '../../domain/doc.entity.js';

/**
 * Who hears about documents. A new file tells the project's members (not the Admins: they are not
 * pinged for every file); sharing it with the customer tells the customer. A customer's own upload
 * tells the team and the Admins, like their posts do. Saving a photo that was already posted tells
 * nobody — it was announced when it was posted.
 */
export class DocAlerts {
  constructor(
    private readonly sender: AlertSenderPort,
    private readonly directory: UserDirectoryPort,
  ) {}

  private ref(project: ProjectAccess, file: DocFile) {
    return { kind: 'PROJECT' as const, id: project.id, fileId: file.id };
  }

  private async deliver(
    userIds: string[],
    alert: Parameters<AlertSenderPort['send']>[1],
  ): Promise<void> {
    if (userIds.length > 0) await this.sender.send([...new Set(userIds)], alert);
  }

  /** A file the team uploaded. */
  async addedByStaff(project: ProjectAccess, file: DocFile, uploaderName: string): Promise<void> {
    await this.deliver(
      project.memberIds.filter((id) => id !== file.uploadedById),
      {
        type: 'FILE_ADDED',
        title: `New file in ${project.name}`,
        body: `${uploaderName} added "${file.name}"`,
        ref: this.ref(project, file),
      },
    );
    if (file.visibility === 'CLIENT') await this.sharedWithCustomer(project, file);
  }

  /** A file the customer uploaded: the team and the Admins. */
  async addedByCustomer(
    project: ProjectAccess,
    file: DocFile,
    uploaderName: string,
  ): Promise<void> {
    const admins = await this.directory.activeAdminIds();
    await this.deliver([...project.memberIds, ...admins], {
      type: 'FILE_ADDED',
      title: `New file in ${project.name}`,
      body: `${uploaderName} added "${file.name}"`,
      ref: this.ref(project, file),
    });
  }

  async sharedWithCustomer(project: ProjectAccess, file: DocFile): Promise<void> {
    await this.deliver([project.customerId], {
      type: 'FILE_SHARED',
      title: 'New document shared with you',
      body: `"${file.name}" — ${project.name}`,
      ref: this.ref(project, file),
    });
  }
}
