import { z } from 'zod';

/** Query string of every paginated list endpoint. Coerces because query values arrive as strings. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>;

/** The `data` of every paginated list endpoint. Generic, so it is a function over an item schema. */
export const paginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  });
export type PaginatedDto<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
