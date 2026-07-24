"use client";

import { db, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { QrCode, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { UpiQr, DEFAULT_UPI_ID, DEFAULT_UPI_PAYEE_NAME } from "@/components/UpiQr";

export function PaymentUpiSettings() {
  const [upiId, setUpiId] = useState(DEFAULT_UPI_ID);
  const [payeeName, setPayeeName] = useState(DEFAULT_UPI_PAYEE_NAME);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    getDoc(doc(db, "settings", "payment"))
      .then((snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data() as { upiId?: string; payeeName?: string };
        setUpiId(data.upiId || DEFAULT_UPI_ID);
        setPayeeName(data.payeeName || DEFAULT_UPI_PAYEE_NAME);
      })
      .catch(() => setMessage("Could not load payment settings from Firebase."));
  }, []);

  const save = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const id = upiId.trim();
      const name = payeeName.trim();
      if (!/^[\w.\-]+@[\w.\-]+$/.test(id)) {
        throw new Error("Enter a valid UPI ID, e.g. name@ybl or 9876543210@okhdfcbank.");
      }
      if (!name) throw new Error("Enter the payee name shown on the QR.");
      if (!isFirebaseConfigured) {
        setMessage("Firebase is not configured, so settings were not saved.");
        return;
      }
      await setDoc(doc(db, "settings", "payment"), { upiId: id, payeeName: name }, { merge: true });
      setMessage("UPI payment QR settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save payment settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card space-y-4 p-4 xl:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">UPI payment QR</h2>
          <p className="mt-1 text-sm font-medium text-[#7d86a8]">Used on the Fee Payments page to generate a scan-to-pay QR for the exact amount.</p>
        </div>
        <QrCode className="text-[#3033a1]" size={22} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-sm">
            UPI ID
            <input className="field mt-1" placeholder="example@ybl" value={upiId} onChange={(event) => setUpiId(event.target.value)} />
          </label>
          <label className="block text-sm">
            Payee name (as shown to payer)
            <input className="field mt-1" placeholder="POTHUGANTI SWAPNA CHARY" value={payeeName} onChange={(event) => setPayeeName(event.target.value)} />
          </label>
          <button className="btn-primary" disabled={loading} onClick={save}>
            <Save size={16} />
            {loading ? "Saving..." : "Save UPI QR"}
          </button>
          {message && <p className="rounded-xl bg-[#f7f8fd] px-3 py-2 text-sm font-medium text-[#7d86a8]">{message}</p>}
        </div>
        <div className="grid place-items-center rounded-2xl bg-[#f7f8fd] p-4">
          <UpiQr upiId={upiId.trim()} payeeName={payeeName.trim()} note="Preview" size={170} />
        </div>
      </div>
    </div>
  );
}
