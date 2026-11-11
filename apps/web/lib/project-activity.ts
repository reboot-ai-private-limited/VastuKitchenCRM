import type { ProjectActivityDto, ProjectActivityType } from '@vastu/contracts';

const VERB: Record<ProjectActivityType, string> = {
  TODO_CREATED: 'added a to-do',
  TODO_ASSIGNED: 'assigned a to-do',
  TODO_DUE_CHANGED: 'changed a due date',
  TODO_COMPLETED: 'completed a to-do',
  TODO_REOPENED: 'reopened a to-do',
  FILE_ADDED: 'added a file',
  FILE_SHARED: 'shared a file with the client',
  FILES_SAVED: 'saved photos to Docs',
  COMPLAINT_RAISED: 'raised a complaint',
  COMPLAINT_ASSIGNED: 'assigned a complaint',
  COMPLAINT_RESOLVED: 'resolved a complaint',
  COMPLAINT_REOPENED: 'reopened a complaint',
  COMPLAINT_CLOSED: 'closed a complaint',
};

/** `data` is loosely typed by the API: take the first readable title-ish field and never throw. */
const KEYS = ['todoTitle', 'title', 'fileName', 'name', 'description'] as const;

export function describeProjectActivity(a: ProjectActivityDto): {
  who: string;
  what: string;
  subject: string | null;
} {
  const subject =
    KEYS.map((k) => a.data[k]).find((v): v is string => typeof v === 'string' && v.trim() !== '') ??
    null;
  return {
    who: a.actor?.name ?? 'Someone',
    what: VERB[a.type] ?? 'did something',
    subject: subject && subject.length > 90 ? `${subject.slice(0, 90)}…` : subject,
  };
}
