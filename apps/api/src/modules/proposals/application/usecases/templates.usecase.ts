import {
  BUILTIN_PROPOSAL_TEMPLATES,
  type ProposalTemplate,
  type ProposalTemplateSummaryDto,
  type SaveProposalTemplateBodyDto,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { ActorRef } from '../../domain/leadsGateway.port.js';
import type { ProposalTemplateStorePort } from '../../domain/proposalTemplate.store.port.js';
import type { TemplateResolver } from '../services/templateResolver.js';

export function toSummary(t: ProposalTemplate, builtin: boolean): ProposalTemplateSummaryDto {
  return {
    key: t.key,
    name: t.name,
    description: t.description,
    builtin,
    pageCount: t.pages.length,
    coverImage: t.pages[0]?.image ?? null,
    primary: t.theme.primary,
  };
}

/** Template writes are Admin-only. The routes guard it too; this keeps the rule with the logic. */
function assertAdmin(actor: ActorRef): void {
  if (actor.role !== 'ADMIN') throw AppError.forbidden('Only an Admin can change templates.');
}

const BUILTIN_LOCKED = 'Built-in templates cannot be changed. Duplicate it to make your own.';

export class ListTemplatesUseCase {
  constructor(private readonly store: ProposalTemplateStorePort) {}
  async execute(): Promise<ProposalTemplateSummaryDto[]> {
    const custom = await this.store.listCustom();
    return [
      ...BUILTIN_PROPOSAL_TEMPLATES.map((t) => toSummary(t, true)),
      ...custom.map((t) => toSummary(t, false)),
    ];
  }
}

export class GetTemplateUseCase {
  constructor(private readonly templates: TemplateResolver) {}
  async execute(key: string): Promise<ProposalTemplate> {
    const t = await this.templates.find(key);
    if (!t) throw AppError.notFound('Template not found.');
    return t;
  }
}

export class CreateTemplateUseCase {
  constructor(private readonly store: ProposalTemplateStorePort) {}
  async execute(actor: ActorRef, input: SaveProposalTemplateBodyDto): Promise<ProposalTemplate> {
    assertAdmin(actor);
    return this.store.createCustom(input, actor.id);
  }
}

export class UpdateTemplateUseCase {
  constructor(
    private readonly store: ProposalTemplateStorePort,
    private readonly templates: TemplateResolver,
  ) {}
  async execute(
    actor: ActorRef,
    key: string,
    input: SaveProposalTemplateBodyDto,
  ): Promise<ProposalTemplate> {
    assertAdmin(actor);
    if (this.templates.isBuiltin(key)) throw AppError.forbidden(BUILTIN_LOCKED);
    const updated = await this.store.replaceCustom(key, input);
    if (!updated) throw AppError.notFound('Template not found.');
    return updated;
  }
}

export class DeleteTemplateUseCase {
  constructor(
    private readonly store: ProposalTemplateStorePort,
    private readonly templates: TemplateResolver,
  ) {}
  /** Safe at any time: proposals keep their own frozen copy. */
  async execute(actor: ActorRef, key: string): Promise<void> {
    assertAdmin(actor);
    if (this.templates.isBuiltin(key)) throw AppError.forbidden(BUILTIN_LOCKED);
    if (!(await this.store.deleteCustom(key))) throw AppError.notFound('Template not found.');
  }
}

export class DuplicateTemplateUseCase {
  constructor(
    private readonly store: ProposalTemplateStorePort,
    private readonly templates: TemplateResolver,
  ) {}
  async execute(actor: ActorRef, key: string, name?: string): Promise<ProposalTemplate> {
    assertAdmin(actor);
    const source = await this.templates.find(key);
    if (!source) throw AppError.notFound('Template not found.');
    const copy: Partial<ProposalTemplate> = structuredClone(source);
    delete copy.key;
    return this.store.createCustom(
      { ...(copy as SaveProposalTemplateBodyDto), name: name ?? `${source.name} copy` },
      actor.id,
    );
  }
}
