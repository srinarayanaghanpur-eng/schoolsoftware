"use client";

import { DatePicker } from "@/components/DatePicker";
import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { defaultDueDate, libraryFine, overdueDays } from "@/lib/libraryFines";
import { hasPermission } from "@sri-narayana/shared";
import { BookOpen, Pencil, Plus, Trash2, Undo2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Book = { id: string; title: string; author?: string; isbn?: string; category?: string; copies: number; available: number };
type Issue = { id: string; bookTitle?: string; memberName?: string; memberType: string; issueDate: string; dueDate: string; returnDate?: string; status: string; fine: number };
type MemberOption = { id: string; name: string; meta: string };

const emptyBook = { title: "", author: "", isbn: "", category: "", copies: "1" };

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function LibraryPage() {
  const { role } = useAdminSession();
  const toast = usePopup();
  const canDelete = hasPermission(role, "library.delete");
  const canEdit = hasPermission(role, "library.edit");
  const [books, setBooks] = useState<Book[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [history, setHistory] = useState<Issue[]>([]);
  const [tab, setTab] = useState<"issued" | "history">("issued");
  const [search, setSearch] = useState("");
  const [bForm, setBForm] = useState({ ...emptyBook });
  const [editingBookId, setEditingBookId] = useState("");
  const [iForm, setIForm] = useState({ bookId: "", memberType: "student", memberId: "", dueDate: defaultDueDate() });
  const [memberQuery, setMemberQuery] = useState("");
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [showB, setShowB] = useState(false);
  const [showI, setShowI] = useState(false);

  async function load() {
    try {
      const [b, i] = await Promise.all([adminApiRequest<{ books: Book[] }>("/api/admin/library/books"), adminApiRequest<{ issues: Issue[] }>("/api/admin/library/issues?status=issued")]);
      setBooks(b.books); setIssues(i.issues);
    } catch (e) { toast.error("Failed to load library", e instanceof AdminApiError ? e.message : undefined); }
  }
  async function loadHistory() {
    try { const h = await adminApiRequest<{ issues: Issue[] }>("/api/admin/library/issues?status=returned"); setHistory(h.issues); }
    catch (e) { toast.error("Failed to load history", e instanceof AdminApiError ? e.message : undefined); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (tab === "history") void loadHistory(); }, [tab]);

  useEffect(() => {
    const q = memberQuery.trim();
    if (!showI || q.length < 2) { setMemberOptions([]); return; }
    const timer = setTimeout(async () => {
      setMemberLoading(true);
      try {
        if (iForm.memberType === "student") {
          const res = await adminApiRequest<{ data?: Array<{ id: string; studentName?: string; admissionNumber?: string; class?: string; section?: string }> }>(`/api/admin/students?q=${encodeURIComponent(q)}&pageSize=20`);
          setMemberOptions((res.data || []).filter((s) => s.id).map((s) => ({ id: s.id, name: s.studentName || "Student", meta: [s.admissionNumber, s.class, s.section].filter(Boolean).join(" · ") })));
        } else {
          const res = await adminApiRequest<{ teachers?: Array<{ id: string; fullName?: string; employeeId?: string; subject?: string }> }>(`/api/admin/teachers?q=${encodeURIComponent(q)}&pageSize=20`);
          setMemberOptions((res.teachers || []).map((t) => ({ id: t.id, name: t.fullName || "Staff", meta: [t.employeeId, t.subject].filter(Boolean).join(" · ") })));
        }
      } catch { setMemberOptions([]); }
      finally { setMemberLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [memberQuery, iForm.memberType, showI]);

  function resetBook() { setBForm({ ...emptyBook }); setEditingBookId(""); }
  function startAdd() { resetBook(); setShowB(true); }
  function startEdit(b: Book) {
    setEditingBookId(b.id);
    setBForm({ title: b.title, author: b.author || "", isbn: b.isbn || "", category: b.category || "", copies: String(b.copies) });
    setShowB(true);
  }

  async function saveBook(e: FormEvent) {
    e.preventDefault();
    try {
      const payload = { ...bForm, copies: Number(bForm.copies) };
      if (editingBookId) await adminApiRequest(`/api/admin/library/books/${editingBookId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await adminApiRequest("/api/admin/library/books", { method: "POST", body: JSON.stringify(payload) });
      resetBook(); setShowB(false); toast.success(editingBookId ? "Book updated" : "Book added"); await load();
    } catch (e) { toast.error(editingBookId ? "Failed to update book" : "Failed to add book", e instanceof AdminApiError ? e.message : undefined); }
  }

  async function issue(e: FormEvent) {
    e.preventDefault();
    const member = memberOptions.find((m) => m.id === iForm.memberId);
    if (!member) return toast.error("Select a member", "Search and pick a student or staff member first.");
    try {
      await adminApiRequest("/api/admin/library/issues", { method: "POST", body: JSON.stringify({ ...iForm, memberName: member.name }) });
      setIForm({ bookId: "", memberType: "student", memberId: "", dueDate: defaultDueDate() }); setMemberQuery(""); setMemberOptions([]); setShowI(false);
      toast.success("Book issued"); await load();
    } catch (e) { toast.error("Failed to issue book", e instanceof AdminApiError ? e.message : undefined); }
  }

  async function ret(i: Issue) {
    const fine = libraryFine(i.dueDate);
    const late = overdueDays(i.dueDate);
    const ok = await toast.confirm(`Return "${i.bookTitle}"?`, fine > 0 ? `${late} day(s) overdue — fine ${inr(fine)} will be recorded.` : "Returned on time. No fine.", { okLabel: "Return" });
    if (!ok) return;
    try { await adminApiRequest(`/api/admin/library/issues/${i.id}/return`, { method: "POST", body: JSON.stringify({ fine }) }); toast.success(fine > 0 ? `Returned · fine ${inr(fine)} recorded` : "Book returned"); await load(); if (tab === "history") await loadHistory(); }
    catch (e) { toast.error("Failed to return book", e instanceof AdminApiError ? e.message : undefined); }
  }

  async function delBook(b: Book) {
    const ok = await toast.confirm(`Delete "${b.title}"?`, "This cannot be undone.", { okLabel: "Delete", danger: true });
    if (!ok) return;
    try { await adminApiRequest(`/api/admin/library/books/${b.id}`, { method: "DELETE" }); toast.success("Book deleted"); await load(); }
    catch (e) { toast.error("Failed to delete book", e instanceof AdminApiError ? e.message : undefined); }
  }

  if (!hasPermission(role, "library.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  const filtered = books.filter((b) => `${b.title} ${b.author || ""} ${b.isbn || ""} ${b.category || ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const overdue = issues.filter((i) => overdueDays(i.dueDate) > 0).length;

  return (
    <>
      <PageHeader title="Library" description="Catalog, member issue, returns, overdue fines and history." />
      <section className="space-y-5 p-4 md:p-7">
        {overdue > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{overdue} issued book{overdue === 1 ? "" : "s"} overdue — fines accrue at {inr(5)}/day.</div>}
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && <button className="btn-primary" onClick={startAdd}>{showB && !editingBookId ? <X size={16} /> : <Plus size={16} />} Add book</button>}
          <button className="btn-secondary" onClick={() => setShowI((v) => !v)} disabled={books.length === 0}>{showI ? <X size={16} /> : <BookOpen size={16} />} Issue book</button>
          <input className="field max-w-xs" placeholder="Search title, author, ISBN, category" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {showB && (
          <form onSubmit={saveBook} className="card grid gap-2 p-5 sm:grid-cols-2">
            <input className="field" placeholder="Title" required value={bForm.title} onChange={(e) => setBForm({ ...bForm, title: e.target.value })} />
            <input className="field" placeholder="Author" value={bForm.author} onChange={(e) => setBForm({ ...bForm, author: e.target.value })} />
            <input className="field" placeholder="ISBN" value={bForm.isbn} onChange={(e) => setBForm({ ...bForm, isbn: e.target.value })} />
            <input className="field" placeholder="Category / shelf" value={bForm.category} onChange={(e) => setBForm({ ...bForm, category: e.target.value })} />
            <input className="field" type="number" min="1" placeholder="Copies" required value={bForm.copies} onChange={(e) => setBForm({ ...bForm, copies: e.target.value })} />
            <div className="flex gap-2">
              <button className="btn-primary flex-1">{editingBookId ? "Save changes" : "Add book"}</button>
              <button type="button" className="btn-secondary" onClick={() => { resetBook(); setShowB(false); }}>Cancel</button>
            </div>
          </form>
        )}

        {showI && (
          <form onSubmit={issue} className="card grid gap-2 p-5 sm:grid-cols-2">
            <select className="field" required value={iForm.bookId} onChange={(e) => setIForm({ ...iForm, bookId: e.target.value })}><option value="">Select book</option>{books.filter((b) => b.available > 0).map((b) => <option key={b.id} value={b.id}>{b.title} ({b.available} avail)</option>)}</select>
            <select className="field" value={iForm.memberType} onChange={(e) => { setIForm({ ...iForm, memberType: e.target.value, memberId: "" }); setMemberQuery(""); setMemberOptions([]); }}><option value="student">Student</option><option value="staff">Staff</option></select>
            <div className="sm:col-span-2">
              <input className="field" placeholder={`Search ${iForm.memberType} by name / ${iForm.memberType === "student" ? "admission no." : "employee id"}`} value={memberQuery} onChange={(e) => { setMemberQuery(e.target.value); setIForm({ ...iForm, memberId: "" }); }} />
              {memberLoading && <p className="mt-1 text-xs text-stone-500">Searching…</p>}
              {memberOptions.length > 0 && (
                <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-stone-200 bg-white">
                  {memberOptions.map((m) => (
                    <button type="button" key={m.id} onClick={() => setIForm({ ...iForm, memberId: m.id })} className={`block w-full px-3 py-2 text-left text-sm hover:bg-stone-50 ${iForm.memberId === m.id ? "bg-emerald-50 font-semibold text-emerald-800" : ""}`}>
                      {m.name} {m.meta && <span className="text-xs font-normal text-stone-500">· {m.meta}</span>}
                    </button>
                  ))}
                </div>
              )}
              {iForm.memberId && <p className="mt-1 text-xs font-semibold text-emerald-700">Selected: {memberOptions.find((m) => m.id === iForm.memberId)?.name}</p>}
            </div>
            <DatePicker required value={iForm.dueDate} onChange={(e) => setIForm({ ...iForm, dueDate: e.target.value })} />
            <button className="btn-primary" disabled={!iForm.memberId}>Issue</button>
          </form>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <article className="card overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3"><h2 className="font-bold text-[#1f2136]">Catalog</h2><span className="text-xs text-stone-500">{filtered.length} title(s)</span></div>
            <table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Title</th><th className="px-4 py-2">Author / Category</th><th className="px-4 py-2 text-right">Available</th>{(canEdit || canDelete) && <th className="px-4 py-2 text-right">Action</th>}</tr></thead>
              <tbody>{filtered.length === 0 ? <tr><td colSpan={canEdit || canDelete ? 4 : 3} className="px-4 py-6 text-center text-stone-400">No books</td></tr> : filtered.map((b) => (<tr key={b.id} className="border-t border-stone-100"><td className="px-4 py-2 font-semibold">{b.title}{b.isbn && <span className="block text-xs font-normal text-stone-400">ISBN {b.isbn}</span>}</td><td className="px-4 py-2">{b.author || "—"}{b.category && <span className="block text-xs text-stone-400">{b.category}</span>}</td><td className="px-4 py-2 text-right">{b.available}/{b.copies}</td>{(canEdit || canDelete) && <td className="px-4 py-2 text-right"><div className="inline-flex gap-1">{canEdit && <button onClick={() => startEdit(b)} aria-label={`Edit ${b.title}`} className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700"><Pencil size={13} /> Edit</button>}{canDelete && <button onClick={() => delBook(b)} aria-label={`Delete ${b.title}`} className="inline-flex items-center gap-1 rounded-lg bg-[#ffebed] px-2 py-1 text-xs font-bold text-[#ed515d]"><Trash2 size={13} /> Delete</button>}</div></td>}</tr>))}</tbody>
            </table>
          </article>

          <article className="card overflow-x-auto">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <h2 className="font-bold text-[#1f2136]">Loans</h2>
              <div className="flex gap-1 rounded-lg bg-stone-100 p-1 text-xs font-semibold">
                <button onClick={() => setTab("issued")} className={`rounded-md px-2 py-1 ${tab === "issued" ? "bg-white text-[#1f2136] shadow-sm" : "text-stone-500"}`}>Issued ({issues.length})</button>
                <button onClick={() => setTab("history")} className={`rounded-md px-2 py-1 ${tab === "history" ? "bg-white text-[#1f2136] shadow-sm" : "text-stone-500"}`}>History</button>
              </div>
            </div>
            {tab === "issued" ? (
              <table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Book</th><th className="px-4 py-2">Member</th><th className="px-4 py-2">Due</th><th className="px-4 py-2 text-right">Fine</th><th className="px-4 py-2"></th></tr></thead>
                <tbody>{issues.length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400">None issued</td></tr> : issues.map((i) => { const fine = libraryFine(i.dueDate); const late = overdueDays(i.dueDate); return (<tr key={i.id} className="border-t border-stone-100"><td className="px-4 py-2">{i.bookTitle}</td><td className="px-4 py-2">{i.memberName}<span className="block text-xs capitalize text-stone-400">{i.memberType}</span></td><td className={`px-4 py-2 ${late ? "font-semibold text-[#ed515d]" : "text-stone-500"}`}>{i.dueDate}{late > 0 && <span className="block text-xs">{late}d late</span>}</td><td className="px-4 py-2 text-right font-semibold">{fine ? inr(fine) : "—"}</td><td className="px-4 py-2">{canEdit && <button onClick={() => ret(i)} className="inline-flex items-center gap-1 rounded-lg bg-[#e6f8ef] px-2 py-1 text-xs font-bold text-[#14a762]"><Undo2 size={13} /> Return</button>}</td></tr>); })}</tbody>
              </table>
            ) : (
              <table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Book</th><th className="px-4 py-2">Member</th><th className="px-4 py-2">Returned</th><th className="px-4 py-2 text-right">Fine</th></tr></thead>
                <tbody>{history.length === 0 ? <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">No returns yet</td></tr> : history.map((i) => (<tr key={i.id} className="border-t border-stone-100"><td className="px-4 py-2">{i.bookTitle}</td><td className="px-4 py-2">{i.memberName}</td><td className="px-4 py-2 text-stone-500">{i.returnDate || "—"}</td><td className="px-4 py-2 text-right font-semibold">{i.fine ? inr(i.fine) : "—"}</td></tr>))}</tbody>
              </table>
            )}
          </article>
        </div>
      </section>
    </>
  );
}
