"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle,
  Edit3,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Power,
  Save,
  Search,
  X
} from "lucide-react";
import { adminApiRequest } from "@/lib/adminApiClient";
import type { BranchInfo } from "@sri-narayana/shared";

type BranchForm = {
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
};

const emptyForm: BranchForm = {
  name: "",
  code: "",
  address: "",
  phone: "",
  email: "",
  isActive: true
};

function branchToForm(branch: BranchInfo): BranchForm {
  return {
    name: branch.name ?? "",
    code: branch.code ?? "",
    address: branch.address ?? "",
    phone: branch.phone ?? "",
    email: branch.email ?? "",
    isActive: branch.isActive
  };
}

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<BranchForm>(emptyForm);

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

  useEffect(() => {
    void fetchBranches();
  }, []);

  const summary = useMemo(() => {
    const active = branches.filter((branch) => branch.isActive).length;
    return {
      total: branches.length,
      active,
      inactive: branches.length - active
    };
  }, [branches]);

  const filteredBranches = useMemo(() => {
    const search = normalizeSearch(query);
    if (!search) return branches;
    return branches.filter((branch) =>
      [branch.name, branch.code, branch.address, branch.phone, branch.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    );
  }, [branches, query]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormMode("create");
    setError(null);
  };

  const openEdit = (branch: BranchInfo) => {
    setForm(branchToForm(branch));
    setEditingId(branch.id);
    setFormMode("edit");
    setError(null);
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.code.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (formMode === "edit" && editingId) {
        await adminApiRequest("/api/admin/branches", {
          method: "PATCH",
          body: JSON.stringify({ id: editingId, ...form })
        });
      } else {
        await adminApiRequest("/api/admin/branches", {
          method: "POST",
          body: JSON.stringify(form)
        });
      }
      closeForm();
      await fetchBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save branch");
    } finally {
      setSaving(false);
    }
  };

  const toggleBranchStatus = async (branch: BranchInfo) => {
    setSavingBranchId(branch.id);
    setError(null);
    try {
      await adminApiRequest("/api/admin/branches", {
        method: "PATCH",
        body: JSON.stringify({ id: branch.id, isActive: !branch.isActive })
      });
      await fetchBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update branch");
    } finally {
      setSavingBranchId(null);
    }
  };

  return (
    <div className="space-y-5 p-4 md:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#1f2136]">Branches</h2>
          <p className="mt-1 text-sm font-semibold text-[#7d86a8]">
            Manage campuses, branch identity, contact details, and operational status.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4748a9] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_22px_rgba(71,72,169,0.18)] transition hover:bg-[#36378f]"
        >
          <Plus size={18} />
          Add Branch
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[#e4e6f0] bg-white p-4 shadow-[0_8px_18px_rgba(36,42,94,0.04)]">
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#7d86a8]">Total Branches</p>
          <p className="mt-2 text-3xl font-extrabold text-[#1f2136]">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-[#d8f1df] bg-[#f4fbf6] p-4 shadow-[0_8px_18px_rgba(36,42,94,0.04)]">
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#39804b]">Active</p>
          <p className="mt-2 text-3xl font-extrabold text-[#146b31]">{summary.active}</p>
        </div>
        <div className="rounded-lg border border-[#e4e6f0] bg-white p-4 shadow-[0_8px_18px_rgba(36,42,94,0.04)]">
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#7d86a8]">Inactive</p>
          <p className="mt-2 text-3xl font-extrabold text-[#5d6690]">{summary.inactive}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {formMode && (
        <section className="rounded-lg border border-[#dce1f0] bg-white p-5 shadow-[0_12px_28px_rgba(36,42,94,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-[#1f2136]">
                {formMode === "edit" ? "Edit Branch" : "New Branch"}
              </h3>
              <p className="mt-1 text-sm font-semibold text-[#7d86a8]">
                {formMode === "edit" ? "Update branch profile and availability." : "Create a campus profile for reports and branch-wise operations."}
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#e0e3f0] text-[#5d6690] transition hover:bg-[#f8f8fc]"
              aria-label="Close branch form"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-[#5d6690]">Branch Name *</label>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="h-11 w-full rounded-lg border border-[#e0e3f0] bg-[#f8f8fc] px-3 text-sm font-semibold text-[#1f2136] outline-none transition focus:border-[#4748a9] focus:bg-white focus:ring-4 focus:ring-[#4748a9]/10"
                placeholder="Sri Narayana Main Campus"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#5d6690]">Branch Code *</label>
              <input
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                className="h-11 w-full rounded-lg border border-[#e0e3f0] bg-[#f8f8fc] px-3 text-sm font-semibold uppercase text-[#1f2136] outline-none transition focus:border-[#4748a9] focus:bg-white focus:ring-4 focus:ring-[#4748a9]/10"
                placeholder="MAIN"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-[#5d6690]">Address</label>
              <input
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                className="h-11 w-full rounded-lg border border-[#e0e3f0] bg-[#f8f8fc] px-3 text-sm font-semibold text-[#1f2136] outline-none transition focus:border-[#4748a9] focus:bg-white focus:ring-4 focus:ring-[#4748a9]/10"
                placeholder="Campus address"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#5d6690]">Phone</label>
              <input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="h-11 w-full rounded-lg border border-[#e0e3f0] bg-[#f8f8fc] px-3 text-sm font-semibold text-[#1f2136] outline-none transition focus:border-[#4748a9] focus:bg-white focus:ring-4 focus:ring-[#4748a9]/10"
                placeholder="Branch contact number"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#5d6690]">Email</label>
              <input
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="h-11 w-full rounded-lg border border-[#e0e3f0] bg-[#f8f8fc] px-3 text-sm font-semibold text-[#1f2136] outline-none transition focus:border-[#4748a9] focus:bg-white focus:ring-4 focus:ring-[#4748a9]/10"
                placeholder="branch@school.edu"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-3 text-sm font-bold text-[#303247]">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                className="h-5 w-5 rounded border-[#d8def0] text-[#4748a9] focus:ring-[#4748a9]"
              />
              Branch is active
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-[#e0e3f0] px-4 py-2.5 text-sm font-bold text-[#5d6690] transition hover:bg-[#f8f8fc]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !form.name.trim() || !form.code.trim()}
                onClick={() => void handleSubmit()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#4748a9] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#36378f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {formMode === "edit" ? "Save Changes" : "Create Branch"}
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-[#e4e6f0] bg-white p-3 shadow-[0_8px_18px_rgba(36,42,94,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block min-w-0 flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8c95b5]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 w-full rounded-lg border border-[#e0e3f0] bg-[#f8f8fc] pl-10 pr-3 text-sm font-semibold text-[#1f2136] outline-none transition focus:border-[#4748a9] focus:bg-white focus:ring-4 focus:ring-[#4748a9]/10"
            placeholder="Search by name, code, address, phone, or email"
          />
        </label>
        <Link
          href="/admin/finance/branch-accounts"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#dce1f0] px-4 py-2.5 text-sm font-bold text-[#303247] transition hover:bg-[#f8f8fc]"
        >
          Branch Accounts
          <ExternalLink size={16} />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-lg border border-[#e4e6f0] bg-white py-14 text-sm font-semibold text-[#7d86a8]">
          <Loader2 size={18} className="mr-2 animate-spin" />
          Loading branches...
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="rounded-lg border border-[#e4e6f0] bg-white p-10 text-center shadow-[0_8px_18px_rgba(36,42,94,0.04)]">
          <Building2 size={42} className="mx-auto mb-3 text-[#c5cae0]" />
          <p className="text-base font-extrabold text-[#1f2136]">
            {branches.length === 0 ? "No branches configured yet" : "No branches match your search"}
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#4748a9] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#36378f]"
          >
            <Plus size={17} />
            Add Branch
          </button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredBranches.map((branch) => (
            <article key={branch.id} className="rounded-lg border border-[#e4e6f0] bg-white p-5 shadow-[0_8px_18px_rgba(36,42,94,0.04)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-extrabold leading-6 text-[#1f2136]">{branch.name}</h3>
                    {branch.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-extrabold text-green-700">
                        <CheckCircle size={12} />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-extrabold text-gray-600">
                        <Power size={12} />
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-extrabold uppercase tracking-[0.08em] text-[#7d86a8]">{branch.code}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(branch)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#dce1f0] px-3 py-2 text-sm font-bold text-[#303247] transition hover:bg-[#f8f8fc]"
                  >
                    <Edit3 size={15} />
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={savingBranchId === branch.id}
                    onClick={() => void toggleBranchStatus(branch)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#dce1f0] px-3 py-2 text-sm font-bold text-[#303247] transition hover:bg-[#f8f8fc] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingBranchId === branch.id ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
                    {branch.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-[#f8f9ff] p-3">
                  <p className="flex items-start gap-2 text-sm font-semibold text-[#5d6690]">
                    <MapPin size={17} className="mt-0.5 shrink-0 text-[#4748a9]" />
                    <span>{branch.address || "Address not added"}</span>
                  </p>
                </div>
                <div className="rounded-lg bg-[#f8f9ff] p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#5d6690]">
                    <Phone size={17} className="shrink-0 text-[#4748a9]" />
                    <span>{branch.phone || "Phone not added"}</span>
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#5d6690]">
                    <Mail size={17} className="shrink-0 text-[#4748a9]" />
                    <span>{branch.email || "Email not added"}</span>
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-[#edf0f7] pt-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-xs font-bold text-[#7d86a8]">
                  <span>Created: {formatDate(branch.createdAt)}</span>
                  <span className="mx-2">|</span>
                  <span>Updated: {formatDate(branch.updatedAt)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/admin/finance/branch-accounts" className="inline-flex items-center gap-2 rounded-lg bg-[#eef0ff] px-3 py-2 text-xs font-extrabold text-[#3033a1] transition hover:bg-[#e3e6ff]">
                    Accounts
                    <ExternalLink size={14} />
                  </Link>
                  <Link href="/admin/notices" className="inline-flex items-center gap-2 rounded-lg bg-[#fff4df] px-3 py-2 text-xs font-extrabold text-[#a4640c] transition hover:bg-[#ffedc6]">
                    Notices
                    <ExternalLink size={14} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
