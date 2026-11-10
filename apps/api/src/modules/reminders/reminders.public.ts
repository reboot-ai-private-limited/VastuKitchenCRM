import type { ReminderRunResultDto } from '@vastu/contracts';

/** The only thing another module (or the scheduler) may use from `reminders/`. */
export interface RemindersPublicContract {
  /** Runs all reminder rules once. Idempotent. */
  run(): Promise<ReminderRunResultDto>;
}
