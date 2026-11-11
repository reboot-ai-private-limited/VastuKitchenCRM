'use client';

import type { PostVisibility, SaveResultDto } from '@vastu/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api/client';
import { useFolders, useSaveFromPhotos } from '@/lib/api/docs';
import { MAX_SAVE_BATCH, folderOptions, saveSummary } from '@/lib/docs';
import { cn } from '@/lib/utils';

/** One photo that can be saved: the stored image's id (`ImageDto.publicId`) and its thumbnail for the picker. */
export interface SavablePhoto {
  publicId: string;
  /** `ImageDto.thumbUrl` */
  thumbUrl: string;
  /** Optional file name in Docs; the server uses a dated default otherwise. */
  name?: string;
}

export interface SaveToDocsDialogProps {
  projectId: string;
  /** The photos on offer: every photo of the post, comment or to-do the person clicked "Save to Docs" on. */
  photos: SavablePhoto[];
  /**
   * The source's visibility: a photo from a Client post/comment defaults to "Shared with client", from a Team
   * one to "Team only". The person can change it. Default `TEAM`.
   */
  sourceVisibility?: PostVisibility;
  /** A customer has no folders and everything they save is shared: the pickers are hidden. */
  isCustomer?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save, e.g. to leave "select photos" mode. */
  onSaved?: (result: SaveResultDto) => void;
}

const TOP = '__top__';

/**
 * "Save to Docs": pick up to 20 photos, a folder and who sees them. Nothing is uploaded again: the document
 * points at the same stored image, and saving a photo twice reports "already in Docs". The body is mounted
 * only while open, so each opening starts fresh from `photos`.
 */
export function SaveToDocsDialog(props: SaveToDocsDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {props.open && <Body {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  projectId,
  photos,
  sourceVisibility = 'TEAM',
  isCustomer = false,
  onOpenChange,
  onSaved,
}: SaveToDocsDialogProps) {
  const folders = useFolders(projectId, !isCustomer);
  const save = useSaveFromPhotos(projectId);
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(photos.slice(0, MAX_SAVE_BATCH).map((p) => p.publicId)),
  );
  const [folder, setFolder] = useState(TOP);
  const [visibility, setVisibility] = useState<PostVisibility>(
    isCustomer ? 'CLIENT' : sourceVisibility,
  );
  const [error, setError] = useState<string | null>(null);
  const options = folderOptions(folders.data ?? []);

  const toggle = (id: string, on: boolean) =>
    setChosen((cur) => {
      const next = new Set(cur);
      if (!on) next.delete(id);
      else if (next.size < MAX_SAVE_BATCH) next.add(id);
      return next;
    });

  function submit() {
    setError(null);
    const items = photos
      .filter((p) => chosen.has(p.publicId))
      .map((p) => ({ publicId: p.publicId, ...(p.name ? { name: p.name } : {}) }));
    save.mutate(
      { items, ...(folder !== TOP && !isCustomer ? { folderId: folder } : {}), visibility },
      {
        onSuccess: (result) => {
          toast.success(saveSummary(result));
          onSaved?.(result);
          onOpenChange(false);
        },
        onError: (e) =>
          setError(e instanceof ApiError ? e.message : 'Couldn’t save to Docs. Please try again.'),
      },
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Save to Docs</DialogTitle>
        <DialogDescription>
          The photos stay where they are and also appear in Docs. Up to {MAX_SAVE_BATCH} at a time.
        </DialogDescription>
      </DialogHeader>

      <fieldset className="space-y-2">
        <legend className="text-muted-foreground mb-1 text-xs font-semibold">
          {chosen.size} of {photos.length} selected
        </legend>
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {photos.map((p, i) => {
            const on = chosen.has(p.publicId);
            return (
              <li
                key={p.publicId}
                className={cn(
                  'relative aspect-square overflow-hidden rounded-md border',
                  on && 'ring-primary ring-2',
                )}
              >
                <Label htmlFor={`sd-${p.publicId}`} className="block size-full cursor-pointer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.thumbUrl}
                    alt={`Photo ${i + 1}`}
                    loading="lazy"
                    className={cn('size-full object-cover', !on && 'opacity-60')}
                  />
                </Label>
                <Checkbox
                  id={`sd-${p.publicId}`}
                  checked={on}
                  disabled={!on && chosen.size >= MAX_SAVE_BATCH}
                  onCheckedChange={(c) => toggle(p.publicId, c === true)}
                  className="bg-card absolute top-1 left-1"
                  aria-label={`Select photo ${i + 1}`}
                />
              </li>
            );
          })}
        </ul>
        {photos.length > MAX_SAVE_BATCH && (
          <p className="text-muted-foreground text-xs">
            Only {MAX_SAVE_BATCH} can be saved at once; save the rest in a second go.
          </p>
        )}
      </fieldset>

      {!isCustomer && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sd-folder">Save into</Label>
            <Select value={folder} onValueChange={setFolder} disabled={folders.isPending}>
              <SelectTrigger id="sd-folder" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.id ?? TOP} value={o.id ?? TOP}>
                    {'— '.repeat(o.depth)}
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sd-vis">Who can see them</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as PostVisibility)}>
              <SelectTrigger id="sd-vis" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEAM">Team only</SelectItem>
                <SelectItem value="CLIENT">Shared with client</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={chosen.size === 0 || save.isPending}>
          {save.isPending
            ? 'Saving…'
            : `Save ${chosen.size} ${chosen.size === 1 ? 'photo' : 'photos'}`}
        </Button>
      </DialogFooter>
    </>
  );
}
