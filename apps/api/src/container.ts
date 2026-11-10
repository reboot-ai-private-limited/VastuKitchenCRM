import { buildHealthContainer } from '@/modules/health/health.container.js';
import { buildIdentityContainer } from '@/modules/identity/identity.container.js';

/** Top-level composition root. Add each new module's container here and in `AppContainers`. */
export interface AppContainers {
  health: ReturnType<typeof buildHealthContainer>;
  identity: ReturnType<typeof buildIdentityContainer>;
}

export function buildContainers(): AppContainers {
  return { health: buildHealthContainer(), identity: buildIdentityContainer() };
}
