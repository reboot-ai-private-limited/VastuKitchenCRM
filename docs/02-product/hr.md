# HR — keep shallow

## Employees
Add/edit: name, phone, role, **designation** (master list), **attendance type** (`GPS` or `Biometric`), fixed monthly salary, active flag. Creating an employee creates their login (optional: floor staff tracked by biometric need none). The owner account is **not** on attendance or payroll (an Admin can be set to GPS/Biometric if they should be).

## Weekly off — a rule, not one day
Setting **`hr.weeklyOff`** (Admin edits it in Settings; applies from the next calculation). Rules separated by `;`:

| Text | Meaning |
|---|---|
| `SUN` | every Sunday (default) |
| `SAT:1,3` | the 1st and 3rd Saturday of each month |
| `THU:2` | the 2nd Thursday |
| `SUN; SAT:1,3` | every Sunday **and** the 1st and 3rd Saturday |

"1st Saturday" = days 1–7, "2nd" = days 8–14, … ("5th" exists only in months that have five). A bad value is refused with a hint. **Working days** of a month = its days minus the weekly off. Public holidays and leave are out of scope.

## Attendance
One record per person per business day (business timezone, default Asia/Kolkata); the **server's clock** sets every time.
- **GPS (field staff, mobile app):** `POST /attendance/check-in` and `/check-out`, with the phone's location if available. Check-in is idempotent (a double tap keeps the first time; simultaneous taps make one record); the last check-out wins; check-out needs a check-in. Only GPS-tracked, active people.
- **Biometric (simulated for the MVP):** Admin/HR enter punches with `PUT /attendance/users/:userId/days/:date` (`inAt`, optional `outAt`). A real device later writes through the same path — nothing else changes.
- **Corrections:** the same `PUT` changes an existing day; it is marked **corrected** with who and why (note). `DELETE` removes a day. Times must fall on that day, a day cannot be in the future, and out cannot be before in.
- **Demo data:** `POST /attendance/simulate {days}` (Admin/HR) fills the last N days: ~9 in 10 working days present, in ≈ 9:00, out ≈ 18:00, now and then no out-time; GPS people get locations around Siliguri. Deterministic, skips days off and today, **never overwrites** an existing day, safe to run twice.
- **Views:** `GET /attendance/board?date=` (Admin/HR) — everyone's day with present / absent / missing-out counts · `GET /attendance/users/:id?month=` — a person's month (Admin/HR any; everyone else only their own) · `GET /attendance/me?month=` — the caller's own calendar.
- **Day status:** `PRESENT` (has an in-time) · `ABSENT` (working day, none) · `OFF` (weekly off) · `FUTURE`. A past day with an in-time but no out-time is flagged `missingOut`. Working on a day off still counts as present.

## Salary
`payable = fixed salary × min(days present, working days) ÷ working days`, to the rupee. No tax, PF, deductions or overtime; working extra days never pays more than the full salary.
- `POST /salary/:month/generate` works the month out from attendance for everyone tracked (active staff, plus anyone since deactivated who worked that month). **Safe to repeat:** it refreshes untouched rows, keeps amounts edited by hand, and refuses a finalized month. A month that has not started is refused.
- `PATCH /salary/:month/users/:userId` sets what will be paid (with a note); the computed amount stays visible beside it.
- `POST /salary/:month/finalize` **locks** the month. Afterwards attendance changes, a changed weekly-off rule or a new salary never move it: each row stores the working days and rule it was computed with.
- `GET /salary/:month/export.csv` downloads the month (names and notes that start with `=`, `+`, `-`, `@` are defused so a spreadsheet will not run them).
- **Admin and HR only**, every route.

## Out of scope
Leave management, payslips, payroll rules, shifts, half days, geofencing, public holidays, mid-month joining/leaving pro-rating. Real biometric device integration (Hikvision SDK) is the live phase after pricing is final.
