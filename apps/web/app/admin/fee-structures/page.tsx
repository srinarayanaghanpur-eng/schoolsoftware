"use client";

import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { PageHeader } from "@/components/PageHeader";
import { adminApiRequest } from "@/lib/adminApiClient";
import { feeStructureCreateSchema, hasPermission, type FeeHead, type FeeStructure } from "@sri-narayana/shared";
import { Edit3, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const CLASS_OPTIONS = ["Nur", "KG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

type FeeStructureForm = {
  id?: string;
  academicYearId: string;
  className: string;
  heads: FeeHead[];
};

function emptyForm(academicYearId = ""): FeeStructureForm {
  return {
    academicYearId,
    className: "1",
    heads: [
      { name: "Tuition Fee", amount: 0 },
      { name: "Books", amount: 0 }
    ]
  };
}

function formatINR(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

function formFromStructure(structure: FeeStructure): FeeStructureForm {
  return {
    id: structure.id,
    academicYearId: structure.academicYearId,
    className: structure.className,
    heads: structure.heads.length ? structure.heads : [{ name: "Tuition Fee", amount: 0 }]
  };
}

export default function FeeStructuresPage() {
  const { role } = useAdminSession();
  const { activeYear, years } = useAcademicYears();
  const [academicYearId, setAcademicYearId] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [form, setForm] = useState<FeeStructureForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCreate = Boolean(role && hasPermission(role, "fees.create"));
  const canEdit = Boolean(role && hasPermission(role, "fees.edit"));
  const formTotal = useMemo(() => form?.heads.reduce((sum, head) => sum + Number(head.amount || 0), 0) ?? 0, [form]);

  useEffect(() => {
    if (!academicYearId && activeYear?.id) {
      setAcademicYearId(activeYear.id);
    }
  }, [academicYearId, activeYear?.id]);

  const loadStructures = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.set("academicYearId", academicYearId);
      if (classFilter) params.set("className", classFilter);
      const result = await adminApiRequest<{ ok: true; structures: FeeStructure[] }>(`/api/admin/fee-structures?${params.toString()}`);
      setStructures(result.structures.sort((a, b) => String(a.className).localeCompare(String(b.className), undefined, { numeric: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load fee structures");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (academicYearId) void loadStructures();
  }, [academicYearId, classFilter]);

  const startCreate = () => {
    setForm(emptyForm(academicYearId || activeYear?.id || ""));
    setMessage(null);
    setError(null);
  };

  const startEdit = (structure: FeeStructure) => {
    setForm(formFromStructure(structure));
    setMessage(null);
    setError(null);
  };

  const updateHead = (index: number, patch: Partial<FeeHead>) => {
    if (!form) return;
    setForm({
      ...form,
      heads: form.heads.map((head, headIndex) => (headIndex === index ? { ...head, ...patch } : head))
    });
  };

  const removeHead = (index: number) => {
    if (!form) return;
    setForm({ ...form, heads: form.heads.filter((_, headIndex) => headIndex !== index) });
  };

  const saveStructure = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const parsed = feeStructureCreateSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check fee structure details.");
      setSaving(false);
      return;
    }

    try {
      if (form.id) {
        await adminApiRequest<{ ok: true }>(`/api/admin/fee-structures/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify(parsed.data)
        });
        setMessage("Fee structure updated.");
      } else {
        await adminApiRequest<{ ok: true; id: string; total: number }>("/api/admin/fee-structures", {
          method: "POST",
          body: JSON.stringify(parsed.data)
        });
        setMessage("Fee structure created.");
      }
      setForm(null);
      await loadStructures();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save fee structure.");
    } finally {
      setSaving(false);
    }
  };

  const deleteStructure = async (structure: FeeStructure) => {
    if (!structure.id || !window.confirm(`Delete fee structure for Class ${structure.className}?`)) return;
    setError(null);
    setMessage(null);
    try {
      await adminApiRequest<{ ok: true }>(`/api/admin/fee-structures/${structure.id}`, { method: "DELETE" });
      setMessage("Fee structure deleted.");
      await loadStructures();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete fee structure.");
    }
  };

  return (
    <>
      <PageHeader
        title="Fee Structures"
        description="Class-wise fee heads for the active academic year."
        action={
          canCreate ? (
            <button className="btn-primary" type="button" onClick={startCreate}>
              <Plus size={16} /> Add Structure
            </button>
          ) : null
        }
      />

      <section className="space-y-5 p-4 md:p-7">
        {message && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{message}</div>}
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}

        <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <label className="min-w-0 flex-1 text-sm font-semibold text-[#303247]">
            Academic year
            <select className="field mt-1" value={academicYearId} onChange={(event) => setAcademicYearId(event.target.value)}>
              <option value="">Select year</option>
              {years.map((year) => (
                <option key={year.id ?? year.name} value={year.id ?? ""}>
                  {year.name}{year.isActive ? " (Active)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 flex-1 text-sm font-semibold text-[#303247]">
            Class
            <select className="field mt-1" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
              <option value="">All classes</option>
              {CLASS_OPTIONS.map((item) => (
                <option key={item} value={item}>Class {item}</option>
              ))}
            </select>
          </label>
          <button className="btn-secondary md:mt-6" type="button" onClick={() => void loadStructures()} disabled={!academicYearId || loading}>
            <Search size={16} /> {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {form && (
          <div className="card p-4 md:p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#1f2136]">{form.id ? "Edit fee structure" : "Add fee structure"}</h2>
                <p className="text-sm font-medium text-[#7d86a8]">Server recomputes the final total after save.</p>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb]" type="button" onClick={() => setForm(null)} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold text-[#303247]">
                Academic year
                <select className="field mt-1" value={form.academicYearId} onChange={(event) => setForm({ ...form, academicYearId: event.target.value })}>
                  <option value="">Select year</option>
                  {years.map((year) => (
                    <option key={year.id ?? year.name} value={year.id ?? ""}>{year.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-[#303247]">
                Class
                <select className="field mt-1" value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })}>
                  {CLASS_OPTIONS.map((item) => (
                    <option key={item} value={item}>Class {item}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 space-y-3">
              {form.heads.map((head, index) => (
                <div key={`${head.name}-${index}`} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_44px]">
                  <input className="field" placeholder="Head name" value={head.name} onChange={(event) => updateHead(index, { name: event.target.value })} />
                  <input className="field" type="number" min="0" value={String(head.amount)} onChange={(event) => updateHead(index, { amount: Number(event.target.value) })} />
                  <button className="grid h-11 w-11 place-items-center rounded-xl bg-[#ffebed] text-[#ed515d]" type="button" onClick={() => removeHead(index)} title="Remove head">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button className="btn-secondary" type="button" onClick={() => setForm({ ...form, heads: [...form.heads, { name: "", amount: 0 }] })}>
                <Plus size={16} /> Add Head
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm font-extrabold text-[#303247]">Draft total {formatINR(formTotal)}</span>
                <button className="btn-primary" type="button" onClick={() => void saveStructure()} disabled={saving || (!canCreate && !form.id) || (!canEdit && Boolean(form.id))}>
                  <Save size={16} /> {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-[#edf0f7] bg-[#f7f8fd]">
                <tr>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Class</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Heads</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Total</th>
                  <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {structures.map((structure) => (
                  <tr key={structure.id ?? `${structure.academicYearId}-${structure.className}`} className="border-b border-[#edf0f7] last:border-b-0">
                    <td className="px-5 py-4 font-extrabold text-[#303247]">Class {structure.className}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {structure.heads.map((head) => (
                          <span key={`${structure.id}-${head.name}`} className="rounded-full bg-[#eef0ff] px-3 py-1 text-xs font-bold text-[#3033a1]">
                            {head.name}: {formatINR(head.amount)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-lg font-extrabold text-[#1f2136]">{formatINR(structure.total)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {canEdit && (
                          <>
                            <button className="btn-secondary" type="button" onClick={() => startEdit(structure)}>
                              <Edit3 size={15} /> Edit
                            </button>
                            <button className="btn-secondary" type="button" onClick={() => void deleteStructure(structure)}>
                              <Trash2 size={15} /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && structures.length === 0 && (
                  <tr>
                    <td className="px-5 py-8 text-center text-sm font-semibold text-[#7d86a8]" colSpan={4}>
                      No fee structures found for the selected filters.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td className="px-5 py-8 text-center text-sm font-semibold text-[#7d86a8]" colSpan={4}>Loading fee structures...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
