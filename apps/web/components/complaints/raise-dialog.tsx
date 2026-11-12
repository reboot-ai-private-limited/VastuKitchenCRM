'use client';

import { MAX_COMPLAINT_IMAGES } from '@vastu/contracts';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { PhotoAttach } from '@/components/projects/photos';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { signRaiseUpload, useProjectOptions, useRaiseComplaint } from '@/lib/api/complaints';
import { useComplaintUploader } from './use-complaint-uploader';

/** Which project it is about matters: a customer with two kitchens has to say which one. */
export function RaiseDialog({
  open,
  onOpenChange,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultProjectId?: string | null;
}) {
  const router = useRouter();
  const projects = useProjectOptions(open);
  const [picked, setPicked] = useState<string>('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const raise = useRaiseComplaint();
  const items = projects.data?.items ?? [];
  // One project: no need to ask. Otherwise the person chooses (or the list's project filter pre-picks it).
  const projectId =
    picked ||
    (defaultProjectId && items.some((p) => p.id === defaultProjectId)
      ? defaultProjectId
      : items.length === 1
        ? items[0]!.id
        : '');
  const up = useComplaintUploader(() => signRaiseUpload(projectId), MAX_COMPLAINT_IMAGES);
  const sent = useRef(false);
  const ready = projectId !== '' && description.trim() !== '' && !up.busy;

  function close(o: boolean) {
    if (raise.isPending) return;
    if (!o) {
      setPicked('');
      setDescription('');
      setError(null);
      if (sent.current) up.reset();
      else up.discard();
      sent.current = false;
    }
    onOpenChange(o);
  }

  function submit() {
    setError(null);
    raise.mutate(
      {
        projectId,
        description: description.trim(),
        ...(up.images.length ? { images: up.images } : {}),
      },
      {
        onSuccess: (c) => {
          toast.success('Complaint raised');
          sent.current = true;
          close(false);
          router.push(`/complaints/${c.id}`);
        },
        onError: (e) =>
          setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Raise a complaint</DialogTitle>
          <DialogDescription>
            Describe what is wrong. Photos help the technician come prepared.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rc-project">Project</Label>
            <Select value={projectId} onValueChange={setPicked} disabled={projects.isPending}>
              <SelectTrigger id="rc-project" className="w-full">
                <SelectValue
                  placeholder={projects.isPending ? 'Loading…' : 'Which project is it about?'}
                />
              </SelectTrigger>
              <SelectContent>
                {items.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projects.isError && (
              <p className="text-danger text-xs">Couldn’t load your projects.</p>
            )}
            {projects.isSuccess && items.length === 0 && (
              <p className="text-muted-foreground text-xs">
                There are no projects to raise a complaint about.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rc-desc">What is the problem?</Label>
            <Textarea
              id="rc-desc"
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <PhotoAttach
            items={up.items}
            problem={up.problem}
            max={MAX_COMPLAINT_IMAGES}
            onAdd={up.add}
            onRemove={up.remove}
            onRetry={up.retry}
          />
          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={raise.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!ready || raise.isPending}>
            {raise.isPending ? 'Raising…' : up.busy ? 'Uploading…' : 'Raise complaint'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
