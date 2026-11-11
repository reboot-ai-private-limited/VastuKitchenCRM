import { z } from 'zod';

/**
 * Photos and files never pass through the API: the app asks for a signed ticket, uploads straight
 * to the storage provider, then sends the returned `publicId` with the post. The ticket shape is
 * provider-neutral (a URL + form fields), so moving from Cloudinary to S3 changes no client code.
 */
export const uploadTicketSchema = z.object({
  /** POST the file here as multipart/form-data. */
  url: z.string(),
  method: z.literal('POST'),
  /** Name of the form field that carries the file. */
  fileField: z.string(),
  /** Extra form fields to send before the file, exactly as given. */
  fields: z.record(z.string()),
  /** The ticket stops working after this moment. */
  expiresAt: z.string(),
});
export type UploadTicketDto = z.infer<typeof uploadTicketSchema>;

export const MAX_IMAGES_PER_POST = 20;

/** An uploaded image, as the app reports it after the upload (the provider's response). */
export const imageInputSchema = z.object({
  publicId: z.string().min(1).max(300),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  bytes: z.number().int().positive().optional(),
});
export type ImageInputDto = z.infer<typeof imageInputSchema>;

/** An image as the API returns it: ready-made URLs, so clients never build them. */
export const imageSchema = z.object({
  publicId: z.string(),
  /** Full-size, delivered in the best format for the device. */
  url: z.string(),
  /** Small, for lists and grids. */
  thumbUrl: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});
export type ImageDto = z.infer<typeof imageSchema>;
