import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import type { AttendanceRecord, AttendanceSource, AttendanceStatus, Holiday, Teacher } from "@sri-narayana/shared";
import { auth, db } from "@/lib/firebase";

type TeacherAttendanceState = {
  teacher: Teacher | null;
  records: AttendanceRecord[];
  holidays: Holiday[];
  loading: boolean;
  error: string | null;
};

type ReadyKey = "teacher" | "records" | "holidays";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asIsoString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  const maybeTimestamp = asRecord(value);
  if (typeof maybeTimestamp.toDate === "function") {
    return (maybeTimestamp.toDate() as Date).toISOString();
  }
  return undefined;
}

function asStatus(value: unknown): AttendanceStatus {
  const statuses: AttendanceStatus[] = ["present", "late", "cl", "holiday", "absent", "not_marked"];
  return statuses.includes(value as AttendanceStatus) ? (value as AttendanceStatus) : "not_marked";
}

function asSource(value: unknown): AttendanceSource {
  const sources: AttendanceSource[] = ["mobile", "biometric", "admin", "system"];
  return sources.includes(value as AttendanceSource) ? (value as AttendanceSource) : "mobile";
}

function normalizeAttendanceRecord(data: Record<string, unknown>): AttendanceRecord {
  const date = String(data.date ?? "");
  const source = asSource(data.source);
  const sourcesUsed = Array.isArray(data.sourcesUsed) ? (data.sourcesUsed as AttendanceSource[]) : [source];

  return {
    ...(data as Partial<AttendanceRecord>),
    teacherId: String(data.teacherId ?? ""),
    date,
    month: String(data.month ?? date.slice(0, 7)),
    year: Number(data.year ?? date.slice(0, 4) ?? new Date().getFullYear()),
    status: asStatus(data.status),
    checkInTime: asIsoString(data.checkInTime),
    checkOutTime: asIsoString(data.checkOutTime),
    source,
    sourcesUsed,
    lateMinutes: Number(data.lateMinutes ?? 0),
    isLate: Boolean(data.isLate),
    adminEdited: Boolean(data.adminEdited),
    createdAt: asIsoString(data.createdAt) ?? "",
    updatedAt: asIsoString(data.updatedAt) ?? ""
  };
}

function normalizeTeacher(id: string, data: Record<string, unknown>): Teacher {
  return {
    ...(data as Partial<Teacher>),
    id,
    fullName: String(data.fullName ?? "Teacher"),
    internalEmail: String(data.internalEmail ?? data.email ?? ""),
    phone: String(data.phone ?? ""),
    subject: String(data.subject ?? ""),
    employeeId: String(data.employeeId ?? ""),
    baseSalary: Number(data.baseSalary ?? 0),
    joiningDate: String(data.joiningDate ?? ""),
    status: data.status === "inactive" ? "inactive" : "active",
    allowedCLPerMonth: Number(data.allowedCLPerMonth ?? 0),
    lateDeductionRule: (data.lateDeductionRule as Teacher["lateDeductionRule"]) ?? "after_3_lates_one_day",
    casualLeaveBalance: Number(data.casualLeaveBalance ?? 0),
    casualLeaveUsedThisMonth: Number(data.casualLeaveUsedThisMonth ?? 0),
    lateEntriesThisMonth: Number(data.lateEntriesThisMonth ?? 0),
    absentDaysThisMonth: Number(data.absentDaysThisMonth ?? 0),
    createdAt: asIsoString(data.createdAt) ?? "",
    updatedAt: asIsoString(data.updatedAt) ?? ""
  };
}

function normalizeHoliday(id: string, data: Record<string, unknown>): Holiday {
  return {
    id,
    date: String(data.date ?? ""),
    title: String(data.title ?? "Holiday"),
    type: (data.type as Holiday["type"]) ?? "school",
    createdAt: asIsoString(data.createdAt) ?? ""
  };
}

async function resolveTeacherId(user: User): Promise<string | null> {
  const token = await user.getIdTokenResult();
  if (typeof token.claims.teacherId === "string" && token.claims.teacherId.trim()) {
    return token.claims.teacherId;
  }

  const userSnapshot = await getDoc(doc(db, "users", user.uid));
  const userData = userSnapshot.exists() ? asRecord(userSnapshot.data()) : {};
  if (typeof userData.teacherId === "string" && userData.teacherId.trim()) {
    return userData.teacherId;
  }

  const teacherSnapshot = await getDocs(
    query(collection(db, "teachers"), where("uid", "==", user.uid), limit(1))
  );
  return teacherSnapshot.empty ? null : teacherSnapshot.docs[0].id;
}

export function useTeacherAttendanceData(): TeacherAttendanceState {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let runId = 0;
    let dataUnsubscribers: Array<() => void> = [];

    const clearDataSubscriptions = () => {
      dataUnsubscribers.forEach((unsubscribe) => unsubscribe());
      dataUnsubscribers = [];
    };

    const connect = async (user: User, currentRunId: number) => {
      const ready: Record<ReadyKey, boolean> = {
        teacher: false,
        records: false,
        holidays: false
      };

      const markReady = (key: ReadyKey) => {
        ready[key] = true;
        if (!disposed && currentRunId === runId && Object.values(ready).every(Boolean)) {
          setLoading(false);
        }
      };

      try {
        const teacherId = await resolveTeacherId(user);
        if (!teacherId) {
          throw new Error("Teacher profile not found.");
        }
        if (disposed || currentRunId !== runId) return;

        dataUnsubscribers.push(
          onSnapshot(
            doc(db, "teachers", teacherId),
            (snapshot) => {
              if (!snapshot.exists()) {
                setTeacher(null);
                setError("Teacher profile not found.");
              } else {
                setTeacher(normalizeTeacher(snapshot.id, asRecord(snapshot.data())));
              }
              markReady("teacher");
            },
            (snapshotError) => {
              setError(snapshotError.message);
              markReady("teacher");
            }
          )
        );

        dataUnsubscribers.push(
          onSnapshot(
            query(
              collection(db, "attendance"),
              where("teacherId", "==", teacherId),
              orderBy("date", "desc"),
              limit(180)
            ),
            (snapshot) => {
              setRecords(snapshot.docs.map((item: QueryDocumentSnapshot) => normalizeAttendanceRecord(asRecord(item.data()))));
              markReady("records");
            },
            (snapshotError) => {
              setError(snapshotError.message);
              markReady("records");
            }
          )
        );

        dataUnsubscribers.push(
          onSnapshot(
            query(collection(db, "holidays"), orderBy("date", "desc"), limit(370)),
            (snapshot) => {
              setHolidays(snapshot.docs.map((item: QueryDocumentSnapshot) => normalizeHoliday(item.id, asRecord(item.data()))));
              markReady("holidays");
            },
            (snapshotError) => {
              setError(snapshotError.message);
              markReady("holidays");
            }
          )
        );
      } catch (err) {
        if (!disposed && currentRunId === runId) {
          setError(err instanceof Error ? err.message : "Unable to load attendance data.");
          setLoading(false);
        }
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      runId += 1;
      clearDataSubscriptions();
      setTeacher(null);
      setRecords([]);
      setHolidays([]);
      setError(null);

      if (!user) {
        setLoading(false);
        setError("Please sign in to continue.");
        return;
      }

      setLoading(true);
      void connect(user, runId);
    });

    return () => {
      disposed = true;
      unsubscribeAuth();
      clearDataSubscriptions();
    };
  }, []);

  return useMemo(
    () => ({ teacher, records, holidays, loading, error }),
    [teacher, records, holidays, loading, error]
  );
}
