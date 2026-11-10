export interface NumberSequencePort {
  /** The next value of the sequence for `year` (1, 2, 3 …). Atomic: never hands out a number twice. */
  next(year: number): Promise<number>;
}
