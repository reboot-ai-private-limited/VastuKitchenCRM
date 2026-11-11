# To-dos (project management)

Basecamp-style to-dos inside each project, for the **team** (never the customer).

## Structure
- **Lists** group to-dos ("Procurement", "Site work") and show **"3/8 completed"**. A list can be renamed or archived (hidden, nothing deleted).
- A **to-do** has: title, notes, photos, one or more **assignees**, a **"when done, notify"** list, a **due date** (a plain calendar date, `YYYY-MM-DD`), and a **comment thread**. It can be completed, reopened, moved to another list of the same project, or deleted (by its creator or an Admin).
- **Who can use them:** the Admin and the project's members. The customer, and anyone not on the project, are told "not found".
- **Assignees and the notify list** must be active members of the project (or an Admin), so nobody gets an alert about something they cannot open.

## Notifications
Only the people involved are told, never the person who did it — and, unlike the project feed, **not every Admin** (to keep the owner's phone quiet).

| Event | Told |
|---|---|
| Assigned (at creation or later) | the **newly** added assignees |
| Due date changed or removed | the assignees |
| **Completed** | the creator **and** everyone on "when done, notify" |
| Comment | assignees, the creator and earlier commenters |
| **Overdue** (a reminder rule) | the assignees (or, with none, the creator), **once per due date** |

Completing is **idempotent and atomic**: five simultaneous taps complete it once and alert once.

## Business calendar
"Due on the 14th" is judged in the **business's timezone** (`BUSINESS_TIMEZONE`, default `Asia/Kolkata`), not UTC: at 11 pm in Siliguri on the 14th the to-do is still due *today*. Dates are stored and compared as `YYYY-MM-DD` strings.

## My assignments
`GET /api/todos/mine` lists everything assigned to me across projects, **most urgent first**, each with its project and list and a `bucket`: **OVERDUE**, **TODAY**, **UPCOMING** or **NO_DATE** (completed items are NO_DATE). A person removed from a project stops seeing its to-dos.

## Project timeline
Every to-do action — created, assigned, due date changed, completed, reopened — writes a **compact activity line** on the project's timeline (the "change log"). `GET /api/projects/:id/timeline` returns **posts and activity in one stream**, newest first, with a time cursor. The customer's timeline is posts only (their Client tab); activity is team-only.

## Out of scope (for now)
Subscribe-to-a-list, groups within a list, hill chart, drag-and-drop ordering, recurring to-dos, assigning to people outside the project.
