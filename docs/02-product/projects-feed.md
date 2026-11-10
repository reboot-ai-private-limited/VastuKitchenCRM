# Projects & Feed (Module 3)

## Lifecycle
Lead `Won` → Project auto-created → design → site installation → **Final Delivery photo** → **Deal Closed**.

## Project feed (core feature)
Facebook/Basecamp-style, one per project:
- Posts with **unlimited photos** and text (designer renders, site photos).
- **Chat-style comments** under each post; everyone with access can reply.
- Two light tabs: **Client Feed** (customer visible) and **Internal Notes** (staff only). UI stays as simple as a social post.

Example flows to support:
1. Designer posts render → customer comments change → owner replies → designer posts revised image.
2. Technician posts photo of electric board issue → owner (remote) sees and instructs → fixed photo posted.

## Design view (no separate board)
There is **no separate design-team board**. A project carries `designerId` and `designStage` (`Not started → In design → Shared with client → Approved`), and "Design" is a **filtered view of the project list** (by stage / designer). A designer sees only their assigned projects (`scopeFor`); the owner sees all and can filter by designer. Nothing is tied to a role name.

## Access
Admin: all · Design: assigned projects · Technician: assigned projects · Customer: own project, Client Feed only.

## Optional (only if time remains)
Basic TODO list, announcements, schedule.
