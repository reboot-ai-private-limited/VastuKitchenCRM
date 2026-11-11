/** The only thing another module may import from `dashboard/`. It is the top of the graph: nothing needs it. */
export type DashboardPublicContract = Record<string, never>;
