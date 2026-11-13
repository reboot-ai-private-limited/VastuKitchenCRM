import { Types, type HydratedDocument } from 'mongoose';
import type { LocationDto } from '@vastu/contracts';
import { isDuplicateKey } from '@/shared/db/mongoErrors.js';
import type {
  AttendanceRecord,
  GeneratedRow,
  NewAttendance,
  SalaryRow,
  SalesTarget,
} from '../domain/hr.entity.js';
import type {
  AttendanceRepositoryPort,
  SalaryRepositoryPort,
  SalesTargetRepositoryPort,
} from '../domain/ports.js';
import {
  AttendanceModel,
  SalaryModel,
  SalesTargetModel,
  type AttendanceDoc,
  type SalaryDoc,
  type SalesTargetDoc,
} from './hr.schemas.js';

const oid = (v: string) => new Types.ObjectId(v);
const idOrNull = (v: { toString(): string } | null): string | null => (v ? v.toString() : null);
const loc = (l: { lat: number; lng: number; accuracy?: number } | null): LocationDto | null =>
  l
    ? { lat: l.lat, lng: l.lng, ...(l.accuracy !== undefined ? { accuracy: l.accuracy } : {}) }
    : null;

const toRecord = (d: HydratedDocument<AttendanceDoc>): AttendanceRecord => ({
  id: d.id as string,
  userId: d.userId.toString(),
  date: d.date,
  inAt: d.inAt,
  outAt: d.outAt,
  method: d.method,
  inLocation: loc(d.inLocation),
  outLocation: loc(d.outLocation),
  correctedById: idOrNull(d.correctedById),
  correctedAt: d.correctedAt,
  note: d.note,
});

const monthRange = (month: string) => ({ $gte: `${month}-01`, $lte: `${month}-31` });

export class MongoAttendanceRepository implements AttendanceRepositoryPort {
  async checkIn(input: NewAttendance) {
    const key = { userId: oid(input.userId), date: input.date };
    const doc = {
      inAt: input.inAt,
      outAt: null,
      method: input.method,
      inLocation: input.inLocation as AttendanceDoc['inLocation'],
      outLocation: null,
    };
    try {
      const res = await AttendanceModel.findOneAndUpdate(
        key,
        { $setOnInsert: doc },
        { upsert: true, new: true, includeResultMetadata: true },
      );
      return {
        record: toRecord(res.value as HydratedDocument<AttendanceDoc>),
        created: res.lastErrorObject?.updatedExisting === false,
      };
    } catch (err) {
      // Two taps at the same instant: the other one created the day first.
      if (!isDuplicateKey(err)) throw err;
      const existing = await AttendanceModel.findOne(key);
      return { record: toRecord(existing!), created: false };
    }
  }

  async checkOut(userId: string, date: string, outAt: Date, location: LocationDto | null) {
    const d = await AttendanceModel.findOneAndUpdate(
      { userId: oid(userId), date },
      { $set: { outAt, outLocation: location as AttendanceDoc['outLocation'] } },
      { new: true },
    );
    return d ? toRecord(d) : null;
  }

  async find(userId: string, date: string) {
    const d = await AttendanceModel.findOne({ userId: oid(userId), date });
    return d ? toRecord(d) : null;
  }

  async setDay(i: Parameters<AttendanceRepositoryPort['setDay']>[0]) {
    const key = { userId: oid(i.userId), date: i.date };
    const existed = (await AttendanceModel.exists(key)) !== null;
    const d = await AttendanceModel.findOneAndUpdate(
      key,
      {
        $set: {
          inAt: i.inAt,
          outAt: i.outAt,
          note: i.note,
          ...(existed ? { correctedById: oid(i.byId), correctedAt: i.at } : {}),
        },
        $setOnInsert: { method: i.method, inLocation: null, outLocation: null },
      },
      { upsert: true, new: true },
    );
    return toRecord(d);
  }

  async deleteDay(userId: string, date: string) {
    return (await AttendanceModel.deleteOne({ userId: oid(userId), date })).deletedCount > 0;
  }

  async forDate(date: string) {
    return (await AttendanceModel.find({ date })).map(toRecord);
  }

  async forUserMonth(userId: string, month: string) {
    return (
      await AttendanceModel.find({ userId: oid(userId), date: monthRange(month) }).sort({ date: 1 })
    ).map(toRecord);
  }

  async forMonth(month: string) {
    return (await AttendanceModel.find({ date: monthRange(month) })).map(toRecord);
  }

  async forRange(from: string, to: string) {
    return (await AttendanceModel.find({ date: { $gte: from, $lte: to } })).map(toRecord);
  }

  async insertMissing(records: NewAttendance[]): Promise<number> {
    if (records.length === 0) return 0;
    const res = await AttendanceModel.bulkWrite(
      records.map((r) => ({
        updateOne: {
          filter: { userId: oid(r.userId), date: r.date },
          update: {
            $setOnInsert: {
              inAt: r.inAt,
              outAt: r.outAt,
              method: r.method,
              inLocation: r.inLocation as AttendanceDoc['inLocation'],
              outLocation: r.outLocation as AttendanceDoc['outLocation'],
              correctedById: null,
              correctedAt: null,
              note: null,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    return res.upsertedCount;
  }
}

const toRow = (d: HydratedDocument<SalaryDoc>): SalaryRow => ({
  month: d.month,
  userId: d.userId.toString(),
  name: d.name,
  designation: d.designation,
  fixedSalary: d.fixedSalary,
  presentDays: d.presentDays,
  workingDays: d.workingDays,
  computedPayable: d.computedPayable,
  payable: d.payable,
  editedById: idOrNull(d.editedById),
  editedAt: d.editedAt,
  note: d.note,
  weeklyOff: d.weeklyOff,
  finalizedAt: d.finalizedAt,
  finalizedById: idOrNull(d.finalizedById),
});

export class MongoSalaryRepository implements SalaryRepositoryPort {
  async listMonth(month: string) {
    return (await SalaryModel.find({ month })).map(toRow);
  }

  async find(month: string, userId: string) {
    const d = await SalaryModel.findOne({ month, userId: oid(userId) });
    return d ? toRow(d) : null;
  }

  async upsertGenerated(rows: GeneratedRow[]): Promise<void> {
    if (rows.length === 0) return;
    const facts = (r: GeneratedRow) => ({
      name: r.name,
      designation: r.designation,
      fixedSalary: r.fixedSalary,
      presentDays: r.presentDays,
      workingDays: r.workingDays,
      computedPayable: r.computedPayable,
      weeklyOff: r.weeklyOff,
    });
    try {
      // 1. Facts for every unfinalized row (created if new). A finalized row is never matched.
      await SalaryModel.bulkWrite(
        rows.map((r) => ({
          updateOne: {
            filter: { month: r.month, userId: oid(r.userId), finalizedAt: null },
            update: {
              $set: facts(r),
              $setOnInsert: {
                payable: r.computedPayable,
                editedById: null,
                editedAt: null,
                note: null,
                finalizedById: null,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    } catch (err) {
      // A finalized row makes the upsert collide with the unique key: that is the lock working.
      const errors = (err as { writeErrors?: Array<{ err?: { code?: number } }> }).writeErrors;
      if (!errors || !errors.every((e) => e.err?.code === 11000)) throw err;
    }
    // 2. The payable follows the computed amount for rows nobody edited.
    await SalaryModel.bulkWrite(
      rows.map((r) => ({
        updateOne: {
          filter: { month: r.month, userId: oid(r.userId), editedAt: null, finalizedAt: null },
          update: { $set: { payable: r.computedPayable } },
        },
      })),
      { ordered: false },
    );
  }

  async setPayable(
    month: string,
    userId: string,
    payable: number,
    note: string | null,
    byId: string,
    at: Date,
  ) {
    const d = await SalaryModel.findOneAndUpdate(
      { month, userId: oid(userId), finalizedAt: null },
      { $set: { payable, note, editedById: oid(byId), editedAt: at } },
      { new: true },
    );
    return d ? toRow(d) : null;
  }

  async finalize(month: string, byId: string, at: Date): Promise<number> {
    const res = await SalaryModel.updateMany(
      { month, finalizedAt: null },
      { $set: { finalizedAt: at, finalizedById: oid(byId) } },
    );
    return res.modifiedCount;
  }
}

const toTarget = (d: HydratedDocument<SalesTargetDoc>): SalesTarget => ({
  month: d.month,
  userId: d.userId.toString(),
  amount: d.amount,
  setById: d.setById.toString(),
  setAt: d.setAt,
});

export class MongoSalesTargetRepository implements SalesTargetRepositoryPort {
  async set(month: string, userId: string, amount: number, byId: string, at: Date) {
    const d = await SalesTargetModel.findOneAndUpdate(
      { month, userId: oid(userId) },
      { $set: { amount, setById: oid(byId), setAt: at } },
      { upsert: true, new: true },
    );
    return toTarget(d);
  }

  async forMonth(month: string) {
    return (await SalesTargetModel.find({ month })).map(toTarget);
  }

  async upToMonth(month: string) {
    return (await SalesTargetModel.find({ month: { $lte: month } })).map(toTarget);
  }
}
