import mongoose, { Schema, type Model } from 'mongoose';

export interface CounterDoc {
  _id: string;
  seq: number;
}

const schema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const CounterModel: Model<CounterDoc> =
  (mongoose.models['Counter'] as Model<CounterDoc>) ??
  mongoose.model<CounterDoc>('Counter', schema);
