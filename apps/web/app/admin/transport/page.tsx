"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Vehicle = { id: string; regNo: string; model?: string; capacity: number; driverName?: string };
type Route = { id: string; name: string; stops: { name: string; fee: number }[] };
function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function TransportPage() {
  const { role } = useAdminSession();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState("");
  const [vForm, setVForm] = useState({ regNo: "", model: "", capacity: "40", driverName: "", driverPhone: "" });
  const [rName, setRName] = useState("");
  const [stops, setStops] = useState([{ name: "", fee: "" }]);
  const [showV, setShowV] = useState(false);
  const [showR, setShowR] = useState(false);

  async function load() {
    try { const [v, r] = await Promise.all([adminApiRequest<{ vehicles: Vehicle[] }>("/api/admin/transport/vehicles"), adminApiRequest<{ routes: Route[] }>("/api/admin/transport/routes")]); setVehicles(v.vehicles); setRoutes(r.routes); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); }
  }
  useEffect(() => { void load(); }, []);

  async function addVehicle(e: FormEvent) { e.preventDefault(); try { await adminApiRequest("/api/admin/transport/vehicles", { method: "POST", body: JSON.stringify({ ...vForm, capacity: Number(vForm.capacity) }) }); setVForm({ regNo: "", model: "", capacity: "40", driverName: "", driverPhone: "" }); setShowV(false); await load(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }
  async function addRoute(e: FormEvent) { e.preventDefault(); try { await adminApiRequest("/api/admin/transport/routes", { method: "POST", body: JSON.stringify({ name: rName, stops: stops.filter((s) => s.name).map((s) => ({ name: s.name, fee: Number(s.fee) || 0 })) }) }); setRName(""); setStops([{ name: "", fee: "" }]); setShowR(false); await load(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }

  if (!hasPermission(role, "transport.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Transport" description="Vehicles, routes and stops." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        <div className="flex flex-wrap gap-2"><button className="btn-primary" onClick={() => setShowV((v) => !v)}>{showV ? <X size={16} /> : <Plus size={16} />} Add vehicle</button><button className="btn-secondary" onClick={() => setShowR((v) => !v)}>{showR ? <X size={16} /> : <Plus size={16} />} Add route</button></div>

        {showV && <form onSubmit={addVehicle} className="card grid gap-2 p-5 sm:grid-cols-3"><input className="field" placeholder="Reg. no." required value={vForm.regNo} onChange={(e) => setVForm({ ...vForm, regNo: e.target.value })} /><input className="field" placeholder="Model" value={vForm.model} onChange={(e) => setVForm({ ...vForm, model: e.target.value })} /><input className="field" type="number" placeholder="Capacity" required value={vForm.capacity} onChange={(e) => setVForm({ ...vForm, capacity: e.target.value })} /><input className="field" placeholder="Driver name" value={vForm.driverName} onChange={(e) => setVForm({ ...vForm, driverName: e.target.value })} /><input className="field" placeholder="Driver phone" value={vForm.driverPhone} onChange={(e) => setVForm({ ...vForm, driverPhone: e.target.value })} /><button className="btn-primary">Add</button></form>}
        {showR && (
          <form onSubmit={addRoute} className="card space-y-3 p-5">
            <input className="field" placeholder="Route name (e.g. Route 1 — North)" required value={rName} onChange={(e) => setRName(e.target.value)} />
            <div className="space-y-2">{stops.map((s, i) => (<div key={i} className="flex gap-2"><input className="field flex-1" placeholder="Stop / village" value={s.name} onChange={(e) => setStops(stops.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /><input className="field w-28" type="number" placeholder="Fee ₹" value={s.fee} onChange={(e) => setStops(stops.map((x, j) => j === i ? { ...x, fee: e.target.value } : x))} />{stops.length > 1 && <button type="button" onClick={() => setStops(stops.filter((_, j) => j !== i))} className="grid w-9 place-items-center text-[#ed515d]"><Trash2 size={16} /></button>}</div>))}<button type="button" onClick={() => setStops([...stops, { name: "", fee: "" }])} className="text-sm font-semibold text-[#3033a1] hover:underline">+ Add stop</button></div>
            <button className="btn-primary">Create route</button>
          </form>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <article className="card overflow-x-auto"><div className="px-4 py-3"><h2 className="font-bold text-[#1f2136]">Vehicles</h2></div><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Reg. no.</th><th className="px-4 py-2">Driver</th><th className="px-4 py-2 text-right">Capacity</th></tr></thead><tbody>{vehicles.length === 0 ? <tr><td colSpan={3} className="px-4 py-6 text-center text-stone-400">No vehicles</td></tr> : vehicles.map((v) => (<tr key={v.id} className="border-t border-stone-100"><td className="px-4 py-2 font-semibold">{v.regNo}</td><td className="px-4 py-2">{v.driverName}</td><td className="px-4 py-2 text-right">{v.capacity}</td></tr>))}</tbody></table></article>
          <article className="card"><div className="px-4 py-3"><h2 className="font-bold text-[#1f2136]">Routes</h2></div><div className="divide-y divide-stone-100">{routes.length === 0 ? <p className="px-4 py-6 text-center text-sm text-stone-400">No routes</p> : routes.map((r) => (<div key={r.id} className="px-4 py-3"><p className="font-semibold text-[#303247]">{r.name}</p><div className="mt-1 flex flex-wrap gap-1.5">{r.stops.map((s, i) => <span key={i} className="rounded-full bg-[#eef0ff] px-2 py-0.5 text-xs font-medium text-[#3033a1]">{s.name} · {inr(s.fee)}</span>)}</div></div>))}</div></article>
        </div>
      </section>
    </>
  );
}
