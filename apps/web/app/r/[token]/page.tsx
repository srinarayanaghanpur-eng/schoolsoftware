import type { Metadata } from "next";
import { headers } from "next/headers";
import { getPublicReceiptByShareToken, isReceiptShareToken, schoolReceiptHeader } from "@/lib/receiptService";
import { checkRateLimit } from "@/lib/quota/rateLimiter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Fee Receipt",
  description: "Read-only fee receipt shared by Sri Narayana High School.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true
  }
};

const SCHOOL = schoolReceiptHeader();
const LOGO_SRC = "/sri-narayana-high-school-logo.jpg";

function formatINR(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  });
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#e2e6f4] bg-[#fafbff] px-3 py-2">
      <dt className="text-[10px] font-extrabold uppercase tracking-wide text-[#7d86a8]">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-bold text-[#1b1d32]">{value || "—"}</dd>
    </div>
  );
}

function SchoolHeader({ receiptNo, status }: { receiptNo?: string; status?: string }) {
  return (
    <header className="bg-[#3033a1] px-5 py-5 text-white">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1 shadow-lg shadow-black/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt={SCHOOL.schoolName} className="h-full w-full object-cover" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold uppercase leading-tight tracking-[0.12em]">{SCHOOL.schoolName}</p>
          <p className="mt-1 text-[11px] font-medium leading-snug text-white/80">{SCHOOL.address}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-white/80">Phone: {SCHOOL.phone}</p>
        </div>
      </div>
      {receiptNo ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/70">Fee Receipt</p>
            <h1 className="mt-0.5 break-words text-xl font-extrabold">{receiptNo}</h1>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide">
            {status || "Issued"}
          </span>
        </div>
      ) : null}
    </header>
  );
}

export default async function PublicReceiptPage({ params }: { params: { token: string } }) {
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = await checkRateLimit({
    key: `public_receipt_page:${ip}`,
    maxRequests: 120,
    windowMinutes: 1
  });
  const receipt = limit.allowed && isReceiptShareToken(params.token)
    ? await getPublicReceiptByShareToken(params.token).catch((error) => {
        console.error("[public-receipt] lookup failed:", error);
        return null;
      })
    : null;

  if (!receipt) {
    return (
      <main className="min-h-screen bg-[#f4f6ff] px-4 py-8 text-[#1b1d32]">
        <section className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-[#e2e6f4] bg-white shadow-[0_18px_48px_rgba(36,42,94,0.12)]">
          <SchoolHeader />
          <div className="px-6 py-10 text-center">
            <h1 className="text-lg font-extrabold">Receipt unavailable</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm font-medium text-[#7d86a8]">
              This receipt link is invalid or has expired. Please contact the school office for a new link.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const classSection = [receipt.className, receipt.section].filter(Boolean).join(" / ") || "—";

  return (
    <main className="min-h-screen bg-[#f4f6ff] px-4 py-6 text-[#1b1d32] sm:py-10">
      <section className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-[#e2e6f4] bg-white shadow-[0_18px_48px_rgba(36,42,94,0.12)]">
        <SchoolHeader receiptNo={receipt.receiptNo} status={receipt.status} />

        <div className="space-y-5 px-5 py-6">
          <div className="rounded-xl border border-[#cfd6ff] bg-[#f5f7ff] px-4 py-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#7d86a8]">Amount Paid</p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#0f8d52]">{formatINR(receipt.totalPaid)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#7d86a8]">Balance Due</p>
                <p className="mt-1 text-base font-extrabold tabular-nums">{formatINR(receipt.balanceDue)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs font-semibold text-[#7d86a8]">
              Payment date: {formatDate(receipt.paymentDate)} · Mode: {receipt.paymentMode || "—"}
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Detail label="Student Name" value={receipt.studentName} />
            <Detail label="Admission No." value={receipt.admissionNo} />
            <Detail label="Class / Section" value={classSection} />
            <Detail label="Payment Mode" value={receipt.paymentMode} />
          </dl>

          <div>
            <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#7d86a8]">Fee Items</h2>
            <div className="overflow-hidden rounded-xl border border-[#e2e6f4]">
              {receipt.feeItems.length === 0 ? (
                <p className="px-4 py-4 text-sm font-medium text-[#7d86a8]">No itemised fee heads on this receipt.</p>
              ) : (
                receipt.feeItems.map((item, index) => (
                  <div
                    key={`${item.type}-${index}`}
                    className={`grid grid-cols-[1fr_auto] items-start gap-3 px-4 py-3 ${index > 0 ? "border-t border-[#edf0f7]" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold">{item.type}</p>
                      {[item.periodOrMonth, item.remarks].filter(Boolean).length > 0 ? (
                        <p className="mt-0.5 break-words text-xs font-medium text-[#7d86a8]">
                          {[item.periodOrMonth, item.remarks].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <p className="whitespace-nowrap text-sm font-extrabold tabular-nums">
                      {item.amount > 0 ? formatINR(item.amount) : "—"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <footer className="border-t border-[#edf0f7] pt-4 text-center">
            <p className="text-[11px] font-semibold text-[#7d86a8]">Computer-generated receipt · Powered by NarayanaOS</p>
            <p className="mt-1 text-[11px] font-medium text-[#9aa2bd]">
              This is a read-only receipt shared by the school. No login is required.
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}
