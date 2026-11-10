import { describe, expect, it } from 'vitest';
import { GetHealthUseCase } from './getHealth.usecase.js';
import type { HealthProbePort } from '../../domain/healthProbe.port.js';

const up: HealthProbePort = { name: 'a', check: async () => ({ name: 'a', status: 'up' }) };
const throws: HealthProbePort = {
  name: 'b',
  check: async () => {
    throw new Error('boom');
  },
};

describe('GetHealthUseCase', () => {
  it('is OK when every probe is up', async () => {
    const report = await new GetHealthUseCase([up], () => 5).execute();
    expect(report).toEqual({
      status: 'OK',
      uptime: 5,
      dependencies: [{ name: 'a', status: 'up' }],
    });
  });

  it('is DEGRADED when a probe throws', async () => {
    const report = await new GetHealthUseCase([up, throws], () => 1).execute();
    expect(report.status).toBe('DEGRADED');
    expect(report.dependencies[1]).toMatchObject({ name: 'b', status: 'down' });
  });
});
