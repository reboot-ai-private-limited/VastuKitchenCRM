import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { ComplaintModel } from './complaint.schemas.js';
import { toComplaint } from './mongoComplaint.adapter.js';

describe('mapping a stored complaint', () => {
  it('keeps the photo fields of the complaint, its resolution and its messages (no Mongoose internals)', () => {
    const photo = (n: string) => ({ publicId: `vastu/projects/p/${n}`, width: 800, height: 600 });
    const doc = new ComplaintModel({
      projectId: new Types.ObjectId(),
      customerId: new Types.ObjectId(),
      description: 'Drawer slider is jammed',
      images: [photo('raised')],
      resolutionImages: [photo('fixed')],
      activeSince: new Date(),
      comments: [
        {
          authorId: new Types.ObjectId(),
          text: 'Photo of the hinge',
          images: [photo('hinge')],
          createdAt: new Date(),
        },
      ],
    });
    const c = toComplaint(doc);
    expect(c.images).toEqual([
      { publicId: 'vastu/projects/p/raised', width: 800, height: 600, bytes: null },
    ]);
    expect(c.resolutionImages[0]?.publicId).toBe('vastu/projects/p/fixed');
    expect(c.comments[0]?.images).toEqual([
      { publicId: 'vastu/projects/p/hinge', width: 800, height: 600, bytes: null },
    ]);
  });
});
