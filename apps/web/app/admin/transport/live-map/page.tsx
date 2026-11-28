"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { LiveDriverMap, type LiveMapDriver } from "@/components/transport/LiveDriverMap";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { Bus, MapPin, Radio, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type LiveResponse = {
  ok: boolean;
  locations: LiveMapDriver[];
  serverTime: number;
  onlineWindowMs: number;
};

const POLL_MS = 30_000;

const DEMO_DRIVERS = [
  { name: "Ramesh Kumar", bus: "TS09 UA 1042", route: "Route A · Kukatpally" },
  { name: "Suresh Reddy", bus: "TS09 UA 1153", route: "Route B · LB Nagar" },
  { name: "Mahesh Goud", bus: "TS09 UA 1264", route: "Route C · Secunderabad" }
];

function buildDemoDrivers(tick: number): LiveMapDriver[] {
  const baseLat = 17.385;
  const baseLng = 78.4867;
  const now = Date.now();
  return DEMO_DRIVERS.map((driver, index) => {
    const angle = tick / 16 + (index * Math.PI * 2) / DEMO_DRIVERS.length;
    const radius = 0.022 + index * 0.008;
    return {
      id: `demo-${index}`,
      driverName: driver.name,
      vehicleRegNo: driver.bus,
      routeName: driver.route,
      latitude: baseLat + Math.sin(angle) * radius,
      longitude: baseLng + Math.cos(angle) * radius * 1.2,
      speed: 8 + (index + 1) * 2.4,
      heading: ((angle * 180) / Math.PI + 90) % 360,
      online: true,
      lastSeenMs: now,
      source: "demo"
    };
  });
}

function formatDateTime(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(new Date(ms));
}

function formatAgo(ms: number | null | undefined, now: number): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "never";
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

function formatSpeed(speed: number | null | undefined): string {
  if (typeof speed !== "number" || !Number.isFinite(speed)) return "—";
  return `${Math.round(speed * 3.6)} km/h`;
}

function formatAccuracy(accuracy: number | null | undefined): string {
  if (typeof accuracy !== "number" || !Number.isFinite(accuracy)) return "—";
  return `±${Math.round(accuracy)} m`;
}

export default function LiveMapPage() {
  const { hasPermission } = useAdminSession();
  const canView = hasPermission("transport.view");

  const [liveDrivers, setLiveDrivers] = useState<LiveMapDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const [demoTick, setDemoTick] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminApiRequest<LiveResponse>(
        "/api/admin/transport/live-locations",
        undefined,
        { fresh: true }
      );
      setLiveDrivers(Array.isArray(res.locations) ? res.locations : []);
      setLoadedAt(Date.now());
      setError("");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Unable to load live locations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    let interval: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = undefined;
      }
    };
    const start = () => {
      if (interval || document.visibilityState !== "visible") return;
      void load();
      interval = setInterval(() => void load(), POLL_MS);
    };
    const onVisibilityChange = () => {
      stop();
      if (document.visibilityState === "visible") start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [canView, load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!demo) return;
    const id = setInterval(() => setDemoTick((tick) => tick + 1), 2000);
    return () => clearInterval(id);
  }, [demo]);

  const demoDrivers = useMemo(
    () => (demo ? buildDemoDrivers(demoTick) : []),
    [demo, demoTick]
  );

  if (!canView) {
    return (
      <section className="p-7">
        <div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div>
      </section>
    );
  }

  const drivers = demo ? demoDrivers : liveDrivers;
  const onlineCount = drivers.filter((driver) => driver.online !== false).length;
  const refreshLabel = loadedAt ? formatAgo(loadedAt, now) : "not yet";

  return (
    <>
      <PageHeader
        title="Live Bus Map"
        description="Follow every school bus in real time. Positions arrive from the driver app while a trip is active."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full bg-muted p-1">
              <button
                type="button"
                onClick={() => setDemo(false)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  demo ? "text-muted-foreground" : "bg-primary text-primary-foreground shadow-sm"
                }`}
              >
                <Radio size={14} /> Live
              </button>
              <button
                type="button"
                onClick={() => setDemo(true)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  demo ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Bus size={14} /> Demo
              </button>
            </div>
            <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        }
      />

      <section className="space-y-5 p-4 md:p-7">
        {error && (
          <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {onlineCount} live
          </span>
          <span className="inline-flex items-center gap-2 font-semibold text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" />
            {drivers.length - onlineCount} stale
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {demo ? "Demo simulation (no server data)" : `Updated ${refreshLabel}`}
          </span>
        </div>

        <LiveDriverMap drivers={drivers} height={480} focusRequest={focusRequest} />

        {drivers.length === 0 && !demo ? (
          <div className="card p-6 text-center">
            <MapPin className="mx-auto mb-2 text-muted-foreground" size={26} />
            <p className="text-sm font-bold text-foreground">No bus positions yet</p>
            <p className="mx-auto mt-1 max-w-xl text-xs text-muted-foreground">
              Open the driver app, allow location, and start a journey. The phone will share a fix
              every ~30 seconds and it will appear here within one poll cycle.
            </p>
            <button type="button" className="btn-secondary mt-4" onClick={() => setDemo(true)}>
              Preview with demo buses
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {drivers.map((driver) => {
              const live = driver.online !== false;
              return (
                <button
                  type="button"
                  key={driver.id}
                  onClick={() => setFocusRequest({ id: driver.id, nonce: Date.now() })}
                  className="card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md hover:ring-2 hover:ring-[#3033a1]/30"
                  aria-label={`Focus ${driver.driverName || driver.vehicleRegNo || "bus"} on the map`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-foreground">
                        {driver.driverName || "Driver"}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                        {driver.vehicleRegNo || "No bus linked"} · {driver.routeName || "No route"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                        live ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {live ? "Live" : "Stale"}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="font-semibold text-muted-foreground">Speed</dt>
                      <dd className="font-bold text-foreground">{formatSpeed(driver.speed)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-muted-foreground">Accuracy</dt>
                      <dd className="font-bold text-foreground">{formatAccuracy(driver.accuracy)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="font-semibold text-muted-foreground">Last update</dt>
                      <dd className="font-bold text-foreground">{formatDateTime(driver.lastSeenMs)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-muted-foreground">Source</dt>
                      <dd className="font-bold capitalize text-foreground">{driver.source || "gps"}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 truncate font-mono text-[10px] text-muted-foreground">
                    {driver.latitude.toFixed(5)}, {driver.longitude.toFixed(5)}
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-[#3033a1]">Tap to focus on map</p>
                </button>
              );
            })}
          </div>
        )}

        <div className="card border-l-4 border-l-[#3033a1] p-4 text-xs text-muted-foreground">
          <p className="font-bold text-foreground">Testing checklist</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            <li>Driver app: allow location, start a journey, keep the screen awake for ~20 s.</li>
            <li>This page: press Refresh (it also polls every 10 s automatically).</li>
            <li>No driver handy? Switch to Demo above to see moving buses.</li>
          </ol>
        </div>
      </section>
    </>
  );
}
