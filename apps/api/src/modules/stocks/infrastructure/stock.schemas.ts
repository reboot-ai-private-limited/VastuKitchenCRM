import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { STOCK_MOVEMENT_TYPES, STOCK_UNITS } from '@vastu/contracts';

export interface StockItemDoc {
  name: string;
  category: string | null;
  unit: (typeof STOCK_UNITS)[number];
  quantity: number;
  minLevel: number;
  archived: boolean;
  updatedAt: Date;
  createdAt: Date;
}

const itemSchema = new Schema<StockItemDoc>(
  {
    name: { type: String, required: true },
    category: { type: String, default: null },
    unit: { type: String, enum: STOCK_UNITS, required: true },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    minLevel: { type: Number, required: true, default: 0, min: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);
itemSchema.index({ archived: 1, name: 1 });
itemSchema.index({ category: 1 });

export const StockItemModel: Model<StockItemDoc> =
  (mongoose.models['StockItem'] as Model<StockItemDoc>) ??
  mongoose.model<StockItemDoc>('StockItem', itemSchema, 'stock_items');

export interface StockMovementDoc {
  itemId: Types.ObjectId;
  type: (typeof STOCK_MOVEMENT_TYPES)[number];
  quantity: number;
  balanceAfter: number;
  note: string | null;
  byId: Types.ObjectId | null;
  createdAt: Date;
}

const movementSchema = new Schema<StockMovementDoc>(
  {
    itemId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: STOCK_MOVEMENT_TYPES, required: true },
    quantity: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    note: { type: String, default: null },
    byId: { type: Schema.Types.ObjectId, default: null },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false },
);
movementSchema.index({ itemId: 1, createdAt: -1 });

export const StockMovementModel: Model<StockMovementDoc> =
  (mongoose.models['StockMovement'] as Model<StockMovementDoc>) ??
  mongoose.model<StockMovementDoc>('StockMovement', movementSchema, 'stock_movements');
