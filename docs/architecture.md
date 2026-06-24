# Sri Narayana Staff Attendance System Architecture

## Collections

- `users`: auth-linked profile and role
- `teachers`: teacher metadata, salary settings, biometric ID
- `attendance`: attendance records with source, GPS, timestamps, and status
- `biometric_logs`: raw incoming logs from ESSL or proxy service
- `holidays`: school holiday calendar
- `salary_reports`: monthly salary computations
- `settings`: geofence, deduction, biometric secret, and attendance policy

## Attendance flow

1. Teacher logs in with Firebase Auth.
2. Mobile app checks geofence before allowing attendance.
3. Attendance writes a single daily record, updating check-out if later valid event arrives.
4. Biometric logs come through a separate ingestion endpoint.
5. Duplicate prevention merges mobile and biometric check-ins for the same day.

## Salary flow

1. Monthly aggregation reads attendance and holidays.
2. Salary rules compute present, late, CL, absent, and paid leave counts.
3. Net salary is stored in `salary_reports`.

## Runtime Services

- `attendanceService`: geofence math, late status, daily attendance merge
- `biometricDeviceService`: ESSL payload validation and biometric log normalization
- `salaryService`: monthly salary calculation
- `reportExportService`: Excel-ready report rows and workbook export
