"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission, ROLE_LABELS, ROLES, type Role } from "@sri-narayana/shared";
import { ArrowLeft, Megaphone, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Notice = { id: string; title: string; body: string; category: string; audienceRoles: string[]; audienceClasses?: string[]; branch?: string; channels: string[]; createdAt?: string };
const CHANNELS = ["app", "sms", "whatsapp", "email"] as const;
const CATEGORIES = ["school", "branch", "class", "holiday", "exam", "event", "fee", "emergency"] as const;

export default function CircularsPage() {
  const { role } = useAdminSession();
  const canCreate = hasPermission(role, "communication.create");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("school");
  const [branch, setBranch] = useState("");
  const [audClasses, setAudClasses] = useState("");
  const [audRoles, setAudRoles] = useState<Set<string>>(new Set());
  const [channels, setChannels] = useState<Set<string>>(new Set(["app"]));

  async function load() {
    try { setNotices((await adminApiRequest<{ notices: Notice[] }>("/api/admin/notices")).notices); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
  }
  useEffect(() => { void load(); }, []);

  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); fn(n); };

  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    try {
      const classes = audClasses.trim() ? audClasses.split(",").map((c) => c.trim()).filter(Boolean) : [];
      await adminApiRequest("/api/admin/notices", {
        method: "POST",
        body: JSON.stringify({ title, body, category, branch: branch.trim(), audienceClasses: classes, audienceRoles: [...audRoles], channels: [...channels] })
      });
      setTitle(""); setBody(""); setCategory("school"); setBranch(""); setAudClasses(""); setAudRoles(new Set()); setChannels(new Set(["app"])); setShow(false); await load();
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to post"); }
  }
  async function remove(id: string) { try { await adminApiRequest(`/api/admin/notices/${id}`, { method: "DELETE" }); await load(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }

  if (!hasPermission(role, "communication.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader
        title="Notices & Circulars"
        description="Post notices & circulars to roles and classes."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/notices" className="btn-secondary"><ArrowLeft size={16} /> Communication</Link>
            {canCreate && <button className="btn-primary" onClick={() => setShow((v) => !v)}>{show ? <X size={16} /> : <Plus size={16} />} New notice</button>}
          </div>
        }
      />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        {show && (
          <form onSubmit={submit} className="card space-y-4 p-5">
            <input className="field" placeholder="Notice title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="field min-h-[100px]" placeholder="Write the notice…" required value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="mb-2 text-sm font-semibold text-[#303247]">Category</p>
                <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-[#303247]">Branch (optional)</p>
                <input className="field" placeholder="e.g. main, branch-b" value={branch} onChange={(e) => setBranch(e.target.value)} />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-[#303247]">Target classes (comma-sep)</p>
                <input className="field" placeholder="e.g. 10, 9A" value={audClasses} onChange={(e) => setAudClasses(e.target.value)} />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-[#303247]">Audience roles (empty = everyone)</p>
              <div className="flex flex-wrap gap-2">{ROLES.map((r) => <button type="button" key={r} onClick={() => toggle(audRoles, r, setAudRoles)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${audRoles.has(r) ? "bg-[#2d3094] text-white" : "bg-white text-[#475067] ring-1 ring-[#e3e6f0]"}`}>{ROLE_LABELS[r as Role]}</button>)}</div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-[#303247]">Channels</p>
              <div className="flex flex-wrap gap-2">{CHANNELS.map((c) => <button type="button" key={c} onClick={() => toggle(channels, c, setChannels)} className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${channels.has(c) ? "bg-[#14a762] text-white" : "bg-white text-[#475067] ring-1 ring-[#e3e6f0]"}`}>{c}</button>)}</div>
              <p className="mt-1 text-xs text-stone-400">App is delivered instantly; SMS/WhatsApp/Email are queued for the provider integration.</p>
            </div>
            <button className="btn-primary"><Megaphone size={16} /> Post notice</button>
          </form>
        )}

        <div className="space-y-3">
          {notices.length === 0 ? <div className="card p-8 text-center text-sm text-stone-400">No notices posted yet</div> : notices.map((n) => (
            <article key={n.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-[#1f2136]">{n.title}</h3>
                    {n.category && <span className="rounded-full bg-[#f0e6ff] px-2 py-0.5 text-xs font-semibold text-[#7c3aed] capitalize">{n.category}</span>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#475067]">{n.body}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(n.audienceRoles?.length ? n.audienceRoles : ["everyone"]).map((r) => <span key={r} className="rounded-full bg-[#eef0ff] px-2 py-0.5 text-xs font-semibold text-[#3033a1] capitalize">{r}</span>)}
                    {n.branch && <span className="rounded-full bg-[#fff4df] px-2 py-0.5 text-xs font-semibold text-[#b8791a]">{n.branch}</span>}
                    {n.audienceClasses?.map((c) => <span key={c} className="rounded-full bg-[#e6f8ef] px-2 py-0.5 text-xs font-semibold text-[#14a762]">Class {c}</span>)}
                    {n.channels?.map((c) => <span key={c} className="rounded-full bg-[#e6f8ef] px-2 py-0.5 text-xs font-semibold text-[#14a762] capitalize">{c}</span>)}
                  </div>
                </div>
                {canCreate && <button onClick={() => remove(n.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#ed515d] hover:bg-[#ffebed]"><Trash2 size={16} /></button>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
