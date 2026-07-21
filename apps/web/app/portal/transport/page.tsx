"use client";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { usePortalChild } from "@/components/PortalChildContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { Bus, MapPin, Phone, User, Clock, Route, Ban } from "lucide-react";
import { useEffect, useState } from "react";

type TransportData = {
  transport: {
    route: { id: string; name: string; driverName?: string; driverPhone?: string } | null;
    stop: { name: string; time?: string; pickupTime?: string; dropTime?: string } | null;
    vehicle: { number: string; type?: string; capacity?: number } | null;
  } | null;
  message?: string;
};

function TransportView() {
  const { selectedChildId, selectedChild, children, switchChild, loading: childrenLoading } = usePortalChild();
  const [data, setData] = useState<TransportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedChildId) return;
    setLoading(true);
    adminApiRequest<{ ok: true } & TransportData>(`/api/portal/transport?studentId=${encodeURIComponent(selectedChildId)}`)
      .then((r) => setData(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedChildId]);

  return (
    <>
      <PageHeader title="Transport" description={selectedChild ? `${selectedChild.name} · Class ${selectedChild.className}` : ""} />

      {children.length > 1 && (
        <div className="px-4 md:px-7">
          <select
            className="field"
            value={selectedChildId}
            onChange={(e) => switchChild(e.target.value)}
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.name} - Class {c.className}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !data?.transport ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <Ban size={48} className="mb-4 text-muted-foreground" />
          <h2 className="text-xl font-extrabold text-foreground">No Transport Assigned</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {data?.message || "Your child is not assigned to any transport route. Please contact the school for transport arrangements."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 p-4 md:grid-cols-2 md:p-7">
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Route size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">Route</h3>
                <p className="text-base font-extrabold text-foreground">{data.transport.route?.name || "N/A"}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <MapPin size={16} className="text-primary" />
                <span className="text-muted-foreground">Pickup Point:</span>
                <span className="font-semibold text-foreground">{data.transport.stop?.name || "N/A"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock size={16} className="text-primary" />
                <span className="text-muted-foreground">Pickup Time:</span>
                <span className="font-semibold text-foreground">{data.transport.stop?.pickupTime || data.transport.stop?.time || "N/A"}</span>
              </div>
              {data.transport.stop?.dropTime && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock size={16} className="text-primary" />
                  <span className="text-muted-foreground">Drop Time:</span>
                  <span className="font-semibold text-foreground">{data.transport.stop.dropTime}</span>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bus size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">Vehicle</h3>
                <p className="text-base font-extrabold text-foreground">{data.transport.vehicle?.number || "N/A"}</p>
              </div>
            </div>
            <div className="space-y-3">
              {data.transport.vehicle?.type && (
                <div className="flex items-center gap-3 text-sm">
                  <Bus size={16} className="text-primary" />
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-semibold text-foreground">{data.transport.vehicle.type}</span>
                </div>
              )}
              {data.transport.vehicle?.capacity && (
                <div className="flex items-center gap-3 text-sm">
                  <User size={16} className="text-primary" />
                  <span className="text-muted-foreground">Capacity:</span>
                  <span className="font-semibold text-foreground">{data.transport.vehicle.capacity} seats</span>
                </div>
              )}
            </div>
          </div>

          {data.transport.route?.driverName && (
            <div className="card p-5 md:col-span-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <User size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-muted-foreground">Driver</h3>
                  <p className="text-base font-extrabold text-foreground">{data.transport.route.driverName}</p>
                </div>
                {data.transport.route.driverPhone && (
                  <a
                    href={`tel:${data.transport.route.driverPhone}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
                  >
                    <Phone size={16} /> {data.transport.route.driverPhone}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function PortalTransportPage() {
  return (
    <AppShell>
      <TransportView />
    </AppShell>
  );
}
