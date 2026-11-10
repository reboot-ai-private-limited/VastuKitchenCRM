import { z } from 'zod';

/**
 * Reference example of the zod-first pattern: one schema, DTO type inferred from it.
 * The API validates/describes with `healthReportSchema`; clients import `HealthReportDto`.
 */
export const dependencyHealthSchema = z.object({
  name: z.string(),
  status: z.enum(['up', 'down']),
  detail: z.string().optional(),
});
export type DependencyHealthDto = z.infer<typeof dependencyHealthSchema>;

export const healthReportSchema = z.object({
  status: z.enum(['OK', 'DEGRADED']),
  uptime: z.number(),
  dependencies: z.array(dependencyHealthSchema),
});
export type HealthReportDto = z.infer<typeof healthReportSchema>;
