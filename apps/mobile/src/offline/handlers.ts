import type {
  CheckInBodyDto,
  ChangeLeadStatusBodyDto,
  CreateLeadBodyDto,
  RecordCallBodyDto,
  RecordVisitBodyDto,
} from '@vastu/contracts';
import { checkInAttendance, checkOutAttendance } from '@/lib/api/endpoints/attendance';
import { changeLeadStatus, createLead, recordCall, recordVisit } from '@/lib/api/endpoints/leads';
import { completeTodo, reopenTodo } from '@/lib/api/endpoints/todos';
import { registerOutboxHandler } from './outbox';

/**
 * Payload shapes per outbox type. Add new offline-capable actions here (or call
 * registerOutboxHandler from the feature's own module and import it once from this file).
 * Dates are stored as ISO strings because payloads are JSON.
 */
export type AttendancePayload = CheckInBodyDto;
export type TodoPayload = { todoId: string };
export type CallRecordPayload = {
  leadId: string;
  body: Omit<RecordCallBodyDto, 'startedAt'> & { startedAt: string };
};
export type VisitLogPayload = {
  leadId: string;
  body: Omit<RecordVisitBodyDto, 'at'> & { at: string };
};
export type LeadStatusPayload = { leadId: string; body: ChangeLeadStatusBodyDto };
export type LeadCreatePayload = { body: CreateLeadBodyDto };

const LEAD_KEYS = [['leads'], ['dashboard']] as const;

// The API takes `capturedAt` (ISO, not in the future, within 36 h), so a late replay keeps the tap time.
const withCapturedAt = (p: AttendancePayload, capturedAt: number): AttendancePayload => ({
  ...p,
  capturedAt: new Date(capturedAt).toISOString(),
});
registerOutboxHandler<AttendancePayload>('attendance.checkin', {
  label: 'Check-in',
  send: (p, ctx) => checkInAttendance(withCapturedAt(p, ctx.capturedAt)),
  invalidate: [['attendance'], ['dashboard']],
});
registerOutboxHandler<AttendancePayload>('attendance.checkout', {
  label: 'Check-out',
  send: (p, ctx) => checkOutAttendance(withCapturedAt(p, ctx.capturedAt)),
  invalidate: [['attendance'], ['dashboard']],
});
// Set-state endpoints, atomic and idempotent on the server, safe to replay.
registerOutboxHandler<TodoPayload>('todo.complete', {
  label: 'Task update',
  send: (p) => completeTodo(p.todoId),
  invalidate: [['todos'], ['dashboard']],
});
registerOutboxHandler<TodoPayload>('todo.reopen', {
  label: 'Task update',
  send: (p) => reopenTodo(p.todoId),
  invalidate: [['todos'], ['dashboard']],
});

// Replayable: the API dedupes a call by (lead, user, startedAt).
registerOutboxHandler<CallRecordPayload>('call.record', {
  label: 'Call log',
  send: (p) => recordCall(p.leadId, p.body as unknown as RecordCallBodyDto),
  invalidate: [...LEAD_KEYS],
});
// NOT idempotent: a replay would create a second visit. The outbox never auto-retries an
// ambiguous failure for this type; it drops the row and tells the user it may have been saved.
registerOutboxHandler<VisitLogPayload>('visit.log', {
  label: 'Site visit',
  idempotent: false,
  send: (p) => recordVisit(p.leadId, p.body as unknown as RecordVisitBodyDto),
  invalidate: [...LEAD_KEYS],
});
registerOutboxHandler<LeadStatusPayload>('lead.status', {
  label: 'Lead status change',
  send: (p) => changeLeadStatus(p.leadId, p.body),
  invalidate: [...LEAD_KEYS],
});
// 409 (phone already exists) is a permanent 4xx: the drop listener offers "Open existing lead".
registerOutboxHandler<LeadCreatePayload>('lead.create', {
  label: 'New lead',
  send: (p) => createLead(p.body),
  invalidate: [...LEAD_KEYS],
});
