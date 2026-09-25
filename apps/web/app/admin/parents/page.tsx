"use client";

import { PageHeader } from "@/components/PageHeader";
import { PasswordInput } from "@/components/PasswordInput";
import { useAdminSession } from "@/components/AdminSessionContext";
import { usePopup } from "@/components/CenterPopup";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { formatLabel } from "@sri-narayana/shared";
import { Link2, Link2Off, Plus, RotateCcw, Search, Unlink, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Parent = {
  uid: string;
  id: string;
  displayName: string;
  phone: string;
  email?: string;
  employeeId?: string;
  status?: string;
  createdAt?: string;
};

const CLASS_OPTIONS = ["Nur", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

type Student = { id: string; studentName: string; admissionNumber: string; class: string; section?: string };
type Link = { id: string; parentUid: string; studentId: string; relationship: string; isPrimary: boolean };

const RELATIONS = ["father", "mother", "guardian", "other"] as const;

export default function ParentsPage() {
  const { hasPermission } = useAdminSession();
  const toast = usePopup();
  const [parents, setParents] = useState<Parent[]>([]);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [resetPass, setResetPass] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({ fullName: "", phone: "", loginId: "", email: "", password: "", confirmPassword: "" });
  const [editForm, setEditForm] = useState({ fullName: "", phone: "", email: "" });
  const [passForm, setPassForm] = useState({ password: "", confirmPassword: "" });

  const [linkSearch, setLinkSearch] = useState("");
  const [debouncedLinkSearch, setDebouncedLinkSearch] = useState("");
  const [linkStudents, setLinkStudents] = useState<Student[]>([]);
  const [linkRelation, setLinkRelation] = useState<string>("father");
  const [existingLinks, setExistingLinks] = useState<{ links: Link[]; students: Student[] }>({ links: [], students: [] });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Parent List vs Linked vs Activation separation (server-filtered).
  const [linkTab, setLinkTab] = useState<"all" | "linked" | "unlinked">("all");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [linkCounts, setLinkCounts] = useState<Record<string, number>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadParentsIdRef = useRef(0);

  // Debounce parent search so typing doesn't fire one query per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Debounce link-modal student search for the same reason.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedLinkSearch(linkSearch), 300);
    return () => window.clearTimeout(timer);
  }, [linkSearch]);

  async function loadParents(cursor?: string | null, append = false) {
    const requestId = ++loadParentsIdRef.current;
    if (append) {
      if (loadingMore || !hasMore) return;
      setLoadingMore(true);
    }
    try {
      const params = new URLSearchParams({ pageSize: "50" });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (classFilter) params.set("classId", classFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (append && cursor) params.set("cursor", cursor);
      const data = await adminApiRequest<{ parents: Parent[]; linkCounts?: Record<string, number>; nextCursor?: string | null; hasMore?: boolean }>(`/api/admin/parents?${params}`);
      if (loadParentsIdRef.current !== requestId) return; // stale response — ignore
      setParents((prev) => (append ? [...prev, ...(data.parents ?? [])] : (data.parents ?? [])));
      setLinkCounts((prev) => (append ? { ...prev, ...(data.linkCounts ?? {}) } : (data.linkCounts ?? {})));
      setNextCursor(data.nextCursor ?? null);
      setHasMore(Boolean(data.hasMore));
    } catch (e) {
      if (loadParentsIdRef.current !== requestId) return;
      setError(e instanceof AdminApiError ? e.message : "Failed to load");
    } finally {
      if (append) setLoadingMore(false);
    }
  }
  useEffect(() => { void loadParents(); }, [debouncedSearch, classFilter, statusFilter]);

  async function toggleParentStatus(p: Parent) {
    const next = (p.status ?? "active") === "active" ? "inactive" : "active";
    if (next === "inactive") {
      const ok = await toast.confirm(
        `Deactivate ${p.displayName}?`,
        "They will not be able to sign in until reactivated.",
        { okLabel: "Deactivate", danger: true }
      );
      if (!ok) return;
    }
    setError("");
    try {
      await adminApiRequest(`/api/admin/parents/${p.uid}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      toast.success(`Parent ${next === "active" ? "activated" : "deactivated"}.`);
      await loadParents();
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to update status"); }
  }

  // Link candidates come from the scoped students endpoint (server filters by
  // name/admission/phone) instead of an arbitrary unfiltered first page.
  async function loadLinkStudents() {
    try {
      const params = debouncedLinkSearch
        ? `?q=${encodeURIComponent(debouncedLinkSearch)}&pageSize=25`
        : "?pageSize=25";
      const studentsData = await adminApiRequest<{ data?: Student[] }>(`/api/admin/students${params}`);
      const allStudents = studentsData.data || [];
      setLinkStudents(allStudents.filter((s) => !existingLinks.links.find((l) => l.studentId === s.id)));
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
  }

  async function loadLinkData(parentUid: string) {
    setLinking(parentUid);
    setLinkSearch("");
    setDebouncedLinkSearch("");
    setLinkStudents([]);
    setLinkRelation("father");
    try {
      const linksData = await adminApiRequest<{ links: Link[]; students: Student[] }>(`/api/admin/parents/${parentUid}/links`);
      setExistingLinks(linksData);
      const studentsData = await adminApiRequest<{ data?: Student[] }>("/api/admin/students?pageSize=25");
      const allStudents = studentsData.data || [];
      setLinkStudents(allStudents.filter((s) => !linksData.links.find((l) => l.studentId === s.id)));
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
  }

  // Refresh candidates as the modal search changes (links stay as loaded).
  useEffect(() => {
    if (linking) void loadLinkStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedLinkSearch]);

  async function submitCreate(e: FormEvent) {
    e.preventDefault(); setError("");
    try {
      await adminApiRequest("/api/admin/parents", { method: "POST", body: JSON.stringify(form) });
      setForm({ fullName: "", phone: "", loginId: "", email: "", password: "", confirmPassword: "" });
      setShowCreate(false); await loadParents();
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to create"); }
  }

  async function submitEdit(uid: string) {
    setError("");
    try {
      await adminApiRequest(`/api/admin/parents/${uid}`, { method: "PATCH", body: JSON.stringify(editForm) });
      setEditing(null); await loadParents();
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to update"); }
  }

  async function submitReset(uid: string) {
    setError("");
    try {
      await adminApiRequest(`/api/admin/parents/${uid}/reset-password`, { method: "POST", body: JSON.stringify(passForm) });
      setPassForm({ password: "", confirmPassword: "" }); setResetPass(null);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to reset"); }
  }

  async function linkStudent(parentUid: string, studentId: string) {
    setError("");
    try {
      await adminApiRequest(`/api/admin/parents/${parentUid}/links`, {
        method: "POST",
        body: JSON.stringify({ studentId, relationship: linkRelation, isPrimary: existingLinks.links.length === 0 })
      });
      setLinkStudents((prev) => prev.filter((s) => s.id !== studentId));
      // Links changed — refresh the small links list only, not the candidates.
      const linksData = await adminApiRequest<{ links: Link[]; students: Student[] }>(`/api/admin/parents/${parentUid}/links`);
      setExistingLinks(linksData);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to link"); }
  }

  async function unlinkStudent(parentUid: string, linkId: string) {
    setError("");
    try {
      await adminApiRequest(`/api/admin/parents/${parentUid}/links?linkId=${linkId}`, { method: "DELETE" });
      await loadLinkData(parentUid);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to unlink"); }
  }

  function startEdit(p: Parent) {
    setEditing(p.uid);
    setEditForm({ fullName: p.displayName, phone: p.phone, email: p.email || "" });
  }

  if (!hasPermission("parents.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  const visibleParents = parents.filter((p) => {
    if (linkTab === "linked") return (linkCounts[p.uid] ?? 0) > 0;
    if (linkTab === "unlinked") return (linkCounts[p.uid] ?? 0) === 0;
    return true;
  });

  return (
    <>
      <PageHeader title="Parents" description="Create parent logins, link students, manage accounts." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8490b9]" />
            <input className="field !pl-9" placeholder="Search parents..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="field w-auto" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Filter by student class">
            <option value="">All classes</option>
            {CLASS_OPTIONS.map((c) => <option key={c} value={c}>Class {c}</option>)}
          </select>
          <select className="field w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")} aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="inline-flex items-center rounded-xl border border-[#e0e3f0] bg-white p-1 text-xs font-bold" role="tablist" aria-label="Link filter">
            {(["all", "linked", "unlinked"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={linkTab === t}
                onClick={() => setLinkTab(t)}
                className={`rounded-lg px-3 py-1.5 capitalize ${linkTab === t ? "bg-[#eef0ff] text-[#3033a1]" : "text-[#7d86a8]"}`}
              >
                {t === "all" ? "All parents" : t}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? <X size={16} /> : <Plus size={16} />} New parent
          </button>
        </div>

        {showCreate && (
          <form onSubmit={submitCreate} className="card grid gap-4 p-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-[#303247]">Full name<input className="field mt-1" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
            <label className="text-sm font-semibold text-[#303247]">Phone<input className="field mt-1" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="text-sm font-semibold text-[#303247]">Login ID<input className="field mt-1" required value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })} placeholder="e.g. PARENT001" /></label>
            <label className="text-sm font-semibold text-[#303247]">Email (optional)<input className="field mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="text-sm font-semibold text-[#303247]">Password<PasswordInput className="field mt-1" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <label className="text-sm font-semibold text-[#303247]">Confirm password<PasswordInput className="field mt-1" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} /></label>
            <div className="sm:col-span-2"><button className="btn-primary"><Plus size={16} /> Create parent login</button></div>
          </form>
        )}

        <div className="card overflow-hidden">
          {visibleParents.length === 0 ? (
            <div className="p-8 text-center text-sm text-stone-400">No parents found. Create one to get started.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {visibleParents.map((p) => (
                <div key={p.uid} className="p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {editing === p.uid ? (
                        <div className="flex flex-wrap gap-2" onSubmit={() => submitEdit(p.uid)}>
                          <input className="field w-40" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
                          <input className="field w-36" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                          <input className="field w-48" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email" />
                          <button className="btn-primary text-xs" onClick={() => submitEdit(p.uid)}>Save</button>
                          <button className="rounded-lg border border-[#e0e3f0] px-3 py-1.5 text-xs font-bold" onClick={() => setEditing(null)}>Cancel</button>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-bold text-[#1f2136]">
                            {p.displayName}
                            {(p.status ?? "active") === "inactive" ? (
                              <span className="ml-2 rounded-md bg-[#ffebed] px-2 py-0.5 text-[11px] font-bold text-[#ed515d]">Inactive</span>
                            ) : (
                              <span className="ml-2 rounded-md bg-[#e6f8ef] px-2 py-0.5 text-[11px] font-bold text-[#0f8d52]">Active</span>
                            )}
                            {(linkCounts[p.uid] ?? 0) > 0 && (
                              <span className="ml-2 rounded-md bg-[#eef0ff] px-2 py-0.5 text-[11px] font-bold text-[#3033a1]">
                                {linkCounts[p.uid]} linked
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-[#5d6690]">
                            {p.phone && <span>{p.phone}</span>}
                            {p.email && <span className="ml-3">{p.email}</span>}
                            {p.employeeId && <span className="ml-3 text-[#3033a1]">ID: {p.employeeId}</span>}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <button onClick={() => startEdit(p)} className="rounded-lg bg-[#eef0ff] px-2.5 py-1.5 text-xs font-bold text-[#3033a1] hover:bg-[#e0e3ff]"><RotateCcw size={13} /> Edit</button>
                      <button onClick={() => { setResetPass(p.uid); setPassForm({ password: "", confirmPassword: "" }); }} className="rounded-lg bg-[#fff4df] px-2.5 py-1.5 text-xs font-bold text-[#b8791a] hover:bg-[#ffedc5]"><RotateCcw size={13} /> Reset pwd</button>
                      <button onClick={() => void loadLinkData(p.uid)} className="rounded-lg bg-[#e6f8ef] px-2.5 py-1.5 text-xs font-bold text-[#14a762] hover:bg-[#d2f2e1]"><Link2 size={13} /> Link</button>
                      <button
                        onClick={() => void toggleParentStatus(p)}
                        title={(p.status ?? "active") === "active" ? "Deactivate login" : "Activate login"}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${(p.status ?? "active") === "active" ? "bg-[#f3f4fb] text-[#5f6888] hover:bg-[#e9ebf5]" : "bg-[#e6f8ef] text-[#0f8d52] hover:bg-[#d2f2e1]"}`}
                      >
                        {(p.status ?? "active") === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>

                  {resetPass === p.uid && (
                    <div className="mt-3 rounded-xl border border-[#fff4df] bg-[#fffcf5] p-4">
                      <div className="flex flex-wrap gap-3 items-end">
                        <label className="text-xs font-bold text-[#5d6690]">New password<PasswordInput className="field mt-1" value={passForm.password} onChange={(e) => setPassForm({ ...passForm, password: e.target.value })} /></label>
                        <label className="text-xs font-bold text-[#5d6690]">Confirm<PasswordInput className="field mt-1" value={passForm.confirmPassword} onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })} /></label>
                        <button className="btn-primary text-xs" onClick={() => submitReset(p.uid)} disabled={!passForm.password || passForm.password !== passForm.confirmPassword}>Reset</button>
                        <button className="rounded-lg border border-[#e0e3f0] px-3 py-1.5 text-xs font-bold" onClick={() => setResetPass(null)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {linking === p.uid && (
                    <div className="mt-3 rounded-xl border border-[#e6f8ef] bg-[#f6fdf9] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-extrabold text-[#1f2136]">Linked Students</h4>
                        <button onClick={() => setLinking(null)} className="text-xs font-bold text-[#7d86a8] hover:text-[#ed515d]"><X size={16} /></button>
                      </div>

                      {existingLinks.links.length > 0 ? (
                        <div className="space-y-2 mb-4">
                          {existingLinks.links.map((link) => {
                            const student = existingLinks.students.find((s) => s.id === link.studentId);
                            return (
                              <div key={link.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                                <span className="font-semibold text-[#303247]">
                                  {student?.studentName ?? link.studentId}
                                  <span className="ml-2 text-xs text-[#7d86a8]">
                                    Class {student?.class}{student?.section} · {formatLabel(link.relationship)}
                                  </span>
                                </span>
                                <button onClick={() => void unlinkStudent(p.uid, link.id!)} className="text-[#ed515d] hover:bg-[#ffebed] rounded-lg p-1">
                                  <Link2Off size={15} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mb-4 text-sm text-[#7d86a8]">No students linked yet.</p>
                      )}

                      <div className="flex flex-wrap gap-2 items-end">
                        <div className="relative flex-1 min-w-[200px]">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8490b9]" />
                          <input className="field !pl-9 text-sm" placeholder="Search students to link..." value={linkSearch}
                            onChange={(e) => setLinkSearch(e.target.value)} />
                        </div>
                        <select className="field w-32 text-sm" value={linkRelation} onChange={(e) => setLinkRelation(e.target.value)}>
                          {RELATIONS.map((r) => <option key={r} value={r}>{formatLabel(r)}</option>)}
                        </select>
                      </div>
                      <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                        {linkStudents
                          .filter((s) => !linkSearch || s.studentName?.toLowerCase().includes(linkSearch.toLowerCase()) || s.admissionNumber?.toLowerCase().includes(linkSearch.toLowerCase()))
                          .slice(0, 20)
                          .map((s) => (
                            <div key={s.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm hover:bg-[#f5f6fd]">
                              <span className="font-medium text-[#303247]">{s.studentName} <span className="text-xs text-[#7d86a8]">({s.admissionNumber}) · Class {s.class}{s.section}</span></span>
                              <button onClick={() => void linkStudent(p.uid, s.id)} className="rounded-lg bg-[#e6f8ef] px-2.5 py-1 text-xs font-bold text-[#14a762] hover:bg-[#d2f2e1]"><Link2 size={13} /> Link</button>
                            </div>
                          ))}
                        {linkStudents.length === 0 && <p className="text-xs text-[#7d86a8] py-2">All students already linked.</p>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {hasMore && linkTab === "all" && !classFilter && (
          <div className="text-center">
            <button type="button" className="btn-secondary" onClick={() => void loadParents(nextCursor, true)} disabled={loadingMore}>
              {loadingMore ? "Loading…" : `Load more (${parents.length} shown)`}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
