import React from "react";
import { AppHeader, AppShell, type ShellTab } from "@/design-system/shell";

const TABS: ShellTab[] = [
  { href: "/driver", match: ["/driver", "/driver/index"], icon: "home", label: "Home" },
  { href: "/driver/route", match: ["/driver/route"], icon: "route", label: "Route" },
  { href: "/driver/profile", match: ["/driver/profile"], icon: "person", label: "Profile" }
];

export function DriverShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell tabs={TABS} header={<AppHeader subtitle="Driver" />}>
      {children}
    </AppShell>
  );
}
