import type { HealthReport } from './domain/health.entity.js';

/** The only thing another module may import from `health/`. */
export interface HealthPublicContract {
  report(): Promise<HealthReport>;
}
