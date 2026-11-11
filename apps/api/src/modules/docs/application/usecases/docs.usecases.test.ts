import { describe, expect, it } from 'vitest';
import {
  CreateFolderUseCase,
  DeleteFolderUseCase,
  ListFoldersUseCase,
  UpdateFolderUseCase,
} from './folders.usecases.js';
import {
  DeleteFileUseCase,
  GetFileUseCase,
  ListFilesUseCase,
  RegisterFileUseCase,
  SaveFromPhotosUseCase,
  SignFileUploadUseCase,
  UpdateFileUseCase,
} from './files.usecases.js';
import { FILES, PHOTOS, admin, cust, designer, designer2, tech, world } from '../testing/fakes.js';

function setup() {
  const w = world();
  return {
    w,
    createFolder: new CreateFolderUseCase(w.access, w.folders),
    updateFolder: new UpdateFolderUseCase(w.access, w.folders, w.files),
    deleteFolder: new DeleteFolderUseCase(w.access, w.folders, w.files),
    listFolders: new ListFoldersUseCase(w.access, w.folders, w.files),
    sign: new SignFileUploadUseCase(w.access, w.storage),
    register: new RegisterFileUseCase(
      w.access,
      w.files,
      w.folders,
      w.projects,
      w.directory,
      w.storage,
      w.settings,
      w.alerts,
      w.views,
    ),
    save: new SaveFromPhotosUseCase(
      w.access,
      w.files,
      w.folders,
      w.projects,
      w.storage,
      w.views,
      () => new Date('2026-11-12T09:00:00Z'),
    ),
    update: new UpdateFileUseCase(w.access, w.files, w.folders, w.projects, w.alerts, w.views),
    del: new DeleteFileUseCase(w.access, w.files),
    list: new ListFilesUseCase(w.access, w.files, w.views),
    get: new GetFileUseCase(w.access, w.views),
  };
}
const pdf = (over = {}) => ({
  publicId: `${FILES}/plan123.pdf`,
  format: 'pdf',
  originalName: 'Kitchen plan.pdf',
  bytes: 2 * 1024 * 1024,
  visibility: 'TEAM' as const,
  ...over,
});

describe('folders', () => {
  it('nest up to 5 levels, with unique names among siblings (any capitalisation)', async () => {
    const { createFolder } = setup();
    let parent: string | undefined;
    for (const n of [1, 2, 3, 4, 5])
      parent = (
        await createFolder.execute(admin, 'proj1', {
          name: `L${n}`,
          ...(parent ? { parentId: parent } : {}),
        })
      ).folder.id;
    await expect(
      createFolder.execute(admin, 'proj1', { name: 'L6', parentId: parent! }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(createFolder.execute(admin, 'proj1', { name: 'l1' })).rejects.toMatchObject({
      statusCode: 409,
    }); // sibling at the top, different case
    await expect(
      createFolder.execute(admin, 'proj1', { name: 'Drawings', parentId: 'nope' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('can be renamed and moved, but never into themselves or their own subfolders', async () => {
    const { createFolder, updateFolder } = setup();
    const a = (await createFolder.execute(admin, 'proj1', { name: 'A' })).folder;
    const b = (await createFolder.execute(admin, 'proj1', { name: 'B', parentId: a.id })).folder;
    const c = (await createFolder.execute(admin, 'proj1', { name: 'C', parentId: b.id })).folder;
    await expect(updateFolder.execute(admin, a.id, { parentId: a.id })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(updateFolder.execute(admin, a.id, { parentId: c.id })).rejects.toMatchObject({
      statusCode: 400,
    }); // into its own descendant
    expect(
      (await updateFolder.execute(designer, c.id, { parentId: null, name: 'Top' })).folder,
    ).toMatchObject({ parentId: null, name: 'Top' });
  });

  it('keeps the WHOLE moved subtree within the depth limit', async () => {
    const { createFolder, updateFolder } = setup();
    let deep: string | undefined;
    for (const n of [1, 2, 3, 4])
      deep = (
        await createFolder.execute(admin, 'proj1', {
          name: `D${n}`,
          ...(deep ? { parentId: deep } : {}),
        })
      ).folder.id;
    const x = (await createFolder.execute(admin, 'proj1', { name: 'X' })).folder;
    await createFolder.execute(admin, 'proj1', { name: 'X1', parentId: x.id });
    // X has a child (height 2); under a depth-4 folder it would reach depth 6.
    await expect(updateFolder.execute(admin, x.id, { parentId: deep! })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('can only be deleted when EMPTY (no subfolders, no files)', async () => {
    const { w, createFolder, deleteFolder, register } = setup();
    const a = (await createFolder.execute(admin, 'proj1', { name: 'A' })).folder;
    const b = (await createFolder.execute(admin, 'proj1', { name: 'B', parentId: a.id })).folder;
    await expect(deleteFolder.execute(admin, a.id)).rejects.toMatchObject({ statusCode: 409 }); // has a subfolder
    await register.execute(designer, 'proj1', pdf({ folderId: b.id }));
    await expect(deleteFolder.execute(admin, b.id)).rejects.toMatchObject({ statusCode: 409 }); // has a file
    w.files.rows[0]!.deleted = true;
    await deleteFolder.execute(admin, b.id);
    await deleteFolder.execute(admin, a.id);
    expect(w.folders.rows).toHaveLength(0);
  });

  it('lists with file counts for the team, shows the customer none, and is not found for outsiders', async () => {
    const { createFolder, listFolders, register } = setup();
    const a = (await createFolder.execute(admin, 'proj1', { name: 'Drawings' })).folder;
    await register.execute(designer, 'proj1', pdf({ folderId: a.id }));
    expect((await listFolders.execute(tech, 'proj1'))[0]).toMatchObject({ fileCount: 1 });
    expect(await listFolders.execute(cust, 'proj1')).toEqual([]);
    await expect(listFolders.execute(designer2, 'proj1')).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(createFolder.execute(cust, 'proj1', { name: 'x' })).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('registering an uploaded file', () => {
  it('stores a document, defaulting its name, and writes the timeline', async () => {
    const { w, register } = setup();
    const v = await register.execute(designer, 'proj1', pdf());
    expect(v.file).toMatchObject({
      name: 'Kitchen plan.pdf',
      kind: 'FILE',
      format: 'pdf',
      visibility: 'TEAM',
      folderId: null,
      uploadedById: 'designer1',
    });
    expect(v.url).toBe(`https://f.test/${FILES}/plan123.pdf`);
    expect(v.thumbUrl).toBeNull();
    expect(w.projects.activities[0]).toMatchObject({
      type: 'FILE_ADDED',
      data: { fileName: 'Kitchen plan.pdf', shared: false },
    });
  });

  it('treats an image upload as an image with a preview', async () => {
    const { register } = setup();
    const v = await register.execute(designer, 'proj1', {
      publicId: `${FILES}/abc123`,
      format: 'jpg',
      originalName: 'site.jpg',
      bytes: 1000,
      visibility: 'TEAM',
    });
    expect(v.file.kind).toBe('IMAGE');
    expect(v.thumbUrl).not.toBeNull();
  });

  it("applies the server's own rules: right folder, allowed type, matching extension, size limit (a setting)", async () => {
    const { w, register } = setup();
    const bad = async (over: object) =>
      expect(register.execute(designer, 'proj1', pdf(over))).rejects.toMatchObject({
        statusCode: 400,
      });
    await bad({ publicId: 'vastu-test/projects/proj2/files/plan.pdf' }); //            another project
    await bad({ publicId: `${PHOTOS}/plan.pdf` }); //                                  the photo folder, not the files folder
    await bad({ publicId: `${FILES}/run.exe`, format: 'exe' }); //                     a disallowed type
    await bad({ format: 'docx' }); //                                                  claims docx, but the upload is a .pdf
    await bad({ bytes: 11 * 1024 * 1024 }); //                                         over the default 10 MB
    w.settings.mb = 20; //                                                             the Admin raised the limit
    await expect(
      register.execute(designer, 'proj1', pdf({ bytes: 11 * 1024 * 1024 })),
    ).resolves.toBeDefined();
  });

  it('is idempotent: registering the same upload twice returns it once and announces once', async () => {
    const { w, register } = setup();
    const a = await register.execute(designer, 'proj1', pdf());
    const b = await register.execute(designer, 'proj1', pdf());
    expect(b.file.id).toBe(a.file.id);
    expect(w.files.rows).toHaveLength(1);
    expect(w.projects.types()).toEqual(['FILE_ADDED']);
    expect(w.sender.ofType('FILE_ADDED')).toHaveLength(1);
  });

  it('tells the members (not the uploader, not the Admins); sharing at upload also tells the customer', async () => {
    const { w, register } = setup();
    await register.execute(designer, 'proj1', pdf());
    expect(w.sender.ofType('FILE_ADDED')[0]?.userIds).toEqual(['tech1']);
    expect(w.sender.ofType('FILE_SHARED')).toHaveLength(0);

    await register.execute(
      designer,
      'proj1',
      pdf({ publicId: `${FILES}/b.pdf`, name: 'Quote', visibility: 'CLIENT' }),
    );
    expect(w.sender.ofType('FILE_SHARED')[0]).toMatchObject({
      userIds: ['cust1'],
      alert: { title: 'New document shared with you', body: `"Quote" — Mrs Rao's project` },
    });
  });

  it('lets the customer upload: always shared, always at the top level, and the team + Admins are told', async () => {
    const { w, register, createFolder } = setup();
    const f = (await createFolder.execute(admin, 'proj1', { name: 'Drawings' })).folder;
    const v = await register.execute(cust, 'proj1', pdf({ folderId: f.id, visibility: 'TEAM' }));
    expect(v.file).toMatchObject({ visibility: 'CLIENT', folderId: null });
    expect(w.sender.ofType('FILE_ADDED')[0]?.userIds).toEqual(['admin1', 'designer1', 'tech1']);
  });

  it('refuses a folder of another project, and outsiders', async () => {
    const { w, register } = setup();
    w.folders.rows.push({
      id: 'foreign',
      projectId: 'proj2',
      parentId: null,
      name: 'x',
      createdById: 'a',
      createdAt: new Date(),
    });
    await expect(
      register.execute(designer, 'proj1', pdf({ folderId: 'foreign' })),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(register.execute(designer2, 'proj1', pdf())).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('Save to Docs (photos already in a post, comment or to-do)', () => {
  const photo = (n: string) => ({ publicId: `${PHOTOS}/${n}` });

  it('points at the SAME stored image (nothing copied), keeps the source visibility, and alerts nobody', async () => {
    const { w, save, createFolder } = setup();
    const f = (await createFolder.execute(admin, 'proj1', { name: 'Renders' })).folder;
    const r = await save.execute(designer, 'proj1', {
      items: [{ publicId: `${PHOTOS}/r1`, name: 'Render v1' }, photo('r2')],
      folderId: f.id,
      visibility: 'CLIENT',
    });

    expect(r.map((x) => x.created)).toEqual([true, true]);
    expect(r[0]!.view.file).toMatchObject({
      publicId: `${PHOTOS}/r1`,
      name: 'Render v1',
      kind: 'IMAGE',
      visibility: 'CLIENT',
      folderId: f.id,
      bytes: null,
    });
    expect(r[1]!.view.file.name).toBe('Photo 2026-11-12 (2)');
    expect(w.sender.sent).toHaveLength(0); // they were announced when posted
    expect(w.projects.activities).toEqual([
      expect.objectContaining({
        type: 'FILES_SAVED',
        data: { count: 2, folderName: 'Renders', names: ['Render v1', 'Photo 2026-11-12 (2)'] },
      }),
    ]);
  });

  it('is idempotent: saving a photo already in Docs returns the existing document', async () => {
    const { w, save } = setup();
    const first = await save.execute(designer, 'proj1', {
      items: [photo('r1')],
      visibility: 'TEAM',
    });
    w.projects.activities.length = 0;
    const again = await save.execute(tech, 'proj1', {
      items: [photo('r1'), photo('r1')],
      visibility: 'CLIENT',
    });
    expect(again).toHaveLength(1); // a repeat within one batch counts once
    expect(again[0]).toMatchObject({ created: false });
    expect(again[0]!.view.file.id).toBe(first[0]!.view.file.id);
    expect(again[0]!.view.file.visibility).toBe('TEAM'); // never silently shared
    expect(w.projects.activities).toHaveLength(0);
    expect(w.files.rows).toHaveLength(1);
  });

  it('accepts only photos of THIS project, and can save a deleted document again', async () => {
    const { w, save, del } = setup();
    await expect(
      save.execute(designer, 'proj1', {
        items: [{ publicId: 'vastu-test/projects/proj2/x' }],
        visibility: 'TEAM',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      save.execute(designer, 'proj1', {
        items: [{ publicId: `${FILES}/doc.pdf` }],
        visibility: 'TEAM',
      }),
    ).rejects.toMatchObject({ statusCode: 400 }); // a document id is not a photo
    const first = await save.execute(designer, 'proj1', {
      items: [photo('r1')],
      visibility: 'TEAM',
    });
    await del.execute(designer, first[0]!.view.file.id);
    expect(
      (await save.execute(designer, 'proj1', { items: [photo('r1')], visibility: 'TEAM' }))[0],
    ).toMatchObject({ created: true });
    expect(w.files.rows.filter((f) => !f.deleted)).toHaveLength(1);
  });

  it('lets the customer save a photo they can see: always shared, at the top level; outsiders cannot', async () => {
    const { save } = setup();
    const r = await save.execute(cust, 'proj1', { items: [photo('c1')], visibility: 'TEAM' });
    expect(r[0]!.view.file).toMatchObject({ visibility: 'CLIENT', folderId: null });
    await expect(
      save.execute(designer2, 'proj1', { items: [photo('c1')], visibility: 'TEAM' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('what the customer sees', () => {
  it('only shared files, flat, with no folder information', async () => {
    const { createFolder, register, list, get } = setup();
    const f = (await createFolder.execute(admin, 'proj1', { name: 'Internal pricing' })).folder;
    const team = await register.execute(
      designer,
      'proj1',
      pdf({ publicId: `${FILES}/t.pdf`, name: 'Supplier quote', folderId: f.id }),
    );
    await register.execute(
      designer,
      'proj1',
      pdf({ publicId: `${FILES}/c.pdf`, name: 'Layout', folderId: f.id, visibility: 'CLIENT' }),
    );

    const seen = await list.execute(cust, 'proj1', {});
    expect(seen.map((v) => v.file.name)).toEqual(['Layout']);
    expect(seen[0]!.folderId).toBeNull(); // the folder name is never revealed
    expect((await list.execute(cust, 'proj1', { folderId: f.id })).map((v) => v.file.name)).toEqual(
      ['Layout'],
    ); // asking for a folder changes nothing
    await expect(get.execute(cust, team.file.id)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('listing for the team', () => {
  it('filters by folder (or top level), search and shared-only', async () => {
    const { createFolder, register, list } = setup();
    const f = (await createFolder.execute(admin, 'proj1', { name: 'Drawings' })).folder;
    await register.execute(
      designer,
      'proj1',
      pdf({ publicId: `${FILES}/1.pdf`, name: 'Kitchen layout', folderId: f.id }),
    );
    await register.execute(
      designer,
      'proj1',
      pdf({ publicId: `${FILES}/2.pdf`, name: 'Wardrobe layout', visibility: 'CLIENT' }),
    );
    await register.execute(designer, 'proj1', pdf({ publicId: `${FILES}/3.pdf`, name: 'Invoice' }));
    const names = async (q: object) =>
      (await list.execute(tech, 'proj1', q)).map((v) => v.file.name).sort();
    expect(await names({})).toEqual(['Invoice', 'Kitchen layout', 'Wardrobe layout']);
    expect(await names({ folderId: f.id })).toEqual(['Kitchen layout']);
    expect(await names({ folderId: 'root' })).toEqual(['Invoice', 'Wardrobe layout']);
    expect(await names({ search: 'layout' })).toEqual(['Kitchen layout', 'Wardrobe layout']);
    expect(await names({ shared: true })).toEqual(['Wardrobe layout']);
  });
});

describe('changing a file', () => {
  it('renames, moves (null = top level) and shares; sharing tells the customer and writes the timeline', async () => {
    const { w, register, update, createFolder } = setup();
    const f = (await createFolder.execute(admin, 'proj1', { name: 'Drawings' })).folder;
    const v = await register.execute(designer, 'proj1', pdf());
    w.sender.sent.length = 0;
    w.projects.activities.length = 0;

    const moved = await update.execute(tech, v.file.id, { name: 'Final layout', folderId: f.id });
    expect(moved.file).toMatchObject({ name: 'Final layout', folderId: f.id });
    expect(w.sender.sent).toHaveLength(0);

    await update.execute(tech, v.file.id, { visibility: 'CLIENT' });
    expect(w.sender.ofType('FILE_SHARED')[0]).toMatchObject({ userIds: ['cust1'] });
    expect(w.projects.types()).toEqual(['FILE_SHARED']);
    await update.execute(tech, v.file.id, { visibility: 'CLIENT' }); // already shared: nothing new
    await update.execute(tech, v.file.id, { visibility: 'TEAM' }); //   unshare: quiet
    expect(w.sender.ofType('FILE_SHARED')).toHaveLength(1);
    expect((await update.execute(tech, v.file.id, { folderId: null })).file.folderId).toBeNull();
  });

  it("is the team's to change: the customer cannot, a foreign folder is refused, outsiders see nothing", async () => {
    const { w, register, update } = setup();
    const v = await register.execute(designer, 'proj1', pdf({ visibility: 'CLIENT' }));
    await expect(update.execute(cust, v.file.id, { name: 'x' })).rejects.toMatchObject({
      statusCode: 403,
    });
    w.folders.rows.push({
      id: 'foreign',
      projectId: 'proj2',
      parentId: null,
      name: 'x',
      createdById: 'a',
      createdAt: new Date(),
    });
    await expect(
      update.execute(designer, v.file.id, { folderId: 'foreign' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(update.execute(designer2, v.file.id, { name: 'x' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('deleting a file', () => {
  it('is for its uploader or an Admin (a customer can remove their own); the stored asset is kept', async () => {
    const { w, register, del } = setup();
    const mine = await register.execute(designer, 'proj1', pdf());
    await expect(del.execute(tech, mine.file.id)).rejects.toMatchObject({ statusCode: 403 });
    await del.execute(designer, mine.file.id);
    await expect(del.execute(admin, mine.file.id)).rejects.toMatchObject({ statusCode: 404 });
    expect(w.files.rows[0]).toMatchObject({ deleted: true, publicId: `${FILES}/plan123.pdf` });

    const theirs = await register.execute(cust, 'proj1', pdf({ publicId: `${FILES}/c.pdf` }));
    await del.execute(cust, theirs.file.id);
    const shared = await register.execute(
      designer,
      'proj1',
      pdf({ publicId: `${FILES}/s.pdf`, visibility: 'CLIENT' }),
    );
    await expect(del.execute(cust, shared.file.id)).rejects.toMatchObject({ statusCode: 403 }); // theirs only
  });
});

describe('upload tickets', () => {
  it("point at the project's FILES folder, for members and the customer", async () => {
    const { sign } = setup();
    for (const who of [designer, tech, cust, admin])
      expect((await sign.execute(who, 'proj1')).fields['folder']).toBe(FILES);
    await expect(sign.execute(designer2, 'proj1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
