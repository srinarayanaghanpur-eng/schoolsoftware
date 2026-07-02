"use client";

import { auth } from "@sri-narayana/shared/firebase/client";
import { DEFAULT_SETTINGS, type Teacher } from "@sri-narayana/shared";
import { LocateFixed, Power, Save, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TeacherGpsForm = {
  gpsEnabled: boolean;
  gpsLatitude: string;
  gpsLongitude: string;
  gpsRadiusMeters: string;
};

function formFromTeacher(teacher?: Teacher): TeacherGpsForm {
  return {
    gpsEnabled: teacher?.gpsEnabled ?? true,
    gpsLatitude: String(teacher?.gpsLatitude ?? DEFAULT_SETTINGS.campusLatitude),
    gpsLongitude: String(teacher?.gpsLongitude ?? DEFAULT_SETTINGS.campusLongitude),
    gpsRadiusMeters: String(teacher?.gpsRadiusMeters ?? DEFAULT_SETTINGS.geofenceRadiusMeters)
  };
}

function getBrowserLocation() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  });
}

export function TeacherGpsSettings() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [form, setForm] = useState<TeacherGpsForm>(() => formFromTeacher());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === selectedTeacherId) ?? teachers[0],
    [selectedTeacherId, teachers]
  );

  const update = (key: keyof TeacherGpsForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const apiRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("Please sign in as admin again.");
    }

    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(init?.headers ?? {})
      }
    });
    const result = await response.json();
    if (!response.ok || result.ok === false) {
      throw new Error(result.error ?? "Request failed");
    }
    return result;
  };

  const loadTeachers = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<{ teachers: Teacher[] }>("/api/admin/teachers");
      setTeachers(result.teachers);
      setSelectedTeacherId((current) => current || result.teachers[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load teacher GPS settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTeachers();
  }, []);

  useEffect(() => {
    if (!selectedTeacherId && teachers[0]) {
      setSelectedTeacherId(teachers[0].id);
    }
  }, [selectedTeacherId, teachers]);

  useEffect(() => {
    setForm(formFromTeacher(selectedTeacher));
  }, [selectedTeacher]);

  const useCurrentLocation = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const position = await getBrowserLocation();
      setForm((current) => ({
        ...current,
        gpsLatitude: position.coords.latitude.toFixed(7),
        gpsLongitude: position.coords.longitude.toFixed(7)
      }));
      setMessage("Current GPS captured. Save it for selected teacher or apply to all teachers.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to capture current GPS.");
    } finally {
      setLoading(false);
    }
  };

  const saveGps = async (mode: "teacher" | "all") => {
    if (mode === "teacher" && !selectedTeacher) {
      setError("Select a teacher before saving GPS settings.");
      return;
    }

    if (mode === "all" && !window.confirm("Apply this GPS setting to every teacher?")) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        mode,
        teacherId: selectedTeacher?.id,
        gpsEnabled: form.gpsEnabled,
        gpsLatitude: Number(form.gpsLatitude),
        gpsLongitude: Number(form.gpsLongitude),
        gpsRadiusMeters: Number(form.gpsRadiusMeters)
      };

      if (!Number.isFinite(payload.gpsLatitude) || !Number.isFinite(payload.gpsLongitude)) {
        throw new Error("Latitude and longitude must be valid numbers.");
      }
      if (!Number.isFinite(payload.gpsRadiusMeters)) {
        throw new Error("Allowed radius must be a valid number.");
      }

      const result = await apiRequest<{ message?: string; updatedCount?: number }>("/api/admin/gps-settings", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setMessage(result.message ?? "Teacher GPS settings updated.");
      await loadTeachers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save teacher GPS settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Teacher GPS control</h2>
          <p className="mt-1 text-sm font-medium text-[#7d86a8]">
            Turn GPS on/off for one teacher, update one teacher location, or apply the same GPS to all teachers.
          </p>
        </div>
        <UsersRound className="text-[#3033a1]" size={22} />
      </div>

      <label className="block text-sm">
        Select teacher
        <select
          className="field mt-1"
          value={selectedTeacher?.id ?? ""}
          onChange={(event) => setSelectedTeacherId(event.target.value)}
          disabled={loading || teachers.length === 0}
        >
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.fullName} - {teacher.employeeId}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e6f0] bg-[#f8f9ff] px-3 py-3 text-sm">
        <span>
          <span className="block font-bold text-[#303247]">GPS attendance for selected teacher</span>
          <span className="font-medium text-[#7d86a8]">
            {form.gpsEnabled ? "ON: teacher must be inside the allowed radius." : "OFF: teacher can mark attendance without GPS geofence."}
          </span>
        </span>
        <input
          className="h-5 w-5 accent-[#3033a1]"
          type="checkbox"
          checked={form.gpsEnabled}
          onChange={(event) => update("gpsEnabled", event.target.checked)}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block text-sm">
          Teacher latitude
          <input className="field mt-1" value={form.gpsLatitude} onChange={(event) => update("gpsLatitude", event.target.value)} />
        </label>
        <label className="block text-sm">
          Teacher longitude
          <input className="field mt-1" value={form.gpsLongitude} onChange={(event) => update("gpsLongitude", event.target.value)} />
        </label>
        <label className="block text-sm">
          Radius meters
          <input className="field mt-1" value={form.gpsRadiusMeters} onChange={(event) => update("gpsRadiusMeters", event.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={loading} onClick={useCurrentLocation}>
          <LocateFixed size={16} />
          Use current GPS
        </button>
        <button className="btn-primary" disabled={loading || !selectedTeacher} onClick={() => saveGps("teacher")}>
          <Save size={16} />
          {loading ? "Saving..." : "Save selected teacher"}
        </button>
        <button className="btn-secondary" disabled={loading || teachers.length === 0} onClick={() => saveGps("all")}>
          <Power size={16} />
          Apply GPS to all teachers
        </button>
      </div>

      {message && <p className="rounded-xl border border-[#c8f0dc] bg-[#e6f8ef] px-3 py-2 text-sm font-semibold text-[#0f8d52]">{message}</p>}
      {error && <p className="rounded-xl border border-[#ffd5da] bg-[#ffebed] px-3 py-2 text-sm font-semibold text-[#c83f4d]">{error}</p>}
    </div>
  );
}
