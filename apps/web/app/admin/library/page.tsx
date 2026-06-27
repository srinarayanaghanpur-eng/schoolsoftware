"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, Undo2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Book = { id: string; title: string; author?: string; copies: number; available: number };
type Issue = { id: string; bookTitle?: string; memberName?: string; memberType: string; issueDate: string; dueDate: string; status: string; fine: number };

export default function LibraryPage() {
  const { role } = useAdminSession();
  const [books, setBooks] = useState<Book[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState("");
  const [bForm, setBForm] = useState({ title: "", author: "", copies: "1" });
  const [iForm, setIForm] = useState({ bookId: "", memberType: "student", memberName: "", memberId: "", dueDate: "" });
  const [showB, setShowB] = useState(false);
  const [showI, setShowI] = useState(false);

  async function load() {
    try { const [b, i] = await Promise.all([adminApiRequest<{ books: Book[] }>("/api/admin/library/books"), adminApiRequest<{ issues: Issue[] }>("/api/admin/library/issues?status=issued")]); setBooks(b.books); setIssues(i.issues); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); }
  }
  useEffect(() => { void load(); }, []);

  async function addBook(e: FormEvent) { e.preventDefault(); try { await adminApiRequest("/api/admin/library/books", { method: "POST", body: JSON.stringify({ ...bForm, copies: Number(bForm.copies) }) }); setBForm({ title: "", author: "", copies: "1" }); setShowB(false); await load(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }
  async function issue(e: FormEvent) { e.preventDefault(); try { await adminApiRequest("/api/admin/library/issues", { method: "POST", body: JSON.stringify({ ...iForm, memberId: iForm.memberId || iForm.memberName }) }); setIForm({ bookId: "", memberType: "student", memberName: "", memberId: "", dueDate: "" }); setShowI(false); await load(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }
  async function ret(id: string) { try { await adminApiRequest(`/api/admin/library/issues/${id}/return`, { method: "POST", body: JSON.stringify({ fine: 0 }) }); await load(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }

  if (!hasPermission(role, "library.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Library" description="Book catalog, issue and return." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setShowB((v) => !v)}>{showB ? <X size={16} /> : <Plus size={16} />} Add book</button>
          <button className="btn-secondary" onClick={() => setShowI((v) => !v)} disabled={books.length === 0}>{showI ? <X size={16} /> : <Plus size={16} />} Issue book</button>
        </div>
        {showB && <form onSubmit={addBook} className="card grid gap-2 p-5 sm:grid-cols-3"><input className="field" placeholder="Title" required value={bForm.title} onChange={(e) => setBForm({ ...bForm, title: e.target.value })} /><input className="field" placeholder="Author" value={bForm.author} onChange={(e) => setBForm({ ...bForm, author: e.target.value })} /><input className="field" type="number" min="1" placeholder="Copies" required value={bForm.copies} onChange={(e) => setBForm({ ...bForm, copies: e.target.value })} /><button className="btn-primary sm:col-span-3">Add</button></form>}
        {showI && <form onSubmit={issue} className="card grid gap-2 p-5 sm:grid-cols-2"><select className="field" required value={iForm.bookId} onChange={(e) => setIForm({ ...iForm, bookId: e.target.value })}><option value="">Select book</option>{books.filter((b) => b.available > 0).map((b) => <option key={b.id} value={b.id}>{b.title} ({b.available} avail)</option>)}</select><input className="field" placeholder="Member name" required value={iForm.memberName} onChange={(e) => setIForm({ ...iForm, memberName: e.target.value })} /><select className="field" value={iForm.memberType} onChange={(e) => setIForm({ ...iForm, memberType: e.target.value })}><option value="student">Student</option><option value="staff">Staff</option></select><input className="field" type="date" required value={iForm.dueDate} onChange={(e) => setIForm({ ...iForm, dueDate: e.target.value })} /><button className="btn-primary sm:col-span-2">Issue</button></form>}

        <div className="grid gap-5 xl:grid-cols-2">
          <article className="card overflow-x-auto">
            <div className="px-4 py-3"><h2 className="font-bold text-[#1f2136]">Catalog</h2></div>
            <table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Title</th><th className="px-4 py-2">Author</th><th className="px-4 py-2 text-right">Available</th></tr></thead>
              <tbody>{books.length === 0 ? <tr><td colSpan={3} className="px-4 py-6 text-center text-stone-400">No books</td></tr> : books.map((b) => (<tr key={b.id} className="border-t border-stone-100"><td className="px-4 py-2 font-semibold">{b.title}</td><td className="px-4 py-2">{b.author}</td><td className="px-4 py-2 text-right">{b.available}/{b.copies}</td></tr>))}</tbody>
            </table>
          </article>
          <article className="card overflow-x-auto">
            <div className="px-4 py-3"><h2 className="font-bold text-[#1f2136]">Issued books</h2></div>
            <table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Book</th><th className="px-4 py-2">Member</th><th className="px-4 py-2">Due</th><th className="px-4 py-2"></th></tr></thead>
              <tbody>{issues.length === 0 ? <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">None issued</td></tr> : issues.map((i) => (<tr key={i.id} className="border-t border-stone-100"><td className="px-4 py-2">{i.bookTitle}</td><td className="px-4 py-2">{i.memberName}</td><td className="px-4 py-2 text-stone-500">{i.dueDate}</td><td className="px-4 py-2">{hasPermission(role, "library.edit") && <button onClick={() => ret(i.id)} className="inline-flex items-center gap-1 rounded-lg bg-[#e6f8ef] px-2 py-1 text-xs font-bold text-[#14a762]"><Undo2 size={13} /> Return</button>}</td></tr>))}</tbody>
            </table>
          </article>
        </div>
      </section>
    </>
  );
}
