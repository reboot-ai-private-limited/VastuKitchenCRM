import type { NumberSequencePort } from '../domain/numberSequence.port.js';
import { CounterModel } from './counter.schema.js';

/** One atomic `$inc` per call, so two simultaneous proposals can never share a number. */
export class MongoNumberSequence implements NumberSequencePort {
  async next(year: number): Promise<number> {
    const doc = await CounterModel.findOneAndUpdate(
      { _id: `proposal-${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    );
    return doc.seq;
  }
}
