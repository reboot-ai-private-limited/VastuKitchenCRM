# Notifications & Cron

## Notification types
`proposal_seen`, `proposal_unseen_2d`, `seen_no_action_2d`, `lead_stagnant`, `complaint_assigned`, `project_comment`.

## Delivery
1. **In-app** (stored in `notifications`, shown on web + mobile) — baseline.
2. **Push** via FCM to the Android app — if time allows.

## Real-time event
`proposal_seen` fires immediately when the public proposal link is first opened (API handler), no cron needed.

## Cron jobs (node-cron in API, persistent host)
| Job | Schedule | Rule |
|---|---|---|
| Unseen proposals | hourly | `sentAt` > 2d ago and `seenAt` null → notify owner (once) |
| Seen, no action | hourly | `seenAt` > 2d and lead `statusChangedAt` ≤ `seenAt` → notify |
| Stagnant status | daily | `statusChangedAt` older than threshold (default 2d) for non-final leads → notify |

- Thresholds in config/env so dev can shorten them to minutes for testing.
- Each reminder stores a flag/record to avoid duplicate alerts.
- Jobs are idempotent; safe to run twice.
