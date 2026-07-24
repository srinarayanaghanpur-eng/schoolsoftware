"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { DebitVoucher as DebitVoucherModel } from "@sri-narayana/shared";
import { FileDown, History, Plus, Printer } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { DebitVoucher } from "@/components/vouchers/DebitVoucher";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";

export default function VoucherPreviewPage() {
  const params = useParams<{ voucherId: string }>();
  const voucherId = params.voucherId;
  const [voucher, setVoucher] = useState<DebitVoucherModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await adminApiRequest<{ voucher: DebitVoucherModel }>(`/api/admin/finance/debit-vouchers/${voucherId}`);
        if (!cancelled) setVoucher(result.voucher);
      } catch (e) {
        if (!cancelled) setError(e instanceof AdminApiError ? e.message : "Unable to load debit voucher");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [voucherId]);

  return (
    <AuthGate roles={["super_admin", "accountant"]}>
      <main className="min-h-screen bg-[#f6f8ff] px-4 py-6 text-[#1f2136] md:px-8">
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#65708f]">Finance / Accounts</p>
              <h1 className="text-2xl font-extrabold tracking-tight">Debit Voucher Preview</h1>
            </div>
            {voucher && (
              <div className="flex flex-wrap gap-2">
                <Link className="btn-primary" href={`/vouchers/print/${voucher.id}?copies=4`}>
                  <Printer size={16} /> Print Voucher
                </Link>
                <Link className="btn-secondary" href={`/vouchers/print/${voucher.id}?copies=1&autoPrint=1`}>
                  <FileDown size={16} /> Download PDF
                </Link>
                <Link className="btn-secondary" href="/admin/finance/debit-vouchers">
                  <Plus size={16} /> Create Another Voucher
                </Link>
                <Link className="btn-secondary" href="/admin/finance/debit-vouchers#voucher-history">
                  <History size={16} /> Go to Voucher History
                </Link>
              </div>
            )}
          </div>

          {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
          {loading ? (
            <div className="card p-10 text-center text-sm font-semibold text-stone-500">Loading voucher...</div>
          ) : voucher ? (
            <div className="debit-voucher-preview-card rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#dfe3f1]">
              <DebitVoucher voucher={voucher} />
            </div>
          ) : (
            <div className="card p-10 text-center text-sm font-semibold text-stone-500">Voucher not found</div>
          )}
        </div>
      </main>
    </AuthGate>
  );
}
