# Docs (project documents)

Each project has a **Docs** area: nested folders and files (drawings, quotations, site maps, photos).

## Folders
- Up to **5 levels** deep; sibling names are unique (case-insensitive). A folder can be renamed and moved (never into itself); it can be deleted only when empty.

## Files
- Uploaded **directly to Cloudinary** with a signed ticket (`POST /projects/:id/files/uploads/sign`), then **registered** (`POST /projects/:id/files`). The server checks: the file sits in the project's own files folder, the type is allowed, the extension matches, and the size is within `docs.maxFileMb` (Settings, default 10 MB).
- Allowed types: pdf, doc, docx, xls, xlsx, ppt, pptx, csv, txt, rtf, jpg, jpeg, png, webp, heic, heif, gif, dwg, dxf, skp.
- Each file is **Team only** or **Shared with client**. The uploader or an Admin can delete.
- Registering the same upload twice returns the same document (idempotent).

## Customer
- Sees one **flat list of shared files**, no folders. Can upload (always shared, always top level) and remove their own. Team-only files are 404 to them.

## Save to Docs
- `POST /projects/:id/files/from-photos` saves up to **20 photos already in posts, comments or to-dos** into Docs. Nothing is re-uploaded or copied: the document points at the same stored image. Saving again returns the existing document. No alerts; the team timeline gets one "saved" line.

## Alerts and timeline
- Staff upload → project members (not the uploader) get `FILE_ADDED`; if shared, the customer gets `FILE_SHARED`. Customer upload → members and Admins. Sharing later → customer `FILE_SHARED`.
- Team timeline lines: `FILE_ADDED`, `FILE_SHARED`, `FILES_SAVED`. The customer's timeline is posts only.

## Not yet verified
- Real Cloudinary behaviour for raw files (the `fl_attachment` download, the returned `format`) — run `pnpm --filter @vastu/api check:storage` once credentials are in `.env`.
- "Attach from Docs" into a post is deferred.
