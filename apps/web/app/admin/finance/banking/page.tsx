"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { ArrowDownToLine, ArrowUpFromLine, Landmark, Plus, X } from "lucide-react";
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

  async function loadAccounts() { try { const r = await adminApiRequest<{ accounts: Account[] }>("/api/admin/finance/bank-accounts"); setAccounts(r.accounts); if (!selected && r.accounts[0]) setSelected(r.accounts[0].id); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }
  async function loadTxns(id: string) { try { setTxns((await adminApiRequest<{ transactions: Txn[] }>(`/api/admin/finance/bank-accounts/${id}/transactions`)).transactions); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }
  useEffect(() => { void loadAccounts(); }, []);
  useEffect(() => { if (selected) void loadTxns(selected); }, [selected]);

  async function addAccount(e: FormEvent) { e.preventDefault(); try { await adminApiRequest("/api/admin/finance/bank-accounts", { method: "POST", body: JSON.stringify({ ...accForm, openingBalance: Number(accForm.openingBalance || 0) }) }); setAccForm({ name: "", bankName: "", openingBalance: "" }); setShowAcc(false); await loadAccounts(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }
  async function addTxn(e: FormEvent) { e.preventDefault(); if (!selected) return; try { await adminApiRequest(`/api/admin/finance/bank-accounts/${selected}/transactions`, { method: "POST", body: JSON.stringify({ ...txnForm, amount: Number(txnForm.amount) }) }); setTxnForm({ ...txnForm, amount: "", description: "" }); await loadAccounts(); await loadTxns(selected); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Banking" description="Bank accounts, deposits and withdrawals." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowAcc((v) => !v)}>{showAcc ? <X size={16} /> : <Plus size={16} />} Add account</button></div>
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
              <div className="px-4 py-3"><h2 className="font-bold text-[#1f2136]">Transactions</h2></div>
              <table className="w-full min-w-[440px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
                <tbody>
                  {txns.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-400">No transactions</td></tr> : txns.map((t) => (
                    <tr key={t.id} className="border-t border-stone-100"><td className="px-4 py-3 text-stone-500">{t.date}</td><td className="px-4 py-3 capitalize">{t.type}</td><td className="px-4 py-3">{t.description}</td><td className={`px-4 py-3 text-right font-semibold ${t.type === "deposit" ? "text-[#14a762]" : "text-[#ed515d]"}`}>{t.type === "deposit" ? "+" : "−"}{inr(t.amount)}</td></tr>
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
