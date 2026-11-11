'use client';

import type { ProjectDto } from '@vastu/contracts';
import { Copy, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { copyLink } from '@/components/proposals/send-flow';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import {
  useCloseProject,
  useInviteCustomer,
  useSetMembers,
  useStaffUsers,
  useUpdateProject,
} from '@/lib/api/projects';
import { formatDate } from '@/lib/format';
import { formatPhone, whatsappUrl } from '@/lib/leads';

const message = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
const Err = ({ text }: { text: string | null }) =>
  text ? (
    <p role="alert" className="text-danger text-sm">
      {text}
    </p>
  ) : null;

export function EditProjectDialog({
  project,
  onClose,
}: {
  project: ProjectDto;
  onClose: () => void;
}) {
  const update = useUpdateProject(project.id);
  const [name, setName] = useState(project.name);
  const [site, setSite] = useState(project.siteAddress ?? '');
  const [value, setValue] = useState(project.value != null ? String(project.value) : '');
  const [error, setError] = useState<string | null>(null);
  const num = value.trim() === '' ? null : Number(value.replace(/,/g, ''));
  const bad = num !== null && (!Number.isInteger(num) || num < 0);
  const ok = name.trim() !== '' && !bad;

  return (
    <Dialog open onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>{project.customer.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Name</Label>
            <Input
              id="ep-name"
              value={name}
              maxLength={160}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-site">Site address</Label>
            <Input
              id="ep-site"
              value={site}
              maxLength={500}
              onChange={(e) => setSite(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-value">Value (₹)</Label>
            <Input
              id="ep-value"
              inputMode="numeric"
              value={value}
              aria-invalid={bad}
              onChange={(e) => setValue(e.target.value)}
            />
            {bad && <p className="text-danger text-xs">Enter whole rupees.</p>}
          </div>
        </div>
        <Err text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!ok || update.isPending}
            onClick={() =>
              update.mutate(
                { name: name.trim(), siteAddress: site.trim() || null, value: num },
                {
                  onSuccess: () => {
                    toast.success('Project updated');
                    onClose();
                  },
                  onError: (e) => setError(message(e)),
                },
              )
            }
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const NONE = '__none__';

export function MembersDialog({ project, onClose }: { project: ProjectDto; onClose: () => void }) {
  const staff = useStaffUsers(true);
  const set = useSetMembers(project.id);
  const [ids, setIds] = useState<Set<string>>(() => new Set(project.members.map((m) => m.id)));
  const [designerId, setDesignerId] = useState(project.designer?.id ?? NONE);
  const [error, setError] = useState<string | null>(null);
  const people = (staff.data?.items ?? []).filter((u) => u.role !== 'CUSTOMER');
  const chosen = people.filter((u) => ids.has(u.id));

  const toggle = (id: string, on: boolean) =>
    setIds((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Dialog open onOpenChange={(o) => !o && !set.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project team</DialogTitle>
          <DialogDescription>
            Staff who can open this project. The designer is added automatically.
          </DialogDescription>
        </DialogHeader>
        {staff.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : staff.isError ? (
          <p className="text-danger text-sm">Couldn’t load the staff list.</p>
        ) : (
          <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
            {people.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-3 py-2">
                <Checkbox
                  id={`m-${u.id}`}
                  checked={ids.has(u.id)}
                  onCheckedChange={(c) => toggle(u.id, c === true)}
                />
                <Label htmlFor={`m-${u.id}`} className="flex-1 cursor-pointer font-normal">
                  <span className="font-medium">{u.name}</span>{' '}
                  <span className="text-muted-foreground text-xs">
                    {u.designation ?? u.role.toLowerCase()}
                  </span>
                </Label>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="designer">Designer</Label>
          <Select value={designerId} onValueChange={setDesignerId}>
            <SelectTrigger id="designer" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No designer</SelectItem>
              {people
                .filter((u) => u.role === 'DESIGNER' || ids.has(u.id))
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <Err text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={set.isPending}>
            Cancel
          </Button>
          <Button
            disabled={set.isPending || staff.isPending}
            onClick={() =>
              set.mutate(
                {
                  memberIds: chosen.map((u) => u.id),
                  designerId: designerId === NONE ? null : designerId,
                },
                {
                  onSuccess: () => {
                    toast.success('Team updated');
                    onClose();
                  },
                  onError: (e) => setError(message(e)),
                },
              )
            }
          >
            {set.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Closing needs a Final Delivery post with photos; if there is none the API says so and we offer to write it. */
export function CloseDialog({
  project,
  onClose,
  onNeedFinalDelivery,
}: {
  project: ProjectDto;
  onClose: () => void;
  onNeedFinalDelivery: () => void;
}) {
  const close = useCloseProject(project.id);
  const [needPost, setNeedPost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && !close.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close this project?</DialogTitle>
          <DialogDescription>
            Closing marks the deal done. It needs a Final Delivery post with photos, and a closed
            project takes no new posts. You can reopen it later.
          </DialogDescription>
        </DialogHeader>
        {needPost && (
          <p className="bg-warning-soft text-warning rounded-md p-3 text-sm">
            There’s no Final Delivery post yet. Post one with photos first, then close.
          </p>
        )}
        <Err text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={close.isPending}>
            Cancel
          </Button>
          {needPost ? (
            <Button
              onClick={() => {
                onClose();
                onNeedFinalDelivery();
              }}
            >
              Write the final delivery post
            </Button>
          ) : (
            <Button
              disabled={close.isPending}
              onClick={() =>
                close.mutate(undefined, {
                  onSuccess: () => {
                    toast.success('Project closed');
                    onClose();
                  },
                  onError: (e) => {
                    if (e instanceof ApiError && e.status === 409) setNeedPost(true);
                    else setError(message(e));
                  },
                })
              }
            >
              {close.isPending ? 'Closing…' : 'Close project'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Each press makes a NEW one-time link, so it is an explicit button, never automatic. */
export function InviteDialog({ project, onClose }: { project: ProjectDto; onClose: () => void }) {
  const invite = useInviteCustomer();
  const link = invite.data;
  const text = link
    ? `Hello ${project.customer.name}, here is your Vaastu Kitchen sign-in link to follow your project: ${link.url}`
    : '';
  return (
    <Dialog open onOpenChange={(o) => !o && !invite.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite {project.customer.name}</DialogTitle>
          <DialogDescription>
            A one-time link that signs the customer in to see their project.{' '}
            {formatPhone(project.customer.phone)}
          </DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="space-y-2">
            <p className="bg-secondary tabular rounded-md p-2.5 text-xs break-all">{link.url}</p>
            <p className="text-muted-foreground text-xs">
              Valid until {formatDate(link.expiresAt)}. Creating another link makes a new one.
            </p>
          </div>
        ) : null}
        <Err text={invite.isError ? message(invite.error) : null} />
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {link ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void copyLink(link.url)}>
                <Copy /> Copy link
              </Button>
              <Button asChild>
                <a
                  href={`${whatsappUrl(project.customer.phone)}?text=${encodeURIComponent(text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle /> WhatsApp
                </a>
              </Button>
            </div>
          ) : (
            <Button disabled={invite.isPending} onClick={() => invite.mutate(project.customer.id)}>
              {invite.isPending ? 'Creating…' : 'Create sign-in link'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
