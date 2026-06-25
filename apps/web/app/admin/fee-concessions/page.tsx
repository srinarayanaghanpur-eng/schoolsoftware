"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Concession } from "@/types/fee.types";
import { ConcessionListItem } from "@/components/FeeComponents";
import { PageHeader } from "@/components/PageHeader";

export default function ConcessionsPage() {
  const [concessions, setConcessions] = useState<Concession[]>([]);
  const [filteredConcessions, setFilteredConcessions] = useState<Concession[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("");

  useEffect(() => {
    fetchConcessions();
  }, []);

  useEffect(() => {
    let filtered = concessions;

    if (statusFilter) {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }
    if (classFilter) {
      filtered = filtered.filter((c) => c.class === classFilter);
    }

    setFilteredConcessions(filtered);
  }, [concessions, statusFilter, classFilter]);

  const fetchConcessions = async () => {
    try {
      const response = await fetch("/api/admin/concessions");
      const data = await response.json();
      if (data.success) {
        setConcessions(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch concessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: concessions.length,
    pending: concessions.filter((c) => c.status === "pending").length,
    approved: concessions.filter((c) => c.status === "approved").length,
    rejected: concessions.filter((c) => c.status === "rejected").length
  };

  const totalAmount = concessions
    .filter((c) => c.status === "approved")
    .reduce((sum, c) => sum + (c.concessionAmount || 0), 0);

  return (
    <>
      <PageHeader
        title="Legacy Fee Concessions"
        description="Legacy concession workflow retained for backward compatibility."
        action={
          <Link href="/admin/fee-concessions/create" className="btn-primary">
            <Plus size={18} />
            Create Legacy Request
          </Link>
        }
      />

      <section className="space-y-5 p-4 md:p-7">
        <div className="rounded-2xl border border-[#ffe1ab] bg-[#fff8ea] p-4 text-sm font-semibold text-[#9f7116]">
          This page is kept only for existing concession records. New fee management uses the annual enrollment + commitment fee model.
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Concessions", value: stats.total },
            { label: "Pending Approval", value: stats.pending },
            { label: "Approved", value: stats.approved },
            { label: "Total Amount", value: `₹${totalAmount.toLocaleString("en-IN")}` }
          ].map((stat) => (
            <div key={stat.label} className="card p-5">
              <p className="text-sm font-semibold text-[#7d86a8]">{stat.label}</p>
              <p className="mt-3 text-[32px] font-extrabold leading-none text-[#1b1d32]">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="card flex flex-wrap gap-4 p-4">
          <label className="min-w-[180px] flex-1 text-sm font-semibold text-[#303247]">
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="field mt-1">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label className="min-w-[180px] flex-1 text-sm font-semibold text-[#303247]">
            Class
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="field mt-1">
              <option value="">All Classes</option>
              <option value="Nur">Nursery</option>
              <option value="KG">KG</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
              <option value="10">10</option>
            </select>
          </label>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="card py-8 text-center text-sm font-medium text-[#7d86a8]">Loading...</div>
          ) : filteredConcessions.length === 0 ? (
            <div className="card py-8 text-center text-sm font-medium text-[#7d86a8]">
              No concessions found. {concessions.length === 0 && "Grant your first concession to get started."}
            </div>
          ) : (
            filteredConcessions.map((concession) => (
              <ConcessionListItem
                key={concession.id}
                concession={concession}
                onView={() => {
                  window.location.href = `/admin/fee-concessions/${concession.id}`;
                }}
                onEdit={() => {
                  window.location.href = `/admin/fee-concessions/${concession.id}/edit`;
                }}
                onApprove={() => {
                  alert("Approve flow to be implemented");
                }}
              />
            ))
          )}
        </div>
      </section>
    </>
  );
}
