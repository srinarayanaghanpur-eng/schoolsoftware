# Firestore Schema

## users

Auth-linked role profile.

- `uid`
- `role`
- `teacherId`
- `email`
- `displayName`
- `createdAt`
- `updatedAt`

## teachers

Teacher/staff master data.

- `id`
- `uid`
- `fullName`
- `email`
- `phone`
- `subject`
- `employeeId`
- `biometricUserId`
- `baseSalary`
- `joiningDate`
- `status`
- `allowedCLPerMonth`
- `lateDeductionRule`
- `profilePhotoUrl`
- `createdAt`
- `updatedAt`

## attendance

Document ID: `teacherId_YYYY-MM-DD`.

- `teacherId`
- `date`
- `month`
- `year`
- `status`
- `checkInTime`
- `checkOutTime`
- `source`
- `sourcesUsed`
- `latitude`
- `longitude`
- `distanceFromCampus`
- `deviceInfo`
- `biometricDeviceId`
- `lateMinutes`
- `isLate`
- `remarks`
- `adminEdited`
- `editedBy`
- `editReason`
- `createdAt`
- `updatedAt`

## attendance_logs

Raw mobile/normalized event history.

- `teacherId`
- `date`
- `timestamp`
- `source`
- `eventType`
- `latitude`
- `longitude`
- `deviceInfo`
- `rawData`
- `createdAt`

## biometric_logs

Raw ESSL device events.

- `deviceId`
- `biometricUserId`
- `teacherId`
- `timestamp`
- `verificationType`
- `eventType`
- `rawPayload`
- `processed`
- `errorMessage`
- `createdAt`

## salary_reports

Document ID: `teacherId_YYYY-MM`.

- `teacherId`
- `month`
- `year`
- `baseSalary`
- `workingDays`
- `presentDays`
- `lateDays`
- `clDays`
- `paidCLDays`
- `unpaidCLDays`
- `absentDays`
- `holidays`
- `perDaySalary`
- `lateDeduction`
- `absentDeduction`
- `manualDeduction`
- `bonus`
- `netPayable`
- `paid`
- `paidAt`
- `paymentNotes`
- `generatedAt`
- `updatedAt`

## settings

Use document ID `school`.

- `schoolName`
- `campusLatitude`
- `campusLongitude`
- `geofenceRadiusMeters`
- `schoolStartTime`
- `graceMinutes`
- `salaryRules`
- `biometricApiSecret`
- `timezone`

## backup_audit_logs

Generated when admin exports a backup before erasing data.

- `checksum`
- `fileName`
- `generatedAt`
- `generatedBy`
- `collectionNames`
- `documentCounts`
- `usedForErase`
- `erasedAt`
- `erasedBy`
- `deletedCounts`

## admin_audit_logs

Used for destructive admin actions.

- `action`
- `backupChecksum`
- `deletedCounts`
- `createdAt`
- `createdBy`
