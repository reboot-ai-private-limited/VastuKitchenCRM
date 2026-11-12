import type { CheckInBodyDto } from '@vastu/contracts';
import { checkInAttendance, checkOutAttendance } from '@/lib/api/endpoints/attendance';
import { completeTodo, reopenTodo } from '@/lib/api/endpoints/todos';
import { registerOutboxHandler } from './outbox';

/** Payload shapes per outbox type. Add new offline-capable actions here. */
export type AttendancePayload = CheckInBodyDto;
export type TodoPayload = { todoId: string };

// GAP-1: the API stamps `inAt` with server time and takes no `capturedAt`, so a late replay
// records the replay time. The captured time is kept locally for display only.
registerOutboxHandler<AttendancePayload>('attendance.checkin', {
  send: (p) => checkInAttendance(p),
  invalidate: [['attendance'], ['dashboard']],
});
registerOutboxHandler<AttendancePayload>('attendance.checkout', {
  send: (p) => checkOutAttendance(p),
  invalidate: [['attendance'], ['dashboard']],
});
// Set-state endpoints, atomic and idempotent on the server, safe to replay.
registerOutboxHandler<TodoPayload>('todo.complete', {
  send: (p) => completeTodo(p.todoId),
  invalidate: [['todos'], ['dashboard']],
});
registerOutboxHandler<TodoPayload>('todo.reopen', {
  send: (p) => reopenTodo(p.todoId),
  invalidate: [['todos'], ['dashboard']],
});
