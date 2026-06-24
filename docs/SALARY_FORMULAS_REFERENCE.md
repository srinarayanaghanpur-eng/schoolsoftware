# SALARY FORMULAS - QUICK REFERENCE

## Attendance Tracking

```
presentDays     = count(status === "present")
lateDays        = count(status === "late")
lateEntries     = lateDays  (same value)
absentDays      = count(status === "absent" OR "not_marked")
```

## Casual Leave (CL) Calculations

### CL Used Formula
```
clUsedFromAbsent = absentDays
clUsedFromLate   = floor(lateEntries ÷ 3)
totalClUsed      = clUsedFromAbsent + clUsedFromLate
```

**Examples**:
- 0 absents + 0 lates → 0 + floor(0/3) = 0 CL used
- 1 absent + 0 lates → 1 + floor(0/3) = 1 CL used
- 0 absents + 3 lates → 0 + floor(3/3) = 1 CL used ✅
- 0 absents + 6 lates → 0 + floor(6/3) = 2 CL used ✅
- 2 absents + 6 lates → 2 + floor(6/3) = 4 CL used ✅

### CL Remaining Formula
```
clAllowanceThisMonth = 3  (default, configurable per teacher)
remainingCl          = max(0, clAllowanceThisMonth - totalClUsed)
```

**Examples**:
- Total used = 0 → Remaining = max(0, 3-0) = 3 ✅
- Total used = 1 → Remaining = max(0, 3-1) = 2 ✅
- Total used = 3 → Remaining = max(0, 3-3) = 0 ✅
- Total used = 5 → Remaining = max(0, 3-5) = 0 (can't be negative) ✅

### Excess Leave Formula
```
excessLeave = max(0, totalClUsed - clAllowanceThisMonth)
```

**Examples**:
- Total used = 0 → Excess = max(0, 0-3) = 0 ✅
- Total used = 3 → Excess = max(0, 3-3) = 0 ✅
- Total used = 5 → Excess = max(0, 5-3) = 2 ✅
- Total used = 10 → Excess = max(0, 10-3) = 7 ✅

## Salary Calculations

### Daily Salary
```
dailySalary = monthlySalary ÷ workingDaysInMonth
```

**Example**:
```
monthlySalary = ₹50,000
workingDays = 30
dailySalary = 50,000 ÷ 30 = ₹1,666.67
```

### Deductions (Only from Excess Leave)
```
deduction = excessLeave × dailySalary
```

**Important**: Absents and Lates do NOT cause direct salary deductions. They only consume CL. Only when CL is exhausted (excess > 0) does the salary get deducted.

**Examples**:
```
Scenario 1: 1 absent + 0 lates
- CL Used = 1 + 0 = 1
- Remaining = 3 - 1 = 2
- Excess = 0
- Deduction = 0 × ₹1,666.67 = ₹0 ✅

Scenario 2: 2 absents + 6 lates
- CL Used = 2 + floor(6/3) = 2 + 2 = 4
- Remaining = 3 - 4 = 0 (exhausted)
- Excess = 4 - 3 = 1
- Deduction = 1 × ₹1,666.67 = ₹1,666.67 ✅

Scenario 3: 2 absents + 9 lates
- CL Used = 2 + floor(9/3) = 2 + 3 = 5
- Remaining = 0
- Excess = 5 - 3 = 2
- Deduction = 2 × ₹1,666.67 = ₹3,333.34 ✅
```

### Net Salary
```
netSalary = monthlySalary - deduction + bonus - manualDeduction
```

**Example**:
```
monthlySalary = ₹50,000
deduction = ₹3,333.34
bonus = ₹0
manualDeduction = ₹0
netSalary = 50,000 - 3,333.34 + 0 - 0 = ₹46,666.66 ✅
```

---

## Key Business Rules

1. **Every 3 late entries = 1 CL** (not 3 days, but 3 attendance records with "late" status)
2. **Every absent day = 1 CL**
3. **CL allowance = 3 per month** (configurable, default)
4. **Only excess CLs cause salary deduction** (not absents or lates directly)
5. **Excess = totalUsed - 3** (if >0, then deduction applies)
6. **No negative values** (all use `max(0, ...)`)

---

## Code Implementation

### Calculate CL Used
```typescript
const lateEntries = records.filter(r => r.status === "late").length;
const absentDays = records.filter(r => r.status === "absent" || r.status === "not_marked").length;

const clUsedFromAbsent = absentDays;
const clUsedFromLate = Math.floor(lateEntries / 3);
const totalClUsed = clUsedFromAbsent + clUsedFromLate;
```

### Calculate Salary
```typescript
const clAllowance = 3;  // Or from teacher.allowedCLPerMonth
const dailySalary = teacher.baseSalary / workingDays;

const excessLeave = Math.max(0, totalClUsed - clAllowance);
const deduction = excessLeave * dailySalary;

const netSalary = teacher.baseSalary - deduction + bonus;
```

---

## Testing Checklist

- [ ] 0 lates, 0 absents → 0 CL used, 0 deduction
- [ ] 3 lates, 0 absents → 1 CL used, 0 deduction
- [ ] 6 lates, 0 absents → 2 CL used, 0 deduction
- [ ] 0 lates, 1 absent → 1 CL used, 0 deduction
- [ ] 0 lates, 3 absents → 3 CL used, 0 deduction
- [ ] 0 lates, 4 absents → 4 CL used, 1 excess, deduction applied
- [ ] 3 lates, 1 absent → 2 CL used, 0 deduction
- [ ] 6 lates, 1 absent → 3 CL used, 0 deduction
- [ ] 9 lates, 2 absents → 5 CL used, 2 excess, 2×daily salary deduction
- [ ] Deduction matches exactly: excessLeave × dailySalary

---

**Last Updated**: June 11, 2026
