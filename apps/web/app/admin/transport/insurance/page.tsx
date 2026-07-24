"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, Trash2, ShieldCheck, IndianRupee, X, AlertTriangle } from "lucide-react";
import { AiTransportInsight } from "@/components/AiTransportInsight";
import { useEffect, useState, type FormEvent } from "react";

interface InsuranceRecord {
  id: string;
  vehicleId: string;
  provider: string;
  policyNo?: string;
  premium: number;
  startDate: string;
  renewalDate: string;
  notes?: string;
}

interface Vehicle { id: string; regNo: string; }

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function InsurancePage() {
  const { role } = useAdminSession();
  const [records, setRecords] = useState<InsuranceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Record<string, string>>({});
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicleId: "", provider: "", policyNo: "", premium: "", startDate: "", renewalDate: "", notes: "" });

  async function load() {
    try {
      const [insRes, vehRes] = await Promise.all([
        adminApiRequest<{ insuranceRecords: InsuranceRecord[]; vehicles: Record<string, string> }>("/api/admin/transport/insurance"),
        adminApiRequest<{ vehicles: Vehicle[] }>("/api/admin/transport/vehicles"),
      ]);
      setRecords(insRes.insuranceRecords);
      setVehicleMap(insRes.vehicles);
      setVehicles(vehRes.vehicles);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed");
    }
  }
  useEffect(() => { void load(); }, []);

  async function addRecord(e: FormEvent) {
    e.preventDefault();
    try {
      await adminApiRequest("/api/admin/transport/insurance", {
        method: "POST",
        body: JSON.stringify({ ...form, premium: Number(form.premium) }),
      });
      setForm({ vehicleId: "", provider: "", policyNo: "", premium: "", startDate: "", renewalDate: "", notes: "" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed");
    }
  }

  async function deleteRecord(id: string) {
    if (!confirm("Delete this insurance record?")) return;
    try { await adminApiRequest(`/api/admin/transport/insurance/${id}`, { method: "DELETE" }); await load(); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); }
  }

  const selectedIds = vehicleFilter === "all" ? Object.keys(vehicleMap) : [vehicleFilter];
  const totalPremium = records.filter(r => selectedIds.includes(r.vehicleId)).reduce((s, r) => s + r.premium, 0);
  const expiringSoon = records.filter(r => {
    const renewal = new Date(r.renewalDate);
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return renewal <= thirtyDays && renewal >= new Date();
  });

  if (!hasPermission(role, "transport.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Insurance Records" description="Track vehicle insurance policies and renewals." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        {expiringSoon.length > 0 && (
          <div className="rounded-2xl border border-[#ffe1a6] bg-[#fff8e8] px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-bold text-[#a76e08]">
              <AlertTriangle size={16} /> Insurance Renewal Due
            </p>
            {expiringSoon.map((r) => (
              <p key={r.id} className="mt-1 text-sm font-medium text-[#7a5205]">
                {vehicleMap[r.vehicleId] || r.vehicleId} — {r.provider} renews on {r.renewalDate}
              </p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <ShieldCheck size={16} />
              <span className="text-xs font-semibold">Total Premium</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{inr(totalPremium)}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <ShieldCheck size={16} />
              <span className="text-xs font-semibold">Policies</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{records.filter(r => selectedIds.includes(r.vehicleId)).length}</p>
          </div>
        </div>

        <AiTransportInsight
          title="Insurance Analysis"
          prompt="Analyze these insurance records for the school transport fleet. Identify: 1) Insurance expiry patterns and renewal risks 2) Premium cost distribution across vehicles 3) Vehicles with expiring or expired policies 4) Recommendations for managing renewals and reducing premium costs. Give actionable insights."
          data={records.filter(r => selectedIds.includes(r.vehicleId)).slice(0, 50)}
        />

        <div className="flex flex-wrap items-center gap-3">
          <select className="field w-auto" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
            <option value="all">All Vehicles</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNo}</option>)}
          </select>
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X size={16} /> : <Plus size={16} />} Add Insurance
          </button>
        </div>

        {showForm && (
          <form onSubmit={addRecord} className="card grid gap-3 p-5 sm:grid-cols-3">
            <select className="field" required value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">Select vehicle</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNo}</option>)}
            </select>
            <input className="field" placeholder="Insurance provider" required value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
            <input className="field" placeholder="Policy number" value={form.policyNo} onChange={(e) => setForm({ ...form, policyNo: e.target.value })} />
            <input className="field" type="number" step="0.01" placeholder="Premium (₹)" required value={form.premium} onChange={(e) => setForm({ ...form, premium: e.target.value })} />
            <input className="field" type="date" placeholder="Start date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <input className="field" type="date" placeholder="Renewal date" required value={form.renewalDate} onChange={(e) => setForm({ ...form, renewalDate: e.target.value })} />
            <input className="field sm:col-span-3" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button className="btn-primary sm:col-span-3">Save Insurance Record</button>
          </form>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Policy No</th>
                <th className="px-4 py-3 text-right">Premium</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">Renewal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {records.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400">No insurance records yet.</td></tr>
              ) : (
                records.filter(r => selectedIds.includes(r.vehicleId)).map((r) => {
                  const renewal = new Date(r.renewalDate);
                  const now = new Date();
                  const expiring = renewal <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) && renewal >= now;
                  const expired = renewal < now;
                  return (
                    <tr key={r.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-semibold text-[#1f2136]">{vehicleMap[r.vehicleId] || r.vehicleId}</td>
                      <td className="px-4 py-3">{r.provider}</td>
                      <td className="px-4 py-3">{r.policyNo || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{inr(r.premium)}</td>
                      <td className="px-4 py-3">{r.startDate}</td>
                      <td className="px-4 py-3">{r.renewalDate}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                          expired ? "bg-[#ffebed] text-[#d84d5b]" :
                          expiring ? "bg-[#fff4e0] text-[#b87a0f]" :
                          "bg-[#e7f6ec] text-[#1f8a4c]"
                        }`}>
                          {expired ? "Expired" : expiring ? "Expiring Soon" : "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteRecord(r.id)} className="rounded-lg p-1.5 text-[#7d86a8] hover:bg-[#ffebed] hover:text-[#ed515d]">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
