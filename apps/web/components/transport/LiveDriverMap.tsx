"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, Maximize2, Minus, Plus } from "lucide-react";
import { MAP_STYLE_URL } from "@/lib/mapTiles";

export type LiveMapDriver = {
  id: string;
  driverName?: string;
  vehicleRegNo?: string;
  routeName?: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  online?: boolean;
  lastSeenMs?: number | null;
  source?: string;
};

type MapLibreNamespace = any;

let maplibrePromise: Promise<MapLibreNamespace> | null = null;

function loadMapLibre(): Promise<MapLibreNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("No browser"));
  const w = window as any;
  if (w.maplibregl) return Promise.resolve(w.maplibregl);
  if (maplibrePromise) return maplibrePromise;

  maplibrePromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
    script.async = true;
    script.onload = () => {
      if (w.maplibregl) resolve(w.maplibregl);
      else reject(new Error("MapLibre failed to load"));
    };
    script.onerror = () => reject(new Error("MapLibre failed to load"));
    document.head.appendChild(script);
  });

  return maplibrePromise;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markerHtml(driver: LiveMapDriver, selected = false): string {
  const live = driver.online !== false;
  const color = live ? "#16a34a" : "#94a3b8";
  const ring = live ? "rgba(22,163,74,.25)" : "rgba(148,163,184,.25)";
  const label = escapeHtml(driver.driverName?.split(" ")[0] || driver.vehicleRegNo || "Bus");
  const selectedRing = selected ? "0 0 0 5px rgba(48,51,161,.9)," : "";
  const scale = selected ? "scale(1.12)" : "scale(1)";
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;transform:${scale};transition:transform .15s ease">
      <div style="width:34px;height:34px;border-radius:9999px;background:${color};box-shadow:${selectedRing}0 0 0 6px ${ring},0 6px 14px rgba(15,23,42,.35);display:grid;place-items:center;font-size:17px;line-height:1">🚌</div>
      <div style="max-width:96px;padding:2px 7px;border-radius:9999px;background:${selected ? "rgba(48,51,161,.95)" : "rgba(15,23,42,.82)"};color:#fff;font:600 10px/1.3 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div>
    </div>`;
}

function popupHtml(driver: LiveMapDriver): string {
  const name = escapeHtml(driver.driverName || "Driver");
  const vehicle = driver.vehicleRegNo ? escapeHtml(driver.vehicleRegNo) : "—";
  const route = driver.routeName ? escapeHtml(driver.routeName) : "—";
  const speed =
    typeof driver.speed === "number" && Number.isFinite(driver.speed)
      ? `${Math.round(driver.speed * 3.6)} km/h`
      : "—";
  const seen = typeof driver.lastSeenMs === "number" ? new Date(driver.lastSeenMs).toLocaleTimeString() : "—";
  return `
    <div style="font:500 12px/1.5 system-ui,sans-serif;color:#0f172a;min-width:180px">
      <div style="font-weight:800;font-size:14px;margin-bottom:2px">${name}</div>
      <div style="color:#475569">Bus: <b>${vehicle}</b></div>
      <div style="color:#475569">Route: <b>${route}</b></div>
      <div style="color:#475569">Speed: <b>${speed}</b></div>
      <div style="color:#64748b;margin-top:2px">Last seen: ${escapeHtml(seen)}</div>
    </div>`;
}

function OfflinePlot({ drivers }: { drivers: LiveMapDriver[] }) {
  const lats = drivers.map((d) => d.latitude);
  const lngs = drivers.map((d) => d.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.01);
  const lngSpan = Math.max(maxLng - minLng, 0.01);

  if (drivers.length === 0) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="text-sm font-bold text-foreground">Map unavailable</p>
          <p className="mt-1 text-xs text-muted-foreground">No live positions received yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(rgba(148,163,184,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.18) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
        backgroundColor: "#0b1220"
      }}
    >
      <div className="absolute left-3 top-3 z-10 rounded-full bg-black/50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300">
        Offline map (relative positions)
      </div>
      {drivers.map((d) => {
        const left = 8 + ((d.longitude - minLng) / lngSpan) * 84;
        const top = 8 + ((maxLat - d.latitude) / latSpan) * 84;
        const live = d.online !== false;
        return (
          <div
            key={d.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <div
              className="grid h-10 w-10 place-items-center rounded-full text-lg shadow-lg"
              style={{ background: live ? "#16a34a" : "#64748b" }}
            >
              🚌
            </div>
            <div className="mt-1 max-w-[110px] truncate rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
              {d.driverName || d.vehicleRegNo || "Bus"}
            </div>
          </div>
        );
      })}
      <div className="absolute bottom-2 left-3 text-[10px] font-medium text-slate-400">
        {drivers.length} bus{drivers.length === 1 ? "" : "es"} · lat/lng scaled to view
      </div>
    </div>
  );
}

type MarkerEntry = { marker: any; element: HTMLDivElement };

export function LiveDriverMap({
  drivers,
  height = 460,
  focusRequest
}: {
  drivers: LiveMapDriver[];
  height?: number;
  focusRequest?: { id: string; nonce: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreNamespace | null>(null);
  const maplibreRef = useRef<MapLibreNamespace | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const driversRef = useRef(drivers);
  const selectDriverRef = useRef<(id: string) => void>(() => undefined);
  const lastSignatureRef = useRef("");
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [tilesBlocked, setTilesBlocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    driversRef.current = drivers;
    if (selectedId && !drivers.some((driver) => driver.id === selectedId)) {
      setSelectedId(null);
    }
  }, [drivers, selectedId]);

  const openPopup = useCallback((id: string) => {
    const entry = markersRef.current.get(id);
    const popup = entry?.marker.getPopup();
    if (entry && popup && !popup.isOpen()) entry.marker.togglePopup();
  }, []);

  const selectDriver = useCallback(
    (id: string) => {
      const driver = driversRef.current.find((item) => item.id === id);
      const map = mapRef.current;
      if (!driver || !map) return;
      setSelectedId(id);
      map.flyTo({
        center: [driver.longitude, driver.latitude],
        zoom: Math.max(map.getZoom(), 15.5),
        duration: 650
      });
      window.setTimeout(() => openPopup(id), 700);
    },
    [openPopup]
  );

  useEffect(() => {
    selectDriverRef.current = selectDriver;
  }, [selectDriver]);

  useEffect(() => {
    if (!focusRequest || status !== "ready") return;
    selectDriver(focusRequest.id);
  }, [focusRequest, selectDriver, status]);

  const fitAll = useCallback(() => {
    const map = mapRef.current;
    const list = driversRef.current.filter(
      (driver) => Number.isFinite(driver.latitude) && Number.isFinite(driver.longitude)
    );
    if (!map || list.length === 0) return;
    if (list.length === 1) {
      map.flyTo({ center: [list[0].longitude, list[0].latitude], zoom: 15, duration: 650 });
      return;
    }
    const lngs = list.map((driver) => driver.longitude);
    const lats = list.map((driver) => driver.latitude);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)]
      ],
      { padding: 80, maxZoom: 14, duration: 700 }
    );
  }, []);

  const focusSelected = useCallback(() => {
    const list = driversRef.current.filter(
      (driver) => Number.isFinite(driver.latitude) && Number.isFinite(driver.longitude)
    );
    const driver = list.find((item) => item.id === selectedId) ?? list[0];
    if (!driver) {
      fitAll();
      return;
    }
    selectDriver(driver.id);
  }, [fitAll, selectDriver, selectedId]);

  const selectedDriver = drivers.find((driver) => driver.id === selectedId) ?? null;

  const zoomBy = useCallback((delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 250 });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadTimer: ReturnType<typeof setTimeout> | null = null;
    const markers = markersRef.current;

    loadMapLibre()
      .then((ml) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        maplibreRef.current = ml;

        const map = new ml.Map({
          container: containerRef.current,
          style: MAP_STYLE_URL,
          center: [78.4867, 17.385],
          zoom: 11,
          attributionControl: true
        });

        let errorCount = 0;
        map.on("error", () => {
          errorCount += 1;
          if (errorCount >= 8) setTilesBlocked(true);
        });
        map.on("load", () => {
          if (loadTimer) clearTimeout(loadTimer);
          if (!cancelled) setStatus("ready");
        });

        mapRef.current = map;

        loadTimer = setTimeout(() => {
          if (cancelled || map.loaded()) return;
          setStatus("failed");
          try {
            map.remove();
          } catch {
            /* already gone */
          }
          mapRef.current = null;
        }, 12_000);
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
      if (loadTimer) clearTimeout(loadTimer);
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const ml = maplibreRef.current;
    const map = mapRef.current;
    if (!ml || !map || status !== "ready") return;

    const seen = new Set<string>();
    for (const driver of drivers) {
      if (!Number.isFinite(driver.latitude) || !Number.isFinite(driver.longitude)) continue;
      seen.add(driver.id);
      const lngLat: [number, number] = [driver.longitude, driver.latitude];

      const isSelected = driver.id === selectedId;
      const existing = markersRef.current.get(driver.id);
      if (existing) {
        existing.marker.setLngLat(lngLat);
        existing.element.innerHTML = markerHtml(driver, isSelected);
        existing.marker.setPopup(
          new ml.Popup({ offset: 24, closeButton: false }).setHTML(popupHtml(driver))
        );
      } else {
        const element = document.createElement("div");
        element.style.cursor = "pointer";
        element.setAttribute("role", "button");
        element.setAttribute(
          "aria-label",
          `Focus ${driver.driverName || driver.vehicleRegNo || "bus"} on the map`
        );
        element.innerHTML = markerHtml(driver, isSelected);
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          selectDriverRef.current(driver.id);
        });
        const marker = new ml.Marker({ element, anchor: "center" })
          .setLngLat(lngLat)
          .setPopup(new ml.Popup({ offset: 24, closeButton: false }).setHTML(popupHtml(driver)))
          .addTo(map);
        markersRef.current.set(driver.id, { marker, element });
      }
    }

    markersRef.current.forEach(({ marker }, id) => {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    const signature = drivers.map((d) => d.id).sort().join("|");
    if (drivers.length > 0 && signature !== lastSignatureRef.current) {
      const lats = drivers.map((d) => d.latitude);
      const lngs = drivers.map((d) => d.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      if (maxLat - minLat < 0.0015 && maxLng - minLng < 0.0015) {
        map.easeTo({ center: [lngs[0], lats[0]], zoom: 14, duration: 600 });
      } else {
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat]
          ],
          { padding: 70, maxZoom: 13.5, duration: 700 }
        );
      }
    }
    lastSignatureRef.current = signature;
  }, [drivers, selectedId, status]);

  return (
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-black/10" style={{ height }}>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ display: status === "failed" ? "none" : "block" }}
      />

      <div className="absolute right-3 top-3 z-[500] flex items-center gap-1 rounded-2xl bg-white/95 p-1.5 shadow-lg ring-1 ring-black/10 backdrop-blur">
        <button
          type="button"
          onClick={() => zoomBy(1)}
          disabled={status !== "ready"}
          className="grid h-9 w-9 place-items-center rounded-xl text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
          aria-label="Zoom in at map centre"
          title="Zoom in at map centre"
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(-1)}
          disabled={status !== "ready"}
          className="grid h-9 w-9 place-items-center rounded-xl text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
          aria-label="Zoom out at map centre"
          title="Zoom out at map centre"
        >
          <Minus size={18} />
        </button>
        <span className="mx-0.5 h-6 w-px bg-slate-200" />
        <button
          type="button"
          onClick={fitAll}
          disabled={status !== "ready" || drivers.length === 0}
          className="grid h-9 w-9 place-items-center rounded-xl text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
          aria-label="Fit all buses on the map"
          title="Fit all buses"
        >
          <Maximize2 size={17} />
        </button>
        <button
          type="button"
          onClick={focusSelected}
          disabled={status !== "ready" || drivers.length === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#3033a1] px-2.5 text-xs font-extrabold text-white transition hover:bg-[#272a8a] disabled:opacity-40"
          aria-label={selectedDriver ? "Focus the selected bus precisely" : "Focus the first bus precisely"}
          title={selectedDriver ? "Precise focus on selected bus" : "Precise focus on a bus"}
        >
          <Crosshair size={16} />
          Precise
        </button>
      </div>

      {status === "ready" ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[260px] rounded-xl bg-slate-950/80 px-3 py-2 text-[11px] text-white shadow-lg backdrop-blur">
          {selectedDriver ? (
            <>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-emerald-300">
                Selected bus
              </p>
              <p className="mt-0.5 truncate text-sm font-extrabold">
                {selectedDriver.vehicleRegNo || selectedDriver.driverName || "Bus"}
              </p>
              <p className="truncate text-white/70">
                {selectedDriver.driverName || "Driver"}
                {selectedDriver.routeName ? ` · ${selectedDriver.routeName}` : " · No route"}
              </p>
              <p className="mt-0.5 text-white/60">
                {typeof selectedDriver.accuracy === "number"
                  ? `±${Math.round(selectedDriver.accuracy)} m accuracy`
                  : "Accuracy unavailable"}
              </p>
            </>
          ) : (
            <p className="font-semibold">Tap a bus pin to focus · drag to pan · scroll to zoom</p>
          )}
        </div>
      ) : null}

      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-slate-950/80 text-sm font-semibold text-slate-200">
          Loading map…
        </div>
      )}
      {status === "failed" && <OfflinePlot drivers={drivers} />}
      {status === "ready" && tilesBlocked && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[500] w-[min(92%,480px)] -translate-x-1/2 rounded-xl bg-amber-50/95 px-3 py-2 text-center text-[11px] font-semibold text-amber-900 shadow ring-1 ring-amber-300">
          Basemap tiles could not be loaded. Bus pins still update — check the network or set{" "}
          <code className="font-mono">NEXT_PUBLIC_MAP_STYLE_URL</code>.
        </div>
      )}
    </div>
  );
}
