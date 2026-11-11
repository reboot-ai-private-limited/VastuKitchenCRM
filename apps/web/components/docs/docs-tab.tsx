'use client';

import type { FolderDto } from '@vastu/contracts';
import {
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  Home,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useFiles, useFolders } from '@/lib/api/docs';
import { breadcrumb, folderOptions, sortFiles } from '@/lib/docs';
import { cn } from '@/lib/utils';
import { FileRow } from './file-list';
import { DeleteFolderDialog, EditFolderDialog, NewFolderDialog } from './folder-dialogs';
import { UploadButton, UploadZone } from './upload-zone';
import { useDocUploader } from './use-doc-uploader';

export interface DocsTabProps {
  projectId: string;
  /** Docs stay usable on a closed project (the API doesn't block them); this only adds a note. */
  closed?: boolean;
  /** Reserved for the team view: Admin can delete any file (the API already says per file via `canDelete`). */
  isAdmin?: boolean;
  /** The customer sees one flat list of shared files and uploads are always shared, top level. */
  isCustomer: boolean;
}

export function DocsTab({ projectId, closed, isCustomer }: DocsTabProps) {
  return (
    <div className="space-y-4">
      {closed && (
        <p className="bg-neutral-soft text-neutral rounded-lg p-3 text-sm">
          This project is closed. Documents are still available.
        </p>
      )}
      {isCustomer ? <CustomerDocs projectId={projectId} /> : <TeamDocs projectId={projectId} />}
    </div>
  );
}

const Panel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-card shadow-card overflow-hidden rounded-xl border', className)}>
    {children}
  </div>
);

const ListSkeleton = () => (
  <div className="space-y-3 p-4" aria-hidden>
    {Array.from({ length: 4 }, (_, i) => (
      <Skeleton key={i} className="h-11 w-full" />
    ))}
  </div>
);

/** Customer: one flat list of the files shared with them, and an upload that is always shared and top level. */
function CustomerDocs({ projectId }: { projectId: string }) {
  const files = useFiles(projectId, { shared: true });
  const up = useDocUploader(projectId, { visibility: 'CLIENT' });
  return (
    <UploadZone
      uploads={up.items}
      problems={up.problems}
      onAdd={up.add}
      onRetry={up.retry}
      onRemove={up.remove}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Files the team has shared with you. You can add your own too.
        </p>
        <UploadButton onAdd={up.add} />
      </div>
      <Panel>
        {files.isPending ? (
          <ListSkeleton />
        ) : files.isError ? (
          <ErrorState error={files.error} onRetry={() => files.refetch()} />
        ) : files.data.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No files yet"
            description="Drop files here or use Upload."
          />
        ) : (
          <ul className="divide-y">
            {sortFiles(files.data).map((f) => (
              <FileRow key={f.id} projectId={projectId} file={f} folders={[]} isCustomer />
            ))}
          </ul>
        )}
      </Panel>
    </UploadZone>
  );
}

type FolderDialog =
  | { kind: 'new'; parent: string | null }
  | { kind: 'edit'; folder: FolderDto }
  | { kind: 'delete'; folder: FolderDto }
  | null;

/** Staff: folders on the left, files on the right, breadcrumb, search, share switch per file. */
function TeamDocs({ projectId }: { projectId: string }) {
  const foldersQ = useFolders(projectId);
  const folders = useMemo(() => foldersQ.data ?? [], [foldersQ.data]);
  const [selected, setSelected] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [shareUploads, setShareUploads] = useState(false);
  const [dialog, setDialog] = useState<FolderDialog>(null);

  // A folder that was deleted or moved away elsewhere simply stops existing: fall back to the top level.
  const current = selected && folders.some((f) => f.id === selected) ? selected : null;
  const search = searchText.trim();
  const files = useFiles(projectId, search ? { search } : { folderId: current ?? 'root' });
  const up = useDocUploader(projectId, {
    ...(current ? { folderId: current } : {}),
    visibility: shareUploads ? 'CLIENT' : 'TEAM',
  });
  const crumbs = breadcrumb(folders, current);
  const tree = folderOptions(folders).slice(1);
  const currentFolder = current ? folders.find((f) => f.id === current) : undefined;
  const folderName = (id: string | null) =>
    id ? (folders.find((f) => f.id === id)?.name ?? null) : 'Top level';

  return (
    <UploadZone
      uploads={up.items}
      problems={up.problems}
      onAdd={up.add}
      onRetry={up.retry}
      onRemove={up.remove}
    >
      <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Panel>
          <div className="flex items-center justify-between border-b px-3 py-2">
            <h2 className="text-sm font-semibold">Folders</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New folder"
              onClick={() => setDialog({ kind: 'new', parent: current })}
            >
              <FolderPlus />
            </Button>
          </div>
          {foldersQ.isPending ? (
            <ListSkeleton />
          ) : foldersQ.isError ? (
            <ErrorState error={foldersQ.error} onRetry={() => foldersQ.refetch()} />
          ) : (
            <nav aria-label="Folders" className="max-h-80 overflow-y-auto p-1.5 lg:max-h-[60dvh]">
              <TreeItem
                label="Top level"
                icon={<Home className="size-4" />}
                depth={0}
                active={current === null && !search}
                onClick={() => {
                  setSelected(null);
                  setSearchText('');
                }}
              />
              {tree.map((o) => {
                const f = folders.find((x) => x.id === o.id)!;
                return (
                  <TreeItem
                    key={f.id}
                    label={f.name}
                    count={f.fileCount}
                    icon={<Folder className="size-4" />}
                    depth={o.depth}
                    active={current === f.id && !search}
                    onClick={() => {
                      setSelected(f.id);
                      setSearchText('');
                    }}
                  />
                );
              })}
            </nav>
          )}
        </Panel>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-44 flex-1 sm:max-w-xs">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                type="search"
                aria-label="Search files"
                placeholder="Search all files"
                className="pl-8"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="docs-share"
                checked={shareUploads}
                onCheckedChange={(c) => setShareUploads(c === true)}
              />
              <Label htmlFor="docs-share" className="font-normal">
                Share new uploads with client
              </Label>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" onClick={() => setDialog({ kind: 'new', parent: current })}>
                <FolderPlus /> New folder
              </Button>
              <UploadButton onAdd={up.add} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 text-sm" aria-label="Breadcrumb">
            {search ? (
              <span className="text-muted-foreground">
                Results for “{search}” across all folders
              </span>
            ) : (
              <>
                <button type="button" className="hover:underline" onClick={() => setSelected(null)}>
                  Top level
                </button>
                {crumbs.map((c, i) => (
                  <span key={c.id} className="flex items-center gap-1">
                    <ChevronRight className="text-muted-foreground size-3.5" aria-hidden />
                    {i === crumbs.length - 1 ? (
                      <span className="font-semibold" aria-current="page">
                        {c.name}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="hover:underline"
                        onClick={() => setSelected(c.id)}
                      >
                        {c.name}
                      </button>
                    )}
                  </span>
                ))}
                {currentFolder && (
                  <span className="ml-auto flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDialog({ kind: 'edit', folder: currentFolder })}
                    >
                      <Pencil /> Rename or move
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      onClick={() => setDialog({ kind: 'delete', folder: currentFolder })}
                    >
                      <Trash2 /> Delete
                    </Button>
                  </span>
                )}
              </>
            )}
          </div>

          <Panel>
            {files.isPending ? (
              <ListSkeleton />
            ) : files.isError ? (
              <ErrorState error={files.error} onRetry={() => files.refetch()} />
            ) : files.data.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={search ? 'No files match' : 'No files here'}
                description={
                  search
                    ? 'Try a different name.'
                    : 'Drop files anywhere on this page, or use Upload.'
                }
              />
            ) : (
              <ul className="divide-y">
                {sortFiles(files.data).map((f) => (
                  <FileRow
                    key={f.id}
                    projectId={projectId}
                    file={f}
                    folders={folders}
                    isCustomer={false}
                    showFolder={search ? folderName(f.folderId) : undefined}
                  />
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {dialog?.kind === 'new' && (
        <NewFolderDialog
          projectId={projectId}
          folders={folders}
          parent={dialog.parent}
          onClose={() => setDialog(null)}
          onCreated={(f) => setSelected(f.id)}
        />
      )}
      {dialog?.kind === 'edit' && (
        <EditFolderDialog
          projectId={projectId}
          folders={folders}
          folder={dialog.folder}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteFolderDialog
          projectId={projectId}
          folder={dialog.folder}
          onClose={() => setDialog(null)}
          onDeleted={() => setSelected(dialog.folder.parentId)}
        />
      )}
    </UploadZone>
  );
}

function TreeItem({
  label,
  count,
  icon,
  depth,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  icon: React.ReactNode;
  depth: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      style={{ paddingLeft: `${0.5 + Math.max(0, depth - 1) * 0.9}rem` }}
      className={cn(
        'hover:bg-primary-soft/60 focus-visible:ring-ring flex h-9 w-full items-center gap-2 rounded-md pr-2 text-left text-sm outline-none focus-visible:ring-2',
        active && 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold',
      )}
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-muted-foreground tabular text-xs">{count}</span>
      )}
    </button>
  );
}
