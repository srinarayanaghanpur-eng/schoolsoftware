# UAT Record (C7)

- Release commit:
- Staging URL:
- Data set: <anonymized sample / description>
- Testers:
- Dates:

## Fee cycle

| Step | Expected | Actual | Result |
|---|---|---|---|
| Admit student | Student created with fee assignment | | |
| Assign fees | Payable fee matches structure minus concession | | |
| Collect cash | Receipt issued, balance reduced once | | |
| Collect online | Gateway confirmation accepted, balance reduced once | | |
| Collect UPI | Receipt issued, balance reduced once | | |
| Print receipt | Correct amount, student, and receipt number | | |
| Cancel receipt | Payment cancelled, receipts cancelled, balance restored | | |
| Re-collect after cancel | Balance correct, new receipt number | | |
| Duplicate submit | One payment only, same receipt returned | | |

## Attendance cycle

Staff attendance is always tested. Student attendance is tested only if C5 chose
to build it.

| Step | Expected | Actual | Result |
|---|---|---|---|
| Staff check-in | Record created with correct status | | |
| Staff check-out | Existing record updated, no duplicate | | |
| Late calculation | Matches configured grace period | | |
| Student attendance (if in scope) | Class marked, parent sees it | | |

## Roles

| Role | Landing page | Permitted actions | Denied actions | Result |
|---|---|---|---|---|
| super_admin | | | | |
| admin | | | | |
| principal | | | | |
| accountant | | | | |
| teacher | | | | |
| parent | | | | |
| settings_manager | | | | |

## Backup and restore

| Step | Expected | Actual | Result |
|---|---|---|---|
| Backup | Manifest lists every collection | | |
| Erase | Only after backup validation | | |
| Restore | Document counts match manifest | | |

## Client smoke

| Client | Result | Notes |
|---|---|---|
| Web (desktop viewport) | | |
| Web (mobile viewport) | | |
| Mobile app | | |
| Desktop wrapper | | |

## Performance

| Check | Target | Actual | Result |
|---|---|---|---|
| Lighthouse performance | | | |
| Firestore reads per dashboard load | | | |
| Quota-error behavior | No blank screens | | |

## Defects found

| ID | Severity | Summary | Status |
|---|---|---|---|
| | | | |

Open P0: 0 required. Open P1: 0 required.
