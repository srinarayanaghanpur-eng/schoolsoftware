"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SCHOOL_CONTACT } from "@sri-narayana/shared";
import StudentDetailsReveal, { type StudentDetailsView } from "./StudentDetailsReveal";

const SCHOOL_NAME = SCHOOL_CONTACT.name;
const SCHOOL_LOGO_SRC = "/sri-narayana-high-school-logo.jpg";
const SCHOOL_ADDRESS = SCHOOL_CONTACT.address;
const SCHOOL_MOBILE = SCHOOL_CONTACT.phone;

type RevealState = {
  status: "loading" | "error" | "ready";
  message: string;
  details: StudentDetailsView | null;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "--";
}

/**
 * The URL carries only an opaque token (?t=...). The student details are
 * resolved server-side by GET /api/student-qr/[token] — nothing readable is
 * encoded in the link, so a leaked URL or screenshot exposes nothing.
 */
function QrDetails() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t");
  const [state, setState] = useState<RevealState>({ status: "loading", message: "", details: null });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "Invalid QR code", details: null });
      return;
    }

    let cancelled = false;
    fetch(`/api/student-qr/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          details?: Record<string, unknown>;
        } | null;
        if (cancelled) return;
        if (!res.ok || !body?.ok || !body.details) {
          setState({
            status: "error",
            message: typeof body?.error === "string" ? body.error : "Invalid QR code",
            details: null
          });
          return;
        }
        const d = body.details;
        setState({
          status: "ready",
          message: "",
          details: {
            name: text(d.name),
            fatherName: text(d.fatherName),
            motherName: text(d.motherName),
            phone: text(d.phone),
            address: text(d.address)
          }
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Invalid QR code", details: null });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === "loading") {
    return (
      <div className="px-5 py-8 text-center text-sm font-semibold text-[#7d86a8]">Loading…</div>
    );
  }

  if (state.status !== "ready" || !state.details) {
    return (
      <div className="px-5 py-8 text-center">
        <h2 className="text-lg font-extrabold">Invalid QR code</h2>
        <p className="mt-2 text-sm font-medium text-[#7d86a8]">{state.message}</p>
      </div>
    );
  }

  return <StudentDetailsReveal details={state.details} />;
}

export default function StudentQrPage() {
  return (
    <main className="min-h-screen bg-[#f4f6ff] px-4 py-8 text-[#1b1d32]">
      <section className="mx-auto max-w-md overflow-hidden rounded-2xl border border-[#e2e6f4] bg-white shadow-[0_18px_48px_rgba(36,42,94,0.12)]">
        <div className="border-b border-[#edf0f7] bg-[#3033a1] px-5 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1 shadow-lg shadow-black/10">
              <img
                src={SCHOOL_LOGO_SRC}
                alt={SCHOOL_NAME}
                className="h-full w-full object-cover"
              />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold uppercase tracking-[0.14em] leading-tight">
                {SCHOOL_NAME}
              </p>
              <p className="mt-1 text-[11px] font-medium leading-snug text-white/80">
                {SCHOOL_ADDRESS}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/80">
                Mobile: {SCHOOL_MOBILE}
              </p>
            </div>
          </div>
          <h1 className="mt-4 text-xl font-extrabold">Student Details</h1>
        </div>

        <Suspense
          fallback={
            <div className="px-5 py-8 text-center text-sm font-semibold text-[#7d86a8]">
              Loading…
            </div>
          }
        >
          <QrDetails />
        </Suspense>
      </section>
    </main>
  );
}
