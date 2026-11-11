# Notifications & Reminders

Two modules, one job each:
- **`notifications`** (tier 2) stores and serves in-app alerts. It knows nothing about leads or proposals.
- **`reminders`** (tier 5) applies the time rules and creates notifications. It reads leads and proposals only through their public contracts.

Event-driven alerts are wired at the composition root (`src/subscribers.ts`): it listens for `proposal.seen` and `lead.assigned` and calls the notifications contract. No lower module imports a higher one.

## Notifications
Fields: recipient, `type`, `title`, `body`, `ref` (`LEAD` or `PROPOSAL` + id, so the app can open the right screen), `readAt`, optional `dedupeKey`. A unique index on (recipient, `dedupeKey`) makes every reminder safe to run twice. Notifications are deleted automatically after 30 days.

Endpoints (any signed-in user, always their own): `GET /api/notifications` (`unread=true`), `GET /api/notifications/unread-count`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`.

| Type | Raised by | Recipient |
|---|---|---|
| `PROPOSAL_SEEN` | `proposal.seen` event (first open of the public link) | the person who sent it |
| `LEAD_ASSIGNED` | `lead.assigned` event (not when you assign to yourself) | the new assignee |
| `PROPOSAL_UNSEEN` | reminder rule 1 | see "Recipient" |
| `PROPOSAL_NO_ACTION` | reminder rule 2 | see "Recipient" |
| `LEAD_STAGNANT` | reminder rule 3 | see "Recipient" |

## Delivery
1. **In-app, by polling:** web and app read `unread-count` about every 30 seconds and when the app returns to the foreground ("within ~30 s", not instant).
2. **Push (FCM)** comes with the mobile app (needs a Firebase project): a `PushSender` port in the notifications module, so it slots in without touching anything else.

## Reminder rules
All thresholds are **system settings** ([settings](settings.md)) in **days** (decimals allowed, e.g. `0.001` ≈ a minute, for demos and tests). The `.env` values (`REMINDER_*`, `LEAD_STUCK_DAYS`) are only the defaults; an Admin's change applies from the next run.

| Rule | Fires when | Sent |
|---|---|---|
| **Unseen** (`REMINDER_UNSEEN_DAYS`, 2) | proposal sent, never opened, older than the threshold, lead still open | once per proposal |
| **Seen, no action** (`REMINDER_NO_ACTION_DAYS`, 2) | proposal first opened longer ago than the threshold and the lead's status has not changed since | once per proposal |
| **Stagnant** (`LEAD_STUCK_DAYS`, 2) | open lead whose status has not changed for the threshold | every `LEAD_STUCK_DAYS`, at most `REMINDER_STAGNANT_MAX` (3) times per stuck period |

- **Stagnant skips `PROPOSAL_SENT` leads:** rules 1 and 2 already cover them at the same moment, so one problem never produces two alerts.
- **Won/Lost leads** never trigger anything.
- **Resets:** a status change, or sending another proposal, resets the lead's `statusChangedAt`, so the clock starts again and stagnant reminders can fire for the new period.
- **Recipient:** the lead's assigned sales person; if unassigned, the person who sent the proposal; if neither, all active Admins. No copies to Admin otherwise (Admin sees stuck leads on the dashboard).
- **Idempotent:** each alert has a `dedupeKey` (`proposal-unseen:<id>`, `proposal-no-action:<id>`, `lead-stagnant:<leadId>:<statusChangedAt>:<window>`), so running the job twice, or after downtime, never duplicates.
- Only recent items are considered (bounded look-back), so the job's work stays small however old the data gets.

## Scheduling
A plain interval job (`REMINDER_INTERVAL_MINUTES`, default 60) with an overlap guard, run once at startup to catch up. Chosen over `node-cron` because the rules are idempotent: exact schedules do not matter. It runs only when `ENABLE_CRON=true`, on **one** instance (see [deployment](deployment.md)).

`POST /api/reminders/run` (Admin) triggers a run on demand and returns how many alerts it created — for demos and testing.
