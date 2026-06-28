# Sri Narayana High School — ERP User Guide

A simple, step-by-step manual for using the school management app.
Website: **https://schoolsoftware-two.vercel.app**

---

## 1. Logging In

1. Open the website in any browser (works on phone and computer).
2. Type your **Login ID** and **Password**.
3. Tap **Login**.

**Accounts:**
| Role | Login ID | What they can do |
|------|----------|------------------|
| Admin | `SNHS` | Everything — full control |
| Accountant | `RAJU` | Fees, finance, salary, reports |
| Teacher | their employee ID (e.g. `TCH006`) | Attendance, marks, own salary |

> Passwords are set when the account is created. If you forget one, the **Admin** can reset it from **Staff → Reset Password**, or use **Forgot Password** on the login screen.

**Tip:** The app keeps itself up to date automatically — new records appear on their own when you switch back to it. You normally never need to log out or refresh.

---

## 2. Getting Around

After login you see the **sidebar** on the left (or a menu button on phones). What you see depends on your role — the accountant sees fewer items than the admin.

Main areas:
- **Dashboard** – quick overview (students, staff, fees collected, attendance).
- **Students** – admit and manage students.
- **Staff** – manage teachers and staff.
- **Attendance** – daily attendance records.
- **Fees & Finance** – collect fees and run the school's money.
- **Salary & Payroll** – staff salaries and advances.
- **Exams & Marks** – exams and results.
- **Communication** – notices and messages.
- **Academic Years** – school year setup.
- **Promotion** – move students to the next class.
- **Users & Roles** – who can log in and what they can do.
- **Approvals** – approve pending requests.
- Plus **Transport, Library, Hostel, Inventory, Branches, Settings**.

---

## 3. Students

**Admit a new student:**
1. Go to **Students**.
2. Click **Add Student**.
3. Fill name, class, section, parent details, phone, fee details.
4. Click **Save**.

**Find a student:** use the **search box** (type name or admission number).

**Edit / view:** click a student row to open and edit their details.

---

## 4. Staff (Teacher Management)

**Add a staff member:**
1. Go to **Staff**.
2. Click **Add Teacher / Add Staff**.
3. Enter name, employee ID, subject/role, phone, **monthly salary**, and a password (this becomes their login).
4. Click **Save**.

**Search:** type name, employee ID, or subject.

**Reset a password:** open the staff member → **Reset Password** → set a new one.

> Drivers and support staff appear here too (shown as "Driver" / "Support Staff").

---

## 5. Attendance

- Go to **Attendance** to see daily records.
- You can **edit** an entry (late minutes, remarks) — a reason is required for the audit log.
- Biometric devices push attendance automatically; manual entry/edit is also possible.

---

## 6. Fees & Finance

This is the money hub. Open **Fees & Finance** and use the tabs at the top.

### Collect a fee (most common task)
1. Go to **Collect Fee** (Payments).
2. Click **Record Payment**.
3. Select the **student**, enter the **amount**, choose the fee type.
4. A **UPI QR code** appears for that exact amount — the parent scans it with **PhonePe / Google Pay / Paytm** to pay.
5. Click **Pay and confirm** to record it and generate a receipt.

> The QR's UPI ID and payee name are set in **Settings → UPI payment QR**.

### Other finance tabs
- **Invoices** – generate a fee invoice (auto invoice number) with line items.
- **Dues / Defaulters** – students with pending fees.
- **Reminders** – select students with dues and send fee reminders (SMS / WhatsApp / Email).
- **Expenses** – record school expenses (electricity, supplies, etc.).
- **Income** – record other income.
- **Vendors** – add vendors and record/pay purchase bills.
- **Banking** – bank accounts, deposits, and withdrawals.
- **Ledger / Cash Book / Trial Balance / Profit & Loss** – accounting statements.
- **Installments** – split a student's fee into installments.

---

## 7. Salary & Payroll

1. Go to **Salary & Payroll**.
2. Pick the **month**.
3. Click **Generate monthly salary** — it calculates each staff member's pay from their base salary and attendance.
4. Click **Mark paid** once a salary is paid.
5. Use **Download** to export to Excel.

**Salary Advances (loans to staff):**
- Scroll to the **Salary Advances** panel.
- Click **Give advance**, pick the staff member, enter amount, date, and reason.
- All advances are listed with an **Outstanding / Recovered** status.

> **Accountant note:** the accountant must **request admin approval** to open payroll. The admin approves it under **Approvals** (or the Salary page).

---

## 8. Exams & Marks

1. Go to **Exams & Marks** → create an exam (name, class, max marks).
2. Open the exam → enter each student's marks.
3. **Publish** when ready so results are finalized.

---

## 9. Communication (Notices)

- Go to **Communication / Notices**.
- Write a **title** and **message**, then post it to notify parents/staff.

---

## 10. Academic Years & Promotion

- **Academic Years:** create the school year (e.g. 2026–27) and set the **active** year.
- **Promotion:** move a class of students up to the next class at year-end.

---

## 11. Users & Roles

- **Admin only.** Go to **Users & Roles** to see all logins.
- Change a person's **role** (admin, accountant, teacher, etc.) to control what they can access.

---

## 12. Approvals

- Pending requests (like the accountant's payroll access, or password resets) appear here.
- **Approve** or **Reject** each one.

---

## 13. Other Modules

- **Transport** – buses (reg no, driver, seats), routes & stops, student assignments.
- **Library** – books, issue/return.
- **Hostel** – rooms and allotments.
- **Inventory** – items and sales.
- **Branches** – manage multiple branches.

---

## 14. Settings (Admin)

Go to **Settings** to configure:
- **Campus GPS geofence** – the area where staff attendance is allowed.
- **UPI payment QR** – the UPI ID and payee name used on fee-payment QR codes.
- **Attendance & salary rules** – school start time, grace minutes, late deductions.
- **Backup & Restore** – take a backup of your data, restore, or erase (use carefully).

---

## 15. Quick Troubleshooting

| Problem | Fix |
|--------|-----|
| New data not showing | It refreshes automatically when you switch back to the app. If not, reopen the page from the menu. |
| "Access denied" | You're not logged in with a role that allows that page. Use the right account. |
| "Login role is missing" | Ask the admin to set your role in **Users & Roles**. |
| Forgot password | Admin resets it in **Staff → Reset Password**. |
| QR shows wrong name/UPI | Update it in **Settings → UPI payment QR**. |

---

*For technical changes (new features, fixes), contact your developer.*
