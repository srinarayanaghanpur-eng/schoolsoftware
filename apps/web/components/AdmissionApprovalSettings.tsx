"use client";

import { db, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ShieldCheck, Save } from "lucide-react";
import { useEffect, useState } from "react";

export function AdmissionApprovalSettings() {
  const [requireApproval, setRequireApproval] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    getDoc(doc(db, "settings", "admissions"))
      .then((snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data() as { requireApproval?: boolean };
        if (typeof data.requireApproval === "boolean") setRequireApproval(data.requireApproval);
      })
      .catch(() => setMessage("Could not load admission settings from Firebase."));
  }, []);

  const save = async () => {
    setLoading(true);
    setMessage(null);
    try {
      if (!isFirebaseConfigured) {
        setMessage("Firebase is not configured, so settings were not saved.");
        return;
      }
      await setDoc(doc(db, "settings", "admissions"), { requireApproval }, { merge: true });
      setMessage("Admission approval setting saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save admission settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card space-y-4 p-4 xl:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Admission approval</h2>
          <p className="mt-1 text-sm font-medium text-[#7d86a8]">
            When ON, every new admission is created as <strong>pending</strong> and must be approved on the Approvals page
            before it is final. When OFF, admissions are approved immediately.
          </p>
        </div>
        <ShieldCheck className="text-[#3033a1]" size={22} />
      </div>

      <label className="flex items-center gap-3 text-sm font-semibold text-[#303247]">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[#3033a1]"
          checked={requireApproval}
          onChange={(event) => setRequireApproval(event.target.checked)}
        />
        Require admin approval for new admissions
      </label>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={loading} onClick={save}>
          <Save size={16} />
          {loading ? "Saving..." : "Save"}
        </button>
        {message && <p className="rounded-xl bg-[#f7f8fd] px-3 py-2 text-sm font-medium text-[#7d86a8]">{message}</p>}
      </div>
    </div>
  );
}
