"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function UnauthorizedPage() {
  const router = useRouter();
  const { signOutAndClear } = useAuth();

  async function backToLogin() {
    await signOutAndClear();
    router.replace("/login?loggedOut=1");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7f3] p-6">
      <div className="card max-w-md p-6 text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-stone-500">NarayanaOS</p>
        <h1 className="mt-2 text-2xl font-semibold">Unauthorized</h1>
        <p className="mt-2 text-sm text-stone-500">Your account does not have access to this area.</p>
        <button type="button" className="btn-primary mt-4" onClick={() => void backToLogin()}>
          Back to login
        </button>
        <p className="mt-5 text-xs font-medium text-stone-400">© 2026 Sri Narayana High School · Powered by NarayanaOS</p>
      </div>
    </main>
  );
}
