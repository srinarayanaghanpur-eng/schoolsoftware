"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";

type BranchAccount = { branchId: string; branchName: string; income: number; expense: number; net: number };
type Consolidated = { totalIncome: number; totalExpense: number; totalNet: number };
type BranchData = { branches: BranchAccount[]; consolidated: Consolidated; availableBranches: { id: string; name: string }[] };

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function BranchAccountsPage() {
  const { role } = useAdminSession();
  const [data, setData] = useState<BranchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams(); if (from) q.set("from", from); if (to) q.set("to", to);
      const r = await adminApiRequest<BranchData>(`/api/admin/finance/branch-accounts?${q}`);
      setData(r);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  const c = data?.consolidated;
  const branches = data?.branches ?? [];
  const multiBranch = branches.length > 1;

  return (
    <>
      <PageHeader title={multiBranch ? "Branch-wise Accounts" : "Consolidated Accounts"} description={multiBranch ? "Income, expense and net by branch." : "Multi-school consolidated financial report."} />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <div className="card flex flex-wrap items-end gap-3 p-4">
          <label className="text-sm font-semibold text-[#303247]">From<input type="date" className="field mt-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-sm font-semibold text-[#303247]">To<input type="date" className="field mt-1" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button className="btn-primary" onClick={load}>Apply</button>
        </div>

        {loading ? <div className="card p-8 text-center text-stone-400">Loading…</div> : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#7d86a8]">{multiBranch ? "Total Income (All)" : "Total Income"}</p>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6f8ef] text-[#14a762]"><ArrowUpRight size={20} /></span>
                </div>
                <p className="mt-3 text-[30px] font-extrabold leading-none tracking-tight text-[#1b1d32]">{inr(c?.totalIncome ?? 0)}</p>
              </div>
              <div className="card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#7d86a8]">{multiBranch ? "Total Expense (All)" : "Total Expense"}</p>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ffebed] text-[#ed515d]"><ArrowDownRight size={20} /></span>
                </div>
                <p className="mt-3 text-[30px] font-extrabold leading-none tracking-tight text-[#1b1d32]">{inr(c?.totalExpense ?? 0)}</p>
              </div>
              <div className="card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#7d86a8]">{multiBranch ? "Consolidated Net" : "Net"}</p>
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${(c?.totalNet ?? 0) >= 0 ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#ffebed] text-[#ed515d]"}`}>
                    {(c?.totalNet ?? 0) >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                  </span>
                </div>
                <p className={`mt-3 text-[30px] font-extrabold leading-none tracking-tight ${(c?.totalNet ?? 0) >= 0 ? "text-[#14a762]" : "text-[#ed515d]"}`}>{inr(c?.totalNet ?? 0)}</p>
              </div>
            </div>

            {branches.length === 0 ? (
              <div className="card p-8 text-center text-stone-400">No branches configured. Records appear under a default branch.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {branches.map((b) => (
                  <div key={b.branchId} className="card p-5">
                    <p className="text-sm font-semibold text-[#7d86a8]">{b.branchName}</p>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between"><span className="text-sm text-stone-600">Income</span><span className="font-semibold text-[#14a762]">{inr(b.income)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm text-stone-600">Expense</span><span className="font-semibold text-[#ed515d]">{inr(b.expense)}</span></div>
                      <div className="flex items-center justify-between border-t border-stone-100 pt-2"><span className="text-sm font-semibold text-[#1f2136]">Net</span><span className={`font-extrabold ${b.net >= 0 ? "text-[#14a762]" : "text-[#ed515d]"}`}>{inr(b.net)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
