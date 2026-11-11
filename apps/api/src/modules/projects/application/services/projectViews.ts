import type { DirectoryUser, UserDirectoryPort } from '../../domain/ports.js';
import type { Project } from '../../domain/project.entity.js';

export interface ProjectView {
  project: Project;
  customer: { id: string; name: string; phone: string };
  designer: { id: string; name: string } | null;
  members: Array<{ id: string; name: string; designation: string | null }>;
}

/** Adds the names people expect to see (customer, designer, members) to projects. */
export class ProjectViewBuilder {
  constructor(private readonly directory: UserDirectoryPort) {}

  async build(projects: Project[]): Promise<ProjectView[]> {
    const ids = new Set<string>();
    for (const p of projects) {
      ids.add(p.customerId);
      if (p.designerId) ids.add(p.designerId);
      p.memberIds.forEach((m) => ids.add(m));
    }
    const users = new Map<string, DirectoryUser>(
      (await this.directory.find([...ids])).map((u) => [u.id, u]),
    );

    return projects.map((project) => {
      const customer = users.get(project.customerId);
      const designer = project.designerId ? users.get(project.designerId) : undefined;
      return {
        project,
        customer: {
          id: project.customerId,
          name: customer?.name ?? 'Customer',
          phone: customer?.phone ?? '',
        },
        designer: designer ? { id: designer.id, name: designer.name } : null,
        members: project.memberIds
          .map((id) => users.get(id))
          .filter((u): u is DirectoryUser => u !== undefined)
          .map((u) => ({ id: u.id, name: u.name, designation: u.designation })),
      };
    });
  }
}
