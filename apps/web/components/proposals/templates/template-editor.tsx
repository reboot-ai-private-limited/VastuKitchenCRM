'use client';

import {
  proposalTemplateSchema,
  saveProposalTemplateBodySchema,
  type ProposalBlock,
  type ProposalBlockType,
  type ProposalPageDef,
  type ProposalTemplate,
} from '@vastu/contracts';
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Lock, Plus, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageBody } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useDuplicateProposalTemplate, useSaveProposalTemplate } from '@/lib/api/proposal-templates';
import { cn } from '@/lib/utils';
import { sampleDocument } from '../render/sample-doc';
import { TemplateDocument } from '../render/template-document';
import { BLOCK_LABELS, BLOCK_TYPES, BlockFields, newBlock } from './block-fields';

const KIND_LABELS: Record<ProposalPageDef['kind'], string> = {
  cover: 'Cover page',
  content: 'Content page',
  pricing: 'Price page',
  terms: 'Terms page',
  thankyou: 'Thank-you page',
};

const move = <T,>(list: T[], n: number, by: -1 | 1): T[] => {
  const to = n + by;
  if (to < 0 || to >= list.length) return list;
  const out = [...list];
  const [it] = out.splice(n, 1);
  out.splice(to, 0, it!);
  return out;
};

const pageId = () => `p${Math.random().toString(36).slice(2, 8)}`;

/**
 * Left: design and pages. Middle: the selected page's blocks. Right: that page, live, with sample
 * data. Built-in templates open read-only; duplicate one to make it yours.
 */
export function TemplateEditor({ initial, builtin }: { initial: ProposalTemplate; builtin: boolean }) {
  const router = useRouter();
  const [t, setT] = useState<ProposalTemplate>(initial);
  const [sel, setSel] = useState(0);
  const [openBlock, setOpenBlock] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const save = useSaveProposalTemplate(initial.key);
  const duplicate = useDuplicateProposalTemplate();
  const doc = useMemo(() => sampleDocument(), []);

  const page = t.pages[Math.min(sel, t.pages.length - 1)]!;
  const pageIndex = t.pages.indexOf(page);
  const edit = (next: ProposalTemplate) => {
    setT(next);
    setDirty(true);
  };
  const setPage = (patch: Partial<ProposalPageDef>) =>
    edit({ ...t, pages: t.pages.map((p, i) => (i === pageIndex ? { ...p, ...patch } : p)) });
  const setBlocks = (blocks: ProposalBlock[]) => setPage({ blocks });

  // The preview shows just the selected page.
  const previewTemplate = useMemo(() => ({ ...t, pages: [page] }), [t, page]);

  function onSave() {
    const parsed = proposalTemplateSchema.safeParse(t);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      toast.error(`${i?.path.join(' › ') ?? 'Template'}: ${i?.message ?? 'not valid'}`);
      return;
    }
    save.mutate(saveProposalTemplateBodySchema.parse(parsed.data), {
      onSuccess: () => {
        setDirty(false);
        toast.success('Template saved');
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save the template.'),
    });
  }

  function onDuplicate() {
    duplicate.mutate(
      { key: initial.key },
      {
        onSuccess: (copy) => {
          toast.success('Copied: you are now editing your own version');
          router.push(`/proposals/templates/${copy.key}`);
        },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not copy the template.'),
      },
    );
  }

  const ro = builtin;
  const addPage = () => {
    edit({
      ...t,
      pages: [...t.pages, { id: pageId(), kind: 'content', layout: 'hero', title: 'New page', blocks: [] }],
    });
    setSel(t.pages.length);
    setOpenBlock(null);
  };

  return (
    <PageBody>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to templates">
            <Link href="/proposals/templates">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{t.name || 'Untitled template'}</h1>
            {ro && (
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                <Lock className="size-3.5" /> Built-in: copy it to change it
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDuplicate} disabled={duplicate.isPending}>
            <Copy /> {duplicate.isPending ? 'Copying…' : 'Make a copy'}
          </Button>
          {!ro && (
            <Button onClick={onSave} disabled={!dirty || save.isPending}>
              <Save /> {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Design and pages */}
        <div className="bg-card shadow-card space-y-4 rounded-xl border p-4">
          <fieldset disabled={ro} className="space-y-4">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={t.name} onChange={(e) => edit({ ...t, name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea rows={2} value={t.description} onChange={(e) => edit({ ...t, description: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Logo address (URL)</Label>
            <Input value={t.logo} onChange={(e) => edit({ ...t, logo: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['primary', 'ink', 'paper', 'tint', 'accent'] as const).map((k) => (
              <div key={k}>
                <Label className="text-xs capitalize">{k === 'ink' ? 'Text' : k === 'paper' ? 'Page' : k}</Label>
                <input
                  type="color"
                  aria-label={k}
                  value={t.theme[k]}
                  onChange={(e) => edit({ ...t, theme: { ...t.theme, [k]: e.target.value } })}
                  className="h-9 w-full cursor-pointer rounded-md border"
                />
              </div>
            ))}
            <div>
              <Label className="text-xs">Headings</Label>
              <Select
                value={t.theme.headingFont}
                onValueChange={(v) => edit({ ...t, theme: { ...t.theme, headingFont: v as 'serif' | 'sans' } })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="serif">Serif</SelectItem>
                  <SelectItem value="sans">Sans</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          </fieldset>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm font-semibold">Pages</p>
              {!ro && (
                <Button type="button" size="sm" variant="outline" onClick={addPage}>
                  <Plus /> Page
                </Button>
              )}
            </div>
            <ol className="space-y-1">
              {t.pages.map((p, i) => (
                <li key={p.id}>
                  <div
                    className={cn(
                      'flex items-center gap-1 rounded-md border px-2 py-1.5',
                      i === pageIndex ? 'border-primary bg-primary-soft' : 'bg-card',
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left text-sm"
                      onClick={() => {
                        setSel(i);
                        setOpenBlock(null);
                      }}
                    >
                      <span className="text-muted-foreground tabular mr-1.5">{i + 1}</span>
                      {p.title || p.headline || KIND_LABELS[p.kind]}
                    </button>
                    {!ro && (
                      <>
                        <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Move up" onClick={() => { edit({ ...t, pages: move(t.pages, i, -1) }); setSel(Math.max(0, i - 1)); }}>
                          <ArrowUp />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Move down" onClick={() => { edit({ ...t, pages: move(t.pages, i, 1) }); setSel(Math.min(t.pages.length - 1, i + 1)); }}>
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label="Delete page"
                          disabled={t.pages.length <= 1}
                          onClick={() => {
                            edit({ ...t, pages: t.pages.filter((_, n) => n !== i) });
                            setSel(Math.max(0, i - 1));
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* The selected page */}
        <div className="bg-card shadow-card space-y-4 rounded-xl border p-4">
          <p className="text-sm font-semibold">
            Page {pageIndex + 1}: {KIND_LABELS[page.kind]}
          </p>
          <fieldset disabled={ro} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Kind</Label>
              <Select value={page.kind} onValueChange={(v) => setPage({ kind: v as ProposalPageDef['kind'] })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABELS) as Array<ProposalPageDef['kind']>).map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(page.kind === 'cover' || page.kind === 'thankyou') && (
              <div>
                <Label className="text-xs">Layout</Label>
                <Select value={page.layout} onValueChange={(v) => setPage({ layout: v as ProposalPageDef['layout'] })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hero">Full picture</SelectItem>
                    <SelectItem value="split">Split</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {page.kind === 'cover' || page.kind === 'thankyou' ? (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Headline</Label>
                <Input value={page.headline ?? ''} onChange={(e) => setPage({ headline: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Line under it</Label>
                <Input value={page.subline ?? ''} onChange={(e) => setPage({ subline: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Picture address (URL)</Label>
                <Input value={page.image ?? ''} onChange={(e) => setPage({ image: e.target.value })} />
              </div>
              <p className="text-muted-foreground text-[11px]">
                Tokens: {'{{client.name}}'}, {'{{proposal.title}}'}, {'{{proposal.date}}'}
              </p>
            </div>
          ) : (
            <div>
              <Label className="text-xs">Page title</Label>
              <Input value={page.title ?? ''} onChange={(e) => setPage({ title: e.target.value })} />
            </div>
          )}
          </fieldset>

          <div>
            <p className="mb-1.5 text-sm font-semibold">
              {page.kind === 'cover' ? 'Extra blocks (not shown on covers)' : 'Blocks'}
            </p>
            <ol className="space-y-1.5">
              {page.blocks.map((b, n) => (
                <li key={n} className="rounded-md border">
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left text-sm font-medium"
                      onClick={() => setOpenBlock(openBlock === n ? null : n)}
                    >
                      {BLOCK_LABELS[b.type]}
                    </button>
                    {!ro && (
                      <>
                        <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Move up" onClick={() => setBlocks(move(page.blocks, n, -1))}>
                          <ArrowUp />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Move down" onClick={() => setBlocks(move(page.blocks, n, 1))}>
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label="Delete block"
                          onClick={() => {
                            setBlocks(page.blocks.filter((_, i) => i !== n));
                            setOpenBlock(null);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                  {openBlock === n && (
                    <fieldset disabled={ro} className="border-t p-3">
                      <BlockFields block={b} onChange={(nb) => setBlocks(page.blocks.map((x, i) => (i === n ? nb : x)))} />
                    </fieldset>
                  )}
                </li>
              ))}
            </ol>
            {!ro && (
              <div className="mt-2">
                <Select
                  value=""
                  onValueChange={(v) => {
                    setBlocks([...page.blocks, newBlock(v as ProposalBlockType)]);
                    setOpenBlock(page.blocks.length);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="+ Add a block" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOCK_TYPES.map((k) => (
                      <SelectItem key={k} value={k}>
                        {BLOCK_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Live page */}
        <div className="lg:sticky lg:top-20">
          <p className="text-muted-foreground mb-2 text-xs font-medium">Live preview with sample data</p>
          <TemplateDocument doc={doc} template={previewTemplate} />
        </div>
      </div>
    </PageBody>
  );
}
