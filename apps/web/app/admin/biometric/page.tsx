import { PageHeader } from "@/components/PageHeader";
import { Fingerprint, Server } from "lucide-react";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

type LogRow = {
  id: string;
  deviceId: string;
  biometricUserId: string;
  teacherName: string;
  timestamp: string;
  verificationType: string;
  eventType: string;
  processed: boolean;
};

async function loadLogs(): Promise<LogRow[]> {
  const db = adminDb();
  const [logsSnap, teachersSnap] = await Promise.all([
    db.collection("biometric_logs").orderBy("createdAt", "desc").limit(50).get(),
    db.collection("teachers").get()
  ]);
  const teacherById = new Map(teachersSnap.docs.map((d) => [d.id, (d.data().fullName as string) || ""]));
  return logsSnap.docs.map((d) => {
    const l = d.data();
    return {
      id: d.id,
      deviceId: l.deviceId || "—",
      biometricUserId: l.biometricUserId || "—",
      teacherName: l.teacherId ? teacherById.get(l.teacherId) || "—" : "—",
      timestamp: l.timestamp || "",
      verificationType: l.verificationType || "unknown",
      eventType: l.eventType || "—",
      processed: Boolean(l.processed)
    };
  });
}

function formatTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

export default async function BiometricPage() {
  const logs = await loadLogs().catch(() => []);

  return (
    <>
      <PageHeader title="Biometric Device Settings" description="ESSL device webhook and live biometric log monitoring." />
      <section className="space-y-4 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold"><Server size={18} /> Webhook endpoint</div>
            <code className="block rounded-md bg-stone-100 p-3 text-sm">POST /api/biometric/log</code>
          </div>
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold"><Fingerprint size={18} /> Supported event payload</div>
            <pre className="overflow-auto rounded-md bg-stone-100 p-3 text-xs">{`{
  "deviceId": "ESSL-001",
  "biometricUserId": "EMP001",
  "timestamp": "2026-05-19T09:05:00+05:30",
  "verificationType": "face",
  "eventType": "checkin"
}`}</pre>
          </div>
        </div>
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="font-semibold text-stone-800">Recent biometric logs</h2>
            <span className="text-xs font-medium text-stone-500">{logs.length} shown</span>
          </div>
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Biometric ID</th>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Processed</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-stone-500">
                    No biometric logs yet. Punches forwarded from the eSSL device will appear here.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-t border-stone-100">
                    <td className="px-4 py-3">{log.deviceId}</td>
                    <td className="px-4 py-3">{log.biometricUserId}</td>
                    <td className="px-4 py-3">{log.teacherName}</td>
                    <td className="px-4 py-3">{formatTime(log.timestamp)}</td>
                    <td className="px-4 py-3">{log.verificationType}</td>
                    <td className="px-4 py-3">{log.eventType}</td>
                    <td className="px-4 py-3">
                      <span className={log.processed ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                        {log.processed ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
