import { logger } from '@/shared/logging/logger.js';

export interface IntervalJob {
  stop(): void;
}

/**
 * Runs `task` once straight away (a restart catches up on what it missed), then every `everyMs`.
 * A run that is still going when the next tick arrives is skipped, never overlapped, and a task
 * that throws is logged and retried at the next tick — it never takes the process down.
 *
 * Deliberately not `node-cron`: the jobs here are idempotent, so exact wall-clock times do not
 * matter. Start it from ONE instance only (`ENABLE_CRON`), see docs/03-architecture/deployment.md.
 */
export function startIntervalJob(
  name: string,
  everyMs: number,
  task: () => Promise<unknown>,
): IntervalJob {
  let running = false;

  const tick = async () => {
    if (running) {
      logger.warn({ job: name }, 'previous run still going, skipping this tick');
      return;
    }
    running = true;
    try {
      const result = await task();
      logger.info({ job: name, result }, 'job finished');
    } catch (err) {
      logger.error({ job: name, err: String(err) }, 'job failed');
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), everyMs);
  // Never keep the process alive just for a timer (shutdown must not wait for it).
  timer.unref();
  return { stop: () => clearInterval(timer) };
}
