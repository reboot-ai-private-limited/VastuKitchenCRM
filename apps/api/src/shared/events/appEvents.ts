import { EventEmitter } from 'node:events';
import { logger } from '@/shared/logging/logger.js';

/**
 * In-process event bus: how a LOWER tier tells a HIGHER one something happened without importing
 * it (e.g. leads → projects). The emitting module only knows this file; subscribers are
 * registered at the composition root (`container.ts` / `server.ts`).
 *
 * A handler that throws is logged, never propagated: the emitter's request has already
 * succeeded. Subscribers must therefore be IDEMPOTENT and safe to re-run.
 */
export interface LeadWonEvent {
  leadId: string;
  customerId: string;
  name: string;
  phone: string;
  /** Who marked it won. */
  byUserId: string;
}

export interface AppEventMap {
  'lead.won': LeadWonEvent;
}

export interface EventBus {
  emit<K extends keyof AppEventMap>(event: K, payload: AppEventMap[K]): void;
  on<K extends keyof AppEventMap>(
    event: K,
    handler: (payload: AppEventMap[K]) => void | Promise<void>,
  ): void;
}

export function createEventBus(): EventBus {
  const emitter = new EventEmitter();
  return {
    emit(event, payload) {
      emitter.emit(event, payload);
    },
    on(event, handler) {
      emitter.on(event, (payload: AppEventMap[typeof event]) => {
        Promise.resolve()
          .then(() => handler(payload))
          .catch((err: unknown) =>
            logger.error({ event, err: String(err) }, 'event handler failed'),
          );
      });
    },
  };
}
