import {
  DEFAULT_PROPOSAL_TEMPLATE_KEY,
  findBuiltinTemplate,
  type ProposalTemplate,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { ProposalTemplateStorePort } from '../../domain/proposalTemplate.store.port.js';

/** Turns a template key into the template, built-ins first, then the Admin's custom ones. */
export class TemplateResolver {
  constructor(private readonly store: ProposalTemplateStorePort) {}

  /** Omitted key: the default template. An unknown key is a 400 on `templateKey`. */
  async resolve(key: string | undefined): Promise<{ key: string; template: ProposalTemplate }> {
    const wanted = key ?? DEFAULT_PROPOSAL_TEMPLATE_KEY;
    const template = await this.find(wanted);
    if (!template) {
      throw AppError.badRequest('That proposal template does not exist.', [
        { path: ['templateKey'], message: 'Unknown template' },
      ]);
    }
    // A snapshot is a deep copy: nothing shared with the template it came from.
    return { key: wanted, template: structuredClone(template) };
  }

  async find(key: string): Promise<ProposalTemplate | null> {
    return findBuiltinTemplate(key) ?? (await this.store.findCustom(key));
  }

  isBuiltin(key: string): boolean {
    return findBuiltinTemplate(key) !== undefined;
  }
}
