"use client";

import { useEffect, useRef, useState } from "react";
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

function markerHtml(driver: LiveMapDriver): string {
  const live = driver.online !== false;
  const color = live ? "#16a34a" : "#94a3b8";
  const ring = live ? "rgba(22,163,74,.25)" : "rgba(148,163,184,.25)";
  const label = escapeHtml(driver.driverName?.split(" ")[0] || driver.vehicleRegNo || "Bus");
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="width:34px;height:34px;border-radius:9999px;background:${color};box-shadow:0 0 0 6px ${ring},0 6px 14px rgba(15,23,42,.35);display:grid;place-items:center;font-size:17px;line-height:1">🚌</div>
      <div style="max-width:96px;padding:2px 7px;border-radius:9999px;background:rgba(15,23,42,.82);color:#fff;font:600 10px/1.3 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div>
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
  height = 460
}: {
  drivers: LiveMapDriver[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreNamespace | null>(null);
  const maplibreRef = useRef<MapLibreNamespace | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const lastSignatureRef = useRef("");
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [tilesBlocked, setTilesBlocked] = useState(false);

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
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-left");

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

      const existing = markersRef.current.get(driver.id);
      if (existing) {
        existing.marker.setLngLat(lngLat);
        existing.element.innerHTML = markerHtml(driver);
        existing.marker.setPopup(
          new ml.Popup({ offset: 24, closeButton: false }).setHTML(popupHtml(driver))
        );
      } else {
        const element = document.createElement("div");
        element.style.cursor = "pointer";
        element.innerHTML = markerHtml(driver);
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
  }, [drivers, status]);

  return (
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-black/10" style={{ height }}>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ display: status === "failed" ? "none" : "block" }}
      />
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
