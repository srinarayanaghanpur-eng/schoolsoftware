"use client";

import { useEffect, useState } from "react";
import { Plus, Building2, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { adminApiRequest } from "@/lib/adminApiClient";
import type { BranchInfo } from "@sri-narayana/shared";

export default function BranchesPage() {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", address: "", phone: "", email: "" });

  const fetchBranches = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApiRequest<{ branches: BranchInfo[] }>("/api/admin/branches");
      setBranches(data.branches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load branches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchBranches(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.code.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await adminApiRequest("/api/admin/branches", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm({ name: "", code: "", address: "", phone: "", email: "" });
      setShowForm(false);
      await fetchBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create branch");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#1f2136]">Branches</h2>
          <p className="mt-1 text-sm font-medium text-[#7d86a8]">
            Manage school branches and campus locations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-[#4748a9] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#36378f]"
        >
          <Plus size={18} />
          Add Branch
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-6 rounded-xl border border-[#e4e6f0] bg-white p-5">
          <h3 className="mb-4 text-base font-bold text-[#1f2136]">New Branch</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-[#5d6690]">Branch Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-10 w-full rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] px-3 text-sm outline-none focus:border-[#4748a9] focus:ring-4 focus:ring-[#4748a9]/10"
                placeholder="Main Campus"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#5d6690]">Branch Code *</label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="h-10 w-full rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] px-3 text-sm outline-none focus:border-[#4748a9] focus:ring-4 focus:ring-[#4748a9]/10"
                placeholder="MAIN"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-[#5d6690]">Address</label>
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="h-10 w-full rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] px-3 text-sm outline-none focus:border-[#4748a9] focus:ring-4 focus:ring-[#4748a9]/10"
                placeholder="123 School Street"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#5d6690]">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="h-10 w-full rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] px-3 text-sm outline-none focus:border-[#4748a9] focus:ring-4 focus:ring-[#4748a9]/10"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#5d6690]">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="h-10 w-full rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] px-3 text-sm outline-none focus:border-[#4748a9] focus:ring-4 focus:ring-[#4748a9]/10"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={saving || !form.name.trim() || !form.code.trim()}
              onClick={() => void handleCreate()}
              className="flex items-center gap-2 rounded-xl bg-[#4748a9] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#36378f] disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create Branch
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-[#e0e3f0] px-4 py-2.5 text-sm font-bold text-[#5d6690] transition hover:bg-[#f8f8fc]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm font-medium text-[#7d86a8]">
          <Loader2 size={18} className="mr-2 animate-spin" />
          Loading branches...
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-xl border border-[#e4e6f0] bg-white p-8 text-center text-sm font-medium text-[#7d86a8]">
          <Building2 size={40} className="mx-auto mb-3 text-[#c5cae0]" />
          No branches configured yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <div key={branch.id} className="rounded-xl border border-[#e4e6f0] bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#1f2136]">{branch.name}</h3>
                  <span className="text-xs font-bold text-[#7d86a8]">{branch.code}</span>
                </div>
                {branch.isActive ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
                    <CheckCircle size={12} />
                    Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
                    <XCircle size={12} />
                    Inactive
                  </span>
                )}
              </div>
              {branch.address && <p className="mt-2 text-sm text-[#5d6690]">{branch.address}</p>}
              {(branch.phone || branch.email) && (
                <div className="mt-2 text-xs font-medium text-[#7d86a8]">
                  {branch.phone && <p>Phone: {branch.phone}</p>}
                  {branch.email && <p>Email: {branch.email}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
