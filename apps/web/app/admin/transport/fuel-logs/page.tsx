"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, Trash2, Fuel, IndianRupee, X } from "lucide-react";
import { AiTransportInsight } from "@/components/AiTransportInsight";
import { useEffect, useState, type FormEvent } from "react";

interface FuelLog {
  id: string;
  vehicleId: string;
  date: string;
  liters: number;
  costPerLiter: number;
  totalCost: number;
  odometerReading?: number;
  station?: string;
  notes?: string;
}

interface Vehicle {
  id: string;
  regNo: string;
}

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function FuelLogsPage() {
  const { role } = useAdminSession();
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Record<string, string>>({});
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicleId: "", date: new Date().toISOString().slice(0, 10), liters: "", costPerLiter: "", odometerReading: "", station: "", notes: "" });

  async function load() {
    try {
      const [fuelRes, vehRes] = await Promise.all([
        adminApiRequest<{ fuelLogs: FuelLog[]; vehicles: Record<string, string> }>("/api/admin/transport/fuel-logs"),
        adminApiRequest<{ vehicles: Vehicle[] }>("/api/admin/transport/vehicles"),
      ]);
      setFuelLogs(fuelRes.fuelLogs);
      setVehicleMap(fuelRes.vehicles);
      setVehicles(vehRes.vehicles);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed");
    }
  }
  useEffect(() => { void load(); }, []);

  async function addFuelLog(e: FormEvent) {
    e.preventDefault();
    try {
      await adminApiRequest("/api/admin/transport/fuel-logs", {
        method: "POST",
        body: JSON.stringify({ ...form, liters: Number(form.liters), costPerLiter: Number(form.costPerLiter), odometerReading: form.odometerReading ? Number(form.odometerReading) : undefined }),
      });
      setForm({ vehicleId: "", date: new Date().toISOString().slice(0, 10), liters: "", costPerLiter: "", odometerReading: "", station: "", notes: "" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed");
    }
  }

  async function deleteLog(id: string) {
    if (!confirm("Delete this fuel log?")) return;
    try {
      await adminApiRequest(`/api/admin/transport/fuel-logs/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed");
    }
  }

  const selectedVehicleIds = vehicleFilter === "all" ? Object.keys(vehicleMap) : [vehicleFilter];
  const totalLiters = fuelLogs.filter(f => selectedVehicleIds.includes(f.vehicleId)).reduce((s, f) => s + f.liters, 0);
  const totalCost = fuelLogs.filter(f => selectedVehicleIds.includes(f.vehicleId)).reduce((s, f) => s + f.totalCost, 0);

  if (!hasPermission(role, "transport.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Fuel Logs" description="Track fuel purchases for all vehicles." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <Fuel size={16} />
              <span className="text-xs font-semibold">Total Liters</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{totalLiters.toFixed(1)} L</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <IndianRupee size={16} />
              <span className="text-xs font-semibold">Total Cost</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{inr(totalCost)}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <Fuel size={16} />
              <span className="text-xs font-semibold">Avg Rate/L</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{totalLiters > 0 ? inr(totalCost / totalLiters) : "—"}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <Fuel size={16} />
              <span className="text-xs font-semibold">Entries</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{fuelLogs.filter(f => selectedVehicleIds.includes(f.vehicleId)).length}</p>
          </div>
        </div>

        <AiTransportInsight
          title="Fuel Analysis"
          prompt="Analyze these fuel logs for the school transport fleet. Identify: 1) Fuel consumption trends and anomalies 2) Average cost per liter and cost efficiency 3) Vehicles with unusually high fuel consumption 4) Recommendations to reduce fuel costs. Give actionable insights."
          data={fuelLogs.filter(f => selectedVehicleIds.includes(f.vehicleId)).slice(0, 50)}
        />

        {/* Filters + Add button */}
        <div className="flex flex-wrap items-center gap-3">
          <select className="field w-auto" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
            <option value="all">All Vehicles</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNo}</option>)}
          </select>
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X size={16} /> : <Plus size={16} />} Add Fuel Log
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <form onSubmit={addFuelLog} className="card grid gap-3 p-5 sm:grid-cols-3">
            <select className="field" required value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">Select vehicle</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNo}</option>)}
            </select>
            <input className="field" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input className="field" type="number" step="0.01" placeholder="Liters" required value={form.liters} onChange={(e) => setForm({ ...form, liters: e.target.value })} />
            <input className="field" type="number" step="0.01" placeholder="Cost per liter (₹)" required value={form.costPerLiter} onChange={(e) => setForm({ ...form, costPerLiter: e.target.value })} />
            <input className="field" type="number" placeholder="Odometer reading" value={form.odometerReading} onChange={(e) => setForm({ ...form, odometerReading: e.target.value })} />
            <input className="field" placeholder="Station" value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} />
            <input className="field sm:col-span-3" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            {form.liters && form.costPerLiter && (
              <p className="sm:col-span-3 text-sm font-semibold text-[#3033a1]">
                Total: {inr(Number(form.liters) * Number(form.costPerLiter))}
              </p>
            )}
            <button className="btn-primary sm:col-span-3">Save Fuel Log</button>
          </form>
        )}

        {/* Table */}
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3 text-right">Liters</th>
                <th className="px-4 py-3 text-right">Rate/L</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Odometer</th>
                <th className="px-4 py-3">Station</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {fuelLogs.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-stone-400">No fuel logs yet.</td></tr>
              ) : (
                fuelLogs.filter(f => selectedVehicleIds.includes(f.vehicleId)).map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">{log.date}</td>
                    <td className="px-4 py-3 font-semibold text-[#1f2136]">{vehicleMap[log.vehicleId] || log.vehicleId}</td>
                    <td className="px-4 py-3 text-right">{log.liters} L</td>
                    <td className="px-4 py-3 text-right">{inr(log.costPerLiter)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{inr(log.totalCost)}</td>
                    <td className="px-4 py-3 text-right">{log.odometerReading ?? "—"}</td>
                    <td className="px-4 py-3">{log.station || "—"}</td>
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
