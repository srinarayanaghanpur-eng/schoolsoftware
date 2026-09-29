"use client";

// Student + lookup fetching and derived `resolved` values for the form.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { adminApiRequest } from "@/lib/adminApiClient";
import type { StudentData, AcademicYear, BranchInfo, AppUser, TransportRoute } from "./form-types";
import { resolveValue, emergencyValue, previousSchoolName, previousSchoolValue } from "./formatters";

export function useAdmissionData() {
  const params = useParams();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lookup data
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);

  // Build lookup maps
  const yearMap = useMemo(() => {
    const m = new Map<string, string>();
    academicYears.forEach((y) => m.set(y.id, y.name));
    return m;
  }, [academicYears]);

  const branchMap = useMemo(() => {
    const m = new Map<string, string>();
    branches.forEach((b) => m.set(b.id, b.name));
    return m;
  }, [branches]);

  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => m.set(u.uid, u.displayName));
    return m;
  }, [users]);

  const routeMap = useMemo(() => {
    const m = new Map<string, string>();
    routes.forEach((r) => m.set(r.id, r.name));
    return m;
  }, [routes]);

  // Fetch student
  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await adminApiRequest<{
          success?: boolean;
          data: StudentData;
        }>(`/api/admin/students/${params.id}`);
        if (result.data) {
          setStudent(result.data);
        } else {
          setError("Student not found");
        }
      } catch (err) {
        console.error("Error fetching student:", err);
        setError("Failed to load student data");
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [params.id]);

  // Fetch lookups
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [yearsRes, branchesRes, usersRes, routesRes] =
          await Promise.all([
            adminApiRequest<{ ok: boolean; years: AcademicYear[] }>(
              "/api/admin/academic-years"
            ),
            adminApiRequest<{ ok: boolean; branches: BranchInfo[] }>(
              "/api/admin/branches"
            ),
            adminApiRequest<{ ok: boolean; users: AppUser[] }>(
              "/api/admin/users"
            ),
            adminApiRequest<{ ok: boolean; routes: TransportRoute[] }>(
              "/api/admin/transport/routes"
            ),
          ]);

      if (yearsRes.years) setAcademicYears(yearsRes.years);
      if (branchesRes.branches) setBranches(branchesRes.branches);
      if (usersRes.users) setUsers(usersRes.users);
      if (routesRes.routes) setRoutes(routesRes.routes);
      } catch (err) {
        console.error("Error fetching lookups:", err);
      } finally {
        setLookupsLoaded(true);
      }
    };
    void fetchLookups();
  }, []);

  const printedAt = useMemo(() => new Date(), []);

  // ---- Resolved values ----
  const resolved = useMemo(() => {
    if (!student) return null;

    const admissionNo = resolveValue(
      student.admissionNumber ?? student.admissionNo
    );
    const name = resolveValue(student.studentName);
    const classApplied = resolveValue(student.classApplied ?? student.class);
    const section = resolveValue(student.section);

    const ayId = resolveValue(
      student.academicYearId ??
        student.academicYear ??
        student.academicYearName
    );
    const academicYearName =
      student.academicYearName || yearMap.get(ayId) || ayId;

    const branchName = branchMap.get(resolveValue(student.branchId)) || "";

    const fatherName = resolveValue(student.fatherName);
    const fatherMobile = resolveValue(
      student.fatherMobile ?? student.fatherPhone ?? student.phone
    );
    const fatherOcc = resolveValue(student.fatherOccupation);

    const motherName = resolveValue(student.motherName);
    const motherMobile = resolveValue(
      student.motherMobile ?? student.motherPhone
    );
    const motherOcc = resolveValue(student.motherOccupation);

    const guardianName = resolveValue(
      student.guardianName ?? emergencyValue(student, "name")
    );
    const guardianRelation = resolveValue(
      student.guardianRelation ?? emergencyValue(student, "relation")
    );
    const emergencyPhone = resolveValue(emergencyValue(student, "phone"));

    const addressLine = resolveValue(
      student.addressLine ?? student.address
    );
    const village = resolveValue(student.villageArea);
    const mandal = resolveValue(student.mandal);
    const district = resolveValue(student.district);
    const pincode = resolveValue(student.pincode);

    const prevSchool = resolveValue(previousSchoolName(student));
    const lastClass = resolveValue(previousSchoolValue(student, "lastClass"));
    const tcNo = resolveValue(previousSchoolValue(student, "tcNo"));

    const transportRequired = student.transportRequired
      ? "Yes"
      : resolveValue(student.transportRouteId) ||
        resolveValue(student.transportStopName)
        ? "Yes"
        : "No";
    const routeName =
      routeMap.get(resolveValue(student.transportRouteId)) ||
      resolveValue(student.busRoute ?? student.transportRouteName);
    const pickupPoint = resolveValue(
      student.pickupPoint ?? student.transportStopName
    );

    const feePlan = resolveValue(
      student.feePlan ??
        (student.totalFeeAmount ? "Standard" : "")
    );
    const feeTypes = student.feeHeads
      ? student.feeHeads
          .map((h) => {
            const amount = Number(
              (h as { committed?: unknown; amount?: unknown }).committed ??
                (h as { amount?: unknown }).amount ??
                NaN
            );
            return Number.isFinite(amount) && amount > 0
              ? `${h.name} (₹${amount.toLocaleString("en-IN")})`
              : h.name;
          })
          .join(", ")
      : "";
    const totalFee = student.totalFeeAmount ?? student.commitmentFee ?? "";
    const concession = student.concession ?? student.totalFeeAmount
      ? Number(student.totalFeeAmount) - Number(student.commitmentFee ?? student.totalFeeAmount)
      : "";

    const verifiedByUid = resolveValue(student.verifiedBy);
    const createdByUid = resolveValue(student.createdBy);

    const verifiedByName = userMap.get(verifiedByUid) || verifiedByUid || "—";
    const createdByName = userMap.get(createdByUid) || createdByUid || "—";

    const admissionDate = student.createdAt;

    const aadhaar = resolveValue(
      student.studentAadhaar ?? student.aadhaarNumber
    );
    const dob = student.dateOfBirth;
    const gender = resolveValue(student.gender);
    const bloodGroup = resolveValue(student.bloodGroup);
    const emis = resolveValue(student.emisId);
    const nationality = resolveValue(student.nationality);
    const motherTongue = resolveValue(student.motherTongue);
    const category = resolveValue(student.category);
    const medium = resolveValue(student.medium);
    const secondLang = resolveValue(student.secondLanguage);
    const admissionType = resolveValue(student.admissionType);
    const admissionStatus = resolveValue(
      student.admissionStatus ?? "Pending"
    );
    const studentLogin = resolveValue(student.studentLogin);
    const parentLogin = resolveValue(student.parentLogin);

    return {
      admissionNo,
      name,
      classApplied,
      section,
      academicYearName,
      branchName,
      fatherName,
      fatherMobile,
      fatherOcc,
      motherName,
      motherMobile,
      motherOcc,
      guardianName,
      guardianRelation,
      emergencyPhone,
      addressLine,
      village,
      mandal,
      district,
      pincode,
      prevSchool,
      lastClass,
      tcNo,
      transportRequired,
      routeName,
      pickupPoint,
      feePlan,
      feeTypes,
      totalFee,
      concession,
      verifiedByName,
      createdByName,
      admissionDate,
      aadhaar,
      dob,
      gender,
      bloodGroup,
      emis,
      nationality,
      motherTongue,
      category,
      medium,
      secondLang,
      admissionType,
      admissionStatus,
      studentLogin,
      parentLogin,
    };
  }, [student, userMap, routeMap, yearMap, branchMap]);

  return {
    student,
    loading,
    error,
    lookupsLoaded,
    yearMap,
    branchMap,
    userMap,
    routeMap,
    resolved,
    printedAt,
  };
}

export type AdmissionResolved = NonNullable<ReturnType<typeof useAdmissionData>["resolved"]>;
