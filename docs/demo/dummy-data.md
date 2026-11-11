# Demo Dummy Data

Seed 3–4 realistic records so the product looks alive. **`pnpm --filter @vastu/api seed:demo` creates all of this** (see [api-walkthrough.md](api-walkthrough.md)); the notes below are what it contains and what it cannot (photos).

## Projects
- **Kitchen A — ₹45 Lakh** (Siliguri): feed with AutoCAD render photos, a customer change request comment, owner reply, revised render.
- **Kitchen B — ₹75 Lakh**: site stage; **electric board issue** thread — technician photo + "board is here, won't fit", owner instruction, fixed photo.
- **Kitchen C (optional)** — delivered, with final delivery photo and closed.

## Leads
8–10 across sources (website, Facebook, Justdial, manual) and statuses, including one unseen proposal, one seen-no-action, one stagnant.

## People
Admin/owner, 2 sales (1 telecaller, 1 field), 3 designers, 2 technicians, 1 receptionist, 2 customers.

## Other
- 1 open complaint (assigned) + 1 resolved with photo.
- ~2 weeks of attendance (GPS for field sales, simulated biometric for others) and one generated salary month.
- Demo images (the seeder uses **placeholder** photo ids; real renders need Cloudinary configured and uploading live): need AutoCAD-style kitchen renders and a site electric-board photo (source from client or stock).
