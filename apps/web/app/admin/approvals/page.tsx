"use client";

import { useState } from "react";
import { Plus, Loader2, X } from "lucide-react";
import { ApprovalList } from "@/components/ApprovalList";
import { adminApiRequest } from "@/lib/adminApiClient";

export default function ApprovalsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({
    requestType: "",
    entityType: "",
    entityId: "",
    title: "",
    description: "",
    payload: ""
  });

  const handleCreate = async () => {
    if (!form.requestType || !form.entityType || !form.entityId || !form.title) return;
    setSaving(true);
    setError(null);
    try {
      let payload: Record<string, unknown> | undefined;
      if (form.payload.trim()) {
        payload = JSON.parse(form.payload);
      }
      await adminApiRequest("/api/admin/approvals", {
        method: "POST",
        body: JSON.stringify({
          requestType: form.requestType,
          entityType: form.entityType,
          entityId: form.entityId,
          title: form.title,
          description: form.description || undefined,
          payload
        })
      });
      setForm({ requestType: "", entityType: "", entityId: "", title: "", description: "", payload: "" });
      setShowCreate(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create approval request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#1f2136]">Approval Requests</h2>
          <p className="mt-1 text-sm font-medium text-[#7d86a8]">
            Review and manage pending approval requests across all modules.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-xl bg-[#4748a9] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#36378f]"
        >
          <Plus size={18} />
          New Request
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#e4e6f0] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#1f2136]">New Approval Request</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="grid h-8 w-8 place-items-center rounded-lg text-[#7d86a8] hover:bg-[#f5f6fd]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#5d6690]">Request Type *</label>
                  <select
                    value={form.requestType}
                    onChange={(e) => setForm((f) => ({ ...f, requestType: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] px-3 text-sm outline-none focus:border-[#4748a9]"
                  >
                    <option value="">Select...</option>
                    <option value="concession">Fee Concession</option>
                    <option value="expense">Expense</option>
                    <option value="receipt_cancel">Receipt Cancel</option>
                    <option value="promotion">Promotion</option>
                    <option value="tc_issue">TC Issue</option>
                    <option value="salary">Salary</option>
                    <option value="student_delete">Student Delete</option>
                    <option value="data_edit">Data Edit</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#5d6690]">Entity Type *</label>
                  <input
                    value={form.entityType}
                    onChange={(e) => setForm((f) => ({ ...f, entityType: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] px-3 text-sm outline-none focus:border-[#4748a9]"
                    placeholder="e.g. concession"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#5d6690]">Entity ID *</label>
                <input
                  value={form.entityId}
                  onChange={(e) => setForm((f) => ({ ...f, entityId: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] px-3 text-sm outline-none focus:border-[#4748a9]"
                  placeholder="Firestore document ID"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#5d6690]">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] px-3 text-sm outline-none focus:border-[#4748a9]"
                  placeholder="Brief title for the request"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#5d6690]">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] px-3 py-2 text-sm outline-none focus:border-[#4748a9]"
                  placeholder="Optional details"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#5d6690]">Payload (JSON)</label>
                <textarea
                  value={form.payload}
                  onChange={(e) => setForm((f) => ({ ...f, payload: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] px-3 py-2 text-sm outline-none focus:border-[#4748a9] font-mono"
                  placeholder='{"key": "value"}'
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={saving || !form.requestType || !form.entityType || !form.entityId || !form.title}
                onClick={() => void handleCreate()}
                className="flex items-center gap-2 rounded-xl bg-[#4748a9] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#36378f] disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Create Request
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-[#e0e3f0] px-4 py-2.5 text-sm font-bold text-[#5d6690] transition hover:bg-[#f8f8fc]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ApprovalList key={refreshKey} />
    </div>
  );
}
