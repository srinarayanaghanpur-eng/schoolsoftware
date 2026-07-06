"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { DebitVoucher as DebitVoucherModel } from "@sri-narayana/shared";
import { ArrowLeft, Printer } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { DebitVoucherA4Page } from "@/components/vouchers/DebitVoucherA4Page";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";

export default function VoucherPrintPage() {
  const params = useParams<{ voucherId: string }>();
  const searchParams = useSearchParams();
  const voucherId = params.voucherId;
  const ids = useMemo(() => {
    const queue = searchParams.get("ids")?.split(",").map((id) => id.trim()).filter(Boolean);
    return queue?.length ? queue : [voucherId];
  }, [searchParams, voucherId]);
  const copies = Math.max(1, Math.min(4, Number(searchParams.get("copies") ?? "4") || 4));
  const autoPrint = searchParams.get("autoPrint") === "1";
  const [vouchers, setVouchers] = useState<DebitVoucherModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const autoPrintedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ ids: ids.join(","), limit: "100" });
        const result = await adminApiRequest<{ vouchers: DebitVoucherModel[] }>(`/api/admin/finance/debit-vouchers?${query}`);
        if (!cancelled) setVouchers(result.vouchers);
      } catch (e) {
        if (!cancelled) setError(e instanceof AdminApiError ? e.message : "Unable to load debit vouchers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  async function handlePrint() {
    if (!vouchers.length) return;
    setPrinting(true);
    setError("");
    try {
      await adminApiRequest(`/api/admin/finance/debit-vouchers/${voucherId}/print`, {
        method: "POST",
        body: JSON.stringify({ ids: vouchers.map((voucher) => voucher.id).filter(Boolean) })
      });
      window.print();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Unable to update print status");
    } finally {
      setPrinting(false);
    }
  }

  useEffect(() => {
    if (!autoPrint || autoPrintedRef.current || loading || !vouchers.length) return;
    autoPrintedRef.current = true;
    const timer = window.setTimeout(() => void handlePrint(), 300);
    return () => window.clearTimeout(timer);
  }, [autoPrint, loading, vouchers.length]);

  return (
    <AuthGate roles={["super_admin", "accountant"]}>
      <main className="min-h-screen bg-[#f6f8ff] py-5 text-[#1f2136]">
        <div className="no-print mx-auto mb-5 flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#65708f]">Debit Voucher Print</p>
            <h1 className="text-2xl font-extrabold tracking-tight">A4 Voucher Sheet</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/vouchers/${voucherId}`} className="btn-secondary">
              <ArrowLeft size={16} /> Back to Preview
            </Link>
            <button className="btn-primary" onClick={handlePrint} disabled={printing || loading || vouchers.length === 0}>
              <Printer size={16} /> {printing ? "Preparing..." : "Print"}
            </button>
          </div>
        </div>

        {error && <div className="no-print mx-auto mb-4 max-w-6xl px-4"><div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div></div>}
        {loading ? (
          <div className="no-print mx-auto max-w-6xl px-4"><div className="card p-10 text-center text-sm font-semibold text-stone-500">Loading voucher sheet...</div></div>
        ) : vouchers.length > 0 ? (
          <DebitVoucherA4Page vouchers={vouchers} copies={ids.length === 1 ? copies : 1} />
        ) : (
          <div className="no-print mx-auto max-w-6xl px-4"><div className="card p-10 text-center text-sm font-semibold text-stone-500">No vouchers found</div></div>
        )}
      </main>
    </AuthGate>
  );
}
