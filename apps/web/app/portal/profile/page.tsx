"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { PasswordInput } from "@/components/PasswordInput";
import { usePortalChild } from "@/components/PortalChildContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { ROLES } from "@sri-narayana/shared";
import { auth } from "@sri-narayana/shared/firebase/client";
import { Camera, Check, Key, Mail, MapPin, Phone, Send, User, Users } from "lucide-react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { useEffect, useState } from "react";

type ProfileData = {
  profile: { name: string; email: string; phone: string; address: string; notificationPreferences: Record<string, boolean> };
  linkedStudents: { id: string; name: string; className: string; section: string; admissionNo: string; relationship: string; isPrimary: boolean }[];
};

function ParentProfile() {
  const { children } = usePortalChild();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    setLoading(true);
    adminApiRequest<{ ok: true } & ProfileData>("/api/portal/profile")
      .then((result) => setData(result))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const requestUpdate = async (field: string, value: string) => {
    setSending(true);
    setError(null);
    setSent(null);
    try {
      const result = await adminApiRequest<{ ok: true; id: string; message: string }>("/api/portal/profile", {
        method: "POST",
        body: JSON.stringify({ field, value }),
      });
      setSent(`${field} update request submitted (ID: ${result.id}). Admin will review it.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit request.");
    } finally {
      setSending(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwNew !== pwConfirm) {
      setPwError("Passwords do not match.");
      return;
    }
    if (pwNew.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    setChangingPw(true);
    setPwError(null);
    setPwSuccess(false);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("Not signed in.");
      const credential = EmailAuthProvider.credential(user.email, pwCurrent);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, pwNew);
      setPwSuccess(true);
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      setShowPasswordForm(false);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Unable to change password.");
    } finally {
      setChangingPw(false);
    }
  };

  if (loading) {
    return <section className="p-4 md:p-7"><div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading profile...</div></section>;
  }

  return (
    <>
      <PageHeader title="Parent Profile" description="Manage your account and preferences" />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}
        {sent && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{sent}</div>}

        {data && (
          <>
            <div className="stagger-children grid gap-5 md:grid-cols-2">
              <div className="card p-5">
                <div className="mb-4 flex items-center gap-3">
                  <User size={20} className="text-[#3033a1]" />
                  <h2 className="font-extrabold text-[#1f2136]">Personal Details</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7d86a8]">Name</p>
                    <p className="mt-1 font-bold text-[#1b1d32]">{data.profile.name || "--"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7d86a8]">Email</p>
                    <p className="mt-1 flex items-center gap-2 font-bold text-[#1b1d32]">
                      <Mail size={15} className="text-[#7d86a8]" /> {data.profile.email || "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7d86a8]">Phone</p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="flex items-center gap-2 font-bold text-[#1b1d32]">
                        <Phone size={15} className="text-[#7d86a8]" /> {data.profile.phone || "Not set"}
                      </p>
                      <button
                        className="text-xs font-bold text-[#3033a1] hover:underline"
                        onClick={() => {
                          const val = prompt("Enter new phone number:");
                          if (val) void requestUpdate("phone", val);
                        }}
                        disabled={sending}
                      >
                        Request Update
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7d86a8]">Address</p>
                    <div className="mt-1 flex items-start justify-between">
                      <p className="flex items-center gap-2 text-sm font-medium text-[#303247]">
                        <MapPin size={15} className="mt-0.5 shrink-0 text-[#7d86a8]" /> {data.profile.address || "Not set"}
                      </p>
                      <button
                        className="shrink-0 text-xs font-bold text-[#3033a1] hover:underline"
                        onClick={() => {
                          const val = prompt("Enter new address:");
                          if (val) void requestUpdate("address", val);
                        }}
                        disabled={sending}
                      >
                        Request Update
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <div className="mb-4 flex items-center gap-3">
                  <Users size={20} className="text-[#3033a1]" />
                  <h2 className="font-extrabold text-[#1f2136]">Linked Children</h2>
                </div>
                {data.linkedStudents.length > 0 ? (
                  <div className="space-y-3">
                    {data.linkedStudents.map((s) => (
                      <div key={s.id} className="rounded-xl bg-[#f7f8fd] p-4">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-[#303247]">{s.name}</p>
                          {s.isPrimary && (
                            <span className="rounded-full bg-[#eef0ff] px-2 py-0.5 text-[11px] font-bold text-[#3033a1]">Primary</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-medium text-[#7d86a8]">
                          Class {s.className}{s.section ? ` - ${s.section}` : ""} · {s.admissionNo}
                        </p>
                        <p className="text-xs font-medium capitalize text-[#7d86a8]">Relationship: {s.relationship}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium text-[#7d86a8]">No children linked to this account.</p>
                )}
              </div>
            </div>

            <div className="card p-5">
              <div className="mb-4 flex items-center gap-3">
                <Key size={20} className="text-[#3033a1]" />
                <h2 className="font-extrabold text-[#1f2136]">Security</h2>
              </div>
              {!showPasswordForm ? (
                <button className="btn-secondary" onClick={() => setShowPasswordForm(true)}>
                  <Key size={16} /> Change Password
                </button>
              ) : (
                <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
                  {pwSuccess && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">Password changed successfully.</div>}
                  {pwError && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{pwError}</div>}
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-[#303247]">Current Password</label>
                    <PasswordInput value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-[#303247]">New Password</label>
                    <PasswordInput value={pwNew} onChange={(e) => setPwNew(e.target.value)} required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-[#303247]">Confirm New Password</label>
                    <PasswordInput value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} required />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="btn-primary" disabled={changingPw}>
                      {changingPw ? "Changing..." : "Update Password"}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => { setShowPasswordForm(false); setPwError(null); setPwSuccess(false); }}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}

export default function PortalProfilePage() {
  return (
    <AuthGate roles={ROLES}>
      <AppShell>
        <ParentProfile />
      </AppShell>
    </AuthGate>
  );
}
