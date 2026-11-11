/**
 * The only thing another module may import from `hr/`. Nothing needs HR's data yet (the dashboard's
 * "present today" will ask for it later), so the contract is empty.
 */
export type HrPublicContract = Record<string, never>;
