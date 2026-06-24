"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Filter } from "lucide-react";
import { Concession } from "@/types/fee.types";
import { FeeStatusBadge, ConcessionListItem } from "@/components/FeeComponents";
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <PageHeader
          title="Legacy Fee Concessions"
          description="Legacy concession workflow retained for backward compatibility"
        />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This page is kept only for existing concession records. New fee management uses the annual enrollment + commitment fee model.
        </div>
      </div>
      <Link
        href="/admin/fee-concessions/create"
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
      >
        <Plus size={18} />
        Create Legacy Request
      </Link>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Concessions",
            value: stats.total,
            color: "blue"
          },
          {
            label: "Pending Approval",
            value: stats.pending,
            color: "amber"
          },
          {
            label: "Approved",
            value: stats.approved,
            color: "emerald"
          },
          {
            label: "Total Amount",
            value: `₹${totalAmount.toLocaleString("en-IN")}`,
            color: "purple"
          }
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg bg-white p-4 border border-stone-200"
          >
            <p className="text-sm text-stone-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-stone-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="text-sm font-medium text-stone-700">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-stone-700">Class</label>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
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
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-stone-500">Loading...</div>
        ) : filteredConcessions.length === 0 ? (
          <div className="text-center py-8 text-stone-500">
            No concessions found. {concessions.length === 0 && "Grant your first concession to get started."}
          </div>
        ) : (
          filteredConcessions.map((concession) => (
            <ConcessionListItem
              key={concession.id}
              concession={concession}
              onView={() => {
                // Navigate to detail page
                window.location.href = `/admin/fee-concessions/${concession.id}`;
              }}
              onEdit={() => {
                window.location.href = `/admin/fee-concessions/${concession.id}/edit`;
              }}
              onApprove={() => {
                // Handle approve
                alert("Approve flow to be implemented");
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
