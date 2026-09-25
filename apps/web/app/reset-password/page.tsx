"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck, TriangleAlert } from "lucide-react";
import { auth, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import {
  verifyPasswordResetCode,
  confirmPasswordReset
} from "firebase/auth";

const PRODUCT_NAME = "NarayanaOS";
const SCHOOL_DISPLAY_NAME = "Sri Narayana High School";
const FOOTER_LINE = "© 2026 Sri Narayana High School · Powered by NarayanaOS";

type Phase = "checking" | "ready" | "done" | "badlink";

function safeAuthError(code: string): string {
  switch (code) {
    case "auth/expired-action-code":
      return "This reset link has expired. Please ask the admin for a fresh link.";
    case "auth/invalid-action-code":
      return "This reset link is invalid or has already been used. Please ask the admin for a fresh link.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact the school office.";
    case "auth/user-not-found":
      return "This reset link is no longer valid. Please ask the admin for a fresh link.";
    case "auth/weak-password":
      return "Please choose a stronger password (at least 8 characters, mix of letters and numbers).";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Network problem. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again or ask the admin for a fresh link.";
  }
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const oobCode = searchParams?.get("oobCode") ?? "";
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setPhase("badlink");
      return;
    }
    if (!isFirebaseConfigured) {
      setPhase("badlink");
      setError("Password reset is not available right now. Please contact the school office.");
      return;
    }
    let cancelled = false;
    verifyPasswordResetCode(auth, oobCode)
      .then(() => {
        if (!cancelled) setPhase("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const code = typeof e === "object" && e && "code" in e ? String((e as { code?: unknown }).code) : "";
        setError(safeAuthError(code));
        setPhase("badlink");
      });
    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      // Never persist the password anywhere — clear it from memory + inputs.
      setPassword("");
      setConfirm("");
      setPhase("done");
    } catch (e: unknown) {
      const code = typeof e === "object" && e && "code" in e ? String((e as { code?: unknown }).code) : "";
      setError(safeAuthError(code));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f3f6fc] px-4 py-6 text-stone-950 dark:bg-[#0f1117] dark:text-[#e2e4ec]">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[980px] items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_24px_65px_rgba(35,49,40,0.14)] dark:border-white/10 dark:bg-[#1a1c26] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#1b2350_0%,#1e3a8a_55%,#2563eb_100%)] px-8 py-10 text-white lg:block">
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-[-0.02em]">{PRODUCT_NAME}</h1>
                <p className="mt-1 text-sm font-semibold text-blue-100">{SCHOOL_DISPLAY_NAME}</p>
                <p className="mt-1 text-xs font-bold tracking-[0.08em] text-blue-200">Authorized Access Only</p>
              </div>
              <div className="rounded-[18px] border border-white/20 bg-white/12 p-5 backdrop-blur-md">
                <ShieldCheck className="h-8 w-8 text-blue-100" />
                <p className="mt-4 text-lg font-extrabold leading-7">Set a new password to regain access to your account.</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-10 lg:px-12 lg:py-14">
            <div className="mx-auto max-w-[430px]">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15">
                {phase === "done" ? (
                  <CheckCircle2 className="h-11 w-11" strokeWidth={2.4} />
                ) : (
                  <KeyRound className="h-11 w-11" strokeWidth={2.2} />
                )}
              </div>

              <div className="mt-7 text-center">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Reset Password</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em]">
                  {phase === "done" ? "Password reset!" : "Choose a new password"}
                </h2>
              </div>

              {phase === "checking" && (
                <p className="mt-6 text-center text-sm font-semibold text-stone-500 dark:text-stone-300">
                  Verifying your secure reset link…
                </p>
              )}

              {phase === "badlink" && (
                <div className="mt-6 rounded-[18px] border border-[#ffd5da] bg-[#ffebed] px-5 py-4 dark:border-red-500/30 dark:bg-red-500/10">
                  <div className="flex gap-3">
                    <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300" />
                    <p className="text-sm font-semibold leading-6 text-red-800 dark:text-red-100">
                      {error ?? "This reset link is invalid or has expired."}
                    </p>
                  </div>
                </div>
              )}

              {phase === "ready" && (
                <form onSubmit={submit} className="mt-6 space-y-3">
                  {[
                    { label: "New Password", value: password, set: setPassword },
                    { label: "Confirm New Password", value: confirm, set: setConfirm }
                  ].map((f) => (
                    <label key={f.label} className="block">
                      <span className="text-sm font-bold">{f.label}</span>
                      <span className="relative mt-1 block">
                        <input
                          type={showPw ? "text" : "password"}
                          required
                          minLength={8}
                          autoComplete="new-password"
                          value={f.value}
                          onChange={(e) => f.set(e.target.value)}
                          placeholder="Minimum 8 characters"
                          className="field w-full pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((v) => !v)}
                          aria-label={showPw ? "Hide passwords" : "Show passwords"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-stone-500 hover:text-stone-800 dark:text-stone-300"
                        >
                          {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </span>
                    </label>
                  ))}
                  {error && (
                    <p role="alert" className="rounded-xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
                      {error}
                    </p>
                  )}
                  <button type="submit" disabled={saving} className="btn-primary h-[52px] w-full text-base disabled:opacity-60">
                    {saving ? "Resetting…" : "Reset Password"}
                  </button>
                </form>
              )}

              {phase === "done" && (
                <div className="mt-6 rounded-[18px] border border-[#c8f0dc] bg-[#e6f8ef] px-5 py-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <p className="text-sm font-semibold leading-6 text-emerald-900 dark:text-emerald-100">
                    Your password has been reset successfully.
                  </p>
                </div>
              )}

              <Link
                href="/login"
                className="mt-8 flex h-[52px] w-full items-center justify-center gap-3 rounded-[15px] border border-stone-300 px-5 text-base font-extrabold text-stone-800 transition hover:bg-stone-100 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
                {phase === "done" ? "Go to Login" : "Back to login"}
              </Link>
              <p className="mt-5 text-center text-xs font-medium text-stone-500 dark:text-stone-400">{FOOTER_LINE}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
