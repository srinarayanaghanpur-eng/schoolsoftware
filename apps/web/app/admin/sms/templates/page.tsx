"use client";

import { useState, useEffect, useCallback } from "react";
import { hasPermission } from "@sri-narayana/shared";
import { useAdminSession } from "@/components/AdminSessionContext";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { PageHeader } from "@/components/PageHeader";
import { Plus, X, Edit2, Trash2, Save } from "lucide-react";

type SmsTemplate = {
  id: string;
  name: string;
  body: string;
  category: string;
};

const CATEGORIES = ["Fee Reminder", "Attendance Alert", "Holiday Notice", "Exam Notification", "Parent Meeting", "Transport Notice", "Admission Follow-up", "Birthday Wishes", "General Announcement", "Emergency Notice"];

export default function SmsTemplatesPage() {
  const { role } = useAdminSession();
  const canManage = Boolean(role && hasPermission(role, "sms.templates"));
  const canView = Boolean(role && hasPermission(role, "sms.view"));

  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCategory, setFormCategory] = useState("General Announcement");

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ ok: boolean; templates: SmsTemplate[] }>("/api/admin/sms/templates");
      setTemplates(result.templates ?? []);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Unable to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const openCreateForm = () => {
    setEditingId(null);
    setFormName("");
    setFormBody("");
    setFormCategory("General Announcement");
    setShowForm(true);
    setError(null);
  };

  const openEditForm = (t: SmsTemplate) => {
    setEditingId(t.id);
    setFormName(t.name);
    setFormBody(t.body);
    setFormCategory(t.category);
    setShowForm(true);
    setError(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormName("");
    setFormBody("");
    setFormCategory("General Announcement");
  };

  const saveTemplate = async () => {
    if (!formName.trim() || !formBody.trim()) { setError("Name and body are required"); return; }
    setError(null);
    setMessage(null);
    try {
      if (editingId) {
        await adminApiRequest(`/api/admin/sms/templates/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: formName.trim(), body: formBody.trim(), category: formCategory })
        });
        setMessage("Template updated");
      } else {
        await adminApiRequest("/api/admin/sms/templates", {
          method: "POST",
          body: JSON.stringify({ name: formName.trim(), body: formBody.trim(), category: formCategory })
        });
        setMessage("Template created");
      }
      closeForm();
      void loadTemplates();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to save template");
    }
  };

  const deleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    setError(null);
    setMessage(null);
    try {
      await adminApiRequest(`/api/admin/sms/templates/${id}`, { method: "DELETE" });
      setMessage(`"${name}" deleted`);
      void loadTemplates();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to delete template");
    }
  };

  if (!canView) {
    return (
      <section className="p-7">
        <div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div>
      </section>
    );
  }

  return (
    <>
      <PageHeader
        title="SMS Templates"
        description="Manage reusable message templates."
        action={canManage ? (
          <button onClick={openCreateForm} className="btn-primary h-10 rounded-lg px-4 text-sm font-bold">
            <Plus size={18} /> New Template
          </button>
        ) : undefined}
      />
      <section className="space-y-5 p-4 md:p-7">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-[#ffebed] px-4 py-3 text-sm font-bold text-[#d84d5b]">
            <X size={16} /> {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
          </div>
        )}
        {message && (
          <div className="flex items-center gap-2 rounded-lg bg-[#e8f5e9] px-4 py-3 text-sm font-bold text-[#2e7d32]">
            <X size={16} className="cursor-pointer" onClick={() => setMessage(null)} /> {message}
          </div>
        )}

        {showForm && (
          <div className="card space-y-4 rounded-xl border border-border p-5">
            <h3 className="text-lg font-extrabold text-foreground">{editingId ? "Edit Template" : "New Template"}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">Template Name</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Fee Reminder" className="input h-10 w-full rounded-lg border border-border px-3 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">Category</label>
                <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="input h-10 w-full rounded-lg border border-border px-3 text-sm">
                  {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">
                Message Body <span className="text-muted-foreground/60">({formBody.length} chars)</span>
              </label>
              <textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} placeholder="Dear {{parentName}},..." rows={6} maxLength={918} className="input w-full rounded-lg border border-border p-3 text-sm resize-none" />
              <div className="mt-1 flex flex-wrap gap-1.5">
                {["{{studentName}}", "{{parentName}}", "{{class}}", "{{section}}", "{{schoolName}}", "{{amountDue}}", "{{dueDate}}"].map((p) => (
                  <button key={p} onClick={() => setFormBody((prev) => prev + p)} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground transition hover:bg-accent">{p}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveTemplate} className="btn-primary h-10 rounded-lg px-5 text-sm font-bold">
                <Save size={16} /> {editingId ? "Update" : "Create"}
              </button>
              <button onClick={closeForm} className="btn-secondary h-10 rounded-lg px-5 text-sm font-bold">Cancel</button>
            </div>
          </div>
        )}

        {loading && <p className="py-4 text-center text-sm text-muted-foreground">Loading...</p>}

        {!loading && templates.length === 0 && !showForm && (
          <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
            <p>No templates yet.</p>
            {canManage && <p className="text-xs">Click "New Template" to create one.</p>}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="card flex flex-col rounded-xl border border-border p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-foreground">{t.name}</h4>
                  <span className="text-[11px] font-medium text-muted-foreground">{t.category}</span>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => openEditForm(t)} title="Edit" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteTemplate(t.id, t.name)} title="Delete" className="grid h-7 w-7 place-items-center rounded-lg text-[#d84d5b] transition hover:bg-[#ffebed]">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-2 line-clamp-4 flex-1 text-xs leading-relaxed text-muted-foreground">{t.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
