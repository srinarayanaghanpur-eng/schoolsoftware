"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, Trash2, Gauge, X } from "lucide-react";
import { AiTransportInsight } from "@/components/AiTransportInsight";
import { useEffect, useState, type FormEvent } from "react";

interface DailyKmLog {
  id: string;
  vehicleId: string;
  date: string;
  startOdometer: number;
  endOdometer: number;
  kmRun: number;
  notes?: string;
}

interface Vehicle { id: string; regNo: string; }

export default function DailyKmPage() {
  const { role } = useAdminSession();
  const [logs, setLogs] = useState<DailyKmLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Record<string, string>>({});
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicleId: "", date: new Date().toISOString().slice(0, 10), startOdometer: "", endOdometer: "", notes: "" });

  async function load() {
    try {
      const [kmRes, vehRes] = await Promise.all([
        adminApiRequest<{ dailyKmLogs: DailyKmLog[]; vehicles: Record<string, string> }>("/api/admin/transport/daily-km"),
        adminApiRequest<{ vehicles: Vehicle[] }>("/api/admin/transport/vehicles"),
      ]);
      setLogs(kmRes.dailyKmLogs);
      setVehicleMap(kmRes.vehicles);
      setVehicles(vehRes.vehicles);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed");
    }
  }
  useEffect(() => { void load(); }, []);

  async function addLog(e: FormEvent) {
    e.preventDefault();
    try {
      await adminApiRequest("/api/admin/transport/daily-km", {
        method: "POST",
        body: JSON.stringify({ ...form, startOdometer: Number(form.startOdometer), endOdometer: Number(form.endOdometer) }),
      });
      setForm({ vehicleId: "", date: new Date().toISOString().slice(0, 10), startOdometer: "", endOdometer: "", notes: "" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed");
    }
  }

  async function deleteLog(id: string) {
    if (!confirm("Delete this KM log?")) return;
    try { await adminApiRequest(`/api/admin/transport/daily-km/${id}`, { method: "DELETE" }); await load(); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); }
  }

  const selectedIds = vehicleFilter === "all" ? Object.keys(vehicleMap) : [vehicleFilter];
  const totalKm = logs.filter(l => selectedIds.includes(l.vehicleId)).reduce((s, l) => s + l.kmRun, 0);

  if (!hasPermission(role, "transport.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Daily KM" description="Track daily odometer readings for each vehicle." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <Gauge size={16} />
              <span className="text-xs font-semibold">Total KM</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{totalKm.toLocaleString()} km</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <Gauge size={16} />
              <span className="text-xs font-semibold">Entries</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{logs.filter(l => selectedIds.includes(l.vehicleId)).length}</p>
          </div>
        </div>

        <AiTransportInsight
          title="KM Analysis"
          prompt="Analyze these daily KM logs for the school transport fleet. Identify: 1) KM usage patterns and trends 2) Vehicles with unusually high or low daily KM 3) Operational efficiency insights 4) Recommendations for optimizing routes and reducing KM. Give actionable insights."
          data={logs.filter(l => selectedIds.includes(l.vehicleId)).slice(0, 50)}
        />

        <div className="flex flex-wrap items-center gap-3">
          <select className="field w-auto" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
            <option value="all">All Vehicles</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNo}</option>)}
          </select>
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X size={16} /> : <Plus size={16} />} Add KM Log
          </button>
        </div>

        {showForm && (
          <form onSubmit={addLog} className="card grid gap-3 p-5 sm:grid-cols-3">
            <select className="field" required value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">Select vehicle</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNo}</option>)}
            </select>
            <input className="field" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input className="field" type="number" placeholder="Start odometer" required value={form.startOdometer} onChange={(e) => setForm({ ...form, startOdometer: e.target.value })} />
            <input className="field" type="number" placeholder="End odometer" required value={form.endOdometer} onChange={(e) => setForm({ ...form, endOdometer: e.target.value })} />
            <input className="field sm:col-span-2" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            {form.startOdometer && form.endOdometer && Number(form.endOdometer) >= Number(form.startOdometer) && (
              <p className="sm:col-span-3 text-sm font-semibold text-[#3033a1]">KM Run: {Number(form.endOdometer) - Number(form.startOdometer)} km</p>
            )}
            <button className="btn-primary sm:col-span-3">Save KM Log</button>
          </form>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3 text-right">Start ODO</th>
                <th className="px-4 py-3 text-right">End ODO</th>
                <th className="px-4 py-3 text-right">KM Run</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {logs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">No KM logs yet.</td></tr>
              ) : (
                logs.filter(l => selectedIds.includes(l.vehicleId)).map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">{log.date}</td>
                    <td className="px-4 py-3 font-semibold text-[#1f2136]">{vehicleMap[log.vehicleId] || log.vehicleId}</td>
                    <td className="px-4 py-3 text-right">{log.startOdometer}</td>
                    <td className="px-4 py-3 text-right">{log.endOdometer}</td>
                    <td className="px-4 py-3 text-right font-semibold">{log.kmRun} km</td>
                    <td className="px-4 py-3 max-w-[150px] truncate">{log.notes || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteLog(log.id)} className="rounded-lg p-1.5 text-[#7d86a8] hover:bg-[#ffebed] hover:text-[#ed515d]">
                        <Trash2 size={15} />
                      </button>
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
