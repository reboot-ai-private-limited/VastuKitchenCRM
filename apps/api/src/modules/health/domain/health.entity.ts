export interface DependencyHealth {
  name: string;
  status: 'up' | 'down';
  detail?: string;
}

export interface HealthReport {
  status: 'OK' | 'DEGRADED';
  uptime: number;
  dependencies: DependencyHealth[];
}

export function summarise(deps: DependencyHealth[], uptime: number): HealthReport {
  return {
    status: deps.every((d) => d.status === 'up') ? 'OK' : 'DEGRADED',
    uptime,
    dependencies: deps,
  };
}
