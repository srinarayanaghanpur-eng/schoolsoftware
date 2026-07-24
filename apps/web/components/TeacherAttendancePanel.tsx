"use client";

import { auth } from "@sri-narayana/shared/firebase/client";
import {
  getAttendanceWindow,
  isWithinCheckInWindow,
  isWithinCheckOutWindow,
  type AttendanceEventType,
  type EmploymentType,
  type Holiday
} from "@sri-narayana/shared";
import { CalendarDays, CalendarOff, LogIn, LogOut, MapPin, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

function getBrowserLocation() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    });
  });
}

export function TeacherAttendancePanel({
  teacherId,
  employmentType = "full_time",
  todayHoliday = null
}: {
  teacherId: string;
  employmentType?: EmploymentType;
  todayHoliday?: Holiday | null;
}) {
  const isManagementHoliday = todayHoliday?.type === "management_declared";
  const [loading, setLoading] = useState<AttendanceEventType | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastGps, setLastGps] = useState<{ latitude: number; longitude: number; accuracy?: number; distance?: number } | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Re-evaluate the open/closed windows every 30s so buttons unlock/lock automatically.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const window = getAttendanceWindow(employmentType);
  const canCheckIn = isWithinCheckInWindow(now, undefined, employmentType);
  const canCheckOut = isWithinCheckOutWindow(now, undefined, employmentType);

  const markAttendance = async (eventType: AttendanceEventType) => {
    setLoading(eventType);
    setMessage(null);
    try {
      if (!auth.currentUser) throw new Error("Please sign in again.");
      let location: GeolocationPosition | null = null;
      try {
        location = await getBrowserLocation();
        setLastGps({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy
        });
      } catch {
        location = null;
      }

      const tokenResult = await auth.currentUser.getIdTokenResult();
      const resolvedTeacherId = typeof tokenResult.claims.teacherId === "string" ? tokenResult.claims.teacherId : teacherId;
      if (!resolvedTeacherId) throw new Error("Teacher profile is missing.");
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          teacherId: resolvedTeacherId,
          eventType,
          timestamp: new Date().toISOString(),
          ...(location
            ? {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracyMeters: location.coords.accuracy
              }
            : {}),
          deviceInfo: navigator.userAgent
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Attendance failed");
      if (location) {
        setLastGps({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          distance: result.attendance?.distanceFromCampus
        });
      }
      const savedMessage = eventType === "checkin" ? "Check-in saved." : "Check-out saved.";
      setMessage(result.gpsRequired === false ? `${savedMessage} GPS check is off for your account.` : savedMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Attendance failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <article className="dashboard-animate overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#30328f_0%,#24266f_100%)] p-5 text-white shadow-[0_14px_28px_rgba(36,38,111,0.2)] md:p-6" style={{ animationDelay: "330ms" }}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#d7dcff]"><ShieldCheck size={17} className="text-[#ffd35b]" /> Secure attendance</p>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight">Record your workday</h2>
          <p className="mt-2 max-w-lg text-sm font-medium leading-6 text-[#d7dcff]">We’ll verify your location before saving your attendance. Please allow browser location access when prompted.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-[#e3e6ff]"><MapPin size={15} className="text-[#ffd35b]" /> Campus check</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[#e3e6ff]">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5">
          Check-in window: {window.checkInStart}–{window.checkInEnd}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5">
          Check-out window: {window.checkOutStart}–{window.checkOutEnd}
        </span>
      </div>

      {isManagementHoliday ? (
        <div className="mt-4 rounded-xl border border-[#ffd35b]/40 bg-[#f7c548]/15 px-4 py-3.5">
          <p className="flex items-center gap-2 text-sm font-extrabold text-[#ffd35b]"><CalendarOff size={17} /> Today: Holiday — Declared by Management</p>
          <p className="mt-1 text-sm font-semibold text-[#eef0ff]">Reason: {todayHoliday?.reason || todayHoliday?.title}</p>
          <p className="mt-0.5 text-sm font-medium text-[#d7dcff]">No attendance required today.</p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-[#4ade80]/40 bg-[#4ade80]/10 px-4 py-3.5">
          <p className="flex items-center gap-2 text-sm font-extrabold text-[#4ade80]"><CalendarDays size={17} /> Today: Working Day</p>
          <p className="mt-0.5 text-sm font-medium text-[#d7dcff]">Attendance marking is active for today.</p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#f7c548] px-4 py-3.5 text-sm font-extrabold text-[#292b7f] transition hover:-translate-y-0.5 hover:bg-[#ffd35b] disabled:cursor-not-allowed disabled:opacity-50" disabled={Boolean(loading) || !canCheckIn || isManagementHoliday} onClick={() => markAttendance("checkin")}>
          <LogIn size={18} /> {isManagementHoliday ? "Holiday Declared" : loading === "checkin" ? "Checking location…" : canCheckIn ? "Check in" : "Check-in closed"}
        </button>
        <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50" disabled={Boolean(loading) || !canCheckOut || isManagementHoliday} onClick={() => markAttendance("checkout")}>
          <LogOut size={18} /> {isManagementHoliday ? "Holiday Declared" : loading === "checkout" ? "Checking location…" : canCheckOut ? "Check out" : "Check-out closed"}
        </button>
      </div>
      {message && <p className="mt-4 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm font-medium text-[#eef0ff]">{message}</p>}
      {lastGps && (
        <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-[#20226b]/50 p-3 text-xs font-medium text-[#d7dcff] sm:grid-cols-3">
          <p>Latitude: {lastGps.latitude.toFixed(6)}</p>
          <p>Longitude: {lastGps.longitude.toFixed(6)}</p>
          <p>Distance: {lastGps.distance === undefined ? "--" : `${lastGps.distance} m`}</p>
        </div>
      )}
    </article>
  );
}
