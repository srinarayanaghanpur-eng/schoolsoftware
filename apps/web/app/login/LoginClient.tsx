"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { isValidRole } from "@sri-narayana/shared";
import { refreshClaims } from "@/lib/authClaims";
import { employeeIdToInternalEmail, normalizeEmployeeId } from "@sri-narayana/shared/utils/employeeAuth";
import type { UserRole } from "@sri-narayana/shared/types/models";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarCheck,
  Check,
  Clock3,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards
} from "lucide-react";

const SCHOOL_NAME = "SRI NARAYANA HIGH SCHOOL";
const SCHOOL_LOGO_SRC = "/sri-narayana-high-school-logo.jpg";

type LoginIdCheckStatus = "empty" | "checking" | "matched" | "unknown";

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const featureCards: Feature[] = [
  {
    title: "Attendance Tracking",
    description: "Track teacher and staff attendance easily",
    icon: CalendarCheck
  },
  {
    title: "Salary Management",
    description: "Manage salaries and payroll seamlessly",
    icon: WalletCards
  },
  {
    title: "Staff Dashboard",
    description: "Insights and reports at your fingertips",
    icon: BarChart3
  },
  {
    title: "Secure & Reliable",
    description: "Your data is safe and fully protected",
    icon: ShieldCheck
  }
];

async function signInAndResolveRole(loginId: string, password: string, rememberMe: boolean) {
  const [{ browserLocalPersistence, browserSessionPersistence, setPersistence, signInWithEmailAndPassword, signOut }, { doc, getDoc }, firebaseClient] =
    await Promise.all([
      import("firebase/auth"),
      import("firebase/firestore"),
      import("@sri-narayana/shared/firebase/client")
    ]);
  const { auth, db, isFirebaseConfigured } = firebaseClient;

  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured yet. Add Firebase environment values to enable login.");
  }

  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
  const credential = await signInWithEmailAndPassword(auth, employeeIdToInternalEmail(loginId), password);
  const uid = credential.user.uid;
  // Force a token refresh so a recently-changed role (updated custom claims)
  // is picked up immediately instead of using a stale cached token.
  const claims = await refreshClaims(auth.currentUser);
  const tokenRole = claims?.role as UserRole | undefined;
  const userSnapshot = await getDoc(doc(db, "users", uid));
  const userData = userSnapshot.exists() ? (userSnapshot.data() as { role?: UserRole; status?: string }) : undefined;
  const role = tokenRole ?? userData?.role;

  if (!isValidRole(role)) {
    await signOut(auth);
    throw new Error("Your login role is missing. Please contact admin.");
  }

  if (userData?.status && userData.status !== "active") {
    await signOut(auth);
    throw new Error("Your login is inactive. Please contact admin.");
  }

  return role;
}

function getLoginErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
    return "Employee ID or password is incorrect. Please check the login details.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many failed attempts. Please wait a moment, then try again.";
  }
  return error instanceof Error ? error.message : "Login failed";
}

function getLoginIdCheckStatus(loginId: string) {
  const normalizedLoginId = normalizeEmployeeId(loginId);
  if (!normalizedLoginId) return "empty";
  // Real existence is always confirmed against the DB via /api/login-id/check.
  return "checking";
}

function LoginIdMatchIndicator({ status }: { status: LoginIdCheckStatus }) {
  if (status === "matched") {
    return <Check className="h-6 w-6 text-[#3033a1]" strokeWidth={3} aria-label="Login ID found" />;
  }

  if (status === "checking") {
    return (
      <span
        className="block h-5 w-5 animate-spin rounded-full border-2 border-[#c7caf0] border-t-[#3033a1]"
        aria-label="Checking login ID"
      />
    );
  }

  return null;
}

function SchoolLogo({ className = "", id }: { className?: string; id: string }) {
  return (
    <div className={`school-logo-badge ${className}`} data-logo-id={id}>
      <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/80 bg-white p-[9%] shadow-[0_18px_38px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.95)]">
        <img className="school-logo-image h-full w-full rounded-[24%] object-contain" src={SCHOOL_LOGO_SRC} alt={`${SCHOOL_NAME} logo`} />
      </div>
    </div>
  );
}

function MobileWave() {
  return (
    <svg className="absolute -bottom-px left-0 h-[82px] w-full" viewBox="0 0 390 82" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 30C42 2 88 6 142 24c69 23 129 35 191 15 25-8 43-20 57-37v80H0V30Z" fill="white" />
    </svg>
  );
}

function FloatingBlob({ className }: { className: string }) {
  return <div className={`pointer-events-none absolute rounded-full blur-2xl ${className}`} aria-hidden="true" />;
}

function DesktopIllustration() {
  return (
    <div className="relative mx-auto h-full min-h-[190px] w-full max-w-[500px] overflow-hidden">
      <div className="absolute right-7 top-12 h-24 w-24 rounded-full bg-white/8" />
      <div className="absolute left-7 bottom-5 h-28 w-28 rounded-full bg-[#4748a9]/10 blur-xl" />

      <div className="relative z-10 grid h-full grid-cols-[96px_minmax(210px,1fr)_82px] items-center gap-3 px-4 py-3">
        <div className="flex h-full flex-col justify-center gap-4">
          <div className="flex h-[58px] w-[58px] items-center justify-center rounded-[13px] bg-white/90 text-[#3033a1] shadow-[0_16px_30px_rgba(15,23,42,0.18)]">
            <CalendarCheck className="h-8 w-8" />
          </div>
          <div className="flex items-end gap-3">
            <div className="relative h-[66px] w-[48px] shrink-0">
              <span className="absolute bottom-0 left-4 h-14 w-3 rounded-full bg-[#6f78c4]/80" />
              <span className="absolute left-0 top-2 h-11 w-6 rotate-[-34deg] rounded-full bg-[#c5ceff]/80" />
              <span className="absolute right-0 top-0 h-12 w-6 rotate-[35deg] rounded-full bg-[#eef0ff]/75" />
              <span className="absolute bottom-0 left-2 h-5 w-10 rounded-t-full bg-white/80 shadow-[0_8px_16px_rgba(15,23,42,0.16)]" />
            </div>
            <div className="space-y-2 pb-1">
              <span className="block h-4 w-[72px] rounded-full bg-white/90 shadow-[0_8px_16px_rgba(15,23,42,0.13)]" />
              <span className="block h-4 w-[60px] rounded-full bg-white/82 shadow-[0_8px_16px_rgba(15,23,42,0.12)]" />
              <span className="block h-4 w-[78px] rounded-full bg-white/88 shadow-[0_8px_16px_rgba(15,23,42,0.12)]" />
            </div>
          </div>
        </div>

        <div className="relative flex h-full min-w-0 flex-col items-center justify-center pt-6">
          <div className="absolute top-0 flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white/88 text-[#3033a1] shadow-[0_16px_30px_rgba(15,23,42,0.18)]">
            <Clock3 className="h-6 w-6" />
          </div>
          <div className="w-full max-w-[254px] rounded-[18px] bg-white/24 p-2 shadow-[0_24px_48px_rgba(9,30,86,0.28)] ring-1 ring-white/22 backdrop-blur-sm">
            <div className="rounded-[14px] border border-white/65 bg-white/92 p-3">
              <div className="grid h-[108px] grid-cols-[58px_1fr_72px] gap-3">
                <div className="rounded-[10px] bg-[#eef0ff] p-2">
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#292b8d,#4748a9)] text-white">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="mt-4 h-1.5 w-10 rounded-full bg-[#c5ceff]" />
                  <div className="mt-2 h-1.5 w-8 rounded-full bg-[#c5ceff]" />
                  <div className="mt-2 h-1.5 w-11 rounded-full bg-[#c5ceff]" />
                </div>
                <div>
                  <div className="h-2.5 w-20 rounded-full bg-[#c5ceff]" />
                  <div className="mt-3 flex h-11 items-end gap-1.5">
                    <span className="h-5 w-2.5 rounded-t bg-[#6f78c4]" />
                    <span className="h-8 w-2.5 rounded-t bg-[#3033a1]" />
                    <span className="h-6 w-2.5 rounded-t bg-[#9ba9ed]" />
                    <span className="h-10 w-2.5 rounded-t bg-[#292b8d]" />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="block h-9 w-9 rounded-full border-[8px] border-[#c5ceff] border-r-[#3033a1]" />
                    <span className="space-y-1.5">
                      <span className="block h-1.5 w-12 rounded-full bg-[#eef0ff]" />
                      <span className="block h-1.5 w-10 rounded-full bg-[#eef0ff]" />
                    </span>
                  </div>
                </div>
                <div className="pt-2">
                  <div className="h-2.5 w-9 rounded-full bg-[#6f78c4]" />
                  <div className="mt-3 h-1.5 w-14 rounded-full bg-[#c5ceff]" />
                  <div className="mt-3 h-1.5 w-12 rounded-full bg-[#c5ceff]" />
                  <div className="mt-4 h-1.5 w-16 rounded-full bg-[#c5ceff]" />
                  <div className="mt-3 h-1.5 w-14 rounded-full bg-[#c5ceff]" />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-2 h-4 w-[250px] max-w-full rounded-full bg-white/80 shadow-[0_10px_18px_rgba(15,23,42,0.12)]" />
          <div className="mt-1.5 h-3.5 w-[210px] max-w-[86%] rounded-full bg-white/70 shadow-[0_10px_18px_rgba(15,23,42,0.1)]" />
        </div>

        <div className="flex h-full items-center justify-center">
          <div className="flex h-[58px] w-[58px] items-center justify-center rounded-[13px] bg-white/14 text-white shadow-[0_16px_30px_rgba(15,23,42,0.14)] ring-1 ring-white/20 backdrop-blur-md">
            <UserRound className="h-8 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopFeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;

  return (
    <div className="group h-[112px] overflow-hidden rounded-[14px] border border-white/35 bg-white/[0.92] px-2.5 py-2.5 text-center text-stone-900 shadow-[0_12px_24px_rgba(8,20,70,0.13)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-white">
      <div className="mx-auto flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#292b8d,#4748a9)] text-white shadow-[0_10px_20px_rgba(48,51,161,0.26)]">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-2 text-[11px] font-extrabold leading-tight tracking-[-0.02em]">{feature.title}</h3>
      <p className="mt-1 text-[9px] font-medium leading-[12px] text-stone-600">{feature.description}</p>
    </div>
  );
}

function LeftBrandPanel() {
  return (
    <aside className="relative hidden w-[45%] overflow-hidden bg-[linear-gradient(135deg,#292b8d_0%,#3033a1_52%,#4748a9_100%)] px-6 py-4 text-white lg:block xl:px-8">
      <FloatingBlob className="-left-14 top-8 h-56 w-56 bg-white/16 animate-float-slow" />
      <FloatingBlob className="bottom-14 right-20 h-36 w-36 bg-[#c5ceff]/20 animate-float-medium" />
      <FloatingBlob className="bottom-52 left-10 h-48 w-48 bg-[#9ba9ed]/18 animate-float-medium" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(255,255,255,0.14),transparent_22%),radial-gradient(circle_at_74%_92%,rgba(255,255,255,0.16),transparent_18%)]" />
      <svg className="absolute -right-[126px] top-0 h-full w-[252px] text-[#F8FAFF]" viewBox="0 0 252 900" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M252 0H122C43 63 31 151 69 259c35 98 40 170-6 255-53 98-40 188 39 272 28 29 37 67 24 114h126V0Z"
          fill="currentColor"
        />
      </svg>
      <div className="relative z-10 grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-3">
        <div className="text-center">
          <SchoolLogo id="school-logo-desktop" className="mx-auto h-[86px] w-[86px] xl:h-[96px] xl:w-[96px]" />
          <h1 className="mt-2 text-[20px] font-extrabold leading-tight tracking-[-0.035em] drop-shadow-sm xl:text-[22px]">{SCHOOL_NAME}</h1>
          <div className="mx-auto mt-2.5 h-0.5 w-10 rounded-full bg-[#ffd23f]/70" />
        </div>
        <div className="min-h-0 py-1">
          <DesktopIllustration />
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {featureCards.map((feature) => (
            <DesktopFeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </aside>
  );
}

function DotGrid({ className }: { className: string }) {
  return (
    <div
      className={`absolute grid grid-cols-6 gap-3 ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: 36 }).map((_, index) => (
        <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#c5ceff]/70" />
      ))}
    </div>
  );
}

function DesktopInput({
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = "text",
  autoCapitalize,
  autoComplete,
  valid,
  right
}: {
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  autoCapitalize?: string;
  autoComplete?: string;
  valid?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <label className="group relative block">
      <Icon className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500 transition group-focus-within:text-[#3033a1]" />
      <input
        className={`h-[52px] w-full rounded-[14px] border bg-white/85 pl-[54px] pr-[52px] text-[16px] font-semibold text-stone-950 shadow-[0_10px_24px_rgba(15,23,42,0.04)] outline-none transition duration-300 placeholder:text-stone-400 focus:border-[#3033a1] focus:bg-white focus:shadow-[0_16px_32px_rgba(48,51,161,0.12)] focus:ring-4 focus:ring-[#3033a1]/10 ${
          valid ? "border-[#6f78c4]" : "border-stone-300"
        }`}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        required
      />
      <div className="absolute right-4 top-1/2 -translate-y-1/2">{right ?? (valid ? <Check className="h-6 w-6 text-[#3033a1]" strokeWidth={3} /> : null)}</div>
    </label>
  );
}

function useTeacherLoginController() {
  const [loginId, setLoginId] = useState("");
  const [loginIdCheckStatus, setLoginIdCheckStatus] = useState<LoginIdCheckStatus>("empty");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [inactiveReason, setInactiveReason] = useState(false);
  const router = useRouter();
  const setUppercaseLoginId = (value: string) => {
    setLoginId(value.toUpperCase());
  };

  // Warm up the destination route bundles + Firebase modules while the user
  // is still typing so navigation after login feels instant.
  useEffect(() => {
    setInactiveReason(new URLSearchParams(window.location.search).get("reason") === "inactive");
    router.prefetch("/admin/dashboard");
    router.prefetch("/portal");
    router.prefetch("/teacher");
    void import("firebase/auth");
    void import("firebase/firestore");
    void import("@sri-narayana/shared/firebase/client");
  }, [router]);

  useEffect(() => {
    const normalizedLoginId = normalizeEmployeeId(loginId);
    const localStatus = getLoginIdCheckStatus(normalizedLoginId);
    setLoginIdCheckStatus(localStatus);

    if (localStatus !== "checking") return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch(`/api/login-id/check?loginId=${encodeURIComponent(normalizedLoginId)}`, {
        signal: controller.signal
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Unable to check login ID");
          }
          try {
            return await response.json();
          } catch (parseError) {
            throw new Error("Failed to parse login check response");
          }
        })
        .then((result: { exists?: boolean }) => {
          setLoginIdCheckStatus(result.exists ? "matched" : "unknown");
        })
        .catch((error) => {
          if ((error as Error).name !== "AbortError") {
            setLoginIdCheckStatus("unknown");
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loginId]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setLoading(true);
    setError(null);
    try {
      const role = await signInAndResolveRole(loginId, password, rememberMe);
      // Store a short-lived hint so the destination's AuthGate can render
      // instantly instead of re-running the token/Firestore checks first.
      try {
        window.sessionStorage.setItem("erp-auth-role", JSON.stringify({ role, at: Date.now() }));
      } catch {
        // sessionStorage may be unavailable; navigation still works.
      }
      if (role === "teacher") {
        router.replace("/teacher");
      } else if (role === "parent" || role === "student") {
        router.replace("/portal");
      } else {
        router.replace("/admin/dashboard");
      }
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async () => {
    const trimmedLoginId = loginId.trim();
    if (!trimmedLoginId) {
      setError("Please enter your Employee ID or Admin ID first.");
      return;
    }

    setForgotLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/password-reset-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId: trimmedLoginId })
      });
      const result = await response.json();
      if (!response.ok || result.ok === false) {
        throw new Error(result.error ?? "Unable to send password request");
      }
      const params = new URLSearchParams({ loginId: trimmedLoginId });
      if (typeof result.requestId === "string") {
        params.set("requestId", result.requestId);
      }
      router.push(`/forgot-password?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send password request");
    } finally {
      setForgotLoading(false);
    }
  };

  return {
    loginId,
    setLoginId: setUppercaseLoginId,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    showPassword,
    setShowPassword,
    error,
    loading,
    forgotLoading,
    loginIdCheckStatus,
    inactiveReason,
    onSubmit,
    onForgotPassword
  };
}

function DesktopLoginExperience() {
  const {
    loginId,
    setLoginId,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    showPassword,
    setShowPassword,
    error,
    loading,
    forgotLoading,
    loginIdCheckStatus,
    inactiveReason,
    onSubmit,
    onForgotPassword
  } = useTeacherLoginController();

  return (
    <section className="relative flex h-screen items-center justify-center overflow-hidden bg-[#f5f6fd] p-2">
      <FloatingBlob className="left-[-90px] top-[-120px] h-80 w-80 bg-[#eef0ff]/90" />
      <FloatingBlob className="bottom-[-120px] right-[-80px] h-96 w-96 bg-[#c5ceff]/70" />
      <div className="relative flex h-[calc(100vh-1rem)] max-h-[820px] min-h-0 w-full max-w-[1280px] overflow-hidden rounded-[24px] bg-white shadow-[0_24px_65px_rgba(36,42,94,0.16)] ring-1 ring-stone-200">
        <LeftBrandPanel />
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#f8f8fc] px-5 py-8 sm:px-8 lg:w-[55%]">
          <DotGrid className="right-8 top-8" />
          <DotGrid className="bottom-10 right-12" />
          <div className="absolute left-[8%] top-[16%] h-52 w-52 rounded-full bg-[#eef0ff]/80 blur-3xl" />
          <div className="absolute bottom-[18%] right-[18%] h-44 w-44 rounded-full bg-[#c5ceff]/70 blur-3xl" />
          <form
            onSubmit={onSubmit}
            className="relative z-10 w-full max-w-[460px] rounded-[24px] border border-stone-200 bg-white/90 px-7 py-6 shadow-[0_22px_65px_rgba(36,42,94,0.12)] backdrop-blur-2xl"
          >
            <div className="text-center">
              <div className="mx-auto flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[linear-gradient(145deg,#eef0ff,#f8f8fc)] shadow-[inset_0_10px_28px_rgba(48,51,161,0.1)]">
                <UsersRound className="h-8 w-8 text-[#3033a1]" strokeWidth={2.4} />
              </div>
              <h2 className="mt-3 text-[27px] font-extrabold tracking-[-0.035em] text-stone-950">Welcome back!</h2>
              <p className="mt-1 text-[15px] font-medium text-stone-500">Use your ID and password. We will open the correct dashboard automatically.</p>
            </div>
            <div className="mt-6 space-y-3">
              <DesktopInput
                icon={UserRound}
                value={loginId}
                onChange={setLoginId}
                placeholder="Employee ID / Admin ID"
                autoCapitalize="characters"
                autoComplete="username"
                valid={loginIdCheckStatus === "matched"}
                right={<LoginIdMatchIndicator status={loginIdCheckStatus} />}
              />
              <DesktopInput
                icon={LockKeyhole}
                value={password}
                onChange={setPassword}
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                right={
                  <button type="button" className="rounded-full p-1 text-stone-500 transition hover:bg-[#eef0ff] hover:text-[#3033a1]" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                }
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              <label className="flex cursor-pointer items-center gap-3 text-[15px] font-medium text-stone-600">
                <input className="peer sr-only" type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                <span className="flex h-5 w-5 items-center justify-center rounded-[6px] border border-[#c7caf0] bg-white text-white shadow-[0_6px_14px_rgba(48,51,161,0.14)] transition peer-checked:border-transparent peer-checked:bg-[linear-gradient(135deg,#292b8d,#4748a9)]">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                Remember me
              </label>
              <button type="button" className="text-[15px] font-semibold text-[#3033a1] transition hover:text-[#20226f] disabled:opacity-60" onClick={onForgotPassword} disabled={forgotLoading}>
                {forgotLoading ? "Sending..." : "Forgot password?"}
              </button>
            </div>
            {(inactiveReason || error) && (
              <div className="mt-5 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error ?? "Your teacher login is inactive. Please contact admin."}
              </div>
            )}
            <button
              disabled={loading}
              className="group mt-5 flex h-[54px] w-full items-center justify-center gap-3 rounded-[15px] bg-[linear-gradient(100deg,#292b8d_0%,#4748a9_100%)] text-[17px] font-extrabold text-white shadow-[0_16px_32px_rgba(48,51,161,0.3)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(48,51,161,0.34)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn className="h-6 w-6 transition group-hover:translate-x-0.5" />
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function MobileLoginInput({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoCapitalize,
  autoComplete,
  valid,
  right
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  autoCapitalize?: string;
  autoComplete?: string;
  valid?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <div
        className={`mt-2 flex h-14 items-center rounded-2xl border bg-white px-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)] transition focus-within:border-[#3033a1] focus-within:ring-4 focus-within:ring-[#3033a1]/10 ${
          valid ? "border-[#6f78c4]" : "border-stone-200"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0 text-slate-500" />
        <input
          className="h-full min-w-0 flex-1 bg-transparent pl-3 pr-2 text-base font-semibold text-slate-950 outline-none placeholder:text-slate-400"
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          required
        />
        {right}
      </div>
    </label>
  );
}

function MobileLoginExperience() {
  const {
    loginId,
    setLoginId,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    showPassword,
    setShowPassword,
    error,
    loading,
    forgotLoading,
    loginIdCheckStatus,
    inactiveReason,
    onSubmit,
    onForgotPassword
  } = useTeacherLoginController();

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#f5f6fd] px-4 py-5 text-stone-950">
      <div className="absolute inset-x-0 top-0 h-[318px] overflow-hidden bg-[linear-gradient(135deg,#292b8d_0%,#3033a1_55%,#4748a9_100%)]">
        <div className="absolute -left-16 -top-14 h-44 w-44 rounded-full bg-white/12" />
        <div className="absolute right-[-50px] top-20 h-36 w-36 rounded-full bg-[#c5ceff]/24 blur-2xl" />
        <div className="absolute left-16 top-24 h-52 w-52 rounded-full bg-[#9ba9ed]/18 blur-2xl" />
        <MobileWave />
      </div>

      <div className="relative z-10 mx-auto flex h-screen w-full max-w-[358px] flex-col overflow-hidden">
        <header className="shrink-0 pt-4 text-center text-white">
          <SchoolLogo id="school-logo-mobile-login" className="mx-auto h-[90px] w-[90px]" />
          <h1 className="mt-3 text-[18px] font-extrabold leading-tight tracking-[-0.03em]">{SCHOOL_NAME}</h1>
          <p className="text-xs font-semibold text-white/90">ERP</p>
        </header>

        <form
          onSubmit={onSubmit}
          className="mt-4 w-full flex-1 overflow-y-auto rounded-[28px] border border-white/80 bg-white px-4 py-4 shadow-[0_26px_70px_rgba(36,42,94,0.14)]" style={{scrollbarWidth: 'thin'}}
        >
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#3033a1]">Secure Login</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.02em] text-slate-950">Welcome back!</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
              Use your ID and password.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <MobileLoginInput
              icon={UserRound}
              label="Login ID"
              value={loginId}
              onChange={setLoginId}
              placeholder="Enter employee or admin ID"
              autoCapitalize="characters"
              autoComplete="username"
              valid={loginIdCheckStatus === "matched"}
              right={<LoginIdMatchIndicator status={loginIdCheckStatus} />}
            />
            <MobileLoginInput
              icon={LockKeyhole}
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Enter password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              right={
                <button
                  type="button"
                  className="rounded-full p-1 text-stone-500 transition hover:bg-[#eef0ff] hover:text-[#3033a1]"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              }
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
              <input className="peer sr-only" type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
              <span className="flex h-4 w-4 items-center justify-center rounded-md border border-[#c7caf0] bg-white text-white transition peer-checked:border-transparent peer-checked:bg-[#3033a1]">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              Remember
            </label>
            <button type="button" className="text-xs font-bold text-[#3033a1] disabled:opacity-60" onClick={onForgotPassword} disabled={forgotLoading}>
              {forgotLoading ? "Sending..." : "Forgot password?"}
            </button>
          </div>

          {(inactiveReason || error) && (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold leading-4 text-red-600">
              {error ?? "Your teacher login is inactive. Please contact admin."}
            </div>
          )}

          <button
            disabled={loading}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#292b8d_0%,#4748a9_100%)] text-sm font-extrabold text-white shadow-[0_18px_34px_rgba(48,51,161,0.3)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Signing in..." : "Login"}
          </button>

        </form>

        <p className="mx-auto shrink-0 mt-2 max-w-sm rounded-2xl bg-white/75 px-3 py-2 text-center text-xs font-semibold leading-4 text-slate-500 shadow-sm">
          For GPS attendance marking, use the Sri Narayana mobile app in campus.
        </p>
      </div>
    </section>
  );
}

function LoginForm() {
  return (
    <main className="min-h-screen bg-[#F5F7FF] text-[#0F172A]">
      <div className="hidden lg:block">
        <DesktopLoginExperience />
      </div>
      <div className="lg:hidden">
        <MobileLoginExperience />
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}
