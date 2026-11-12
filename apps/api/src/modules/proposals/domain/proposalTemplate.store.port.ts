import type { ProposalTemplate } from '@vastu/contracts';

export type NewCustomTemplate = Omit<ProposalTemplate, 'key'>;

/** Custom (Admin-made) templates only. Built-ins live in code, not here. */
export interface ProposalTemplateStorePort {
  listCustom(): Promise<ProposalTemplate[]>;
  findCustom(key: string): Promise<ProposalTemplate | null>;
  /** The store generates the key. */
  createCustom(template: NewCustomTemplate, createdById: string): Promise<ProposalTemplate>;
  /** Null when no custom template has this key. */
  replaceCustom(key: string, template: NewCustomTemplate): Promise<ProposalTemplate | null>;
  deleteCustom(key: string): Promise<boolean>;
}
