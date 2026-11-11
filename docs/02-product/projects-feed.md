# Projects & Feed (Module 3)

## Lifecycle
Lead **Won** → project auto-created → design → site installation → **Final Delivery post** → **Deal Closed**.

- A project is created **automatically** when a lead is won (one per won lead, idempotent). Its name defaults to "<customer>'s project" and its value to the lead's latest sent proposal total (Admin can edit both).
- The Admin can also create a project **by hand**, for an existing customer or from a lead. A **customer can have any number of projects** (a repeat customer's wardrobes, a second kitchen). A manual project from a lead is linked to it; one for a repeat customer has no lead.
- `stage`: `DESIGN → SITE → CLOSED`. `designStage`: `NOT_STARTED → IN_DESIGN → SHARED → APPROVED`.
- **Closing** is Admin-only and needs a **Final Delivery post** with photos. A closed project takes no new posts; the Admin can reopen it.

## Members and access
A project has **members** (staff the Admin adds: designers, technicians, office staff, anyone) plus a **designer** (primary, drives the "design view") and its **customer**. Access is decided by relationship to the project, never by role name:

| Who | Sees |
|---|---|
| Admin | everything |
| Member (incl. the designer) | the project, **both tabs** |
| The project's customer | the project, **Client tab only** |
| The lead's owner (Sales) | a **read-only summary** and the **lead journey**; not the feeds |
| Anyone else | nothing (reported as "not found") |

There is **no separate design board**: "Design" is the project list filtered by `designerId` / `designStage`.

## Feed
Facebook/Basecamp-style, per project. Two tabs:
- **Client** — the team and the customer.
- **Team** — staff on the project only. **The default for a new post**, so nothing reaches the customer by accident.

Posts hold **text and/or multiple photos**. **Comments are chat-style, one thread per post**, and inherit the post's tab. A feed page carries each post's comment count and its latest three comments; the full thread loads on demand. Posts load newest-first with a cursor.

- **The customer can post and comment** — always on the Client tab — and **approve** a design: an **Approve** button on a team post with photos, once, recorded with who and when.
- A **Final Delivery** post needs a photo and is always visible to the customer.
- Posts and comments can be deleted by their author or the Admin.

Example flows:
1. Designer posts a render (Client) → customer comments "I don't like this" → owner replies → designer posts v2 → customer approves.
2. Technician posts a photo of the electric board (Team) → remote owner sees it and instructs → the fix is posted.

## Photos
Photos never pass through the API. The app asks `POST /projects/:id/uploads/sign` for a ticket scoped to **that project's folder**, uploads straight to the storage provider, then sends the returned id with the post. The API accepts only ids inside the project's own folder. See [ADR-0010](../adr/0010-direct-uploads.md).

## Lead journey
On the project page, a **collapsed "Lead journey"** shows the lead's story oldest-first (created, source, calls, visits, proposals, status changes). It is read from the lead's own timeline (nothing copied) and is visible only to people who may access the lead: the Admin and the Sales person who owns it. The lead's timeline continues past the win with **Project created** / **Project delivered** entries, and the lead page shows a project summary.

## Won leads
After a lead is won only the risky things are locked: **Sales cannot change its status** (the Admin can; the project is not deleted) and **nobody can change its phone number** (the customer signs in with it). Calls, visits, proposals and other details stay editable. Lost leads stay reopenable.

## Notifications
Everyone who may **see** an item hears about it, except the person who did it — and **Admins always** (the owner follows every project). Client items reach the customer; Team items never do. Types: `PROJECT_CREATED`, `PROJECT_ASSIGNED`, `PROJECT_POST`, `PROJECT_COMMENT`, `PROJECT_APPROVED`, `PROJECT_CLOSED`.

## Next (planned)
To-dos (lists, assignees, "when done, notify", due dates, comments, "my assignments", timeline entries) and Docs (nested folders, per-file "share with client").
