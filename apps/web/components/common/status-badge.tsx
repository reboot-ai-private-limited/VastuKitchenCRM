import type { LeadStatus, ProjectStage, ComplaintStatus, DayStatus } from '@vastu/contracts';
import { cn } from '@/lib/utils';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'violet' | 'orange' | 'accent';

/** Full class names so Tailwind can see them. A badge is always tinted background + dark text, never colour alone. */
const TONE: Record<Tone, string> = {
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-neutral-soft text-neutral',
  violet: 'bg-violet-soft text-violet',
  orange: 'bg-orange-soft text-orange',
  accent: 'bg-primary-soft text-primary-hover',
};

const LEAD: Record<LeadStatus, [string, Tone]> = {
  NEW: ['New', 'info'],
  CONTACTED: ['Contacted', 'info'],
  VISIT: ['Visit', 'violet'],
  PROPOSAL_SENT: ['Proposal sent', 'warning'],
  FOLLOW_UP: ['Follow-up', 'orange'],
  WON: ['Won', 'success'],
  LOST: ['Lost', 'danger'],
};
const PROJECT: Record<ProjectStage, [string, Tone]> = {
  DESIGN: ['Design', 'violet'],
  SITE: ['Site', 'info'],
  CLOSED: ['Closed', 'neutral'],
};
const COMPLAINT: Record<ComplaintStatus, [string, Tone]> = {
  OPEN: ['Open', 'danger'],
  ASSIGNED: ['Assigned', 'warning'],
  RESOLVED: ['Resolved', 'success'],
  CLOSED: ['Closed', 'neutral'],
};
const DAY: Record<DayStatus, [string, Tone]> = {
  PRESENT: ['Present', 'success'],
  ABSENT: ['Absent', 'danger'],
  OFF: ['Off', 'neutral'],
  FUTURE: ['', 'neutral'],
};

type Props =
  | { kind: 'lead'; value: LeadStatus }
  | { kind: 'project'; value: ProjectStage }
  | { kind: 'complaint'; value: ComplaintStatus }
  | { kind: 'day'; value: DayStatus }
  | { kind: 'tone'; tone: Tone; label: string };

export function StatusBadge(props: Props & { className?: string }) {
  let label: string;
  let tone: Tone;
  switch (props.kind) {
    case 'lead':
      [label, tone] = LEAD[props.value];
      break;
    case 'project':
      [label, tone] = PROJECT[props.value];
      break;
    case 'complaint':
      [label, tone] = COMPLAINT[props.value];
      break;
    case 'day':
      [label, tone] = DAY[props.value];
      break;
    default:
      ({ label, tone } = props);
  }
  if (!label) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE[tone],
        props.className,
      )}
    >
      {label}
    </span>
  );
}
