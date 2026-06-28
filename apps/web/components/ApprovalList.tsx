"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { adminApiRequest } from "@/lib/adminApiClient";
import type { ApprovalRequest } from "@sri-narayana/shared";

type FilterTab = "pending" | "approved" | "rejected" | "all";

export function ApprovalList({ requestType }: { requestType?: string }) {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (requestType) params.set("requestType", requestType);
      const data = await adminApiRequest<{ requests: ApprovalRequest[] }>(
        `/api/admin/approvals?${params.toString()}`
      );
      setRequests(data.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchRequests(); }, [filter, requestType]);

  const handleReview = async (id: string, status: "approved" | "rejected", notes?: string) => {
    setReviewingId(id);
    try {
      await adminApiRequest(`/api/admin/approvals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes: notes ?? "" })
      });
      await fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review approval");
    } finally {
      setReviewingId(null);
    }
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" }
  ];

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b border-[#e4e6f0]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2.5 text-sm font-bold transition border-b-2 -mb-px ${
              filter === tab.key
                ? "border-[#4748a9] text-[#4748a9]"
                : "border-transparent text-[#7d86a8] hover:text-[#4748a9]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm font-medium text-[#7d86a8]">
          <Clock size={18} className="mr-2 animate-spin" />
          Loading approvals...
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-[#e4e6f0] bg-white p-8 text-center text-sm font-medium text-[#7d86a8]">
          No {filter === "all" ? "" : filter} approval requests found.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-[#e4e6f0] bg-white p-5 transition hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#1f2136]">{req.title}</h3>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      req.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : req.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {req.status === "approved" ? <CheckCircle size={12} /> : req.status === "rejected" ? <XCircle size={12} /> : <Clock size={12} />}
                      {req.status}
                    </span>
                  </div>
                  {req.description && (
                    <p className="mt-1 text-sm text-[#5d6690]">{req.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-[#7d86a8]">
                    <span>Type: {req.requestType}</span>
                    <span>By: {req.requestedByName ?? req.requestedBy}</span>
                    <span>{new Date(req.requestedAt).toLocaleString()}</span>
                    {req.reviewedAt && (
                      <span>
                        {req.status === "approved" ? "Approved" : "Rejected"} by {req.reviewedByName ?? req.reviewedBy} on{" "}
                        {new Date(req.reviewedAt).toLocaleString()}
                      </span>
                    )}
                    {req.notes && <span>Notes: {req.notes}</span>}
                  </div>
                </div>

                {req.status === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={reviewingId === req.id}
                      onClick={() => void handleReview(req.id!, "approved")}
                      className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle size={14} />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={reviewingId === req.id}
                      onClick={() => void handleReview(req.id!, "rejected")}
                      className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
