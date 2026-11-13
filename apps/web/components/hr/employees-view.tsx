'use client';

import { STAFF_ROLES, type StaffRole, type UserDto } from '@vastu/contracts';
import { Plus, Search, Tags, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import { EMPLOYEE_PAGE_SIZE, useEmployees, useTargets, useUpdateEmployee } from '@/lib/api/hr';
import { useAuth } from '@/lib/auth';
import { formatINR, formatINRShort } from '@/lib/format';
import {
  ATTENDANCE_LABEL,
  DEFAULT_EMPLOYEE_FILTERS,
  ROLE_LABEL,
  canManageUser,
  currentMonth,
  employeeFiltersToSearch,
  parseEmployeeFilters,
  type EmployeeFilters,
} from '@/lib/hr';
import { formatPhone } from '@/lib/leads';
import { cn } from '@/lib/utils';
import { DeactivateDialog, PasswordDialog, TargetDialog } from './employee-dialogs';
import { EmployeeSheet } from './employee-sheet';

const ALL = '__all__';

type Dialog =
  { kind: 'edit' | 'password' | 'deactivate' | 'target'; user: UserDto } | { kind: 'add' } | null;

export function EmployeesView() {
  const router = useRouter();
  const params = useSearchParams();
  const { user: me } = useAuth();
  const filters = useMemo(() => parseEmployeeFilters(params), [params]);
  const [dialog, setDialog] = useState<Dialog>(null);

  const setFilters = useCallback(
    (patch: Partial<EmployeeFilters>) =>
      router.replace(`/employees${employeeFiltersToSearch({ ...filters, page: 1, ...patch })}`, {
        scroll: false,
      }),
    [filters, router],
  );

  // Typing waits a moment before it reaches the URL. The draft only counts while the URL still holds
  // the value it was typed over, so Clear and back/forward win.
  const [draft, setDraft] = useState<{ value: string; from: string } | null>(null);
  const text = draft && draft.from === filters.search ? draft.value : filters.search;
  useEffect(() => {
    if (!draft || draft.from !== filters.search || draft.value.trim() === filters.search) return;
    const t = setTimeout(() => setFilters({ search: draft.value.trim() }), 350);
    return () => clearTimeout(t);
  }, [draft, filters.search, setFilters]);

  const month = currentMonth();
  const targets = useTargets(month);
  const targetOf = (id: string) => targets.data?.rows.find((r) => r.userId === id);
  const q = useEmployees(filters);
  const data = q.data;
  const filtered =
    JSON.stringify({ ...filters, page: 1 }) !== JSON.stringify(DEFAULT_EMPLOYEE_FILTERS);

  return (
    <PageBody>
      <PageHeader
        title="Employees"
        description={
          data
            ? `${data.total} ${data.total === 1 ? 'person' : 'people'}${filtered ? ' match your filters' : ''}`
            : undefined
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/employees/designations">
                <Tags /> Designations
              </Link>
            </Button>
            <Button onClick={() => setDialog({ kind: 'add' })}>
              <Plus /> Add employee
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search employees"
            placeholder="Search name or phone"
            className="pl-8"
            value={text}
            onChange={(e) => setDraft({ value: e.target.value, from: filters.search })}
          />
        </div>
        <Select
          value={filters.role ?? ALL}
          onValueChange={(v) => setFilters({ role: v === ALL ? null : (v as StaffRole) })}
        >
          <SelectTrigger aria-label="Role" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All roles</SelectItem>
            {STAFF_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.active === null ? ALL : String(filters.active)}
          onValueChange={(v) => setFilters({ active: v === ALL ? null : v === 'true' })}
        >
          <SelectTrigger aria-label="Active" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Active and not</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Deactivated</SelectItem>
          </SelectContent>
        </Select>
        {filtered && (
          <Button variant="ghost" onClick={() => router.replace('/employees', { scroll: false })}>
            Clear
          </Button>
        )}
      </div>

      <div className="bg-card shadow-card overflow-hidden rounded-xl border">
        {q.isError && !data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.isPending ? (
          <div className="space-y-3 p-4" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filtered ? 'No one matches these filters' : 'No employees yet'}
            action={
              filtered ? (
                <Button
                  variant="outline"
                  onClick={() => router.replace('/employees', { scroll: false })}
                >
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => setDialog({ kind: 'add' })}>
                  <Plus /> Add employee
                </Button>
              )
            }
          />
        ) : data ? (
          <>
            <Table className={cn(q.isPlaceholderData && 'opacity-60 transition-opacity')}>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Designation</TableHead>
                  <TableHead className="hidden lg:table-cell">Attendance</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Salary</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Target</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-px whitespace-nowrap">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((u) => (
                  <EmployeeRow
                    key={u.id}
                    u={u}
                    isMe={u.id === me?.id}
                    canManage={canManageUser(me?.role, u.role)}
                    target={targetOf(u.id)?.amount ?? null}
                    onTarget={() => setDialog({ kind: 'target', user: u })}
                    onAction={(kind) => setDialog({ kind, user: u })}
                  />
                ))}
              </TableBody>
            </Table>
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5">
                <p className="text-muted-foreground tabular text-xs">
                  {(data.page - 1) * EMPLOYEE_PAGE_SIZE + 1}–
                  {Math.min(data.page * EMPLOYEE_PAGE_SIZE, data.total)} of {data.total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page <= 1}
                    onClick={() => setFilters({ page: data.page - 1 })}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page >= data.totalPages}
                    onClick={() => setFilters({ page: data.page + 1 })}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Keyed so each open starts from that person's current values, never the last form's leftovers. */}
      {dialog?.kind === 'add' && (
        <EmployeeSheet key="add" user={null} open onOpenChange={(o) => !o && setDialog(null)} />
      )}
      {dialog?.kind === 'edit' && (
        <EmployeeSheet
          key={dialog.user.id}
          user={dialog.user}
          open
          onOpenChange={(o) => !o && setDialog(null)}
        />
      )}
      {dialog?.kind === 'target' && (
        <TargetDialog user={dialog.user} initialMonth={month} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'password' && (
        <PasswordDialog user={dialog.user} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'deactivate' && (
        <DeactivateDialog user={dialog.user} onClose={() => setDialog(null)} />
      )}
    </PageBody>
  );
}

function EmployeeRow({
  u,
  isMe,
  canManage,
  target,
  onTarget,
  onAction,
}: {
  u: UserDto;
  isMe: boolean;
  canManage: boolean;
  /** This month's target in rupees; null when none has been set. */
  target: number | null;
  onTarget: () => void;
  onAction: (kind: 'edit' | 'password' | 'deactivate') => void;
}) {
  const update = useUpdateEmployee(u.id);
  // You can't switch yourself off, and HR can't touch Admin or HR accounts.
  const lockedSwitch = !canManage || isMe || update.isPending;
  const actions = [
    ...(canManage
      ? [
          { label: 'Edit', onClick: () => onAction('edit') },
          { label: u.canLogin ? 'Password' : 'Create login', onClick: () => onAction('password') },
        ]
      : []),
    ...(u.attendanceType !== null ? [{ label: 'Target', onClick: onTarget }] : []),
  ];
  return (
    <TableRow className={cn(!u.active && 'text-muted-foreground')}>
      <TableCell>
        <span className="font-semibold">{u.name}</span>
        {isMe && <span className="text-muted-foreground ml-1 text-xs">(you)</span>}
        <span className="tabular text-muted-foreground block text-xs">
          {formatPhone(u.phone)}
          {!u.canLogin && (
            <span className="bg-secondary text-secondary-foreground ml-2 rounded-full px-1.5">
              No login
            </span>
          )}
        </span>
      </TableCell>
      <TableCell>{ROLE_LABEL[u.role]}</TableCell>
      <TableCell className="hidden md:table-cell">{u.designation ?? '—'}</TableCell>
      <TableCell className="hidden lg:table-cell">
        {u.attendanceType ? ATTENDANCE_LABEL[u.attendanceType] : '—'}
      </TableCell>
      <TableCell className="tabular hidden text-right sm:table-cell">
        {u.fixedSalary !== undefined ? formatINR(u.fixedSalary) : '—'}
      </TableCell>
      <TableCell className="tabular hidden text-right sm:table-cell">
        {u.attendanceType === null ? (
          '—'
        ) : (
          <button
            type="button"
            onClick={onTarget}
            title="Set monthly target"
            className="hover:bg-muted focus-visible:ring-ring -mx-1.5 rounded px-1.5 py-0.5 focus-visible:ring-2 focus-visible:outline-none"
          >
            {target ? formatINRShort(target) : <span className="text-muted-foreground">Set</span>}
          </button>
        )}
      </TableCell>
      <TableCell>
        <Switch
          aria-label={`${u.name} is active`}
          checked={u.active}
          disabled={lockedSwitch}
          onCheckedChange={(on) => {
            if (!on) return onAction('deactivate'); // confirm first: it signs them out
            update.mutate(
              { active: true },
              {
                onSuccess: () => toast.success(`${u.name} reactivated`),
                onError: (e) =>
                  toast.error(e instanceof ApiError ? e.message : 'Couldn’t reactivate.'),
              },
            );
          }}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2 text-sm whitespace-nowrap">
          {actions.map((a, i) => (
            <Fragment key={a.label}>
              {i > 0 && (
                <span aria-hidden className="text-muted-foreground/50">
                  |
                </span>
              )}
              <button
                type="button"
                onClick={a.onClick}
                className="text-primary cursor-pointer hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {a.label}
              </button>
            </Fragment>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}
