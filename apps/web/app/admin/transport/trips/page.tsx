"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { Bus, ChevronDown, ChevronRight, Loader2, MapPin, Users } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";

interface Trip {
  id: string;
  date?: string;
  driverId?: string;
  driverName?: string;
  vehicleId?: string;
  vehicleRegNo?: string;
  busRegNo?: string;
  routeId?: string;
  routeName?: string;
  direction?: string;
  mode?: string;
  status?: string;
  boarded?: number;
  alighted?: number;
  totalBoarded?: number;
  totalAlighted?: number;
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
  completedAt?: string;
}

interface TripStop {
  id?: string;
  tripId?: string;
  stopIndex?: number;
  stopName?: string;
  boarded?: number;
  alighted?: number;
}

interface BaselineStop {
  stopIndex: number;
  stopName: string;
  count: number;
}

interface Baseline {
  routeId?: string;
  baselineDate?: string;
  stopCounts?: BaselineStop[];
}

interface TripsResponse {
  ok?: boolean;
  trips?: Trip[];
  stops?: TripStop[];
  baseline?: Baseline | null;
}

interface RouteOption { id: string; name: string; stops?: { name: string; fee?: number }[]; }
interface VehicleOption { id: string; regNo: string; }
interface DriverOption { id: string; name: string; }

const MODE_LABELS: Record<string, string> = {
  first_day: "First day",
  daily: "Daily",
  combined: "Combined"
};
const DIRECTION_LABELS: Record<string, string> = {
  pickup: "Pickup",
  drop: "Drop"
};

function todayIso() { return new Date().toISOString().slice(0, 10); }
function errorMessage(error: unknown) { return error instanceof AdminApiError ? error.message : "Failed"; }
function timeLabel(value?: string) {
  if (!value) return "—";
  if (!value.includes("T")) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function statusClass(status?: string) {
  const value = (status ?? "").toLowerCase();
  if (value === "completed" || value === "done" || value === "active") return "bg-[#e6f8ef] text-[#0f8d52]";
  if (value === "cancelled" || value === "canceled" || value === "missed") return "bg-[#ffebed] text-[#c83f4d]";
  return "bg-[#fff8ea] text-[#9f7116]";
}
function tripBoarded(trip: Trip) { return Number(trip.totalBoarded ?? trip.boarded ?? 0); }
function tripAlighted(trip: Trip) { return Number(trip.totalAlighted ?? trip.alighted ?? 0); }

export default function DriverTripsPage() {
  const { hasPermission } = useAdminSession();
  const [date, setDate] = useState(todayIso);
  const [routeId, setRouteId] = useState("all");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [stops, setStops] = useState<TripStop[]>([]);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const canView = hasPermission("transport.view");

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    Promise.all([
      adminApiRequest<{ routes?: RouteOption[] }>("/api/admin/transport/routes"),
      adminApiRequest<{ vehicles?: VehicleOption[] }>("/api/admin/transport/vehicles"),
      adminApiRequest<{ drivers?: DriverOption[] }>("/api/admin/transport/drivers")
    ]).then(([routeResult, vehicleResult, driverResult]) => {
      if (cancelled) return;
      setRoutes(routeResult.routes ?? []);
      setVehicles(vehicleResult.vehicles ?? []);
      setDrivers(driverResult.drivers ?? []);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [canView]);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ date });
    if (routeId !== "all") params.set("routeId", routeId);
    adminApiRequest<TripsResponse>(`/api/admin/transport/trips?${params.toString()}`, undefined, { fresh: true })
      .then((result) => {
        if (cancelled) return;
        setTrips(result.trips ?? []);
        setStops(result.stops ?? []);
        setBaseline(result.baseline ?? null);
        setExpandedId(null);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [date, routeId, canView]);

  const routeMap = useMemo(() => new Map(routes.map((route) => [route.id, route.name])), [routes]);
  const vehicleMap = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.regNo])), [vehicles]);
  const driverMap = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver.name])), [drivers]);
  const stopsByTrip = useMemo(() => {
    const map = new Map<string, TripStop[]>();
    stops.forEach((stop) => {
      if (!stop.tripId) return;
      const list = map.get(stop.tripId) ?? [];
      list.push(stop);
      map.set(stop.tripId, list);
    });
    map.forEach((list) => list.sort((a, b) => (a.stopIndex ?? 0) - (b.stopIndex ?? 0)));
    return map;
  }, [stops]);

  const totalBoarded = trips.reduce((sum, trip) => sum + tripBoarded(trip), 0);
  const totalAlighted = trips.reduce((sum, trip) => sum + tripAlighted(trip), 0);

  if (!canView) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Driver Trips" description="Read-only trip and boarding report for drivers, buses, and routes." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <Bus size={16} />
              <span className="text-xs font-semibold">Trips</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{trips.length}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <Users size={16} />
              <span className="text-xs font-semibold">Boarded</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{totalBoarded}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <Users size={16} />
              <span className="text-xs font-semibold">Alighted</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{totalAlighted}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-[#7d86a8]">
              <MapPin size={16} />
              <span className="text-xs font-semibold">Baseline Date</span>
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#1f2136]">{baseline?.baselineDate || "—"}</p>
          </div>
        </div>

        <div className="card flex flex-wrap items-center gap-3 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-[#5f6888]">
            Date
            <input className="field w-auto" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-[#5f6888]">
            Route
            <select className="field w-auto" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
              <option value="all">All routes</option>
              {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
            </select>
          </label>
          {loading && <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#7d86a8]"><Loader2 size={14} className="animate-spin" /> Loading trips</span>}
        </div>

        {baseline && baseline.stopCounts && baseline.stopCounts.length > 0 && (
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <MapPin size={16} className="text-[#3033a1]" />
              <h2 className="font-bold text-[#1f2136]">Route baseline</h2>
              <span className="rounded-full bg-[#eef0ff] px-2.5 py-1 text-xs font-extrabold text-[#3033a1]">{baseline.baselineDate || "—"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {baseline.stopCounts.map((stop) => (
                <span key={`${stop.stopIndex}-${stop.stopName}`} className="rounded-full bg-[#f7f8fd] px-3 py-1 text-xs font-semibold text-[#5f6888] ring-1 ring-[#e3e6f0]">
                  {stop.stopName}: {stop.count}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3" />
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Bus</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Boarded</th>
                <th className="px-4 py-3 text-right">Alighted</th>
                <th className="px-4 py-3">Times</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-stone-400"><span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading trips...</span></td></tr>
              ) : trips.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-stone-400">No trips recorded for this date.</td></tr>
              ) : (
                trips.map((trip) => {
                  const tripStops = stopsByTrip.get(trip.id) ?? [];
                  const expanded = expandedId === trip.id;
                  const driverName = trip.driverName || (trip.driverId ? driverMap.get(trip.driverId) : "") || "—";
                  const bus = trip.vehicleRegNo || trip.busRegNo || (trip.vehicleId ? vehicleMap.get(trip.vehicleId) : "") || "—";
                  const routeName = trip.routeName || (trip.routeId ? routeMap.get(trip.routeId) : "") || "—";
                  const started = trip.startedAt || trip.createdAt;
                  const ended = trip.endedAt || trip.completedAt;
                  return (
                    <Fragment key={trip.id}>
                      <tr className="hover:bg-stone-50">
                        <td className="px-2 py-3">
                          <button
                            type="button"
                            className="grid h-8 w-8 place-items-center rounded-lg text-[#7d86a8] hover:bg-[#eef0ff] hover:text-[#3033a1]"
                            onClick={() => setExpandedId(expanded ? null : trip.id)}
                            aria-label={expanded ? "Hide stop counts" : "Show stop counts"}
                            aria-expanded={expanded}
                          >
                            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#1f2136]">{driverName}</td>
                        <td className="px-4 py-3">{bus}</td>
                        <td className="px-4 py-3">{routeName}</td>
                        <td className="px-4 py-3">{DIRECTION_LABELS[trip.direction ?? ""] ?? trip.direction ?? "—"}</td>
                        <td className="px-4 py-3">{MODE_LABELS[trip.mode ?? ""] ?? trip.mode ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${statusClass(trip.status)}`}>{trip.status || "pending"}</span>
                        </td>
                        <td className="px-4 py-3 text-right">{tripBoarded(trip)}</td>
                        <td className="px-4 py-3 text-right">{tripAlighted(trip)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-[#5f6888]">{timeLabel(started)} – {timeLabel(ended)}</td>
                      </tr>
                      {expanded && (
                        <tr className="bg-[#fafbff]">
                          <td colSpan={10} className="px-4 py-4">
                            <div className="rounded-xl border border-[#edf0f7] bg-white">
                              <div className="flex items-center gap-2 border-b border-[#edf0f7] px-4 py-3">
                                <MapPin size={15} className="text-[#3033a1]" />
                                <h3 className="font-bold text-[#1f2136]">Stop counts</h3>
                              </div>
                              {tripStops.length === 0 ? (
                                <p className="px-4 py-5 text-sm font-medium text-[#7d86a8]">No stop records for this trip.</p>
                              ) : (
                                <table className="w-full text-left text-sm">
                                  <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                                    <tr>
                                      <th className="px-4 py-2">Stop</th>
                                      <th className="px-4 py-2 text-right">Boarded</th>
                                      <th className="px-4 py-2 text-right">Alighted</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-stone-100">
                                    {tripStops.map((stop, index) => (
                                      <tr key={stop.id ?? `${trip.id}-${index}`}>
                                        <td className="px-4 py-2 font-semibold text-[#303247]">{stop.stopName || `Stop ${(stop.stopIndex ?? index) + 1}`}</td>
                                        <td className="px-4 py-2 text-right">{stop.boarded ?? 0}</td>
                                        <td className="px-4 py-2 text-right">{stop.alighted ?? 0}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
