import { buildHealthContainer } from '@/modules/health/health.container.js';

/** Top-level composition root. Add each new module's container here and in `AppContainers`. */
export interface AppContainers {
  health: ReturnType<typeof buildHealthContainer>;
}

export function buildContainers(): AppContainers {
  return { health: buildHealthContainer() };
}
