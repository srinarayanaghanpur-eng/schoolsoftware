"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { CalendarDays, Edit2, IndianRupee, Link2, Loader2, MapPin, Plus, Save, Trash2, User, X } from "lucide-react";
import { AiTransportInsight } from "@/components/AiTransportInsight";
import { useEffect, useState, type FormEvent } from "react";
import type { Driver, DriverMode } from "@/types/busFinance.types";

interface Vehicle { id: string; regNo: string; }
interface RouteOption { id: string; name: string; stops: { name: string; fee?: number }[]; }
interface UserOption {
  uid: string;
  displayName?: string;
  internalEmail?: string;
  employeeId?: string;
  role?: string;
  status?: string;
}
interface BaselineStop { stopIndex: number; stopName: string; count: number; }
interface BaselineRecord { baselineDate?: string; stopCounts?: BaselineStop[]; }
interface BaselineResponse {
  ok?: boolean;
  baseline?: BaselineRecord | null;
  baselineDate?: string;
  stopCounts?: BaselineStop[];
}
interface LinkCandidate {
  driverId: string;
  driverName: string;
  candidateUid: string;
  candidateName: string;
  candidateRole: string;
  match: "phone" | "name";
}
interface AutoLinkResponse {
  ok?: boolean;
  dryRun?: boolean;
  candidates?: LinkCandidate[];
  linked?: { driverId: string; uid: string }[];
  failed?: { driverId: string; uid: string; error: string }[];
  conflicts?: { driverId: string; driverName: string; reason: string }[];
  alreadyLinked?: number;
  unmatched?: number;
}
interface DriverForm {
  name: string;
  phone: string;
  salary: string;
  licenseExpiry: string;
  vehicleId: string;
  routeId: string;
  mode: DriverMode;
  notes: string;
}

const MODE_LABELS: Record<DriverMode, string> = {
  first_day: "First day",
  daily: "Daily",
  combined: "Combined"
};

function inr(n: number | undefined | null) { return n ? `₹${Number(n).toLocaleString("en-IN")}` : "—"; }
function todayIso() { return new Date().toISOString().slice(0, 10); }
function errorMessage(error: unknown) { return error instanceof AdminApiError ? error.message : "Failed"; }
function emptyForm(): DriverForm {
  return { name: "", phone: "", salary: "", licenseExpiry: "", vehicleId: "", routeId: "", mode: "daily", notes: "" };
}
function emptyCounts(route: RouteOption): Record<number, string> {
  const counts: Record<number, string> = {};
  route.stops.forEach((_, index) => { counts[index] = ""; });
  return counts;
}

export default function DriversPage() {
  const { hasPermission } = useAdminSession();
  const popup = usePopup();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<DriverForm>(emptyForm);
  const [linkDriver, setLinkDriver] = useState<Driver | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [selectedUid, setSelectedUid] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [autoLinking, setAutoLinking] = useState(false);
  const [baselineRouteId, setBaselineRouteId] = useState("");
  const [baselineDate, setBaselineDate] = useState(todayIso);
  const [baselineCounts, setBaselineCounts] = useState<Record<number, string>>({});
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [baselineSaving, setBaselineSaving] = useState(false);
  const [baselineLoaded, setBaselineLoaded] = useState(false);

  const canView = hasPermission("transport.view");
  const canEdit = hasPermission("transport.edit");
  const baselineRoute = routes.find((route) => route.id === baselineRouteId);

  async function load() {
    try {
      const [dRes, vRes, rRes] = await Promise.all([
        adminApiRequest<{ drivers: Driver[]; vehicles: Record<string, string> }>("/api/admin/transport/drivers"),
        adminApiRequest<{ vehicles: Vehicle[] }>("/api/admin/transport/vehicles"),
        adminApiRequest<{ routes: RouteOption[] }>("/api/admin/transport/routes"),
      ]);
      setDrivers(dRes.drivers);
      setVehicleMap(dRes.vehicles);
      setVehicles(vRes.vehicles);
      setRoutes(rRes.routes);
      if (!baselineRouteId && rRes.routes.length > 0) {
        const firstRoute = rRes.routes[0];
        setBaselineRouteId(firstRoute.id);
        setBaselineCounts(emptyCounts(firstRoute));
        void loadBaseline(firstRoute);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  useEffect(() => { void load(); }, []);

  function resetForm() { setForm(emptyForm()); setEditId(null); setFormOpen(false); }

  function openCreate() {
    setForm(emptyForm());
    setEditId(null);
    setFormOpen(true);
  }

  function openEdit(d: Driver) {
    setEditId(d.id);
    setFormOpen(true);
    setForm({
      name: d.name,
      phone: d.phone || "",
      salary: d.salary?.toString() || "",
      licenseExpiry: d.licenseExpiry || "",
      vehicleId: d.vehicleId || "",
      routeId: d.routeId || "",
      mode: d.mode || "daily",
      notes: d.notes || ""
    });
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
      popup.success(editId ? "Driver updated" : "Driver added");
    } catch (e) {
      popup.error("Unable to save driver", errorMessage(e));
    }
  }

  async function patchDriver(id: string, patch: Partial<Pick<Driver, "mode" | "status" | "routeId" | "vehicleId">>) {
    try {
      await adminApiRequest(`/api/admin/transport/drivers/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await load();
    } catch (e) {
      popup.error("Unable to update driver", errorMessage(e));
    }
  }

  async function deleteDriver(id: string) {
    if (!(await popup.confirm("Delete this driver?", "This cannot be undone.", { okLabel: "Delete", danger: true }))) return;
    try {
      await adminApiRequest(`/api/admin/transport/drivers/${id}`, { method: "DELETE" });
      await load();
      popup.success("Driver deleted");
    } catch (e) {
      popup.error("Unable to delete driver", errorMessage(e));
    }
  }

  async function openLink(d: Driver) {
    setLinkDriver(d);
    setSelectedUid("");
    setUserQuery("");
    setUsers([]);
    setUsersLoading(true);
    try {
      const result = await adminApiRequest<{ ok?: boolean; users: UserOption[] }>(
        "/api/admin/users?pageSize=500",
        undefined,
        { fresh: true }
      );
      setUsers(result.users ?? []);
    } catch (e) {
      popup.error("Unable to load users", errorMessage(e));
      setLinkDriver(null);
    } finally {
      setUsersLoading(false);
    }
  }

  async function saveLink() {
    if (!linkDriver || !selectedUid) return;
    setLinkSaving(true);
    try {
      await adminApiRequest(`/api/admin/transport/drivers/${linkDriver.id}/link`, {
        method: "POST",
        body: JSON.stringify({ uid: selectedUid })
      });
      setLinkDriver(null);
      await load();
      popup.success("Driver account linked");
    } catch (e) {
      popup.error("Unable to link account", errorMessage(e));
    } finally {
      setLinkSaving(false);
    }
  }

  async function autoLink() {
    setAutoLinking(true);
    try {
      const preview = await adminApiRequest<AutoLinkResponse>(
        "/api/admin/transport/drivers/auto-link",
        { method: "POST", body: JSON.stringify({ apply: false }) },
        { fresh: true }
      );
      const candidates = preview.candidates ?? [];
      if (candidates.length === 0) {
        popup.success(
          "No exact matches found",
          `${preview.alreadyLinked ?? 0} already linked · ${preview.unmatched ?? 0} unmatched · ${preview.conflicts?.length ?? 0} conflicts`
        );
        return;
      }
      const sample = candidates
        .slice(0, 8)
        .map((candidate) => `${candidate.driverName} → ${candidate.candidateName} (${candidate.match})`)
        .join("\n");
      const more = candidates.length > 8 ? `\n…and ${candidates.length - 8} more` : "";
      const ok = await popup.confirm(
        `Link ${candidates.length} matching driver${candidates.length === 1 ? "" : "s"}?`,
        `${sample}${more}\n\nThis converts each selected staff account to the driver role and signs them out.`,
        { okLabel: "Link all" }
      );
      if (!ok) return;

      const result = await adminApiRequest<AutoLinkResponse>(
        "/api/admin/transport/drivers/auto-link",
        { method: "POST", body: JSON.stringify({ apply: true }) }
      );
      await load();
      const linked = result.linked?.length ?? 0;
      const failed = result.failed?.length ?? 0;
      if (failed > 0) {
        popup.error(
          `Linked ${linked}, failed ${failed}`,
          result.failed?.slice(0, 4).map((item) => `${item.driverId}: ${item.error}`).join("\n")
        );
      } else {
        popup.success(`Linked ${linked} driver${linked === 1 ? "" : "s"}`);
      }
    } catch (e) {
      popup.error("Unable to auto-link drivers", errorMessage(e));
    } finally {
      setAutoLinking(false);
    }
  }

  async function loadBaseline(route: RouteOption) {
    setBaselineLoading(true);
    try {
      const result = await adminApiRequest<BaselineResponse>(
        `/api/admin/transport/baselines?routeId=${encodeURIComponent(route.id)}`
      );
      const record = result.baseline ?? (result.stopCounts ? { baselineDate: result.baselineDate, stopCounts: result.stopCounts } : null);
      const counts = emptyCounts(route);
      record?.stopCounts?.forEach((stop) => {
        counts[stop.stopIndex] = String(stop.count ?? "");
      });
      setBaselineCounts(counts);
      setBaselineDate(record?.baselineDate || todayIso());
      setBaselineLoaded(Boolean(record));
    } catch (e) {
      setBaselineCounts(emptyCounts(route));
      setBaselineDate(todayIso());
      setBaselineLoaded(false);
      if (e instanceof AdminApiError && e.status !== 404) setError(e.message);
    } finally {
      setBaselineLoading(false);
    }
  }

  function selectBaselineRoute(nextRouteId: string) {
    setBaselineRouteId(nextRouteId);
    setBaselineLoaded(false);
    const route = routes.find((item) => item.id === nextRouteId);
    if (!route) {
      setBaselineCounts({});
      return;
    }
    setBaselineCounts(emptyCounts(route));
    setBaselineDate(todayIso());
    void loadBaseline(route);
  }

  async function saveBaseline() {
    if (!baselineRoute || !baselineDate) return;
    setBaselineSaving(true);
    try {
      const stopCounts = baselineRoute.stops.map((stop, index) => ({
        stopIndex: index,
        stopName: stop.name,
        count: Number(baselineCounts[index] || 0)
      }));
      await adminApiRequest("/api/admin/transport/baselines", {
        method: "PUT",
        body: JSON.stringify({ routeId: baselineRoute.id, baselineDate, stopCounts })
      });
      setBaselineLoaded(true);
      popup.success("Baseline saved");
    } catch (e) {
      popup.error("Unable to save baseline", errorMessage(e));
    } finally {
      setBaselineSaving(false);
    }
  }

  const filteredUsers = users.filter((user) =>
    `${user.displayName ?? ""} ${user.internalEmail ?? ""} ${user.employeeId ?? ""}`.toLowerCase().includes(userQuery.trim().toLowerCase())
  );

  if (!canView) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Drivers" description="Manage vehicle drivers, salaries, license records, and driver app accounts." />
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

        {canEdit && (
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> Add Driver
            </button>
            <button className="btn-secondary" type="button" disabled={autoLinking} onClick={() => void autoLink()}>
              {autoLinking ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} Link staff accounts
            </button>
          </div>
        )}

        {canEdit && formOpen ? (
          <form onSubmit={handleSubmit} className="card grid gap-3 p-5 sm:grid-cols-3">
            <input className="field" placeholder="Driver name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="field" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="field" type="number" step="0.01" placeholder="Monthly salary (₹)" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
            <input className="field" type="date" placeholder="License expiry" value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} />
            <select className="field" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">No vehicle assigned</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNo}</option>)}
            </select>
            <select className="field" value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })}>
              <option value="">No route assigned</option>
              {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
            </select>
            <select className="field" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as DriverMode })}>
              {Object.entries(MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input className="field" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="sm:col-span-3 flex gap-2">
              <button className="btn-primary"><Save size={16} /> {editId ? "Update Driver" : "Add Driver"}</button>
              <button type="button" className="btn-secondary" onClick={resetForm}><X size={16} /> Cancel</button>
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
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Salary</th>
                <th className="px-4 py-3">License Expiry</th>
                <th className="px-4 py-3">Notes</th>
                {canEdit && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {drivers.length === 0 ? (
                <tr><td colSpan={canEdit ? 11 : 10} className="px-4 py-8 text-center text-stone-400">No drivers yet.</td></tr>
              ) : (
                drivers.map((d) => (
                  <tr key={d.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-semibold text-[#1f2136]">{d.name}</td>
                    <td className="px-4 py-3">{d.phone || "—"}</td>
                    <td className="px-4 py-3">{d.vehicleId ? (vehicleMap[d.vehicleId] || "—") : "—"}</td>
                    <td className="px-4 py-3">{d.routeId ? (routes.find((route) => route.id === d.routeId)?.name || "—") : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={d.uid ? "rounded-full bg-[#e6f8ef] px-2.5 py-1 text-xs font-extrabold text-[#0f8d52]" : "rounded-full bg-[#eef0f7] px-2.5 py-1 text-xs font-extrabold text-[#7d86a8]"}>
                        {d.uid ? "Linked" : "Unlinked"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <select
                          className="field w-auto py-1.5 text-xs"
                          value={d.mode || "daily"}
                          onChange={(e) => void patchDriver(d.id, { mode: e.target.value as DriverMode })}
                        >
                          {Object.entries(MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs font-semibold text-[#5f6888]">{MODE_LABELS[d.mode || "daily"]}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => void patchDriver(d.id, { status: d.status === "inactive" ? "active" : "inactive" })}
                          className={d.status === "inactive"
                            ? "rounded-full bg-[#ffebed] px-2.5 py-1 text-xs font-extrabold text-[#c83f4d] hover:bg-[#ffd5da]"
                            : "rounded-full bg-[#e6f8ef] px-2.5 py-1 text-xs font-extrabold text-[#0f8d52] hover:bg-[#d7f3e5]"}
                        >
                          {d.status === "inactive" ? "Inactive" : "Active"}
                        </button>
                      ) : (
                        <span className={d.status === "inactive"
                          ? "rounded-full bg-[#ffebed] px-2.5 py-1 text-xs font-extrabold text-[#c83f4d]"
                          : "rounded-full bg-[#e6f8ef] px-2.5 py-1 text-xs font-extrabold text-[#0f8d52]"}>
                          {d.status === "inactive" ? "Inactive" : "Active"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{inr(d.salary)}</td>
                    <td className="px-4 py-3">{d.licenseExpiry || "—"}</td>
                    <td className="px-4 py-3 max-w-[150px] truncate">{d.notes || "—"}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => void openLink(d)} title={d.uid ? "Re-link account" : "Link account"} className="rounded-lg p-1.5 text-[#7d86a8] hover:bg-[#eef0ff] hover:text-[#3033a1]">
                            <Link2 size={15} />
                          </button>
                          <button onClick={() => openEdit(d)} className="rounded-lg p-1.5 text-[#7d86a8] hover:bg-[#eef0ff] hover:text-[#3033a1]">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => void deleteDriver(d.id)} className="rounded-lg p-1.5 text-[#7d86a8] hover:bg-[#ffebed] hover:text-[#ed515d]">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-[#1f2136]"><CalendarDays size={17} /> Daily Boarding Baseline</h2>
              <p className="mt-1 text-sm font-medium text-[#7d86a8]">Set the expected stop-wise student count used for trip reports.</p>
            </div>
            {baselineLoading && <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#7d86a8]"><Loader2 size={14} className="animate-spin" /> Loading baseline</span>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <select className="field" value={baselineRouteId} onChange={(e) => selectBaselineRoute(e.target.value)} disabled={!canEdit}>
              <option value="">Select route</option>
              {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
            </select>
            <input className="field" type="date" value={baselineDate} onChange={(e) => setBaselineDate(e.target.value)} disabled={!canEdit} />
            <button type="button" className="btn-primary" disabled={!canEdit || !baselineRoute || baselineSaving || !baselineDate} onClick={() => void saveBaseline()}>
              {baselineSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Baseline
            </button>
          </div>
          {baselineRoute && baselineRoute.stops.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {baselineRoute.stops.map((stop, index) => (
                <label key={`${stop.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-[#edf0f7] px-3 py-2">
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-[#303247]">
                    <MapPin size={14} className="shrink-0 text-[#7d86a8]" />
                    <span className="truncate">{stop.name}</span>
                  </span>
                  <input
                    className="field w-24 text-right"
                    type="number"
                    min="0"
                    step="1"
                    value={baselineCounts[index] ?? ""}
                    onChange={(e) => setBaselineCounts({ ...baselineCounts, [index]: e.target.value })}
                    disabled={!canEdit}
                  />
                </label>
              ))}
            </div>
          ) : baselineRouteId ? (
            <p className="mt-4 text-sm font-medium text-[#7d86a8]">This route has no stops configured.</p>
          ) : null}
          {baselineLoaded && <p className="mt-3 text-xs font-semibold text-[#0f8d52]">Saved baseline loaded for {baselineDate}.</p>}
        </div>
      </section>

      {linkDriver && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#10122d]/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_24px_70px_rgba(16,18,45,0.22)] md:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#1f2136]">Link driver account</h2>
                <p className="mt-1 text-sm font-medium text-[#7d86a8]">{linkDriver.name} · choose an existing user account</p>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb]" type="button" onClick={() => setLinkDriver(null)} title="Close">
                <X size={18} />
              </button>
            </div>
            <input
              className="field"
              placeholder="Search users by name, email, or ID"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />
            <div className="mt-3 max-h-[380px] overflow-y-auto rounded-xl border border-[#edf0f7]">
              {usersLoading ? (
                <p className="flex items-center justify-center gap-2 p-6 text-sm font-semibold text-[#7d86a8]"><Loader2 size={16} className="animate-spin" /> Loading users...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="p-6 text-center text-sm font-semibold text-[#7d86a8]">No linkable users found.</p>
              ) : (
                filteredUsers.map((user) => (
                  <label key={user.uid} className="flex cursor-pointer items-center gap-3 border-b border-[#edf0f7] px-4 py-3 last:border-b-0 hover:bg-[#fafbff]">
                    <input
                      type="radio"
                      name="driver-link-user"
                      className="h-4 w-4 accent-[#3033a1]"
                      checked={selectedUid === user.uid}
                      onChange={() => setSelectedUid(user.uid)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-[#303247]">{user.displayName ?? user.uid}</span>
                      <span className="block text-xs font-medium text-[#7d86a8]">{user.internalEmail ?? user.employeeId ?? user.uid}</span>
                    </span>
                    <span className="rounded-full bg-[#eef0ff] px-2.5 py-1 text-[11px] font-extrabold uppercase text-[#3033a1]">{user.role ?? "user"}</span>
                  </label>
                ))
              )}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button className="btn-secondary" type="button" onClick={() => setLinkDriver(null)}>Cancel</button>
              <button className="btn-primary" type="button" disabled={!selectedUid || linkSaving} onClick={() => void saveLink()}>
                <Link2 size={16} /> {linkSaving ? "Linking..." : "Link account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
