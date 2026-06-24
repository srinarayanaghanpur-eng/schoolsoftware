import Link from "next/link";
import { ArrowLeft, BellRing, CheckCircle2, ShieldCheck } from "lucide-react";

const SCHOOL_NAME = "SRI NARAYANA HIGH SCHOOL";
const SCHOOL_LOGO_SRC = "/sri-narayana-high-school-logo.jpg";

type ForgotPasswordPageProps = {
  searchParams?: {
    loginId?: string | string[];
    requestId?: string | string[];
  };
};

function getSearchValue(value?: string | string[]) {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved?.trim() ?? "";
}

function getLoginId(searchParams?: ForgotPasswordPageProps["searchParams"]) {
  const value = getSearchValue(searchParams?.loginId);
  return value;
}

function getRequestId(searchParams?: ForgotPasswordPageProps["searchParams"]) {
  const value = getSearchValue(searchParams?.requestId);
  return value?.trim() ?? "";
}

export default function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const loginId = getLoginId(searchParams);
  const requestId = getRequestId(searchParams);
  const hasLoginId = loginId.length > 0;

  return (
    <main className="min-h-screen bg-[#f4f7f3] px-4 py-6 text-stone-950">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[980px] items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_24px_65px_rgba(35,49,40,0.14)] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#233128_0%,#14532D_55%,#047857_100%)] px-8 py-10 text-white lg:block">
            <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-white/12 blur-2xl" />
            <div className="absolute bottom-10 right-[-70px] h-64 w-64 rounded-full bg-lime-200/16 blur-2xl" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div className="school-logo-badge h-[96px] w-[96px]">
                  <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/80 bg-white p-[9%] shadow-[0_18px_38px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.95)]">
                    <img className="school-logo-image h-full w-full rounded-[24%] object-contain" src={SCHOOL_LOGO_SRC} alt={`${SCHOOL_NAME} logo`} />
                  </div>
                </div>
                <h1 className="mt-6 text-2xl font-extrabold leading-tight tracking-[-0.02em]">{SCHOOL_NAME}</h1>
              </div>
              <div className="rounded-[18px] border border-white/20 bg-white/12 p-5 backdrop-blur-md">
                <ShieldCheck className="h-8 w-8 text-emerald-100" />
                <p className="mt-4 text-lg font-extrabold leading-7">Your account stays protected while admin verifies the reset request.</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-10 lg:px-12 lg:py-14">
            <div className="mx-auto max-w-[430px]">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 shadow-[inset_0_10px_28px_rgba(4,120,87,0.08)]">
                <CheckCircle2 className="h-11 w-11" strokeWidth={2.4} />
              </div>

              <div className="mt-7 text-center">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-700">Forgot password</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-stone-950">
                  {hasLoginId ? "Request sent to admin" : "Login ID required"}
                </h2>
                <p className="mt-4 text-base font-medium leading-7 text-stone-600">
                  {hasLoginId
                    ? "Your password request has been sent to the admin. The admin will notify you after checking your account and resetting your password."
                    : "Please go back to login and enter your Employee ID or Admin ID before requesting password help."}
                </p>
              </div>

              <div className="mt-7 rounded-[18px] border border-emerald-100 bg-emerald-50/80 px-5 py-4">
                <div className="flex gap-3">
                  <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <p className="text-sm font-semibold leading-6 text-emerald-900">
                    {hasLoginId
                      ? `${requestId ? `Request ID: ${requestId}. ` : ""}Login ID: ${loginId}. Please wait for the admin notification before trying to sign in again.`
                      : "The request will only be sent after a login ID is entered."}
                  </p>
                </div>
              </div>

              <Link
                href="/login"
                className="mt-8 flex h-[52px] w-full items-center justify-center gap-3 rounded-[15px] bg-[linear-gradient(100deg,#233128_0%,#047857_100%)] px-5 text-base font-extrabold text-white shadow-[0_16px_32px_rgba(4,120,87,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(4,120,87,0.34)]"
              >
                <ArrowLeft className="h-5 w-5" />
                Back to login
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
