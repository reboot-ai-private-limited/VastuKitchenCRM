'use client';

import type { DocFileDto, FolderDto } from '@vastu/contracts';
import {
  Download,
  File as FileIcon,
  FileText,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api/client';
import { useDeleteFile, useUpdateFile } from '@/lib/api/docs';
import { folderOptions, formatBytes } from '@/lib/docs';
import { formatDate, relativeAge } from '@/lib/format';

const fail = (e: unknown, fallback: string) =>
  toast.error(e instanceof ApiError ? e.message : fallback);
const TOP = '__top__';

/** A file row: thumbnail or icon, name, who/when, the Shared switch (team), and a menu. */
export function FileRow({
  projectId,
  file,
  folders,
  isCustomer,
  showFolder,
}: {
  projectId: string;
  file: DocFileDto;
  folders: FolderDto[];
  isCustomer: boolean;
  /** Search results span folders: say where the file lives. */
  showFolder?: string | null;
}) {
  const update = useUpdateFile(projectId);
  const del = useDeleteFile(projectId);
  const [dialog, setDialog] = useState<'rename' | 'move' | 'delete' | null>(null);
  const shared = file.visibility === 'CLIENT';

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {file.thumbUrl ? (
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${file.name}`}
          className="bg-muted size-11 shrink-0 overflow-hidden rounded-md border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
        </a>
      ) : (
        <span
          className="bg-secondary text-muted-foreground grid size-11 shrink-0 place-items-center rounded-md border"
          aria-hidden
        >
          {file.format === 'pdf' ? (
            <FileText className="size-5" />
          ) : (
            <FileIcon className="size-5" />
          )}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate font-semibold hover:underline"
        >
          {file.name}
        </a>
        <p className="text-muted-foreground truncate text-xs">
          {[
            file.format?.toUpperCase(),
            formatBytes(file.bytes),
            file.uploadedBy?.name,
            relativeAge(file.createdAt),
            showFolder,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      {!isCustomer && (
        <label className="flex shrink-0 items-center gap-2 text-xs">
          <Switch
            checked={shared}
            disabled={update.isPending}
            aria-label={`Shared with client: ${file.name}`}
            onCheckedChange={(on) =>
              update.mutate(
                { id: file.id, visibility: on ? 'CLIENT' : 'TEAM' },
                { onError: (e) => fail(e, 'Couldn’t change sharing.') },
              )
            }
          />
          <span className={shared ? 'text-success font-medium' : 'text-muted-foreground'}>
            {shared ? 'Shared' : 'Team only'}
          </span>
        </label>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${file.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href={file.downloadUrl}>
              <Download /> Download
            </a>
          </DropdownMenuItem>
          {file.canDelete && !isCustomer && (
            <DropdownMenuItem onSelect={() => setDialog('rename')}>
              <Pencil /> Rename…
            </DropdownMenuItem>
          )}
          {file.canDelete && !isCustomer && (
            <DropdownMenuItem onSelect={() => setDialog('move')}>
              <FolderInput /> Move…
            </DropdownMenuItem>
          )}
          {file.canDelete && <DropdownMenuSeparator />}
          {file.canDelete && (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog('delete')}>
              <Trash2 /> Delete…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'rename' && (
        <RenameFile projectId={projectId} file={file} onClose={() => setDialog(null)} />
      )}
      {dialog === 'move' && (
        <MoveFile
          projectId={projectId}
          file={file}
          folders={folders}
          onClose={() => setDialog(null)}
        />
      )}
      <Dialog
        open={dialog === 'delete'}
        onOpenChange={(o) => !del.isPending && !o && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this file?</DialogTitle>
            <DialogDescription>
              {file.name} is removed for everyone. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={del.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() =>
                del.mutate(file.id, {
                  onSuccess: () => {
                    setDialog(null);
                    toast.success('File deleted');
                  },
                  onError: (e) => {
                    setDialog(null);
                    fail(e, 'Couldn’t delete.');
                  },
                })
              }
            >
              {del.isPending ? 'Deleting…' : 'Delete file'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function RenameFile({
  projectId,
  file,
  onClose,
}: {
  projectId: string;
  file: DocFileDto;
  onClose: () => void;
}) {
  const update = useUpdateFile(projectId);
  const [name, setName] = useState(file.name);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename file</DialogTitle>
          <DialogDescription>Added {formatDate(file.createdAt)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="rn-file">Name</Label>
          <Input
            id="rn-file"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            disabled={update.isPending || name.trim() === '' || name.trim() === file.name}
            onClick={() =>
              update.mutate(
                { id: file.id, name: name.trim() },
                {
                  onSuccess: onClose,
                  onError: (e) => setError(e instanceof ApiError ? e.message : 'Couldn’t rename.'),
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

function MoveFile({
  projectId,
  file,
  folders,
  onClose,
}: {
  projectId: string;
  file: DocFileDto;
  folders: FolderDto[];
  onClose: () => void;
}) {
  const update = useUpdateFile(projectId);
  const [dest, setDest] = useState(file.folderId ?? TOP);
  const [error, setError] = useState<string | null>(null);
  const options = folderOptions(folders);
  return (
    <Dialog open onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move file</DialogTitle>
          <DialogDescription>{file.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="mv-file">Move to</Label>
          <Select value={dest} onValueChange={setDest}>
            <SelectTrigger id="mv-file" className="w-full">
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
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            disabled={update.isPending || dest === (file.folderId ?? TOP)}
            onClick={() =>
              update.mutate(
                { id: file.id, folderId: dest === TOP ? null : dest },
                {
                  onSuccess: () => {
                    toast.success('File moved');
                    onClose();
                  },
                  onError: (e) => setError(e instanceof ApiError ? e.message : 'Couldn’t move.'),
                },
              )
            }
          >
            {update.isPending ? 'Moving…' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
