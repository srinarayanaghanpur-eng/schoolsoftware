// Shared data shapes for the admission form (extracted from page.tsx).

export type DocumentItem = { name?: string; url?: string };

export interface StudentData {
  id: string;
  admissionNumber?: string;
  admissionNo?: string;
  rollNo?: number | string;
  studentName?: string;
  class?: string;
  classApplied?: string;
  classId?: string;
  section?: string;
  sectionId?: string;
  medium?: string;
  academicYear?: string;
  academicYearName?: string;
  academicYearId?: string;
  secondLanguage?: string;
  admissionType?: string;
  admissionStatus?: string;
  gender?: string;
  dateOfBirth?: string | { _seconds?: number; _nanoseconds?: number } | null;
  aadhaarNumber?: string;
  studentAadhaar?: string;
  bloodGroup?: string;
  emisId?: string;
  nationality?: string;
  motherTongue?: string;
  category?: string;
  fatherName?: string;
  fatherPhone?: string;
  fatherMobile?: string;
  fatherOccupation?: string;
  motherName?: string;
  motherPhone?: string;
  motherMobile?: string;
  motherOccupation?: string;
  guardianName?: string;
  guardianRelation?: string;
  email?: string;
  phone?: string;
  address?: string;
  addressLine?: string;
  villageArea?: string;
  mandal?: string;
  district?: string;
  pincode?: string;
  photoURL?: string;
  documentURLs?: DocumentItem[];
  previousSchool?:
    | { name?: string; address?: string; yearLeft?: string; lastClass?: string; tcNo?: string }
    | string
    | null;
  lastClass?: string;
  tcNo?: string;
  emergencyContact?:
    | { name?: string; phone?: string; relation?: string }
    | string
    | null;
  transportRequired?: boolean;
  transportRouteId?: string;
  transportRouteName?: string;
  transportStopName?: string;
  busRoute?: string;
  pickupPoint?: string;
  annualEnrollmentFee?: number | string;
  commitmentFee?: number | string;
  totalFeeAmount?: number | string;
  concession?: number | string;
  feePlan?: string;
  feeHeads?: { name: string; amount: number }[] | null;
  receiptNo?: string;
  studentLogin?: string;
  parentLogin?: string;
  verifiedBy?: string;
  createdBy?: string;
  createdAt?: string | { _seconds?: number; _nanoseconds?: number };
  updatedAt?: string | { _seconds?: number; _nanoseconds?: number };
  branchId?: string;
  schoolId?: string;
}

export interface AcademicYear {
  id: string;
  name: string;
}

export interface BranchInfo {
  id: string;
  name: string;
}

export interface AppUser {
  uid: string;
  displayName: string;
}

export interface TransportRoute {
  id: string;
  name: string;
}