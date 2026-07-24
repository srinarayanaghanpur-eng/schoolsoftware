"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, Trash2, Wrench, IndianRupee, X } from "lucide-react";
import { AiTransportInsight } from "@/components/AiTransportInsight";
import { useEffect, useState, type FormEvent } from "react";
import { MAINTENANCE_TYPES, type MaintenanceType } from "@/types/busFinance.types";

interface MaintenanceLog {
  id: string;
  vehicleId: string;
  date: string;
  type: MaintenanceType;
  description?: string;
  cost: number;
  mechanic?: string;
  notes?: string;
}

interface Vehicle { id: string; regNo: string; }

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

const TYPE_STYLE: Record<string, string> = {
  service: "bg-[#e7f6ec] text-[#1f8a4c]",
  repair: "bg-[#ffebed] text-[#d84d5b]",
  parts: "bg-[#fff4e0] text-[#b87a0f]",
  other: "bg-[#eceefb] text-[#3033a1]",
};

export default function MaintenancePage() {
  const { role } = useAdminSession();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Record<string, string>>({});
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicleId: "", date: new Date().toISOString().slice(0, 10), type: "service" as MaintenanceType, description: "", cost: "", mechanic: "", notes: "" });

  async function load() {
    try {
      const [maintRes, vehRes] = await Promise.all([
        adminApiRequest<{ maintenanceLogs: MaintenanceLog[]; vehicles: Record<string, string> }>("/api/admin/transport/maintenance"),
        adminApiRequest<{ vehicles: Vehicle[] }>("/api/admin/transport/vehicles"),
      ]);
      setLogs(maintRes.maintenanceLogs);
      setVehicleMap(maintRes.vehicles);
      setVehicles(vehRes.vehicles);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed");
    }
  }
  useEffect(() => { void load(); }, []);

  async function addLog(e: FormEvent) {
    e.preventDefault();
    try {
      await adminApiRequest("/api/admin/transport/maintenance", {
        method: "POST",
        body: JSON.stringify({ ...form, cost: Number(form.cost) }),
      });
      setForm({ vehicleId: "", date: new Date().toISOString().slice(0, 10), type: "service", description: "", cost: "", mechanic: "", notes: "" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed");
    }
  }

  async function deleteLog(id: string) {
    if (!confirm("Delete this maintenance log?")) return;
    try { await adminApiRequest(`/api/admin/transport/maintenance/${id}`, { method: "DELETE" }); await load(); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); }
  }

  const selectedIds = vehicleFilter === "all" ? Object.keys(vehicleMap) : [vehicleFilter];
  const totalCost = logs.filter(l => selectedIds.includes(l.vehicleId)).reduce((s, l) => s + l.cost, 0);

  if (!hasPermission(role, "transport.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Maintenance Logs" description="Track vehicle service, repairs, and parts." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <Wrench size={16} />
              <span className="text-xs font-semibold">Total Cost</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{inr(totalCost)}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <Wrench size={16} />
              <span className="text-xs font-semibold">Entries</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{logs.filter(l => selectedIds.includes(l.vehicleId)).length}</p>
          </div>
        </div>

        <AiTransportInsight
          title="Maintenance Analysis"
          prompt="Analyze these maintenance logs for the school transport fleet. Identify: 1) Most common maintenance issues and patterns 2) Vehicles requiring frequent repairs 3) Total maintenance cost trends 4) Recommendations for preventive maintenance to reduce costs. Give actionable insights."
          data={logs.filter(l => selectedIds.includes(l.vehicleId)).slice(0, 50)}
        />

        <div className="flex flex-wrap items-center gap-3">
          <select className="field w-auto" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
            <option value="all">All Vehicles</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNo}</option>)}
          </select>
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X size={16} /> : <Plus size={16} />} Add Maintenance
          </button>
        </div>

        {showForm && (
          <form onSubmit={addLog} className="card grid gap-3 p-5 sm:grid-cols-3">
            <select className="field" required value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">Select vehicle</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNo}</option>)}
            </select>
            <input className="field" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as MaintenanceType })}>
              {MAINTENANCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input className="field" type="number" step="0.01" placeholder="Cost (₹)" required value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            <input className="field" placeholder="Mechanic / vendor" value={form.mechanic} onChange={(e) => setForm({ ...form, mechanic: e.target.value })} />
            <input className="field sm:col-span-3" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input className="field sm:col-span-3" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button className="btn-primary sm:col-span-3">Save Maintenance Log</button>
          </form>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3">Mechanic</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {logs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">No maintenance logs yet.</td></tr>
              ) : (
                logs.filter(l => selectedIds.includes(l.vehicleId)).map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">{log.date}</td>
                    <td className="px-4 py-3 font-semibold text-[#1f2136]">{vehicleMap[log.vehicleId] || log.vehicleId}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${TYPE_STYLE[log.type] || TYPE_STYLE.other}`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{log.description || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{inr(log.cost)}</td>
                    <td className="px-4 py-3">{log.mechanic || "—"}</td>
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
