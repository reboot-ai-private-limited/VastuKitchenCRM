import { scopeFor } from '@/shared/access/scope.js';
import { AppError } from '@/shared/errors/AppError.js';
import type { Complaint, Viewer } from '../../domain/complaint.entity.js';
import type { ComplaintRepositoryPort } from '../../domain/ports.js';

export type ComplaintAction = 'assign' | 'resolve' | 'reopen' | 'close';

export interface ComplaintAbilities {
  assign: boolean;
  resolve: boolean;
  reopen: boolean;
  close: boolean;
}

/**
 * Who may see and do what. Reception and Admins see every complaint; everyone else sees only those
 * they are part of (assigned to them, raised by them, or about their own project as the customer) —
 * anyone else is told "not found". The actions follow the status: only the Admin assigns and
 * closes; the assignee (or an Admin) resolves; the customer (or an Admin) reopens.
 */
export class ComplaintAccess {
  constructor(private readonly complaints: ComplaintRepositoryPort) {}

  seesAll(viewer: Viewer): boolean {
    return scopeFor(viewer.role, 'complaints') === 'all';
  }

  /** The filter that limits a list to what `viewer` may see. */
  involving(viewer: Viewer): string | undefined {
    return this.seesAll(viewer) ? undefined : viewer.id;
  }

  canSee(c: Complaint, viewer: Viewer): boolean {
    return (
      this.seesAll(viewer) ||
      c.assignedToId === viewer.id ||
      c.raisedById === viewer.id ||
      c.customerId === viewer.id
    );
  }

  async load(id: string, viewer: Viewer): Promise<Complaint> {
    const c = /^[a-f\d]{24}$/i.test(id) ? await this.complaints.findById(id) : null;
    if (!c || !this.canSee(c, viewer)) throw AppError.notFound('Complaint not found.');
    return c;
  }

  private rule(
    c: Complaint,
    v: Viewer,
    action: ComplaintAction,
  ): { actor: boolean; status: boolean } {
    const admin = v.role === 'ADMIN';
    switch (action) {
      case 'assign':
        return { actor: admin, status: c.status === 'OPEN' || c.status === 'ASSIGNED' };
      case 'resolve':
        return { actor: admin || c.assignedToId === v.id, status: c.status === 'ASSIGNED' };
      case 'reopen':
        return { actor: admin || c.customerId === v.id, status: c.status === 'RESOLVED' };
      case 'close':
        return { actor: admin, status: c.status === 'RESOLVED' };
    }
  }

  abilities(c: Complaint, viewer: Viewer): ComplaintAbilities {
    const can = (a: ComplaintAction) => {
      const r = this.rule(c, viewer, a);
      return r.actor && r.status;
    };
    return {
      assign: can('assign'),
      resolve: can('resolve'),
      reopen: can('reopen'),
      close: can('close'),
    };
  }

  /** 403 when this person may never do it; 409 when it is not possible in the current status. */
  assert(c: Complaint, viewer: Viewer, action: ComplaintAction): void {
    const r = this.rule(c, viewer, action);
    if (!r.actor) throw AppError.forbidden('You cannot do that on this complaint.');
    if (!r.status)
      throw AppError.conflict(
        `This complaint is ${c.status.toLowerCase()}, so you cannot ${action} it.`,
      );
  }
}
