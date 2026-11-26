"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { usePopup } from "@/components/CenterPopup";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Vehicle = {
  id: string;
  regNo: string;
  model?: string;
  capacity: number;
  driverName?: string;
  driverPhone?: string;
};
type RouteStop = { name: string; fee: number };
type Route = { id: string; name: string; vehicleId?: string; stops: RouteStop[] };
type VehicleForm = { regNo: string; model: string; capacity: string; driverName: string; driverPhone: string };
type RouteForm = { name: string; vehicleId: string; stops: { name: string; fee: string }[] };

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}
function errorMessage(error: unknown) {
  return error instanceof AdminApiError ? error.message : "Failed";
}
function emptyVehicle(): VehicleForm {
  return { regNo: "", model: "", capacity: "40", driverName: "", driverPhone: "" };
}
function emptyRoute(): RouteForm {
  return { name: "", vehicleId: "", stops: [{ name: "", fee: "" }] };
}
function tempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function TransportPage() {
  const { hasPermission } = useAdminSession();
  const popup = usePopup();
  const canEdit = hasPermission("transport.edit");
  const canDelete = hasPermission("transport.delete");

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showV, setShowV] = useState(false);
  const [vForm, setVForm] = useState<VehicleForm>(emptyVehicle);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [vEdit, setVEdit] = useState<VehicleForm>(emptyVehicle);

  const [showR, setShowR] = useState(false);
  const [rForm, setRForm] = useState<RouteForm>(emptyRoute);
  const [editRoute, setEditRoute] = useState<Route | null>(null);
  const [rEdit, setREdit] = useState<RouteForm>(emptyRoute);

  async function load() {
    try {
      const [v, r] = await Promise.all([
        adminApiRequest<{ vehicles: Vehicle[] }>("/api/admin/transport/vehicles"),
        adminApiRequest<{ routes: Route[] }>("/api/admin/transport/routes")
      ]);
      setVehicles(v.vehicles);
      setRoutes(r.routes);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function addVehicle(e: FormEvent) {
    e.preventDefault();
    const payload = {
      regNo: vForm.regNo.trim(),
      model: vForm.model.trim(),
      capacity: Number(vForm.capacity),
      driverName: vForm.driverName.trim(),
      driverPhone: vForm.driverPhone.trim()
    };
    const optimistic: Vehicle = { id: tempId("vehicle"), ...payload };
    setVehicles((current) => [...current, optimistic]);
    setVForm(emptyVehicle());
    setShowV(false);
    setSaving(true);
    try {
      const result = await adminApiRequest<{ ok: true; id: string }>("/api/admin/transport/vehicles", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setVehicles((current) => current.map((v) => (v.id === optimistic.id ? { ...v, id: result.id } : v)));
      popup.success("Vehicle added");
    } catch (err) {
      setVehicles((current) => current.filter((v) => v.id !== optimistic.id));
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function addRoute(e: FormEvent) {
    e.preventDefault();
    const stops = rForm.stops.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), fee: Number(s.fee) || 0 }));
    if (!stops.length) {
      setError("Add at least one stop.");
      return;
    }
    const payload = { name: rForm.name.trim(), vehicleId: rForm.vehicleId, stops };
    const optimistic: Route = { id: tempId("route"), ...payload };
    setRoutes((current) => [...current, optimistic]);
    setRForm(emptyRoute());
    setShowR(false);
    setSaving(true);
    try {
      const result = await adminApiRequest<{ ok: true; id: string }>("/api/admin/transport/routes", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setRoutes((current) => current.map((r) => (r.id === optimistic.id ? { ...r, id: result.id } : r)));
      popup.success("Route created");
    } catch (err) {
      setRoutes((current) => current.filter((r) => r.id !== optimistic.id));
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function openEditVehicle(v: Vehicle) {
    setEditVehicle(v);
    setVEdit({
      regNo: v.regNo,
      model: v.model || "",
      capacity: String(v.capacity),
      driverName: v.driverName || "",
      driverPhone: v.driverPhone || ""
    });
  }

  async function saveVehicle(e: FormEvent) {
    e.preventDefault();
    if (!editVehicle) return;
    const id = editVehicle.id;
    const payload = {
      regNo: vEdit.regNo.trim(),
      model: vEdit.model.trim(),
      capacity: Number(vEdit.capacity),
      driverName: vEdit.driverName.trim(),
      driverPhone: vEdit.driverPhone.trim()
    };
    const previous = vehicles;
    setVehicles((current) => current.map((v) => (v.id === id ? { ...v, ...payload } : v)));
    setEditVehicle(null);
    setSaving(true);
    try {
      await adminApiRequest(`/api/admin/transport/vehicles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      popup.success("Vehicle updated");
    } catch (err) {
      setVehicles(previous);
      popup.error("Unable to update vehicle", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteVehicle(v: Vehicle) {
    if (!(await popup.confirm("Delete this vehicle?", `${v.regNo} will be removed.`, { okLabel: "Delete", danger: true }))) return;
    const previous = vehicles;
    setVehicles((current) => current.filter((item) => item.id !== v.id));
    try {
      await adminApiRequest(`/api/admin/transport/vehicles/${v.id}`, { method: "DELETE" });
      popup.success("Vehicle deleted");
    } catch (err) {
      setVehicles(previous);
      popup.error("Unable to delete vehicle", errorMessage(err));
    }
  }

  function openEditRoute(r: Route) {
    setEditRoute(r);
    setREdit({
      name: r.name,
      vehicleId: r.vehicleId || "",
      stops: r.stops.length ? r.stops.map((s) => ({ name: s.name, fee: String(s.fee) })) : [{ name: "", fee: "" }]
    });
  }

  async function saveRoute(e: FormEvent) {
    e.preventDefault();
    if (!editRoute) return;
    const stops = rEdit.stops.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), fee: Number(s.fee) || 0 }));
    if (!stops.length) {
      setError("Add at least one stop.");
      return;
    }
    const id = editRoute.id;
    const payload = { name: rEdit.name.trim(), vehicleId: rEdit.vehicleId, stops };
    const previous = routes;
    setRoutes((current) => current.map((r) => (r.id === id ? { ...r, ...payload } : r)));
    setEditRoute(null);
    setSaving(true);
    try {
      await adminApiRequest(`/api/admin/transport/routes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      popup.success("Route updated");
    } catch (err) {
      setRoutes(previous);
      popup.error("Unable to update route", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRoute(r: Route) {
    if (!(await popup.confirm("Delete this route?", `${r.name} will be removed.`, { okLabel: "Delete", danger: true }))) return;
    const previous = routes;
    setRoutes((current) => current.filter((item) => item.id !== r.id));
    try {
      await adminApiRequest(`/api/admin/transport/routes/${r.id}`, { method: "DELETE" });
      popup.success("Route deleted");
    } catch (err) {
      setRoutes(previous);
      popup.error("Unable to delete route", errorMessage(err));
    }
  }

  if (!hasPermission("transport.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Transport" description="Vehicles, routes and stops." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setShowV((v) => !v)}>
              {showV ? <X size={16} /> : <Plus size={16} />} Add vehicle
            </button>
            <button className="btn-secondary" onClick={() => setShowR((v) => !v)}>
              {showR ? <X size={16} /> : <Plus size={16} />} Add route
            </button>
          </div>
        )}

        {canEdit && showV && (
          <form onSubmit={addVehicle} className="card grid gap-2 p-5 sm:grid-cols-3">
            <input className="field" placeholder="Reg. no." required value={vForm.regNo} onChange={(e) => setVForm({ ...vForm, regNo: e.target.value })} />
            <input className="field" placeholder="Model" value={vForm.model} onChange={(e) => setVForm({ ...vForm, model: e.target.value })} />
            <input className="field" type="number" placeholder="Capacity" required value={vForm.capacity} onChange={(e) => setVForm({ ...vForm, capacity: e.target.value })} />
            <input className="field" placeholder="Driver name" value={vForm.driverName} onChange={(e) => setVForm({ ...vForm, driverName: e.target.value })} />
            <input className="field" placeholder="Driver phone" value={vForm.driverPhone} onChange={(e) => setVForm({ ...vForm, driverPhone: e.target.value })} />
            <button className="btn-primary" disabled={saving}>Add</button>
          </form>
        )}

        {canEdit && showR && (
          <form onSubmit={addRoute} className="card space-y-3 p-5">
            <input className="field" placeholder="Route name (e.g. Route 1 — North)" required value={rForm.name} onChange={(e) => setRForm({ ...rForm, name: e.target.value })} />
            <select className="field" value={rForm.vehicleId} onChange={(e) => setRForm({ ...rForm, vehicleId: e.target.value })}>
              <option value="">No vehicle assigned</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNo}{v.driverName ? ` — ${v.driverName}` : ""}</option>)}
            </select>
            <div className="space-y-2">
              {rForm.stops.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input className="field min-w-0 flex-1" placeholder="Stop / village" value={s.name} onChange={(e) => setRForm({ ...rForm, stops: rForm.stops.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
                  <div className="w-28 shrink-0">
                    <input className="field" type="number" min="0" inputMode="decimal" placeholder="Fee ₹" value={s.fee} onChange={(e) => setRForm({ ...rForm, stops: rForm.stops.map((x, j) => j === i ? { ...x, fee: e.target.value } : x) })} />
                  </div>
                  {rForm.stops.length > 1 && (
                    <button type="button" onClick={() => setRForm({ ...rForm, stops: rForm.stops.filter((_, j) => j !== i) })} className="grid w-9 place-items-center text-[#ed515d]"><Trash2 size={16} /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setRForm({ ...rForm, stops: [...rForm.stops, { name: "", fee: "" }] })} className="text-sm font-semibold text-[#3033a1] hover:underline">+ Add stop</button>
            </div>
            <button className="btn-primary" disabled={saving}>Create route</button>
          </form>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <article className="card overflow-x-auto">
            <div className="px-4 py-3"><h2 className="font-bold text-[#1f2136]">Vehicles</h2></div>
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-2">Reg. no.</th>
                  <th className="px-4 py-2">Driver</th>
                  <th className="px-4 py-2 text-right">Capacity</th>
                  {canEdit && <th className="px-4 py-2 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr><td colSpan={canEdit ? 4 : 3} className="px-4 py-6 text-center text-stone-400">No vehicles</td></tr>
                ) : vehicles.map((v) => (
                  <tr key={v.id} className="border-t border-stone-100">
                    <td className="px-4 py-2 font-semibold">{v.regNo}</td>
                    <td className="px-4 py-2">{v.driverName || "—"}</td>
                    <td className="px-4 py-2 text-right">{v.capacity}</td>
                    {canEdit && (
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditVehicle(v)} title="Edit vehicle" className="rounded-lg p-1.5 text-[#7d86a8] hover:bg-[#eef0ff] hover:text-[#3033a1]"><Pencil size={15} /></button>
                          {canDelete && <button onClick={() => void deleteVehicle(v)} title="Delete vehicle" className="rounded-lg p-1.5 text-[#7d86a8] hover:bg-[#ffebed] hover:text-[#ed515d]"><Trash2 size={15} /></button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="card">
            <div className="px-4 py-3"><h2 className="font-bold text-[#1f2136]">Routes</h2></div>
            <div className="divide-y divide-stone-100">
              {routes.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-stone-400">No routes</p>
              ) : routes.map((r) => (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-[#303247]">
                      {r.name}{r.vehicleId ? ` · ${vehicles.find((v) => v.id === r.vehicleId)?.regNo ?? "Vehicle"}` : ""}
                    </p>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditRoute(r)} title="Edit route" className="rounded-lg p-1.5 text-[#7d86a8] hover:bg-[#eef0ff] hover:text-[#3033a1]"><Pencil size={15} /></button>
                        {canDelete && <button onClick={() => void deleteRoute(r)} title="Delete route" className="rounded-lg p-1.5 text-[#7d86a8] hover:bg-[#ffebed] hover:text-[#ed515d]"><Trash2 size={15} /></button>}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {r.stops.map((s, i) => <span key={i} className="rounded-full bg-[#eef0ff] px-2 py-0.5 text-xs font-medium text-[#3033a1]">{s.name} · {inr(s.fee)}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      {editVehicle && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#10122d]/45 p-4 backdrop-blur-sm">
          <form onSubmit={saveVehicle} className="w-full max-w-xl rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_24px_70px_rgba(16,18,45,0.22)] md:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#1f2136]">Edit vehicle</h2>
                <p className="mt-1 text-sm font-medium text-[#7d86a8]">Update the bus, driver name and capacity.</p>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb]" type="button" onClick={() => setEditVehicle(null)} title="Close"><X size={18} /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="field" placeholder="Reg. no." required value={vEdit.regNo} onChange={(e) => setVEdit({ ...vEdit, regNo: e.target.value })} />
              <input className="field" placeholder="Model" value={vEdit.model} onChange={(e) => setVEdit({ ...vEdit, model: e.target.value })} />
              <input className="field" type="number" placeholder="Capacity" required value={vEdit.capacity} onChange={(e) => setVEdit({ ...vEdit, capacity: e.target.value })} />
              <input className="field" placeholder="Driver name" value={vEdit.driverName} onChange={(e) => setVEdit({ ...vEdit, driverName: e.target.value })} />
              <input className="field" placeholder="Driver phone" value={vEdit.driverPhone} onChange={(e) => setVEdit({ ...vEdit, driverPhone: e.target.value })} />
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditVehicle(null)}>Cancel</button>
              <button className="btn-primary" disabled={saving}><Save size={16} /> {saving ? "Saving..." : "Save vehicle"}</button>
            </div>
          </form>
        </div>
      )}

      {editRoute && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#10122d]/45 p-4 backdrop-blur-sm">
          <form onSubmit={saveRoute} className="w-full max-w-2xl rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_24px_70px_rgba(16,18,45,0.22)] md:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#1f2136]">Edit route</h2>
                <p className="mt-1 text-sm font-medium text-[#7d86a8]">Rename, assign a bus, or change the stops and fees.</p>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb]" type="button" onClick={() => setEditRoute(null)} title="Close"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input className="field" placeholder="Route name" required value={rEdit.name} onChange={(e) => setREdit({ ...rEdit, name: e.target.value })} />
              <select className="field" value={rEdit.vehicleId} onChange={(e) => setREdit({ ...rEdit, vehicleId: e.target.value })}>
                <option value="">No vehicle assigned</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNo}{v.driverName ? ` — ${v.driverName}` : ""}</option>)}
              </select>
              <div className="space-y-2">
                {rEdit.stops.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="field min-w-0 flex-1" placeholder="Stop / village" value={s.name} onChange={(e) => setREdit({ ...rEdit, stops: rEdit.stops.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
                    <div className="w-28 shrink-0">
                      <input className="field" type="number" min="0" inputMode="decimal" placeholder="Fee ₹" value={s.fee} onChange={(e) => setREdit({ ...rEdit, stops: rEdit.stops.map((x, j) => j === i ? { ...x, fee: e.target.value } : x) })} />
                    </div>
                    {rEdit.stops.length > 1 && (
                      <button type="button" onClick={() => setREdit({ ...rEdit, stops: rEdit.stops.filter((_, j) => j !== i) })} className="grid w-9 place-items-center text-[#ed515d]"><Trash2 size={16} /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setREdit({ ...rEdit, stops: [...rEdit.stops, { name: "", fee: "" }] })} className="text-sm font-semibold text-[#3033a1] hover:underline">+ Add stop</button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditRoute(null)}>Cancel</button>
              <button className="btn-primary" disabled={saving}><Save size={16} /> {saving ? "Saving..." : "Save route"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
