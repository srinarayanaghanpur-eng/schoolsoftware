"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { adminApiRequest } from "@/lib/adminApiClient";
import type { FaceAttendanceSettings, FaceDevice } from "@sri-narayana/shared";
import {
  CheckCircle2,
  Fingerprint,
  Laptop,
  Loader2,
  Save,
  ScanFace,
  ShieldCheck,
  Trash2,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type TeacherRow = {
  id: string;
  fullName: string;
  employeeId: string;
  subject: string;
  enrolled: boolean;
  face: { modelVersion: string; sampleCount: number; quality?: number; updatedAt: string } | null;
};

type Response = {
  ok: boolean;
  settings: FaceAttendanceSettings;
  devices: FaceDevice[];
  teachers: TeacherRow[];
};

const FALLBACK: FaceAttendanceSettings = {
  enabled: false,
  matchThreshold: 0.6,
  requireLiveness: true,
  allowSharedDevices: true,
  allowSelfOnUnapprovedDevices: true,
  modelVersion: "mobilefacenet-192-v1"
};

export default function FaceAttendancePage() {
  const toast = usePopup();
  const [settings, setSettings] = useState<FaceAttendanceSettings>(FALLBACK);
  const [devices, setDevices] = useState<FaceDevice[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<Response>("/api/admin/face-attendance", undefined, { fresh: true });
      setSettings({ ...FALLBACK, ...result.settings });
      setDevices(result.devices ?? []);
      setTeachers(result.teachers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load face attendance settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = <K extends keyof FaceAttendanceSettings>(key: K, value: FaceAttendanceSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminApiRequest("/api/settings/face-attendance", {
        method: "PATCH",
        body: JSON.stringify(settings)
      });
      toast.success("Face attendance settings saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save face attendance settings.");
    } finally {
      setSaving(false);
    }
  };

  const actOnDevice = async (deviceId: string, action: "approve" | "reject" | "revoke") => {
    setBusyId(deviceId);
    setError(null);
    try {
      await adminApiRequest("/api/admin/face-attendance/devices", {
        method: "POST",
        body: JSON.stringify({ deviceId, action })
      });
      toast.success(action === "approve" ? "Device approved." : action === "reject" ? "Device rejected." : "Device access revoked.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the device.");
    } finally {
      setBusyId(null);
    }
  };

  const deleteFace = async (teacher: TeacherRow) => {
    const confirmed = await toast.confirm(
      `Delete face enrollment?`,
      `${teacher.fullName} will need to enroll again.`,
      { okLabel: "Delete", danger: true }
    );
    if (!confirmed) return;
    setBusyId(teacher.id);
    setError(null);
    try {
      await adminApiRequest(`/api/admin/face-attendance/enroll?teacherId=${encodeURIComponent(teacher.id)}`, {
        method: "DELETE"
      });
      toast.success(`Face deleted for ${teacher.fullName}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the face enrollment.");
    } finally {
      setBusyId(null);
    }
  };

  const enrolledCount = teachers.filter((teacher) => teacher.enrolled).length;
  const pendingDevices = devices.filter((device) => device.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Face attendance"
        description="Enroll teacher faces on the office laptop and approve the shared tablet/phone that will run the face kiosk."
      />
      <section className="space-y-5 p-4 md:p-7">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#7d86a8]">Enrolled teachers</p>
            <p className="mt-1 text-3xl font-extrabold text-[#1f2136]">{enrolledCount}</p>
            <p className="text-sm font-medium text-[#7d86a8]">of {teachers.length} active teachers</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#7d86a8]">Approved devices</p>
            <p className="mt-1 text-3xl font-extrabold text-[#1f2136]">
              {devices.filter((device) => device.status === "approved").length}
            </p>
            <p className="text-sm font-medium text-[#7d86a8]">{pendingDevices} waiting for approval</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#7d86a8]">Status</p>
            <p className={`mt-1 text-xl font-extrabold ${settings.enabled ? "text-[#0f8d52]" : "text-[#c83f4d]"}`}>
              {settings.enabled ? "Face attendance is ON" : "Face attendance is OFF"}
            </p>
            <p className="text-sm font-medium text-[#7d86a8]">Model: {settings.modelVersion}</p>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-[#ffd5da] bg-[#ffebed] px-3 py-2 text-sm font-semibold text-[#c83f4d]">
            {error}
          </p>
        )}

        <div className="card space-y-4 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef0ff] text-[#3033a1]">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 className="font-bold text-[#1f2136]">Face attendance settings</h2>
              <p className="text-sm font-medium text-[#7d86a8]">
                Recognition runs on the device. This server only checks the face fingerprint again before saving attendance.
              </p>
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e6f0] bg-[#f8f9ff] px-3 py-3 text-sm">
            <span>
              <span className="block font-bold text-[#303247]">Turn on face attendance</span>
              <span className="font-medium text-[#7d86a8]">
                If off, the Face button is hidden and the kiosk API rejects requests.
              </span>
            </span>
            <input
              className="h-5 w-5 accent-[#3033a1]"
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => update("enabled", event.target.checked)}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-semibold text-[#303247]">
              Match threshold: {settings.matchThreshold.toFixed(2)}
              <input
                className="mt-2 w-full accent-[#3033a1]"
                type="range"
                min={0.4}
                max={0.9}
                step={0.01}
                value={settings.matchThreshold}
                onChange={(event) => update("matchThreshold", Number(event.target.value))}
              />
              <span className="mt-1 block text-xs font-medium text-[#7d86a8]">
                Higher is stricter. Start at 0.60 and raise it if a wrong teacher is ever shown.
              </span>
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e6f0] px-3 py-3 text-sm">
              <span>
                <span className="block font-semibold text-[#303247]">Require blink + head turn</span>
                <span className="font-medium text-[#7d86a8]">Stops a printed photo or phone screen.</span>
              </span>
              <input
                className="h-5 w-5 accent-[#3033a1]"
                type="checkbox"
                checked={settings.requireLiveness}
                onChange={(event) => update("requireLiveness", event.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e6f0] px-3 py-3 text-sm">
              <span>
                <span className="block font-semibold text-[#303247]">Allow approved shared devices</span>
                <span className="font-medium text-[#7d86a8]">Any enrolled teacher can check in on an approved tablet.</span>
              </span>
              <input
                className="h-5 w-5 accent-[#3033a1]"
                type="checkbox"
                checked={settings.allowSharedDevices}
                onChange={(event) => update("allowSharedDevices", event.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e6f0] px-3 py-3 text-sm">
              <span>
                <span className="block font-semibold text-[#303247]">Allow self check-in on unapproved phones</span>
                <span className="font-medium text-[#7d86a8]">Only the signed-in teacher; never another teacher.</span>
              </span>
              <input
                className="h-5 w-5 accent-[#3033a1]"
                type="checkbox"
                checked={settings.allowSelfOnUnapprovedDevices}
                onChange={(event) => update("allowSelfOnUnapprovedDevices", event.target.checked)}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary" disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              {saving ? "Saving..." : "Save face settings"}
            </button>
            <Link className="btn-secondary" href="/admin/face-attendance/enroll">
              <ScanFace size={16} />
              Enroll teacher faces
            </Link>
            <span className="text-xs font-medium text-[#7d86a8]">
              Enrollment is done on this office laptop with its webcam.
            </span>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <h2 className="font-bold text-[#1f2136]">Face devices</h2>
              <p className="text-sm font-medium text-[#7d86a8]">
                Approve only the school tablet or shared phone. A pending device can still check in the signed-in teacher.
              </p>
            </div>
            <button className="btn-secondary" disabled={loading} onClick={() => void load()}>
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Laptop size={16} />}
              Refresh
            </button>
          </div>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last seen</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm font-medium text-[#7d86a8]">
                    No face devices have opened the app yet. Open the mobile app and tap Face once.
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id} className="border-t border-stone-100">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#303247]">{device.name || "Unnamed device"}</p>
                      <p className="text-xs font-medium text-[#7d86a8]">{device.id}</p>
                    </td>
                    <td className="px-4 py-3">{device.platform || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          device.status === "approved"
                            ? "font-bold text-[#0f8d52]"
                            : device.status === "pending"
                              ? "font-bold text-[#d79418]"
                              : "font-bold text-[#c83f4d]"
                        }
                      >
                        {device.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString("en-IN") : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {device.status !== "approved" && (
                          <button
                            className="btn-secondary"
                            disabled={busyId === device.id}
                            onClick={() => void actOnDevice(device.id, "approve")}
                          >
                            <CheckCircle2 size={15} /> Approve
                          </button>
                        )}
                        {device.status === "pending" && (
                          <button
                            className="btn-secondary"
                            disabled={busyId === device.id}
                            onClick={() => void actOnDevice(device.id, "reject")}
                          >
                            <XCircle size={15} /> Reject
                          </button>
                        )}
                        {device.status === "approved" && (
                          <button
                            className="btn-secondary"
                            disabled={busyId === device.id}
                            onClick={() => void actOnDevice(device.id, "revoke")}
                          >
                            <XCircle size={15} /> Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card overflow-x-auto">
          <div className="px-4 py-3">
            <h2 className="font-bold text-[#1f2136]">Teacher face enrollment</h2>
            <p className="text-sm font-medium text-[#7d86a8]">
              Enroll 3 angles on the office laptop. Only the face fingerprint is stored; photos are not saved.
            </p>
          </div>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Face</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id} className="border-t border-stone-100">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#303247]">{teacher.fullName}</p>
                    <p className="text-xs font-medium text-[#7d86a8]">{teacher.subject || "—"}</p>
                  </td>
                  <td className="px-4 py-3">{teacher.employeeId || "—"}</td>
                  <td className="px-4 py-3">
                    {teacher.enrolled ? (
                      <span className="inline-flex items-center gap-1 font-bold text-[#0f8d52]">
                        <Fingerprint size={15} /> Enrolled
                      </span>
                    ) : (
                      <span className="font-bold text-[#d79418]">Not enrolled</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="btn-secondary"
                        href={`/admin/face-attendance/enroll?teacherId=${encodeURIComponent(teacher.id)}`}
                      >
                        <ScanFace size={15} /> {teacher.enrolled ? "Re-enroll" : "Enroll"}
                      </Link>
                      {teacher.enrolled && (
                        <button
                          className="btn-secondary"
                          disabled={busyId === teacher.id}
                          onClick={() => void deleteFace(teacher)}
                        >
                          <Trash2 size={15} /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

