"use client";

import { PageHeader } from "@/components/PageHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { ArrowDownRight, ArrowUpRight, Lock, Unlock } from "lucide-react";
import { useEffect, useState } from "react";

type DailyRow = { date: string; income: number; expense: number; net: number };
type ClosingStatus = { [date: string]: boolean };

function inr(n: number) {
  const prefix = n >= 0 ? "" : "−";
  return `${prefix}₹${Math.abs(n).toLocaleString("en-IN")}`;
}

function fmt(d: Date) { return d.toISOString().slice(0, 10); }

export default function CollectionsPage() {
  const { role } = useAdminSession();
  const canClose = hasPermission(role, "fees.approve");
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(fmt(firstOfMonth));
  const [to, setTo] = useState(fmt(today));
  const [days, setDays] = useState<DailyRow[]>([]);
  const [closingStatus, setClosingStatus] = useState<ClosingStatus>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async (f: string, t: string) => {
    setLoading(true); setError("");
    try {
      const r = await adminApiRequest<{ days: DailyRow[] }>(`/api/admin/finance/daily?from=${f}&to=${t}`);
      setDays(r.days);
      // Load closing status from audit logs or daily_closing collection
      try {
        const closeSnap = await adminApiRequest<{ closings: { date: string }[] }>(`/api/admin/finance/daily/closing?from=${f}&to=${t}`);
        const status: ClosingStatus = {};
        closeSnap.closings.forEach((c) => { status[c.date] = true; });
        setClosingStatus(status);
      } catch { }
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(from, to); }, []);

  async function toggleClose(date: string) {
    try {
      await adminApiRequest("/api/admin/finance/daily/closing", {
        method: "POST",
        body: JSON.stringify({ date, action: closingStatus[date] ? "open" : "close" })
      });
      setClosingStatus((prev) => ({ ...prev, [date]: !prev[date] }));
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to update closing status");
    }
  }

  const totalIncome = days.reduce((s, d) => s + d.income, 0);
  const totalExpense = days.reduce((s, d) => s + d.expense, 0);
  const totalNet = days.reduce((s, d) => s + d.net, 0);

  if (!hasPermission(role, "fees.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Daily Account Closing" description="Day-wise income, expense, net position and closing status." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <DateRangeFilter
          from={from}
          to={to}
          onChange={({ from, to }) => { setFrom(from); setTo(to); }}
          onApply={({ from, to }) => fetchData(from, to)}
          loading={loading}
        />

        <div className="stat-grid">
          <div className="card p-4 sm:p-5">
            <p className="text-xs font-semibold text-[#7d86a8] sm:text-sm">Total Income</p>
            <p className="mt-2 text-[24px] font-extrabold leading-none tracking-tight text-[#1b1d32] sm:mt-3 sm:text-[28px] xl:text-[30px]">{inr(totalIncome)}</p>
          </div>
          <div className="card p-4 sm:p-5">
            <p className="text-xs font-semibold text-[#7d86a8] sm:text-sm">Total Expense</p>
            <p className="mt-2 text-[24px] font-extrabold leading-none tracking-tight text-[#1b1d32] sm:mt-3 sm:text-[28px] xl:text-[30px]">{inr(totalExpense)}</p>
          </div>
          <div className="card p-4 sm:p-5">
            <p className="text-xs font-semibold text-[#7d86a8] sm:text-sm">Net</p>
            <p className={`mt-2 text-[24px] font-extrabold leading-none tracking-tight sm:mt-3 sm:text-[28px] xl:text-[30px] ${totalNet >= 0 ? "text-[#14a762]" : "text-[#ed515d]"}`}>{inr(totalNet)}</p>
          </div>
          <div className="card p-4 sm:p-5">
            <p className="text-xs font-semibold text-[#7d86a8] sm:text-sm">Closed Days</p>
            <p className="mt-2 text-[24px] font-extrabold leading-none tracking-tight text-[#3033a1] sm:mt-3 sm:text-[28px] xl:text-[30px]">{Object.values(closingStatus).filter(Boolean).length} / {days.length}</p>
          </div>
        </div>

        {/* Mobile: daily closing cards */}
        <div className="space-y-3 md:hidden">
          {loading ? (
            <div className="card p-8 text-center text-sm text-stone-400">Loading…</div>
          ) : days.length === 0 ? (
            <div className="card p-8 text-center text-sm text-stone-400">No transactions for this period.</div>
          ) : days.map((d) => {
            const isClosed = closingStatus[d.date];
            return (
              <div key={d.date} className={`card p-4 ${isClosed ? "bg-[#f6faf6]" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-[#303247]">{d.date}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${isClosed ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#fff4df] text-[#e29813]"}`}>
                    {isClosed ? <Lock size={12} /> : <Unlock size={12} />}{isClosed ? "Closed" : "Open"}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><dt className="text-[10px] font-semibold uppercase text-stone-500">Income</dt><dd className="text-sm font-bold text-[#14a762]">{inr(d.income)}</dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase text-stone-500">Expense</dt><dd className="text-sm font-bold text-[#ed515d]">{inr(d.expense)}</dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase text-stone-500">Net</dt><dd className={`text-sm font-bold ${d.net >= 0 ? "text-[#14a762]" : "text-[#ed515d]"}`}>{inr(d.net)}</dd></div>
                </dl>
                {canClose && (
                  <button onClick={() => toggleClose(d.date)} className={`mt-3 w-full rounded-lg py-2.5 text-sm font-bold transition ${isClosed ? "bg-[#ffebed] text-[#ed515d]" : "bg-[#e6f8ef] text-[#14a762]"}`}>
                    {isClosed ? "Reopen day" : "Close day"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop / tablet: table */}
        <div className="hidden overflow-hidden rounded-2xl border border-[#e3e6f0] bg-white md:block">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#f7f8fd]">
                <tr>
                  <th className="border-b border-[#edf0f7] px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Date</th>
                  <th className="border-b border-[#edf0f7] px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Income</th>
                  <th className="border-b border-[#edf0f7] px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Expense</th>
                  <th className="border-b border-[#edf0f7] px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Net</th>
                  <th className="border-b border-[#edf0f7] px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Status</th>
                  {canClose && <th className="border-b border-[#edf0f7] px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Action</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={canClose ? 6 : 5} className="px-4 py-8 text-center text-stone-400">Loading…</td></tr>
                ) : days.length === 0 ? (
                  <tr><td colSpan={canClose ? 6 : 5} className="px-4 py-8 text-center text-stone-400">No transactions for this period.</td></tr>
                ) : (
                  days.map((d) => {
                    const isClosed = closingStatus[d.date];
                    return (
                      <tr key={d.date} className={`border-b border-[#edf0f7] transition last:border-b-0 hover:bg-[#fafbff] ${isClosed ? "bg-[#f6faf6]" : ""}`}>
                        <td className="px-4 py-3 font-medium text-[#303247]">{d.date}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#14a762]">{inr(d.income)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#ed515d]">{inr(d.expense)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${d.net >= 0 ? "text-[#14a762]" : "text-[#ed515d]"}`}>{inr(d.net)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${isClosed ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#fff4df] text-[#e29813]"}`}>
                            {isClosed ? <Lock size={12} /> : <Unlock size={12} />}
                            {isClosed ? "Closed" : "Open"}
                          </span>
                        </td>
                        {canClose && (
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => toggleClose(d.date)} className={`rounded-lg px-3 py-1 text-xs font-bold transition ${isClosed ? "bg-[#ffebed] text-[#ed515d] hover:bg-[#ffd9dd]" : "bg-[#e6f8ef] text-[#14a762] hover:bg-[#d2f2e1]"}`}>
                              {isClosed ? "Reopen" : "Close"}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
