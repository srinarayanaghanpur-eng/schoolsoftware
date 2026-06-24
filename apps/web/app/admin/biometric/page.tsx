import { PageHeader } from "@/components/PageHeader";
import { demoBiometricLogs } from "@sri-narayana/shared";
import { Fingerprint, Server } from "lucide-react";

export default function BiometricPage() {
  return (
    <>
      <PageHeader title="Biometric Device Settings" description="ESSL device webhook and raw biometric log monitoring." />
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
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Biometric ID</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Processed</th>
              </tr>
            </thead>
            <tbody>
              {demoBiometricLogs.map((log) => (
                <tr key={log.id} className="border-t border-stone-100">
                  <td className="px-4 py-3">{log.deviceId}</td>
                  <td className="px-4 py-3">{log.biometricUserId}</td>
                  <td className="px-4 py-3">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-3">{log.verificationType}</td>
                  <td className="px-4 py-3">{log.eventType}</td>
                  <td className="px-4 py-3">{log.processed ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
