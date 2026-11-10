import {
  createLeadBodySchema,
  leadSourceSchema,
  type ImportLeadsBodyDto,
  type ImportResultDto,
} from '@vastu/contracts';
import type { LeadActivityRepositoryPort } from '../../domain/leadActivity.repository.port.js';
import type { LeadRepositoryPort } from '../../domain/lead.repository.port.js';
import type { Actor } from '../services/leadAccess.js';

/**
 * Bulk add from rows the web app parsed out of a CSV. Each row is validated on its own with the
 * SAME schema as the single-add form, so one bad row never fails the file. Existing phone numbers
 * (and repeats inside the file) are reported as duplicates and never overwritten.
 * Imported leads are unassigned until the Admin assigns them.
 */
export class ImportLeadsUseCase {
  constructor(
    private readonly leads: LeadRepositoryPort,
    private readonly activities: LeadActivityRepositoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: Actor, input: ImportLeadsBodyDto): Promise<ImportResultDto> {
    const result: ImportResultDto = { created: 0, duplicates: [], invalid: [] };

    // 1. Validate every row; keep the valid ones with their 1-based row number.
    const valid: Array<{ row: number; data: ReturnType<typeof createLeadBodySchema.parse> }> = [];
    input.rows.forEach((raw, index) => {
      const row = index + 1;
      const sourceCandidate = raw.source
        ?.trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_');
      const source = leadSourceSchema.safeParse(sourceCandidate).success
        ? sourceCandidate
        : input.defaultSource;
      const parsed = createLeadBodySchema.safeParse({
        name: raw.name,
        phone: raw.phone,
        source,
        ...(raw.altPhone?.trim() ? { altPhone: raw.altPhone } : {}),
        ...(raw.email?.trim() ? { email: raw.email } : {}),
        ...(raw.city?.trim() ? { city: raw.city } : {}),
        ...(raw.notes?.trim() ? { notes: raw.notes } : {}),
      });
      if (parsed.success) valid.push({ row, data: parsed.data });
      else {
        result.invalid.push({
          row,
          errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`),
        });
      }
    });

    // 2. Drop phones that already exist as leads, and repeats within the file (first one wins).
    const existing = new Map(
      (await this.leads.findByPhones(valid.map((v) => v.data.phone))).map((l) => [l.phone, l.id]),
    );
    const seen = new Set<string>();
    const toCreate: typeof valid = [];
    for (const item of valid) {
      const { phone } = item.data;
      if (existing.has(phone)) {
        result.duplicates.push({
          row: item.row,
          phone,
          existingLeadId: existing.get(phone) ?? null,
        });
      } else if (seen.has(phone)) {
        result.duplicates.push({ row: item.row, phone, existingLeadId: null });
      } else {
        seen.add(phone);
        toCreate.push(item);
      }
    }

    // 3. Create.
    const now = this.now();
    for (const { row, data } of toCreate) {
      try {
        const lead = await this.leads.create({
          name: data.name,
          phone: data.phone,
          altPhone: data.altPhone ?? null,
          email: data.email ?? null,
          city: data.city ?? null,
          notes: data.notes ?? null,
          source: data.source,
          status: 'NEW',
          statusChangedAt: now,
          assignedToId: null,
          lostReason: null,
          customerId: null,
          createdById: actor.id,
        });
        await this.activities.add({
          leadId: lead.id,
          type: 'CREATED',
          byUserId: actor.id,
          at: now,
          data: { source: lead.source, import: true },
        });
        result.created++;
      } catch (err) {
        // Lost a race with someone adding the same phone meanwhile: report it, keep going.
        if ((err as { code?: string }).code === 'CONFLICT') {
          result.duplicates.push({ row, phone: data.phone, existingLeadId: null });
        } else throw err;
      }
    }

    result.duplicates.sort((a, b) => a.row - b.row);
    return result;
  }
}
