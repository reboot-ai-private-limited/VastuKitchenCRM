'use client';

import {
  ATTENDANCE_TYPES,
  createUserBodySchema,
  type AttendanceType,
  type StaffRole,
  type UserDto,
} from '@vastu/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ApiError } from '@/lib/api/client';
import { useCreateEmployee, useDesignationList, useUpdateEmployee } from '@/lib/api/hr';
import { ATTENDANCE_LABEL, ROLE_LABEL, assignableRoles, parseRupees } from '@/lib/hr';
import { formatPhone } from '@/lib/leads';
import { useAuth } from '@/lib/auth';

interface Form {
  name: string;
  phone: string;
  role: StaffRole | '';
  designation: string;
  attendanceType: AttendanceType | '';
  salary: string;
  createLogin: boolean;
  password: string;
}

const blank = (): Form => ({
  name: '',
  phone: '',
  role: '',
  designation: '',
  attendanceType: '',
  salary: '',
  createLogin: true,
  password: '',
});
const fromUser = (u: UserDto): Form => ({
  name: u.name,
  phone: u.phone,
  role: u.role === 'CUSTOMER' ? '' : u.role,
  designation: u.designation ?? '',
  attendanceType: u.attendanceType ?? '',
  salary: u.fixedSalary !== undefined ? String(u.fixedSalary) : '',
  createLogin: false,
  password: '',
});

const FRIENDLY: Record<string, string> = {
  name: 'Enter a name.',
  phone: 'Enter a 10-digit mobile number.',
  role: 'Choose a role.',
  designation: 'Choose a designation.',
  attendanceType: 'Choose how attendance is tracked.',
  fixedSalary: 'Enter the monthly salary in whole rupees.',
};

/**
 * Add or edit an employee. Role choices follow what the signed-in person may assign (HR cannot make Admin or HR
 * accounts). A login is optional: floor staff tracked only by biometric need none.
 */
export function EmployeeSheet({
  user,
  open,
  onOpenChange,
}: {
  user: UserDto | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { user: me } = useAuth();
  const editing = user !== null;
  const designations = useDesignationList(false, open);
  const create = useCreateEmployee();
  const update = useUpdateEmployee(user?.id ?? '');
  const [form, setForm] = useState<Form>(() => (user ? fromUser(user) : blank()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const roles = assignableRoles(me?.role);
  // Keep the person's current designation selectable even if it has since been deactivated.
  const options = designations.data?.map((d) => d.name) ?? [];
  if (form.designation && !options.includes(form.designation)) options.unshift(form.designation);

  function close(o: boolean) {
    if (pending) return;
    onOpenChange(o);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    const salary = parseRupees(form.salary, { allowEmpty: true });
    if (!salary.ok) return setErrors({ fixedSalary: salary.error });
    const onError = (err: unknown) => {
      if (err instanceof ApiError && err.status === 409)
        setErrors({ phone: 'An account with this phone number already exists.' });
      else if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0)
        setErrors(err.fieldErrors);
      else
        setBanner(
          err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
        );
    };
    if (editing) {
      const next: Record<string, unknown> = {};
      if (form.name.trim() !== user.name) next['name'] = form.name.trim();
      if (form.role && form.role !== user.role) next['role'] = form.role;
      if (form.designation && form.designation !== user.designation)
        next['designation'] = form.designation;
      if (form.attendanceType && form.attendanceType !== user.attendanceType)
        next['attendanceType'] = form.attendanceType;
      if (user.fixedSalary !== undefined && salary.value !== user.fixedSalary)
        next['fixedSalary'] = salary.value;
      if (form.name.trim() === '') return setErrors({ name: FRIENDLY['name']! });
      if (Object.keys(next).length === 0) return onOpenChange(false);
      setErrors({});
      update.mutate(next, {
        onSuccess: () => {
          toast.success('Employee updated');
          onOpenChange(false);
        },
        onError,
      });
      return;
    }
    const parsed = createUserBodySchema.safeParse({
      name: form.name,
      phone: form.phone,
      role: form.role || undefined,
      designation: form.designation || undefined,
      attendanceType: form.attendanceType || undefined,
      fixedSalary: salary.value,
      ...(form.createLogin && form.password ? { password: form.password } : {}),
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = String(i.path[0] ?? '');
        next[k] ||= k === 'password' ? i.message : (FRIENDLY[k] ?? i.message);
      }
      return setErrors(next);
    }
    if (form.createLogin && !form.password)
      return setErrors({
        password: 'Set a password of at least 8 characters, or untick “Create a login”.',
      });
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: (u) => {
        toast.success(`${u.name} added`);
        onOpenChange(false);
      },
      onError,
    });
  }

  const err = (k: string) => errors[k] && <p className="text-danger mt-1 text-xs">{errors[k]}</p>;

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <form onSubmit={submit} noValidate className="flex min-h-full flex-col">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit employee' : 'Add employee'}</SheetTitle>
            <SheetDescription>
              {editing
                ? `${formatPhone(user.phone)} · the phone number can’t be changed.`
                : 'They can sign in with their phone number and password.'}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-4">
            {banner && (
              <p role="alert" className="bg-danger-soft text-danger rounded-md p-3 text-sm">
                {banner}
              </p>
            )}
            <div>
              <Label htmlFor="emp-name">Name *</Label>
              <Input
                id="emp-name"
                value={form.name}
                maxLength={120}
                autoComplete="off"
                aria-invalid={!!errors['name']}
                onChange={(e) => set('name', e.target.value)}
              />
              {err('name')}
            </div>
            {!editing && (
              <div>
                <Label htmlFor="emp-phone">Phone *</Label>
                <Input
                  id="emp-phone"
                  inputMode="tel"
                  placeholder="10-digit mobile"
                  autoComplete="off"
                  value={form.phone}
                  aria-invalid={!!errors['phone']}
                  onChange={(e) => set('phone', e.target.value)}
                />
                {err('phone')}
              </div>
            )}
            <div>
              <Label htmlFor="emp-role">Role *</Label>
              <Select value={form.role} onValueChange={(v) => set('role', v as StaffRole)}>
                <SelectTrigger id="emp-role" className="w-full" aria-invalid={!!errors['role']}>
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {err('role')}
              {me?.role === 'HR' && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Admin and HR accounts can only be managed by an Admin.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="emp-desig">Designation *</Label>
              <Select
                value={form.designation}
                onValueChange={(v) => set('designation', v)}
                disabled={designations.isPending}
              >
                <SelectTrigger
                  id="emp-desig"
                  className="w-full"
                  aria-invalid={!!errors['designation']}
                >
                  <SelectValue
                    placeholder={designations.isPending ? 'Loading…' : 'Choose a designation'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {options.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {err('designation')}
            </div>
            <div>
              <Label htmlFor="emp-att">Attendance *</Label>
              <Select
                value={form.attendanceType}
                onValueChange={(v) => set('attendanceType', v as AttendanceType)}
              >
                <SelectTrigger
                  id="emp-att"
                  className="w-full"
                  aria-invalid={!!errors['attendanceType']}
                >
                  <SelectValue placeholder="How is attendance tracked?" />
                </SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ATTENDANCE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {err('attendanceType')}
              <p className="text-muted-foreground mt-1 text-xs">
                GPS: checks in from the phone app. Biometric: punches are entered by HR (simulated
                for now).
              </p>
            </div>
            {(!editing || user.fixedSalary !== undefined) && (
              <div>
                <Label htmlFor="emp-salary">Fixed monthly salary (₹)</Label>
                <Input
                  id="emp-salary"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.salary}
                  aria-invalid={!!errors['fixedSalary']}
                  onChange={(e) => set('salary', e.target.value)}
                />
                {err('fixedSalary')}
              </div>
            )}
            {!editing && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="emp-login"
                    checked={form.createLogin}
                    onCheckedChange={(c) => set('createLogin', c === true)}
                  />
                  <Label htmlFor="emp-login">Create a login</Label>
                </div>
                {form.createLogin ? (
                  <div>
                    <Label htmlFor="emp-pass">Password</Label>
                    <Input
                      id="emp-pass"
                      type="password"
                      autoComplete="new-password"
                      value={form.password}
                      aria-invalid={!!errors['password']}
                      onChange={(e) => set('password', e.target.value)}
                    />
                    {err('password')}
                    <p className="text-muted-foreground mt-1 text-xs">
                      At least 8 characters. Share it with them yourself; it can be reset later.
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    No login: for floor staff tracked only by biometric. You can give them one later
                    with “Create login”.
                  </p>
                )}
              </div>
            )}
          </div>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : editing ? 'Save changes' : 'Add employee'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
