"use client";

import { auth, db, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import type { UserRole } from "@sri-narayana/shared";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ROLE_HINT_KEY = "erp-auth-role";
const ROLE_HINT_TTL = 10 * 60 * 1000; // 10 minutes

function readRoleHint(role: UserRole): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(ROLE_HINT_KEY);
    if (!raw) return false;
    const hint = JSON.parse(raw) as { role?: UserRole; at?: number };
    return hint.role === role && typeof hint.at === "number" && Date.now() - hint.at < ROLE_HINT_TTL;
  } catch {
    return false;
  }
}

export function AuthGate({ role, children }: { role: UserRole; children: React.ReactNode }) {
  // Start false so server and first client render match (avoids hydration
  // mismatch); the optimistic hint is applied in the effect below, before
  // Firebase resolves, so post-login navigation still feels instant.
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    // Optimistically render when the freshly-stored login hint matches this
    // role. Full validation still runs below and redirects if anything is wrong.
    if (readRoleHint(role)) setReady(true);

    if (!isFirebaseConfigured) {
      router.replace("/login");
      return;
    }

    const validateUser = async (user: typeof auth.currentUser) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const token = await user.getIdTokenResult();
      const actualRole = token.claims.role as UserRole | undefined;
      if (actualRole && actualRole !== role) {
        router.replace("/unauthorized");
        return;
      }
      if (!actualRole) {
        router.replace("/unauthorized");
        return;
      }

      if (role === "teacher") {
        const userSnapshot = await getDoc(doc(db, "users", user.uid));
        const userData = userSnapshot.exists() ? (userSnapshot.data() as { status?: string }) : undefined;
        if (userData?.status !== "active") {
          await signOut(auth);
          router.replace("/login?reason=inactive");
          return;
        }
      }

      if (!cancelled) setReady(true);
    };

    if (auth.currentUser) {
      void validateUser(auth.currentUser);
      return () => {
        cancelled = true;
      };
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void validateUser(user);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [role, router]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f7ff]">
        <div className="flex flex-col items-center gap-3">
          <span className="block h-9 w-9 animate-spin rounded-full border-[3px] border-emerald-100 border-t-emerald-600" />
          <span className="animate-fade-in text-sm font-medium text-stone-500">Loading secure workspace…</span>
        </div>
      </div>
    );
  }

  return children;
}
