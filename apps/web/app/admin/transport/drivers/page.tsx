"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, Trash2, Edit2, User, IndianRupee, Save, X } from "lucide-react";
import { AiTransportInsight } from "@/components/AiTransportInsight";
import { useEffect, useState, type FormEvent } from "react";
import type { Driver } from "@/types/busFinance.types";

interface Vehicle { id: string; regNo: string; }

function inr(n: number | undefined | null) { return n ? `₹${Number(n).toLocaleString("en-IN")}` : "—"; }

export default function DriversPage() {
  const { role } = useAdminSession();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", salary: "", licenseExpiry: "", vehicleId: "", notes: "" });

  async function load() {
    try {
      const [dRes, vRes] = await Promise.all([
        adminApiRequest<{ drivers: Driver[]; vehicles: Record<string, string> }>("/api/admin/transport/drivers"),
        adminApiRequest<{ vehicles: Vehicle[] }>("/api/admin/transport/vehicles"),
      ]);
      setDrivers(dRes.drivers);
      setVehicleMap(dRes.vehicles);
      setVehicles(vRes.vehicles);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed");
    }
  }
  useEffect(() => { void load(); }, []);

  function resetForm() { setForm({ name: "", phone: "", salary: "", licenseExpiry: "", vehicleId: "", notes: "" }); setEditId(null); }

  function openEdit(d: Driver) {
    setEditId(d.id);
    setForm({ name: d.name, phone: d.phone || "", salary: d.salary?.toString() || "", licenseExpiry: d.licenseExpiry || "", vehicleId: d.vehicleId || "", notes: d.notes || "" });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const payload = { ...form, salary: form.salary ? Number(form.salary) : undefined };
      if (editId) {
        await adminApiRequest(`/api/admin/transport/drivers/${editId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await adminApiRequest("/api/admin/transport/drivers", { method: "POST", body: JSON.stringify(payload) });
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed");
    }
  }

  async function deleteDriver(id: string) {
    if (!confirm("Delete this driver?")) return;
    try { await adminApiRequest(`/api/admin/transport/drivers/${id}`, { method: "DELETE" }); await load(); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); }
  }

  if (!hasPermission(role, "transport.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Drivers" description="Manage vehicle drivers, salaries, and license records." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <User size={16} />
              <span className="text-xs font-semibold">Total Drivers</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{drivers.length}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <IndianRupee size={16} />
              <span className="text-xs font-semibold">Avg Salary</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">
              {drivers.filter(d => d.salary).length > 0
                ? inr(drivers.reduce((s, d) => s + (d.salary || 0), 0) / drivers.filter(d => d.salary).length)
                : "—"}
            </p>
          </div>
        </div>

        <AiTransportInsight
          title="Driver Analysis"
          prompt="Analyze these driver records for the school transport fleet. Identify: 1) Driver salary distribution and cost 2) License expiry risks and compliance 3) Vehicle assignment patterns 4) Recommendations for workforce planning and cost optimization. Give actionable insights."
          data={drivers.slice(0, 50)}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={() => { resetForm(); }}>
            <Plus size={16} /> Add Driver
          </button>
        </div>

        {editId !== null || form.name ? (
          <form onSubmit={handleSubmit} className="card grid gap-3 p-5 sm:grid-cols-3">
            {editId && <input type="hidden" />}
            <input className="field" placeholder="Driver name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="field" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="field" type="number" step="0.01" placeholder="Monthly salary (₹)" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
            <input className="field" type="date" placeholder="License expiry" value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} />
            <select className="field" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">No vehicle assigned</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNo}</option>)}
            </select>
            <input className="field" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="sm:col-span-3 flex gap-2">
              <button className="btn-primary"><Save size={16} /> {editId ? "Update Driver" : "Add Driver"}</button>
              {editId && <button type="button" className="btn-secondary" onClick={resetForm}><X size={16} /> Cancel</button>}
            </div>
          </form>
        ) : null}

        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Assigned Vehicle</th>
                <th className="px-4 py-3 text-right">Salary</th>
                <th className="px-4 py-3">License Expiry</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {drivers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">No drivers yet.</td></tr>
              ) : (
                drivers.map((d) => (
                  <tr key={d.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-semibold text-[#1f2136]">{d.name}</td>
                    <td className="px-4 py-3">{d.phone || "—"}</td>
                    <td className="px-4 py-3">{d.vehicleId ? (vehicleMap[d.vehicleId] || "—") : "—"}</td>
                    <td className="px-4 py-3 text-right">{inr(d.salary)}</td>
                    <td className="px-4 py-3">{d.licenseExpiry || "—"}</td>
                    <td className="px-4 py-3 max-w-[150px] truncate">{d.notes || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(d)} className="rounded-lg p-1.5 text-[#7d86a8] hover:bg-[#eef0ff] hover:text-[#3033a1]">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => deleteDriver(d.id)} className="rounded-lg p-1.5 text-[#7d86a8] hover:bg-[#ffebed] hover:text-[#ed515d]">
                          <Trash2 size={15} />
                        </button>
                      </div>
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
