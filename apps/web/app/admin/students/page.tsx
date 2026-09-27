"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, IndianRupee, ReceiptText, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { hasPermission } from "@sri-narayana/shared";
import { adminApiRequest } from "@/lib/adminApiClient";
import {
  CLASS_SELECTOR_CLASSES,
  CLASS_LABELS,
  classIdToSlug,
  type StudentClassCardConfig
} from "@/lib/studentClasses";

/**
 * Students overview (landing page for /admin/students).
 *
 * Deliberately shows NO student rows and NO active/archived student status —
 * each class has its own strict URL page (e.g. /admin/students/class-1) that
 * owns the student list. This page only:
 *   1. links to every class page
 *   2. shows the latest fee collections at the bottom
 */
type RecentPayment = {
  id: string;
  studentName?: string;
  admissionNumber?: string;
  amountPaid?: number;
  class?: string;
  section?: string;
  receiptNumber?: string;
  paymentType?: string;
  paymentMethod?: string;
  createdAt?: string | number | { toDate?: () => Date };
};

function formatWhen(value: RecentPayment["createdAt"]): string {
  try {
    let date: Date | null = null;
    if (value && typeof value === "object" && typeof value.toDate === "function") {
      date = value.toDate();
    } else if (typeof value === "string" || typeof value === "number") {
      date = new Date(value);
    }
    if (!date || Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

function formatAmount(amount: number | undefined): string {
  const value = Number(amount ?? 0);
  return `₹${value.toLocaleString("en-IN")}`;
}

export default function StudentsOverviewPage() {
  const { role } = useAdminSession();
  const canViewFees = Boolean(role && hasPermission(role, "fees.view"));

  const [fees, setFees] = useState<RecentPayment[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feesError, setFeesError] = useState("");

  useEffect(() => {
    if (!canViewFees) return;
    let cancelled = false;
    (async () => {
      setFeesLoading(true);
      try {
        const res = await adminApiRequest<{ success?: boolean; data?: RecentPayment[] }>(
          "/api/admin/payments?pageSize=10"
        );
        if (!cancelled) setFees(res.data ?? []);
      } catch (error) {
        if (!cancelled) {
          setFeesError(error instanceof Error ? error.message : "Unable to load recent fee additions");
        }
      } finally {
        if (!cancelled) setFeesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canViewFees]);

  const renderClassCard = (item: StudentClassCardConfig) => (
    <div
      key={item.id}
      className={`group flex min-h-[104px] flex-col rounded-2xl border transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(31,33,54,0.12)] ${item.accent.border} ${item.accent.background}`}
    >
      <Link
        href={`/admin/students/${classIdToSlug(item.id)}`}
        className="flex flex-1 items-center justify-between gap-3 p-4 pb-2"
      >
        <div className="min-w-0">
          <div className={`truncate text-sm font-extrabold ${item.accent.text}`}>{item.label}</div>
          <div className="mt-1 text-xs font-semibold text-[#7d86a8]">
            View students · Sections {item.availableSections.join(", ")}
          </div>
        </div>
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/80 text-[#303247] transition group-hover:translate-x-0.5 ${item.accent.text}`}
          aria-hidden="true"
        >
          <ArrowRight size={16} />
        </span>
      </Link>
      {canViewFees && (
        <Link
          href={`/admin/fee-structures?className=${item.id}&add=1`}
          className="mx-4 mb-3 inline-flex w-fit items-center gap-1 rounded-lg bg-white/85 px-2.5 py-1 text-[11px] font-extrabold text-[#303247] ring-1 ring-black/5 transition hover:bg-white"
        >
          <IndianRupee size={12} />
          Fee structure
        </Link>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Students"
        description="Pick a class to open its student list — every class has its own page (e.g. /admin/students/class-1)."
      />

      <section className="space-y-6 p-4 md:p-6 lg:p-8">
        <div className="card p-4 md:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-[#1f2136]">Classes</h3>
            <span className="rounded-full bg-[#eef0fb] px-2 py-0.5 text-[11px] font-bold text-[#7d86a8]">
              {CLASS_SELECTOR_CLASSES.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {CLASS_SELECTOR_CLASSES.map(renderClassCard)}
          </div>
        </div>

        {canViewFees && (
          <div className="card p-4 md:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ecfdf3] text-[#18765e]">
                  <ReceiptText size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-[#1f2136]">Recent fee additions</h3>
                  <p className="text-xs font-semibold text-[#7d86a8]">Latest 10 fee collections</p>
                </div>
              </div>
              <Link
                href="/admin/finance"
                className="inline-flex items-center gap-1 rounded-lg border border-[#dfe3f1] bg-white px-3 py-1.5 text-xs font-bold text-[#303247] transition hover:bg-[#f4f5fb]"
              >
                Open Finance
                <ArrowRight size={13} />
              </Link>
            </div>

            {feesLoading && (
              <div className="space-y-2" aria-busy="true">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="h-11 animate-pulse rounded-xl bg-[#f2f4fb]" />
                ))}
              </div>
            )}

            {!feesLoading && feesError && (
              <div className="flex items-center gap-2 rounded-xl bg-[#fff7f8] px-3 py-2.5 text-xs font-semibold text-[#b33b51]">
                <AlertCircle size={14} />
                {feesError}
              </div>
            )}

            {!feesLoading && !feesError && fees.length === 0 && (
              <p className="rounded-xl bg-[#f7f8fd] px-3 py-4 text-center text-xs font-semibold text-[#7d86a8]">
                No fee collections recorded yet.
              </p>
            )}

            {!feesLoading && !feesError && fees.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="border-b border-[#edf0f7] text-[11px] uppercase tracking-wide text-[#8490b9]">
                      <th className="px-2 py-2 font-bold">Student</th>
                      <th className="px-2 py-2 font-bold">Class</th>
                      <th className="px-2 py-2 font-bold">Receipt</th>
                      <th className="px-2 py-2 font-bold">Type</th>
                      <th className="px-2 py-2 font-bold">When</th>
                      <th className="px-2 py-2 text-right font-bold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fees.map((payment) => {
                      const classId = String(payment.class ?? "");
                      const classLabel = CLASS_LABELS[classId] ?? (classId ? `Class ${classId}` : "—");
                      return (
                        <tr key={payment.id} className="border-b border-[#f2f4fb] last:border-0 hover:bg-[#fafbff]">
                          <td className="px-2 py-2.5">
                            <div className="text-sm font-bold text-[#1f2136]">{payment.studentName || "—"}</div>
                            {payment.admissionNumber && (
                              <div className="text-[11px] font-semibold text-[#8490b9]">{payment.admissionNumber}</div>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-xs font-semibold text-[#5a6488]">
                            {classLabel}
                            {payment.section ? ` · ${payment.section}` : ""}
                          </td>
                          <td className="px-2 py-2.5 text-xs font-semibold text-[#5a6488]">
                            {payment.receiptNumber || "—"}
                          </td>
                          <td className="px-2 py-2.5 text-xs font-semibold text-[#5a6488]">
                            {payment.paymentType || payment.paymentMethod || "—"}
                          </td>
                          <td className="px-2 py-2.5 text-xs font-semibold text-[#7d86a8]">
                            {formatWhen(payment.createdAt)}
                          </td>
                          <td className="px-2 py-2.5 text-right text-sm font-extrabold text-[#18765e]">
                            {formatAmount(payment.amountPaid)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
