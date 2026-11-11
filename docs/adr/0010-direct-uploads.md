# ADR-0010: Photos upload straight to the storage provider

**Status:** Accepted

## Context
The project feed is mostly photos. Sending every file through the API would load the server, and the VPS should stay light.

## Decision
The API never handles file bytes. `POST /projects/:id/uploads/sign` checks the caller may post in that project and returns a short-lived **signed ticket** (a URL plus form fields) scoped to the project's folder. The app uploads directly to Cloudinary, then sends the returned `publicId` with the post. The API accepts only ids **directly inside that project's folder**, so a member cannot attach another project's photo or an arbitrary image.

The ticket is provider-neutral and the API talks to a `StoragePort`; Cloudinary is one adapter (signing is ~10 lines of SHA-1, no SDK). S3 later means one new adapter. Display URLs are built by the API (`f_auto,q_auto`, plus a small thumbnail), so clients never construct them. Credentials are optional env values: without them everything else works and only signing answers 503.

## Consequences
+ No upload load on the API; fast delivery and thumbnails from the CDN.
+ Tickets are folder-scoped and expire; the secret never reaches a client.
− Files are public-but-unguessable URLs (as with most CDNs). Locked downloads would need Cloudinary's authenticated delivery.
− Cloudinary's free tier limits file size; large CAD files would need S3 (the port makes that contained).
− An uploaded file that is never attached to a post stays in storage (a cleanup job can come later).
