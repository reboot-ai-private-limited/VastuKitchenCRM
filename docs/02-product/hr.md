# HR (Module 5) — keep shallow

## Employees
Add/edit: name, phone, role, **attendance type** (`GPS` or `Biometric`), fixed monthly salary, active flag. Creating an employee creates their login.

## Attendance
- **Field sales — GPS:** check-in / check-out from the mobile app, stored with location + time.
- **Everyone else — Biometric:** in-time / out-time log. **MVP uses simulated punches** (seeded/dummy) to show the flow. Real device integration (Hikvision SDK: register as technology company, works on local LAN; reference: Spectrum project) happens in the live phase after pricing is final.

## Basic salary view
Monthly table: `fixed salary × (days present / working days) = payable`. Payable is editable by admin before finalising. No tax, PF, deductions, or overtime.

## Out of scope
Leave management, payslips, payroll rules, shifts.
