import type { DependencyHealth } from './health.entity.js';

/** Anything external the service depends on and can check (DB, storage…). */
export interface HealthProbePort {
  readonly name: string;
  check(): Promise<DependencyHealth>;
}
