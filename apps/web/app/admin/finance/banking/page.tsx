"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { ArrowDownToLine, ArrowUpFromLine, Download, Landmark, Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Account = { id: string; name: string; bankName?: string; currentBalance: number };
type Txn = { id: string; type: string; amount: number; date: string; description?: string };
function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function BankingPage() {
  const { role } = useAdminSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [error, setError] = useState("");
  const [showAcc, setShowAcc] = useState(false);
  const [accForm, setAccForm] = useState({ name: "", bankName: "", openingBalance: "" });
  const [txnForm, setTxnForm] = useState({ type: "deposit", amount: "", date: new Date().toISOString().slice(0, 10), description: "" });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function loadAccounts() { try { const r = await adminApiRequest<{ accounts: Account[] }>("/api/admin/finance/bank-accounts"); setAccounts(r.accounts); if (!selected && r.accounts[0]) setSelected(r.accounts[0].id); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }
  async function loadTxns(id: string) { try { setTxns((await adminApiRequest<{ transactions: Txn[] }>(`/api/admin/finance/bank-accounts/${id}/transactions`)).transactions); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }
  useEffect(() => { void loadAccounts(); }, []);
  useEffect(() => { if (selected) void loadTxns(selected); }, [selected]);

  async function addAccount(e: FormEvent) { e.preventDefault(); try { await adminApiRequest("/api/admin/finance/bank-accounts", { method: "POST", body: JSON.stringify({ ...accForm, openingBalance: Number(accForm.openingBalance || 0) }) }); setAccForm({ name: "", bankName: "", openingBalance: "" }); setShowAcc(false); await loadAccounts(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }
  async function addTxn(e: FormEvent) { e.preventDefault(); if (!selected) return; try { await adminApiRequest(`/api/admin/finance/bank-accounts/${selected}/transactions`, { method: "POST", body: JSON.stringify({ ...txnForm, amount: Number(txnForm.amount) }) }); setTxnForm({ ...txnForm, amount: "", description: "" }); await loadAccounts(); await loadTxns(selected); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }

  const selectedAccount = accounts.find((a) => a.id === selected);
  const filtered = txns.filter((t) => {
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    return true;
  });
  let runBalance = selectedAccount?.currentBalance ?? 0;
  const withBalance = [...filtered].reverse().map((t) => {
    runBalance += t.type === "deposit" ? -t.amount : t.amount;
    return { ...t, bal: runBalance };
  }).reverse();

  function downloadCsv() {
    const rows = [["Date", "Type", "Description", "Amount", "Balance"]];
    withBalance.forEach((t) => rows.push([t.date, t.type, t.description || "", String(t.amount), String(t.bal)]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${selectedAccount?.name || "bank"}-book.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Bank Book" description="Bank accounts, deposits, withdrawals and running balance." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        <div className="flex justify-end gap-3"><button className="btn-secondary" onClick={downloadCsv}><Download size={16} /> Download CSV</button><button className="btn-primary" onClick={() => setShowAcc((v) => !v)}>{showAcc ? <X size={16} /> : <Plus size={16} />} Add account</button></div>
        {showAcc && (
          <form onSubmit={addAccount} className="card grid gap-3 p-5 sm:grid-cols-3">
            <input className="field" placeholder="Account name" required value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} />
            <input className="field" placeholder="Bank name" value={accForm.bankName} onChange={(e) => setAccForm({ ...accForm, bankName: e.target.value })} />
            <input className="field" type="number" placeholder="Opening balance ₹" value={accForm.openingBalance} onChange={(e) => setAccForm({ ...accForm, openingBalance: e.target.value })} />
            <button className="btn-primary sm:col-span-3">Create account</button>
          </form>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <button key={a.id} onClick={() => setSelected(a.id)} className={`card p-5 text-left transition ${selected === a.id ? "ring-2 ring-[#2d3094]" : "hover:shadow-md"}`}>
              <div className="flex items-center gap-2 text-[#7d86a8]"><Landmark size={16} /><span className="text-sm font-semibold">{a.bankName || "Bank"}</span></div>
              <p className="mt-1 font-bold text-[#1f2136]">{a.name}</p>
              <p className="mt-2 text-2xl font-extrabold text-[#14a762]">{inr(a.currentBalance)}</p>
            </button>
          ))}
          {accounts.length === 0 && <p className="text-sm text-stone-400">No bank accounts yet.</p>}
        </div>

        {selected && (
          <div className="grid gap-5 xl:grid-cols-[1fr_1.6fr]">
            <form onSubmit={addTxn} className="card h-fit space-y-3 p-5">
              <h2 className="font-bold text-[#1f2136]">New transaction</h2>
              <select className="field" value={txnForm.type} onChange={(e) => setTxnForm({ ...txnForm, type: e.target.value })}><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option></select>
              <input className="field" type="number" min="1" placeholder="Amount ₹" required value={txnForm.amount} onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })} />
              <input className="field" placeholder="Description" value={txnForm.description} onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })} />
              <button className="btn-primary w-full">{txnForm.type === "deposit" ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />} Record</button>
            </form>
            <article className="card overflow-x-auto">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <h2 className="font-bold text-[#1f2136]">Transactions — {selectedAccount?.name}</h2>
                <div className="flex items-center gap-2"><input type="date" className="field w-36" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" /><input type="date" className="field w-36" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" /></div>
              </div>
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Balance</th></tr></thead>
                <tbody>
                  {filtered.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">No transactions</td></tr> : withBalance.map((t) => (
                    <tr key={t.id} className="border-t border-stone-100">
                      <td className="px-4 py-3 text-stone-500">{t.date}</td>
                      <td className="px-4 py-3 capitalize">{t.type}</td>
                      <td className="px-4 py-3">{t.description}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${t.type === "deposit" ? "text-[#14a762]" : "text-[#ed515d]"}`}>{t.type === "deposit" ? "+" : "−"}{inr(t.amount)}</td>
                      <td className="px-4 py-3 text-right text-stone-600">{inr(t.bal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          </div>
        )}
      </section>
    </>
  );
}
