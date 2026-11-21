"use client";

import { PortalSubnav } from "@/components/PortalSubnav";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { CalendarCheck } from "lucide-react";
import { useEffect, useState } from "react";

type Meeting = {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  classes?: string;
  status?: string;
};

const statusStyles: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ongoing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
};

export default function PortalPtmPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void adminApiRequest<{ meetings: Meeting[] }>("/api/portal/ptm")
      .then((data) => {
        if (active) setMeetings(data.meetings ?? []);
      })
      .catch((err) => {
        if (active) setError(err instanceof AdminApiError ? err.message : "Unable to load PTM meetings");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <PortalSubnav />
      <main className="px-4 py-6 md:px-7">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Parent-Teacher Meetings</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">Upcoming and past meeting schedules announced by the school.</p>

        {error && <div className="card mt-4 border-l-4 border-l-red-500 p-4 text-sm font-semibold text-red-500">{error}</div>}

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="card mt-4 flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <CalendarCheck size={28} /> No PTM scheduled yet.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {meetings.map((meeting) => (
              <li key={meeting.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <h2 className="font-bold text-foreground">{meeting.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {meeting.date} · {meeting.startTime || "—"} to {meeting.endTime || "—"}
                    {meeting.classes ? ` · ${meeting.classes}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusStyles[meeting.status ?? "scheduled"] ?? statusStyles.scheduled}`}>
                  {meeting.status || "scheduled"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
