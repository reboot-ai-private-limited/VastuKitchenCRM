import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { toEntity } from './mongoNotification.adapter.js';
import { NotificationModel } from './notification.schema.js';

describe('notification storage mapping', () => {
  it('keeps ref.fileId (S-14), alongside postId and projectId', () => {
    const doc = new NotificationModel({
      userId: new Types.ObjectId(),
      type: 'FILE_ADDED',
      title: 't',
      body: 'b',
      ref: { kind: 'PROJECT', id: 'p1', projectId: 'p1', fileId: 'f9' },
    });
    expect(toEntity(doc).ref).toEqual({ kind: 'PROJECT', id: 'p1', projectId: 'p1', fileId: 'f9' });
  });
});
