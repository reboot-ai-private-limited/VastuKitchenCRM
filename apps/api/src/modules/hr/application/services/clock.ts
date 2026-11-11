/** The business calendar, so use cases never touch timezones: dates in, dates out. */
export interface BusinessClock {
  now(): Date;
  /** The business-timezone calendar day of an instant, `YYYY-MM-DD`. */
  dateOf(instant: Date): string;
  /** The instant at which the business clocks read `hhmm` on `date`. */
  at(date: string, hhmm: string): Date;
}
