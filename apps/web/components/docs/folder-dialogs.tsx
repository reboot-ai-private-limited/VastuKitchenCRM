'use client';

import type { FolderDto } from '@vastu/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { ApiError } from '@/lib/api/client';
import { useCreateFolder, useDeleteFolder, useUpdateFolder } from '@/lib/api/docs';
import { MAX_FOLDER_DEPTH, folderDepth, folderOptions, subtreeHeight } from '@/lib/docs';

const TOP = '__top__';
const msg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const Err = ({ text }: { text: string | null }) =>
  text ? (
    <p role="alert" className="text-danger text-sm">
      {text}
    </p>
  ) : null;

/** New folder inside `parent` (null = top level). Duplicate names and the depth cap come back as the API's message. */
export function NewFolderDialog({
  projectId,
  folders,
  parent,
  onClose,
  onCreated,
}: {
  projectId: string;
  folders: FolderDto[];
  parent: string | null;
  onClose: () => void;
  onCreated: (f: FolderDto) => void;
}) {
  const create = useCreateFolder(projectId);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tooDeep = parent !== null && folderDepth(folders, parent) >= MAX_FOLDER_DEPTH;
  return (
    <Dialog open onOpenChange={(o) => !o && !create.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>
            {tooDeep
              ? `Folders can only go ${MAX_FOLDER_DEPTH} levels deep.`
              : 'Names must be unique within a folder.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && !tooDeep)
              create.mutate(
                { name: name.trim(), ...(parent ? { parentId: parent } : {}) },
                {
                  onSuccess: (f) => {
                    toast.success('Folder created');
                    onCreated(f);
                    onClose();
                  },
                  onError: (er) => setError(msg(er, 'Couldn’t create the folder.')),
                },
              );
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="nf-name">Name</Label>
            <Input
              id="nf-name"
              autoFocus
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Err text={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || name.trim() === '' || tooDeep}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Rename and/or move. A folder can't go into itself or its own subtree, nor deeper than the cap. */
export function EditFolderDialog({
  projectId,
  folders,
  folder,
  onClose,
}: {
  projectId: string;
  folders: FolderDto[];
  folder: FolderDto;
  onClose: () => void;
}) {
  const update = useUpdateFolder(projectId);
  const [name, setName] = useState(folder.name);
  const [dest, setDest] = useState(folder.parentId ?? TOP);
  const [error, setError] = useState<string | null>(null);
  const options = folderOptions(folders, {
    blockedId: folder.id,
    extraDepth: 1 + subtreeHeight(folders, folder.id),
  });
  const unchanged = name.trim() === folder.name && dest === (folder.parentId ?? TOP);
  return (
    <Dialog open onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit folder</DialogTitle>
          <DialogDescription>{folder.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ef-name">Name</Label>
            <Input
              id="ef-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ef-dest">Inside</Label>
            <Select value={dest} onValueChange={setDest}>
              <SelectTrigger id="ef-dest" className="w-full">
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
        </div>
        <Err text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            disabled={update.isPending || name.trim() === '' || unchanged}
            onClick={() =>
              update.mutate(
                {
                  id: folder.id,
                  ...(name.trim() !== folder.name ? { name: name.trim() } : {}),
                  ...(dest !== (folder.parentId ?? TOP)
                    ? { parentId: dest === TOP ? null : dest }
                    : {}),
                },
                {
                  onSuccess: () => {
                    toast.success('Folder updated');
                    onClose();
                  },
                  onError: (e) => setError(msg(e, 'Couldn’t update the folder.')),
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

/** Only an empty folder can be deleted; the API says so otherwise. */
export function DeleteFolderDialog({
  projectId,
  folder,
  onClose,
  onDeleted,
}: {
  projectId: string;
  folder: FolderDto;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const del = useDeleteFolder(projectId);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && !del.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{folder.name}”?</DialogTitle>
          <DialogDescription>
            A folder can only be deleted when it is empty (no files and no subfolders).
          </DialogDescription>
        </DialogHeader>
        <Err text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={del.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={del.isPending}
            onClick={() =>
              del.mutate(folder.id, {
                onSuccess: () => {
                  toast.success('Folder deleted');
                  onDeleted();
                  onClose();
                },
                onError: (e) => setError(msg(e, 'Couldn’t delete the folder.')),
              })
            }
          >
            {del.isPending ? 'Deleting…' : 'Delete folder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
