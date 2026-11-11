# Admin Dashboard

The owner's one screen: `GET /api/dashboard?from=&to=`. **Read-only** — worked out live from the other modules, nothing is stored. `from`/`to` are inclusive business dates (default today, at most 31 days); a single date is a one-day range.

## Blocks
1. **Counters** *(Admin)*
   - Open leads (not Won/Lost) with a count per status, and leads created in the range.
   - Running projects, Design vs Site Installation.
   - Complaints per status, and *pending* = Open + Assigned + Resolved-not-yet-closed.
   - **Value** (whole rupees): *pipeline* = each open lead's latest **sent** proposal; *won in range* = leads won in the range, the same way. A lead with no sent proposal counts 0. At most 2,000 open leads are valued per request (`pipelineCapped` says so).
2. **Staff** *(Admin and HR)* — today (whatever the range): staff tracked, present, absent, and whether it is the weekly off.
3. **People** — one row per person on attendance, plus anyone (even someone since deactivated) who did something in the range, sorted by name.
   - *Attendance* (Admin and HR): days present, earliest in-time, latest out-time over the range.
   - *Activity* (Admin only): first and last activity, calls (answered, talk time), leads handled, proposals generated and sent, project posts and comments.
4. **Needs attention** *(Admin)* — each block shows the oldest 10 and a count (counted up to 50):
   - proposals **unseen** · proposals **seen, no action** · **stagnant** leads (Proposal-Sent leads are covered by the two proposal blocks) · **complaints** unresolved too long · **overdue to-dos**.
   - Uses the **same Admin-editable day thresholds as the reminders** ([settings](../03-architecture/settings.md)), so the dashboard and the alerts never disagree; a change shows on the next refresh. Nothing is sent or recorded here. Every item carries a `ref` so the app can open it.
5. **Recent customer activity** *(Admin)* — the latest 15 customer posts, comments and approvals across projects (the things the team may need to answer).

## Access
- **Admin:** everything.
- **HR:** only *Staff* and each person's *attendance*; the other blocks are `null` (no leads, money, complaints or activity).
- Everyone else: 403.

## How "first / last activity" works
There is **no separate activity log**. Each module answers "what did this person do in the range" from its own records (lead timeline, proposals, project feed), and the dashboard merges them: first = earliest moment across them, last = latest. Attendance in/out is shown separately — arriving at 9:05 and last touching a lead at 4:40 are different facts. Another source (e.g. to-dos completed) is one more small method on that module's public contract.

## If a source fails
Each block loads on its own. One that fails is `null` and named in `errors`; the rest of the dashboard still renders.

## Not included
Custom reports, charts over time, per-person workload (open leads assigned), export.
