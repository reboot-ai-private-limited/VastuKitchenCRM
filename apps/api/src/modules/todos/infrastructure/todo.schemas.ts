import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface TodoListDoc {
  projectId: Types.ObjectId;
  name: string;
  archived: boolean;
  /** Orders lists in the order they were made (a timestamp: monotonic, and race-free). */
  position: number;
  createdById: Types.ObjectId;
  createdAt: Date;
}

const listSchema = new Schema<TodoListDoc>(
  {
    projectId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    archived: { type: Boolean, default: false },
    position: { type: Number, required: true },
    createdById: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

export const TodoListModel: Model<TodoListDoc> =
  (mongoose.models['TodoList'] as Model<TodoListDoc>) ??
  mongoose.model<TodoListDoc>('TodoList', listSchema);

export interface TodoDoc {
  projectId: Types.ObjectId;
  listId: Types.ObjectId;
  title: string;
  notes: string | null;
  images: Array<{
    publicId: string;
    width: number | null;
    height: number | null;
    bytes: number | null;
  }>;
  assigneeIds: Types.ObjectId[];
  notifyOnDoneIds: Types.ObjectId[];
  /** `YYYY-MM-DD` in the business timezone — a string, so it compares correctly and carries no time. */
  dueOn: string | null;
  completedById: Types.ObjectId | null;
  completedAt: Date | null;
  createdById: Types.ObjectId;
  commentCount: number;
  position: number;
  deletedAt: Date | null;
  createdAt: Date;
}

const imageSchema = new Schema(
  {
    publicId: { type: String, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    bytes: { type: Number, default: null },
  },
  { _id: false },
);

const todoSchema = new Schema<TodoDoc>(
  {
    projectId: { type: Schema.Types.ObjectId, required: true },
    listId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true },
    notes: { type: String, default: null },
    images: { type: [imageSchema], default: [] },
    assigneeIds: { type: [Schema.Types.ObjectId], default: [] },
    notifyOnDoneIds: { type: [Schema.Types.ObjectId], default: [] },
    dueOn: { type: String, default: null },
    completedById: { type: Schema.Types.ObjectId, default: null },
    completedAt: { type: Date, default: null },
    createdById: { type: Schema.Types.ObjectId, required: true },
    commentCount: { type: Number, default: 0, min: 0 },
    position: { type: Number, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
todoSchema.index({ projectId: 1, listId: 1, position: 1 });
// "My assignments".
todoSchema.index({ assigneeIds: 1, completedAt: 1 });
// The overdue reminder.
todoSchema.index({ dueOn: 1, completedAt: 1 });

export const TodoModel: Model<TodoDoc> =
  (mongoose.models['Todo'] as Model<TodoDoc>) ?? mongoose.model<TodoDoc>('Todo', todoSchema);

export interface TodoCommentDoc {
  todoId: Types.ObjectId;
  projectId: Types.ObjectId;
  authorId: Types.ObjectId;
  text: string;
  deletedAt: Date | null;
  createdAt: Date;
}

const commentSchema = new Schema<TodoCommentDoc>(
  {
    todoId: { type: Schema.Types.ObjectId, required: true },
    projectId: { type: Schema.Types.ObjectId, required: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    text: { type: String, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
commentSchema.index({ todoId: 1, createdAt: 1 });

export const TodoCommentModel: Model<TodoCommentDoc> =
  (mongoose.models['TodoComment'] as Model<TodoCommentDoc>) ??
  mongoose.model<TodoCommentDoc>('TodoComment', commentSchema);
