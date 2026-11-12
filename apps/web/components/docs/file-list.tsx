'use client';

import type { DocFileDto, FolderDto } from '@vastu/contracts';
import {
  Download,
  ExternalLink,
  EyeOff,
  File as FileIcon,
  FileText,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Share2,
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
import { ApiError } from '@/lib/api/client';
import { useDeleteFile, useUpdateFile } from '@/lib/api/docs';
import { folderOptions, formatBytes } from '@/lib/docs';
import { formatDate, relativeAge } from '@/lib/format';
import { cn } from '@/lib/utils';

const fail = (e: unknown, fallback: string) =>
  toast.error(e instanceof ApiError ? e.message : fallback);
const TOP = '__top__';

/** What a file with no preview looks like: its extension on a quiet tile. */
function TypeTile({ file }: { file: DocFileDto }) {
  const ext = (file.format ?? file.name.split('.').pop() ?? '').slice(0, 5).toUpperCase();
  return (
    <span className="bg-secondary text-muted-foreground flex size-full flex-col items-center justify-center gap-1.5">
      {file.format === 'pdf' ? <FileText className="size-9" /> : <FileIcon className="size-9" />}
      {ext && <span className="text-xs font-semibold tracking-wide">{ext}</span>}
    </span>
  );
}

/**
 * A file as a gallery card: a big preview (photo, or a PDF's first page), the name and details, a
 * Team only / Shared chip and a menu. Clicking the preview opens the viewer.
 */
export function FileCard({
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
  const [dialog, setDialog] = useState<'rename' | 'move' | 'delete' | 'view' | null>(null);
  const shared = file.visibility === 'CLIENT';

  return (
    <li className="bg-card shadow-card group relative overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setDialog('view')}
        aria-label={`Open ${file.name}`}
        className="focus-visible:ring-ring bg-muted block aspect-4/3 w-full overflow-hidden outline-none focus-visible:ring-2"
      >
        {file.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.thumbUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <TypeTile file={file} />
        )}
      </button>
      {!isCustomer && (
        <span
          className={cn(
            'absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur',
            shared ? 'bg-success-soft/90 text-success' : 'bg-background/80 text-muted-foreground',
          )}
        >
          {shared ? 'Shared' : 'Team only'}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label={`Actions for ${file.name}`}
            className="absolute top-2 right-2 opacity-90 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href={file.downloadUrl}>
              <Download /> Download
            </a>
          </DropdownMenuItem>
          {!isCustomer && (
            <DropdownMenuItem
              disabled={update.isPending}
              onSelect={() =>
                update.mutate(
                  { id: file.id, visibility: shared ? 'TEAM' : 'CLIENT' },
                  { onError: (e) => fail(e, 'Couldn’t change sharing.') },
                )
              }
            >
              {shared ? <EyeOff /> : <Share2 />}
              {shared ? 'Make team only' : 'Share with client'}
            </DropdownMenuItem>
          )}
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
      <div className="min-w-0 space-y-0.5 px-3 py-2.5">
        <p className="truncate text-sm font-semibold" title={file.name}>
          {file.name}
        </p>
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

      {dialog === 'view' && <FileViewer file={file} onClose={() => setDialog(null)} />}
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

/** The big view: the photo or a PDF's first page, with Open and Download. */
function FileViewer({ file, onClose }: { file: DocFileDto; onClose: () => void }) {
  const picture = file.previewUrl ?? file.thumbUrl;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{file.name}</DialogTitle>
          <DialogDescription>
            {[file.format?.toUpperCase(), formatBytes(file.bytes), file.uploadedBy?.name]
              .filter(Boolean)
              .join(' · ')}
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted grid min-h-48 place-items-center overflow-hidden rounded-lg border">
          {picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picture} alt={file.name} className="max-h-[65dvh] w-auto max-w-full" />
          ) : (
            <div className="size-48">
              <TypeTile file={file} />
            </div>
          )}
        </div>
        {file.format === 'pdf' && (
          <p className="text-muted-foreground text-xs">Showing the first page.</p>
        )}
        <DialogFooter>
          <Button variant="outline" asChild>
            <a href={file.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Open
            </a>
          </Button>
          <Button asChild>
            <a href={file.downloadUrl}>
              <Download /> Download
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
