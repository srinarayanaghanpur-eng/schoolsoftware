"use client";

import { useAutoLogout } from "@/hooks/useAutoLogout";

export function AutoLogoutProvider({ children }: { children: React.ReactNode }) {
  useAutoLogout();
  return <>{children}</>;
}
