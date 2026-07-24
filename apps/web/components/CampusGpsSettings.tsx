"use client";

import { DEFAULT_SETTINGS, type SchoolSettings } from "@sri-narayana/shared";
import { db, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { LocateFixed, MapPin, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CampusForm = {
  schoolName: string;
  campusLatitude: string;
  campusLongitude: string;
  geofenceRadiusMeters: string;
  schoolStartTime: string;
  graceMinutes: string;
};

function toForm(settings: SchoolSettings): CampusForm {
  return {
    schoolName: settings.schoolName,
    campusLatitude: String(settings.campusLatitude),
    campusLongitude: String(settings.campusLongitude),
    geofenceRadiusMeters: String(settings.geofenceRadiusMeters),
    schoolStartTime: settings.schoolStartTime,
    graceMinutes: String(settings.graceMinutes)
  };
}

function toSettings(form: CampusForm) {
  return {
    schoolName: form.schoolName,
    campusLatitude: Number(form.campusLatitude),
    campusLongitude: Number(form.campusLongitude),
    geofenceRadiusMeters: Number(form.geofenceRadiusMeters),
    schoolStartTime: form.schoolStartTime,
    graceMinutes: Number(form.graceMinutes),
    timezone: "Asia/Kolkata"
  };
}

function getBrowserLocation() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  });
}

export function CampusGpsSettings() {
  const [form, setForm] = useState<CampusForm>(() => toForm(DEFAULT_SETTINGS));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const mapUrl = useMemo(() => {
    const lat = Number(form.campusLatitude);
    const lng = Number(form.campusLongitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }, [form.campusLatitude, form.campusLongitude]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    getDoc<Partial<SchoolSettings>>(doc(db, "settings", "school"))
      .then((snapshot) => {
        if (!snapshot.exists()) return;
        setForm(toForm({ ...DEFAULT_SETTINGS, ...snapshot.data() }));
      })
      .catch(() => setMessage("Could not load GPS settings from Firebase."));
  }, []);

  const update = (key: keyof CampusForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const useCurrentLocation = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const position = await getBrowserLocation();
      setForm((current) => ({
        ...current,
        campusLatitude: position.coords.latitude.toFixed(7),
        campusLongitude: position.coords.longitude.toFixed(7)
      }));
      setMessage("Current GPS location captured. Check the map preview before saving.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to get current GPS location.");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const settings = toSettings(form);
      if (!Number.isFinite(settings.campusLatitude) || !Number.isFinite(settings.campusLongitude)) {
        throw new Error("Latitude and longitude must be valid numbers.");
      }
      if (settings.geofenceRadiusMeters < 50 || settings.geofenceRadiusMeters > 1000) {
        throw new Error("Allowed radius should be between 50 and 1000 meters.");
      }
      if (!isFirebaseConfigured) {
        setMessage("Firebase is not configured, so GPS settings were not saved.");
        return;
      }
      await setDoc(doc(db, "settings", "school"), settings, { merge: true });
      setMessage("Campus GPS settings saved to Firebase.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save GPS settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Campus GPS geofence</h2>
          <p className="mt-1 text-sm font-medium text-[#7d86a8]">Attendance is allowed only inside this radius.</p>
        </div>
        <MapPin className="text-[#3033a1]" size={22} />
      </div>

      <label className="block text-sm">
        School name
        <input className="field mt-1" value={form.schoolName} onChange={(event) => update("schoolName", event.target.value)} />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          Latitude
          <input className="field mt-1" value={form.campusLatitude} onChange={(event) => update("campusLatitude", event.target.value)} />
        </label>
        <label className="block text-sm">
          Longitude
          <input className="field mt-1" value={form.campusLongitude} onChange={(event) => update("campusLongitude", event.target.value)} />
        </label>
      </div>

      <label className="block text-sm">
        Allowed radius in meters
        <input className="field mt-1" value={form.geofenceRadiusMeters} onChange={(event) => update("geofenceRadiusMeters", event.target.value)} />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          School start time
          <input className="field mt-1" type="time" value={form.schoolStartTime} onChange={(event) => update("schoolStartTime", event.target.value)} />
        </label>
        <label className="block text-sm">
          Grace minutes
          <input className="field mt-1" value={form.graceMinutes} onChange={(event) => update("graceMinutes", event.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={loading} onClick={useCurrentLocation}>
          <LocateFixed size={16} />
          Use current GPS
        </button>
        {mapUrl && (
          <a className="btn-secondary" href={mapUrl} target="_blank" rel="noreferrer">
            <MapPin size={16} />
            Open map
          </a>
        )}
        <button className="btn-primary" disabled={loading} onClick={save}>
          <Save size={16} />
          {loading ? "Saving..." : "Save GPS"}
        </button>
      </div>

      {message && <p className="rounded-xl bg-[#f7f8fd] px-3 py-2 text-sm font-medium text-[#7d86a8]">{message}</p>}
    </div>
  );
}
