import type { DocFileDto, FolderDto, SaveResultDto } from '@vastu/contracts';
import { describe, expect, it } from 'vitest';
import {
  breadcrumb,
  childrenOf,
  fileExtension,
  fileProblem,
  folderDepth,
  folderOptions,
  formatBytes,
  saveSummary,
  sortFiles,
  subtreeHeight,
  subtreeIds,
} from './docs';

const f = (id: string, parentId: string | null, name = id): FolderDto => ({
  id,
  projectId: 'p',
  parentId,
  name,
  fileCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
});
const tree = [
  f('a', null, 'Drawings'),
  f('b', 'a', 'Kitchen'),
  f('c', 'b', 'v1'),
  f('d', null, 'Bills'),
];

describe('file validation', () => {
  it('reads extensions', () => {
    expect(fileExtension('Plan.FINAL.PDF')).toBe('pdf');
    expect(fileExtension('noext')).toBe('');
    expect(fileExtension('.hidden')).toBe('');
  });
  it('accepts allowed types, refuses others and empties', () => {
    expect(fileProblem({ name: 'a.dwg', size: 10 })).toBeNull();
    expect(fileProblem({ name: 'virus.exe', size: 10 })).toMatch(/aren’t allowed/);
    expect(fileProblem({ name: 'noext', size: 10 })).toMatch(/aren’t allowed/);
    expect(fileProblem({ name: 'a.pdf', size: 0 })).toMatch(/empty/);
  });
  it('formats sizes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024 + 300_000)).toBe('5.3 MB');
    expect(formatBytes(null)).toBe('');
  });
});

describe('folder tree', () => {
  it('lists children by name and builds breadcrumbs', () => {
    expect(childrenOf(tree, null).map((x) => x.id)).toEqual(['d', 'a']);
    expect(breadcrumb(tree, 'c').map((x) => x.name)).toEqual(['Drawings', 'Kitchen', 'v1']);
    expect(breadcrumb(tree, null)).toEqual([]);
    expect(folderDepth(tree, 'c')).toBe(3);
  });
  it('survives a cycle', () => {
    expect(breadcrumb([f('x', 'y'), f('y', 'x')], 'x').length).toBe(2);
  });
  it('finds a subtree and its height', () => {
    expect([...subtreeIds(tree, 'a')].sort()).toEqual(['a', 'b', 'c']);
    expect(subtreeHeight(tree, 'a')).toBe(2);
    expect(subtreeHeight(tree, 'd')).toBe(0);
  });
  it('never offers a folder as its own destination', () => {
    const ids = folderOptions(tree, { blockedId: 'a' }).map((o) => o.id);
    expect(ids).toEqual([null, 'd']);
  });
  it('respects the 5-level cap when the moved folder has its own subtree', () => {
    const deep = [f('1', null), f('2', '1'), f('3', '2'), f('4', '3'), f('5', '4')];
    // placing a 2-level subtree (extra depth 2) under a depth-4 folder would reach 7: not allowed
    expect(folderOptions(deep, { extraDepth: 2 }).map((o) => o.id)).toEqual([null, '1', '2', '3']);
    expect(folderOptions(deep).map((o) => o.id)).toEqual([null, '1', '2', '3', '4', '5']);
  });
});

describe('save to docs', () => {
  it('summarises created vs already saved', () => {
    const r = [
      { created: true },
      { created: true },
      { created: true },
      { created: false },
    ] as unknown as SaveResultDto;
    expect(saveSummary(r)).toBe('Saved 3 · 1 already in Docs');
    expect(saveSummary([{ created: true }] as unknown as SaveResultDto)).toBe('Saved 1');
  });
});

describe('sortFiles', () => {
  it('newest first', () => {
    const a = { id: 'a', createdAt: '2026-01-01T00:00:00Z' } as DocFileDto;
    const b = { id: 'b', createdAt: '2026-02-01T00:00:00Z' } as DocFileDto;
    expect(sortFiles([a, b]).map((x) => x.id)).toEqual(['b', 'a']);
  });
});
