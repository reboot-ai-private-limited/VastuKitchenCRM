/**
 * The only thing another module may import from `leads/`. Deliberately small: add to it when a
 * real consumer needs something (proposals will need to log activity and read a lead).
 */
export interface LeadsPublicContract {
  /** Calls, answered calls and talk time per employee over `[from, to)` — dashboard performance. */
  callStats(
    from: Date,
    to: Date,
  ): Promise<Array<{ userId: string; calls: number; answered: number; talkSeconds: number }>>;
}
