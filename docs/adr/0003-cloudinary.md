# ADR-0003: Cloudinary for MVP file storage

**Status:** Accepted

## Context
Project feed needs many photos; fastest path is a managed service with image transforms.

## Decision
Cloudinary for MVP, accessed through a small `storage` interface (`upload`, `getUrl`, `delete`). S3 later.

## Consequences
+ Minimal setup, built-in resizing/CDN.
− Free-tier limits; interface needed to swap to S3 without touching feature code.
