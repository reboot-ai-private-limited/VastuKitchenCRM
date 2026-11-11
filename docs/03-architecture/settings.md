# System Settings

Values the Admin can change **without a developer or a redeploy**. The `settings` module (tier 0) owns them; every other module reads them through its public contract.

## The settings
| Key | Type | Default | Used by |
|---|---|---|---|
| `projects.autoCreateOnWon` | on/off | **on** | projects: create a project when a lead is won |
| `leads.stuckDays` | days | `LEAD_STUCK_DAYS` (2) | leads (the "stuck" flag and filter) and reminders (stagnant rule) |
| `reminders.unseenDays` | days | `REMINDER_UNSEEN_DAYS` (2) | reminders: proposal not opened |
| `reminders.noActionDays` | days | `REMINDER_NO_ACTION_DAYS` (2) | reminders: opened, no action |
| `reminders.stagnantMax` | whole number | `REMINDER_STAGNANT_MAX` (3) | reminders: repeats per stuck period |
| `docs.maxFileMb` | MB | 10 | docs: largest uploaded document (1–100) |
| `proposals.defaultTerms` | long text | placeholder terms | proposals: terms on a **new** proposal |
| `company.name` / `.tagline` / `.address` / `.phone` | text | the client's website details | proposals: header, public page, WhatsApp message |

Time values are in **days** (decimals allowed: `0.0002` ≈ 17 seconds, handy for demos). The `.env` values are only the **defaults**: until an Admin changes a setting, behaviour is exactly as before.

## How it works
- A **registry in code** defines each setting: label, description, group, type, default and limits (`min`, `max`, whole-number, max length). To add one: a line in `SETTING_TYPES` (`packages/contracts`) and one in `settings.registry.ts`; the API and a Settings screen pick it up.
- **Only changes are stored** (`settings` collection: key, value, who, when). Nothing needs seeding; removing a stored value ("reset") brings the default back.
- A saved value that no longer passes its rules (e.g. a limit tightened later) is ignored in favour of the default, so a bad stored value can never take a feature down.
- **Reads are cached** (hot paths such as every lead list) and the cache is **cleared the moment a value is saved**; a 30-second limit only covers another server instance. Changes therefore apply at once, with no restart.
- **API (Admin only):** `GET /api/settings` (all settings with current value, default, `isDefault`, limits, group, label), `PATCH /api/settings` (`{ values: { key: value } }`, **all-or-nothing**: if any value is invalid nothing is saved, and the response names the key), `DELETE /api/settings/:key` (reset).
- Other modules depend only on `SettingsPublicContract.get(key)`, typed by key (a boolean setting returns a boolean) and always returns a usable value. Each consumer wraps it in its own small port, so use cases stay independent of where values come from.

## The auto-create toggle
- **On (default):** winning a lead creates its project at once.
- **Off:** nothing is created. Every Admin (except one who marked it won) gets a **"Lead won — no project yet"** alert pointing at the lead, **once per lead**. The Admin creates the project when ready (`POST /api/projects` with the lead, or a "Create project" button on the Won lead).
- It is checked **when the lead is won**: turning it on later does **not** create projects for leads already won.

## Not settings (yet)
Secrets and infrastructure (database, JWT, Cloudinary keys, cookie options) stay in `.env`: they must not be editable from the app.
