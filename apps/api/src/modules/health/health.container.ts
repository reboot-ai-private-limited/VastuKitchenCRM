import type { Router } from 'express';
import { GetHealthUseCase } from './application/usecases/getHealth.usecase.js';
import type { HealthProbePort } from './domain/healthProbe.port.js';
import { MongoHealthProbe } from './infrastructure/mongoHealthProbe.adapter.js';
import { makeGetHealthController } from './interface/health.controller.js';
import { buildHealthRouter } from './interface/health.route.js';
import type { HealthPublicContract } from './health.public.js';

export interface HealthContainer {
  contract: HealthPublicContract;
  buildRouter: () => Router;
}

/**
 * REFERENCE MODULE — copy this for a new one. Composition root: adapters → use cases →
 * `{ contract, buildRouter }`. `buildRouter` is a function (not an eager Router) so a worker or
 * script can build the container without allocating Express objects.
 */
export function buildHealthContainer(): HealthContainer {
  const probes: HealthProbePort[] = [new MongoHealthProbe()];
  const getHealth = new GetHealthUseCase(probes);

  return {
    contract: { report: () => getHealth.execute() },
    buildRouter: () => buildHealthRouter(makeGetHealthController(getHealth)),
  };
}
