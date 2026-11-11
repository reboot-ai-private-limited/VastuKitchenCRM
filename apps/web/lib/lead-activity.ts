import type { LeadActivityDto, LeadStatus } from '@vastu/contracts';
import { formatDuration } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/leads';

const OUTCOME: Record<string, string> = {
  INTERESTED: 'Interested',
  CALL_BACK: 'Call back',
  NOT_INTERESTED: 'Not interested',
  NO_ANSWER: 'No answer',
  WRONG_NUMBER: 'Wrong number',
};

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const status = (v: unknown): string => (typeof v === 'string' && v in STATUS_LABEL ? STATUS_LABEL[v as LeadStatus] : String(v ?? '?'));

/** One timeline entry as a headline plus an optional detail line. `data` is loosely typed by the API, so read it defensively. */
export function describeActivity(a: LeadActivityDto): { title: string; detail?: string } {
  const d = a.data;
  const who = a.by?.name;
  switch (a.type) {
    case 'CREATED':
      return { title: who ? `Lead added by ${who}` : 'Lead added', detail: str(d['source']) ? `Source: ${str(d['source'])}` : undefined };
    case 'ASSIGNED': {
      const to = str(d['toName']);
      return { title: to ? `Assigned to ${to}` : 'Unassigned', detail: who ? `By ${who}` : undefined };
    }
    case 'STATUS_CHANGED': {
      const note = str(d['note']);
      const lost = str(d['lostReason']);
      return {
        title: `${status(d['from'])} → ${status(d['to'])}`,
        detail: [who && `By ${who}`, lost && `Reason: ${lost}`, note].filter(Boolean).join(' · ') || undefined,
      };
    }
    case 'CALL': {
      const answered = d['answered'] === true;
      const sec = typeof d['durationSec'] === 'number' ? d['durationSec'] : 0;
      const outcome = str(d['outcome']);
      return {
        title: answered ? `Call answered (${formatDuration(sec)})` : 'Call not answered',
        detail: [who && `By ${who}`, outcome && OUTCOME[outcome]].filter(Boolean).join(' · ') || undefined,
      };
    }
    case 'VISIT':
      return { title: 'Site visit', detail: [who && `By ${who}`, str(d['note'])].filter(Boolean).join(' · ') || undefined };
    case 'PROPOSAL_SENT':
      return { title: `Proposal ${str(d['number']) ?? ''} sent`.replace('  ', ' '), detail: who ? `By ${who}` : undefined };
    case 'PROPOSAL_SEEN':
      return { title: `Customer opened proposal ${str(d['number']) ?? ''}`.trim() };
    case 'PROJECT_CREATED':
      return { title: `Project created${str(d['projectName']) ? `: ${str(d['projectName'])}` : ''}` };
    case 'PROJECT_CLOSED':
      return { title: `Project closed${str(d['projectName']) ? `: ${str(d['projectName'])}` : ''}` };
  }
}
