import type { ComplaintsPublicContract } from '@/modules/complaints/complaints.public.js';
import type { HrPublicContract } from '@/modules/hr/hr.public.js';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { LeadsPublicContract } from '@/modules/leads/leads.public.js';
import type { ProjectsPublicContract } from '@/modules/projects/projects.public.js';
import type { ProposalsPublicContract } from '@/modules/proposals/proposals.public.js';
import type { TodosPublicContract } from '@/modules/todos/todos.public.js';

/**
 * The dashboard only READS. Each port is the narrow slice of another module's public contract that
 * the dashboard needs — nothing more — so a test can fake it in a few lines and a module can change
 * everything else without the dashboard noticing.
 */
export type LeadsSource = Pick<
  LeadsPublicContract,
  | 'dashboardCounts'
  | 'activitySummary'
  | 'callStats'
  | 'openLeadIds'
  | 'wonLeadIds'
  | 'wonLeads'
  | 'getLeadStates'
  | 'findStuckLeads'
>;
export type ProposalsSource = Pick<
  ProposalsPublicContract,
  'activitySummary' | 'latestSentTotals' | 'findUnseenSent' | 'findSeen'
>;
export type ProjectsSource = Pick<
  ProjectsPublicContract,
  'countByStage' | 'feedActivitySummary' | 'recentCustomerActivity' | 'getProjectNames'
>;
export type ComplaintsSource = Pick<ComplaintsPublicContract, 'countByStatus' | 'findStale'>;
export type TodosSource = Pick<TodosPublicContract, 'findOverdue'>;
export type HrSource = Pick<
  HrPublicContract,
  'dayCounts' | 'attendanceSummary' | 'targetsForMonth'
>;
export type DirectorySource = Pick<IdentityPublicContract, 'getStaff' | 'getUserSummaries'>;

/** The day-count thresholds the alerts use (Admin-editable; the same ones the reminders use). */
export interface AlertThresholds {
  unseenDays: number;
  noActionDays: number;
  stuckDays: number;
  complaintDays: number;
}
export interface ThresholdsPort {
  load(): Promise<AlertThresholds>;
}
