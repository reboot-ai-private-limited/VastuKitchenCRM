import {
  addCustomerBodySchema,
  type AddCustomerBodyDto,
  type ImportCustomersBodyDto,
  type ImportCustomersResultDto,
  type ListCustomersQueryDto,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { Actor, IdentityGatewayPort, LeadsGatewayPort } from '../../domain/ports.js';
import type { CustomerView, CustomerViewBuilder } from '../services/customerViews.js';

export class ListCustomersUseCase {
  constructor(
    private readonly leads: LeadsGatewayPort,
    private readonly views: CustomerViewBuilder,
  ) {}

  async execute(
    actor: Actor,
    q: ListCustomersQueryDto,
  ): Promise<{ items: CustomerView[]; total: number }> {
    const { items, total } = await this.leads.list(actor, {
      page: q.page,
      pageSize: q.pageSize,
      ...(q.search ? { search: q.search } : {}),
    });
    const views = await this.views.build(items);
    // Customers with a project come first; inside each group the most recently active first.
    views.sort(
      (a, b) =>
        Number(b.projects.length > 0) - Number(a.projects.length > 0) ||
        b.lastActivityAt.getTime() - a.lastActivityAt.getTime(),
    );
    return { items: views, total };
  }
}

export class GetCustomerUseCase {
  constructor(
    private readonly leads: LeadsGatewayPort,
    private readonly views: CustomerViewBuilder,
  ) {}

  async execute(actor: Actor, customerId: string): Promise<CustomerView> {
    return (await this.views.build([await this.leads.find(actor, customerId)]))[0]!;
  }
}

/**
 * Adds someone who is already a customer (they never came through the lead flow). Their account is
 * found or created, and their lead is created (or linked, if they were already a lead). Adding a
 * phone that is already a customer is refused, pointing at the existing one.
 */
export class AddCustomerUseCase {
  constructor(
    private readonly leads: LeadsGatewayPort,
    private readonly identity: IdentityGatewayPort,
    private readonly views: CustomerViewBuilder,
  ) {}

  async execute(actor: Actor, input: AddCustomerBodyDto): Promise<CustomerView> {
    const account = await this.identity.ensureCustomer({ name: input.name, phone: input.phone });
    const { lead, outcome } = await this.leads.add(actor, {
      name: input.name,
      phone: input.phone,
      city: input.city ?? null,
      customerId: account.id,
    });
    if (outcome === 'existing') {
      throw AppError.conflict('This person is already a customer.', {
        existingCustomerId: lead.customerId,
      });
    }
    return (await this.views.build([lead]))[0]!;
  }
}

/**
 * Bulk add from rows the web app parsed out of a CSV. Each row is validated like the single form, so
 * one bad row never fails the file. People who are already customers (or repeat in the file) are
 * reported and left as they were; people who were already leads are linked, not duplicated.
 */
export class ImportCustomersUseCase {
  constructor(
    private readonly leads: LeadsGatewayPort,
    private readonly identity: IdentityGatewayPort,
  ) {}

  async execute(actor: Actor, input: ImportCustomersBodyDto): Promise<ImportCustomersResultDto> {
    const result: ImportCustomersResultDto = { created: 0, linked: 0, existing: [], invalid: [] };
    const seen = new Map<string, string>(); // phone -> customer id, for repeats inside the file

    for (const [index, raw] of input.rows.entries()) {
      const row = index + 1;
      const parsed = addCustomerBodySchema.safeParse({
        name: raw.name,
        phone: raw.phone,
        ...(raw.city?.trim() ? { city: raw.city } : {}),
      });
      if (!parsed.success) {
        result.invalid.push({
          row,
          errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`),
        });
        continue;
      }
      const data = parsed.data;
      const repeat = seen.get(data.phone);
      if (repeat) {
        result.existing.push({ row, phone: data.phone, customerId: repeat });
        continue;
      }
      try {
        const account = await this.identity.ensureCustomer({ name: data.name, phone: data.phone });
        const { lead, outcome } = await this.leads.add(actor, {
          name: data.name,
          phone: data.phone,
          city: data.city ?? null,
          customerId: account.id,
        });
        seen.set(data.phone, account.id);
        if (outcome === 'existing')
          result.existing.push({ row, phone: data.phone, customerId: lead.customerId });
        else if (outcome === 'linked') result.linked++;
        else result.created++;
      } catch (err) {
        // A phone that belongs to staff, or any other refusal, only skips this row.
        result.invalid.push({
          row,
          errors: [
            `phone: ${err instanceof AppError ? err.message : 'Could not add this person.'}`,
          ],
        });
      }
    }
    return result;
  }
}

/** "Start new project": the customer's lead goes back into the pipeline (see leads). */
export class StartNewProjectForCustomerUseCase {
  constructor(
    private readonly leads: LeadsGatewayPort,
    private readonly views: CustomerViewBuilder,
  ) {}

  async execute(actor: Actor, customerId: string): Promise<CustomerView> {
    const lead = await this.leads.startNewProject(actor, customerId);
    return (await this.views.build([lead]))[0]!;
  }
}
