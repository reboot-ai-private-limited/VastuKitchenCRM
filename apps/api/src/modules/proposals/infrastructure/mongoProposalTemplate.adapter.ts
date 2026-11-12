import { Types } from 'mongoose';
import type { ProposalTemplate } from '@vastu/contracts';
import type {
  NewCustomTemplate,
  ProposalTemplateStorePort,
} from '../domain/proposalTemplate.store.port.js';
import { ProposalTemplateModel } from './proposalTemplate.schema.js';

export class MongoProposalTemplateStore implements ProposalTemplateStorePort {
  async listCustom(): Promise<ProposalTemplate[]> {
    const docs = await ProposalTemplateModel.find().sort({ createdAt: 1 });
    return docs.map((d) => d.template);
  }

  async findCustom(key: string): Promise<ProposalTemplate | null> {
    const doc = await ProposalTemplateModel.findOne({ key });
    return doc ? doc.template : null;
  }

  async createCustom(t: NewCustomTemplate, createdById: string): Promise<ProposalTemplate> {
    const key = `tpl_${new Types.ObjectId().toHexString()}`;
    const template: ProposalTemplate = { ...t, key };
    await ProposalTemplateModel.create({ key, name: t.name, template, createdById });
    return template;
  }

  async replaceCustom(key: string, t: NewCustomTemplate): Promise<ProposalTemplate | null> {
    const template: ProposalTemplate = { ...t, key };
    const doc = await ProposalTemplateModel.findOneAndUpdate(
      { key },
      { $set: { name: t.name, template } },
      { new: true },
    );
    return doc ? doc.template : null;
  }

  async deleteCustom(key: string): Promise<boolean> {
    return (await ProposalTemplateModel.deleteOne({ key })).deletedCount === 1;
  }
}
