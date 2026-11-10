import mongoose from 'mongoose';
import type { DependencyHealth } from '../domain/health.entity.js';
import type { HealthProbePort } from '../domain/healthProbe.port.js';

/** Reports MongoDB as up when the Mongoose connection is open (readyState 1). */
export class MongoHealthProbe implements HealthProbePort {
  readonly name = 'MongoDB';

  async check(): Promise<DependencyHealth> {
    const up = mongoose.connection.readyState === 1;
    return up
      ? { name: this.name, status: 'up' }
      : { name: this.name, status: 'down', detail: 'not connected' };
  }
}
